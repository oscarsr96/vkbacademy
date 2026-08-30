import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ── Mocks ──

const mockSummary = vi.fn();
vi.mock('../hooks/useChallenges', () => ({
  useChallengeSummary: () => mockSummary(),
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
  beforeEach(() => vi.clearAllMocks());

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
