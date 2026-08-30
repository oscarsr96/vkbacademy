import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Role } from '@vkbacademy/shared';
import type { ChallengeSummary } from '../api/challenges.api';

// ── Mocks ──

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockSummary = vi.fn();
vi.mock('../hooks/useChallenges', () => ({
  useChallengeSummary: () => mockSummary(),
  useMyChallenges: () => ({ data: undefined, isLoading: false, isError: false }),
}));

vi.mock('../hooks/usePageZone', () => ({ usePageZone: () => undefined }));

vi.mock('../store/auth.store', () => ({
  useAuthStore: (selector: (s: { user: unknown }) => unknown) =>
    selector({
      user: { id: 'u1', name: 'Juan García', role: Role.STUDENT, schoolYearId: 'sy1' },
    }),
}));

import DashboardPage from './DashboardPage';

// ── Fixtures ──

const summary = (over: Partial<ChallengeSummary>): { data: ChallengeSummary } => ({
  data: {
    totalPoints: 120,
    currentStreak: 2,
    longestStreak: 4,
    currentDailyStreak: 12,
    longestDailyStreak: 18,
    activeToday: false,
    completedCount: 3,
    recentBadges: [],
    ...over,
  },
});

function renderPage() {
  // La página tiene más consultas que las mockeadas (cursos, progreso):
  // el provider las deja resolver en vacío sin romper el render.
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ── Tests ──

describe('DashboardPage — racha diaria', () => {
  beforeEach(() => vi.clearAllMocks());

  it('dice qué se juega hoy cuando el día aún no cuenta, con acción para hacerlo', async () => {
    mockSummary.mockReturnValue(summary({ currentDailyStreak: 12, activeToday: false }));

    renderPage();

    expect(screen.getByText('12 días seguidos')).toBeInTheDocument();
    expect(screen.getByText(/Hoy todavía no cuenta/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Seguir hoy' }));
    expect(mockNavigate).toHaveBeenCalledWith('/study');
  });

  it('cierra el día sin pedir nada más cuando hoy ya cuenta', () => {
    mockSummary.mockReturnValue(summary({ currentDailyStreak: 12, activeToday: true }));

    renderPage();

    expect(screen.getByText(/Hoy ya cuenta/)).toBeInTheDocument();
    // Nada que hacer hoy: no se le empuja a seguir estudiando
    expect(screen.queryByRole('button', { name: 'Seguir hoy' })).not.toBeInTheDocument();
  });

  it('invita a empezar si no hay racha, sin hablar de nada perdido', () => {
    mockSummary.mockReturnValue(
      summary({ currentDailyStreak: 0, longestDailyStreak: 0, activeToday: false }),
    );

    const { container } = renderPage();

    expect(screen.getByText('Empieza hoy tu racha')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Empezar' })).toBeInTheDocument();
    // El tono es de invitación: nada de "vas a perder" ni "llevas X días sin"
    expect(container.textContent).not.toMatch(/perder|perderás|sin entrar|fallaste/i);
  });

  it('usa el singular con un solo día', () => {
    mockSummary.mockReturnValue(summary({ currentDailyStreak: 1, activeToday: true }));

    renderPage();

    expect(screen.getByText('1 día seguido')).toBeInTheDocument();
  });
});
