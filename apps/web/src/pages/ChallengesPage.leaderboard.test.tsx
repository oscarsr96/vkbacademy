import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { LeaderboardEntry } from '../api/challenges.api';

// ── Mocks ──

const mockLeaderboard = vi.fn();
const mockMyChallenges = vi.fn();

vi.mock('../hooks/useChallenges', () => ({
  useLeaderboard: () => mockLeaderboard(),
  useMyChallenges: () => mockMyChallenges(),
}));

vi.mock('../hooks/usePageZone', () => ({ usePageZone: () => undefined }));

import ChallengesPage from './ChallengesPage';

// ── Fixtures ──

const entry = (name: string, points: number, isMe = false): LeaderboardEntry => ({
  userId: `u-${name}`,
  name,
  avatarUrl: null,
  points,
  isMe,
});

const PROGRESO = {
  meta: {
    totalPoints: 120,
    currentStreak: 1,
    longestStreak: 2,
    currentDailyStreak: 3,
    longestDailyStreak: 5,
  },
  challenges: [],
};

function renderPage() {
  return render(
    <MemoryRouter>
      <ChallengesPage />
    </MemoryRouter>,
  );
}

// ── Tests ──

describe('ChallengesPage — franja semanal del grupo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMyChallenges.mockReturnValue({ data: PROGRESO, isLoading: false, isError: false });
  });

  it('pinta al alumno y a sus vecinos, con el alumno como "Tú"', () => {
    mockLeaderboard.mockReturnValue({
      data: {
        weekStart: '2026-08-24T22:00:00.000Z',
        entries: [entry('Marta', 180), entry('Ana', 150), entry('Yo', 120, true), entry('Bruno', 110)],
      },
    });

    renderPage();

    expect(screen.getByText('Tu grupo esta semana')).toBeInTheDocument();
    expect(screen.getByText('Marta')).toBeInTheDocument();
    expect(screen.getByText('Tú')).toBeInTheDocument();
    expect(screen.getByText('120 pts')).toBeInTheDocument();
    // El nombre propio no se repite: la fila del alumno dice "Tú"
    expect(screen.queryByText('Yo')).not.toBeInTheDocument();
  });

  it('no muestra puestos ni cuánta gente hay en el grupo', () => {
    mockLeaderboard.mockReturnValue({
      data: {
        weekStart: '2026-08-24T22:00:00.000Z',
        entries: [entry('Bruno', 110), entry('Iker', 90), entry('Yo', 0, true)],
      },
    });

    const { container } = renderPage();

    // Ni "3º", ni "de 12": el último no puede deducir que va el último
    expect(container.textContent).not.toMatch(/\bde \d+\b/);
    expect(container.textContent).not.toMatch(/[1-9]\d*[ºª°]/);
  });

  it('oculta el bloque si el alumno no tiene con quién compararse', () => {
    mockLeaderboard.mockReturnValue({
      data: { weekStart: '2026-08-24T22:00:00.000Z', entries: [entry('Yo', 120, true)] },
    });

    renderPage();

    expect(screen.queryByText('Tu grupo esta semana')).not.toBeInTheDocument();
  });

  it('no rompe la página mientras la clasificación aún no ha cargado', () => {
    mockLeaderboard.mockReturnValue({ data: undefined });

    renderPage();

    expect(screen.queryByText('Tu grupo esta semana')).not.toBeInTheDocument();
    expect(screen.getByText('Mis Retos')).toBeInTheDocument();
  });
});
