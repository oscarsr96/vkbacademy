import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Role } from '@vkbacademy/shared';

// ── Mocks ──

const mockGetUsers = vi.fn();
const mockUpdateUser = vi.fn();
const SCHOOL_YEARS = [
  { id: 'sy-1eso', name: '1eso', label: '1º ESO' },
  { id: 'sy-2eso', name: '2eso', label: '2º ESO' },
];
vi.mock('../../api/admin.api', () => ({
  adminApi: {
    getUsers: (...args: unknown[]) => mockGetUsers(...args),
    listSchoolYears: () => Promise.resolve(SCHOOL_YEARS),
    updateRole: vi.fn(),
    createUser: vi.fn(),
    updateUser: (...args: unknown[]) => mockUpdateUser(...args),
    deleteUser: vi.fn(),
    resetUserPassword: vi.fn(),
  },
}));

vi.mock('../../store/academy-filter.store', () => ({
  useAcademyFilterStore: (selector: (s: { selectedAcademyId: string | null }) => unknown) =>
    selector({ selectedAcademyId: null }),
}));

vi.mock('../../components/AcademyFilter', () => ({ default: () => null }));

import AdminUsersPage from './AdminUsersPage';

// ── Fixtures ──

const student = (over: Partial<Record<string, unknown>> & { id: string; name: string }) => ({
  email: null,
  username: over.id,
  guardianEmail: null,
  role: Role.STUDENT,
  avatarUrl: null,
  createdAt: '2026-08-01T10:00:00.000Z',
  totalPoints: 0,
  currentDailyStreak: 0,
  longestDailyStreak: 0,
  currentStreak: 0,
  aiCost: { courseUsd: 0, examUsd: 0, chatbotUsd: 0, totalUsd: 0, totalTokens: 0 },
  ...over,
});

const USERS = [
  student({ id: 'u1', name: 'Ana', currentDailyStreak: 12, totalPoints: 340, longestDailyStreak: 18 }),
  student({ id: 'u2', name: 'Bruno', currentDailyStreak: 3, totalPoints: 900 }),
  {
    id: 'u3',
    name: 'Admin Club',
    email: 'admin@vkb.es',
    username: null,
    guardianEmail: null,
    role: Role.ADMIN,
    avatarUrl: null,
    createdAt: '2026-07-01T10:00:00.000Z',
    totalPoints: 0,
    currentDailyStreak: 0,
    longestDailyStreak: 0,
    currentStreak: 0,
    aiCost: { courseUsd: 0, examUsd: 0, chatbotUsd: 0, totalUsd: 0, totalTokens: 0 },
  },
];

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AdminUsersPage />
    </QueryClientProvider>,
  );
}

/** Nombres de las filas de la tabla, en el orden en que se pintan. */
function rowNames(): string[] {
  const rows = screen.getAllByRole('row').slice(1); // la primera es la cabecera
  // La celda de usuario lleva el avatar (con iniciales) y el nombre en un span
  return rows.map((r) => within(r).getAllByRole('cell')[0].querySelector('span')?.textContent ?? '');
}

// ── Tests ──

describe('AdminUsersPage — columna de actividad', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUsers.mockResolvedValue({ data: USERS, total: USERS.length, page: 1, limit: 1000, totalPages: 1 });
  });

  it('muestra racha diaria y puntos del alumno en formato compacto', async () => {
    renderPage();

    const fila = within(await screen.findByText('Ana').then((el) => el.closest('tr')!));
    expect(fila.getByText('🔥 12d')).toBeInTheDocument();
    expect(fila.getByText('340 pts')).toBeInTheDocument();
  });

  it('no pinta actividad para quien no es alumno', async () => {
    renderPage();

    const fila = within((await screen.findByText('Admin Club')).closest('tr')!);
    expect(fila.queryByText(/🔥/)).not.toBeInTheDocument();
    // Dos guiones: sin actividad y sin consumo de IA
    expect(fila.getAllByText('—')).toHaveLength(2);
  });

  it('ordena por racha, no por puntos, cuando se elige Racha', async () => {
    renderPage();
    await screen.findByText('Ana');

    // Bruno tiene más puntos (900) pero menos racha (3d) que Ana (340 / 12d):
    // ordenar por racha tiene que ponerlo por detrás.
    await userEvent.selectOptions(screen.getByLabelText('Ordenar por'), 'racha');

    expect(rowNames()).toEqual(['Ana', 'Bruno', 'Admin Club']);
  });

  it('ordena por puntos cuando se elige Puntos', async () => {
    renderPage();
    await screen.findByText('Ana');

    await userEvent.selectOptions(screen.getByLabelText('Ordenar por'), 'puntos');

    expect(rowNames()).toEqual(['Bruno', 'Ana', 'Admin Club']);
  });
});

describe('AdminUsersPage — columna de coste de IA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra el importe y los tokens de quien ha consumido', async () => {
    mockGetUsers.mockResolvedValue({
      data: [
        student({
          id: 'u1',
          name: 'Ana',
          aiCost: { courseUsd: 1.5, examUsd: 0.5, chatbotUsd: 0, totalUsd: 2, totalTokens: 12345 },
        }),
      ],
      total: 1,
      page: 1,
      limit: 1000,
      totalPages: 1,
    });

    renderPage();

    const fila = within((await screen.findByText('Ana')).closest('tr')!);
    expect(fila.getByText('$2.00')).toBeInTheDocument();
    // Los tokens acompañan al importe: con Gemini gratis casi todo sale a 0 $
    expect(fila.getByText('12.345 tok')).toBeInTheDocument();
  });

  it('usa más decimales cuando el importe es minúsculo, en vez de mostrar $0.00', async () => {
    mockGetUsers.mockResolvedValue({
      data: [
        student({
          id: 'u1',
          name: 'Ana',
          aiCost: { courseUsd: 0.0004, examUsd: 0, chatbotUsd: 0, totalUsd: 0.0004, totalTokens: 900 },
        }),
      ],
      total: 1,
      page: 1,
      limit: 1000,
      totalPages: 1,
    });

    renderPage();

    const fila = within((await screen.findByText('Ana')).closest('tr')!);
    expect(fila.getByText('$0.0004')).toBeInTheDocument();
  });

  it('no revienta si la API todavía no envía aiCost (despliegue a medias)', async () => {
    const sinCoste = student({ id: 'u1', name: 'Ana' });
    delete (sinCoste as { aiCost?: unknown }).aiCost;
    mockGetUsers.mockResolvedValue({
      data: [sinCoste],
      total: 1,
      page: 1,
      limit: 1000,
      totalPages: 1,
    });

    renderPage();

    expect(await screen.findByText('Ana')).toBeInTheDocument();
  });

  it('ordena por coste cuando se elige Coste IA', async () => {
    mockGetUsers.mockResolvedValue({
      data: [
        student({ id: 'u1', name: 'Barata', aiCost: { courseUsd: 0.1, examUsd: 0, chatbotUsd: 0, totalUsd: 0.1, totalTokens: 100 } }),
        student({ id: 'u2', name: 'Cara', aiCost: { courseUsd: 5, examUsd: 0, chatbotUsd: 0, totalUsd: 5, totalTokens: 900 } }),
      ],
      total: 2,
      page: 1,
      limit: 1000,
      totalPages: 1,
    });

    renderPage();
    await screen.findByText('Barata');

    await userEvent.selectOptions(screen.getByLabelText('Ordenar por'), 'coste');

    expect(rowNames()).toEqual(['Cara', 'Barata']);
  });
});

describe('AdminUsersPage — edición de un alumno', () => {
  const ANA = student({
    id: 'u1',
    name: 'Ana',
    email: 'ana@vkbacademy.es',
    schoolYearId: 'sy-2eso',
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUsers.mockResolvedValue({ data: [ANA], total: 1, page: 1, limit: 1000, totalPages: 1 });
    mockUpdateUser.mockResolvedValue({ ...ANA, name: 'Ana Ruiz' });
  });

  async function abrirEdicionDeAna() {
    const fila = (await screen.findByText('Ana')).closest('tr')!;
    await userEvent.click(within(fila).getByTitle('Editar'));
    return await screen.findByLabelText('Nivel educativo');
  }

  it('parte del nivel que ya tiene el alumno, no de "Sin asignar"', async () => {
    renderPage();

    const nivel = await abrirEdicionDeAna();

    expect(nivel).toHaveValue('sy-2eso');
  });

  it('cambiar solo el nombre no toca el nivel educativo', async () => {
    renderPage();
    await abrirEdicionDeAna();

    const nombre = screen.getByLabelText('Nombre');
    await userEvent.clear(nombre);
    await userEvent.type(nombre, 'Ana Ruiz');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    // Enviar schoolYearId aquí es lo que le borraba el nivel al alumno —y con
    // él el acceso a sus cursos— al corregirle una errata en el nombre.
    expect(mockUpdateUser).toHaveBeenCalledTimes(1);
    const [userId, payload] = mockUpdateUser.mock.calls[0] as [string, Record<string, unknown>];
    expect(userId).toBe('u1');
    expect(payload).toEqual({ name: 'Ana Ruiz' });
  });

  it('sí envía el nivel cuando es lo que se ha cambiado', async () => {
    renderPage();
    const nivel = await abrirEdicionDeAna();

    await userEvent.selectOptions(nivel, 'sy-1eso');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    const [, payload] = mockUpdateUser.mock.calls[0] as [string, Record<string, unknown>];
    expect(payload).toEqual({ schoolYearId: 'sy-1eso' });
  });
});
