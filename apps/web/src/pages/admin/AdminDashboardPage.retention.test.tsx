import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ── Mocks ──

const mockGetRetention = vi.fn();

const EMPTY_ANALYTICS = {
  kpis: {
    newUsers: 0,
    newEnrollments: 0,
    completedLessons: 0,
    quizAttempts: 0,
    avgQuizScore: 0,
  },
  timeSeries: [],
  topCourses: [],
  topStudents: [],
  insights: { atRiskStudents: [], scoreDistribution: [], lowCompletionLessons: [] },
};

vi.mock('../../api/admin.api', () => ({
  adminApi: {
    getAnalytics: () => Promise.resolve(EMPTY_ANALYTICS),
    listSchoolYears: () => Promise.resolve([]),
    listCourses: () => Promise.resolve({ data: [], total: 0, page: 1, limit: 200, totalPages: 1 }),
    listCertificates: () =>
      Promise.resolve({
        data: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 1,
        stats: { byType: {} },
      }),
    getRetention: () => mockGetRetention(),
  },
}));

vi.mock('../../store/academy-filter.store', () => ({
  useAcademyFilterStore: (selector: (s: { selectedAcademyId: string | null }) => unknown) =>
    selector({ selectedAcademyId: null }),
}));

vi.mock('../../components/AcademyFilter', () => ({ default: () => null }));

import AdminDashboardPage from './AdminDashboardPage';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AdminDashboardPage />
    </QueryClientProvider>,
  );
}

// ── Tests ──

describe('AdminDashboardPage — retención por cohortes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pinta una fila por cohorte con sus porcentajes', async () => {
    mockGetRetention.mockResolvedValue({
      cohorts: [
        {
          week: '2026-W36',
          signups: 12,
          d1Opened: 58,
          d1Worked: 33,
          d7Opened: 75,
          d7Worked: 50,
          d1Complete: true,
          d7Complete: true,
        },
      ],
    });

    renderPage();

    const fila = within((await screen.findByText('2026-W36')).closest('tr')!);
    expect(fila.getByText('12')).toBeInTheDocument();
    expect(fila.getByText(/58%/)).toBeInTheDocument();
    expect(fila.getByText(/33% trabajó/)).toBeInTheDocument();
  });

  it('no inventa un porcentaje para la cohorte cuyo plazo no ha cerrado', async () => {
    mockGetRetention.mockResolvedValue({
      cohorts: [
        {
          week: '2026-W40',
          signups: 3,
          d1Opened: 66,
          d1Worked: 33,
          d7Opened: null,
          d7Worked: null,
          d1Complete: true,
          d7Complete: false,
        },
      ],
    });

    renderPage();

    // Un 0% que solo puede subir se lee como un mal dato, no como uno pendiente.
    const fila = within((await screen.findByText('2026-W40')).closest('tr')!);
    expect(fila.queryByText(/0%/)).not.toBeInTheDocument();
    expect(fila.getByText('—')).toBeInTheDocument();
  });

  it('dice que aún no hay nada que medir en vez de esconder la sección', async () => {
    mockGetRetention.mockResolvedValue({ cohorts: [] });

    renderPage();

    // Esconderla haría parecer que la métrica no existe; lo que no está en
    // pantalla no lo mira nadie, que es el problema que esto viene a resolver.
    expect(await screen.findByText('Todavía no hay altas de alumnos que medir.')).toBeInTheDocument();
  });
});
