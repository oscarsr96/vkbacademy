import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ── Mocks ──

const mockSummary = vi.fn();
const mockRedemptions = vi.fn();
vi.mock('../hooks/useChallenges', () => ({
  useChallengeSummary: () => mockSummary(),
  useMyRedemptions: () => mockRedemptions(),
  useRedeemItem: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('../hooks/usePageZone', () => ({ usePageZone: () => undefined }));

import ShopPage from './ShopPage';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ShopPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ── Tests ──

describe('ShopPage — artículos que aún no se pueden canjear', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedemptions.mockReturnValue({ data: { redemptions: [], totalSpent: 0 } });
  });

  it('dice cuánto falta en vez de "Sin puntos"', () => {
    mockSummary.mockReturnValue({ data: { totalPoints: 60 } });

    const { container } = renderPage();

    // Stickers cuestan 100: faltan 40. Balón cuesta 1000: faltan 940.
    expect(screen.getByText('Te faltan 40 pts')).toBeInTheDocument();
    expect(screen.getByText('Te faltan 940 pts')).toBeInTheDocument();
    expect(container.textContent).not.toContain('Sin puntos');
  });

  it('el alumno recién llegado ve el precio como distancia, no como puerta cerrada', () => {
    mockSummary.mockReturnValue({ data: { totalPoints: 0 } });

    const { container } = renderPage();

    expect(screen.getByText('Te faltan 100 pts')).toBeInTheDocument();
    expect(container.textContent).not.toContain('Sin puntos');
  });

  it('mantiene Canjear en lo que sí alcanza', () => {
    mockSummary.mockReturnValue({ data: { totalPoints: 250 } });

    renderPage();

    // Stickers (100) y botella (200) sí; gorra (350) no
    expect(screen.getAllByRole('button', { name: 'Canjear' })).toHaveLength(2);
    expect(screen.getByText('Te faltan 100 pts')).toBeInTheDocument();
  });
});

describe('ShopPage — histórico de canjes', () => {
  const canje = (over: Record<string, unknown>) => ({
    id: 'r1',
    itemName: 'Camiseta oficial del club',
    cost: 500,
    redeemedAt: '2026-08-20T10:00:00.000Z',
    delivered: false,
    deliveredAt: null,
    ...over,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockSummary.mockReturnValue({ data: { totalPoints: 60 } });
  });

  it('lista lo canjeado con puntos y fecha', () => {
    mockRedemptions.mockReturnValue({
      data: { redemptions: [canje({})], totalSpent: 500 },
    });

    renderPage();

    expect(screen.getByText('Mis canjes')).toBeInTheDocument();
    // Acotado a la tabla: el nombre y el precio también salen en la tarjeta
    // del artículo, arriba en el catálogo
    const tabla = within(screen.getByRole('table'));
    expect(tabla.getByText('Camiseta oficial del club')).toBeInTheDocument();
    expect(tabla.getByText('500 pts')).toBeInTheDocument();
    expect(tabla.getByText('20 ago 2026')).toBeInTheDocument();
  });

  it('distingue lo entregado de lo que sigue pendiente', () => {
    mockRedemptions.mockReturnValue({
      data: {
        redemptions: [
          canje({ id: 'r1', itemName: 'Gorra oficial VKB', cost: 350, delivered: true, deliveredAt: '2026-08-22T10:00:00.000Z' }),
          canje({ id: 'r2', itemName: 'Pack de stickers VKB', cost: 100 }),
        ],
        totalSpent: 450,
      },
    });

    renderPage();

    // Son artículos físicos: saber si ya lo tienes importa tanto como la fecha
    expect(screen.getByText(/Entregado · 22 ago 2026/)).toBeInTheDocument();
    expect(screen.getByText('Pendiente de entrega')).toBeInTheDocument();
  });

  it('resume cuánto se ha canjeado en total', () => {
    mockRedemptions.mockReturnValue({
      data: { redemptions: [canje({}), canje({ id: 'r2', cost: 100 })], totalSpent: 600 },
    });

    renderPage();

    expect(screen.getByText('600 pts canjeados en 2 artículos')).toBeInTheDocument();
  });

  it('sin canjes explica dónde aparecerán, en vez de una tabla vacía', () => {
    mockRedemptions.mockReturnValue({ data: { redemptions: [], totalSpent: 0 } });

    renderPage();

    expect(screen.getByText(/Aún no has canjeado nada/)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
