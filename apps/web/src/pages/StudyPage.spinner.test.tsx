import userEvent from '@testing-library/user-event';
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

// ── Mocks ──

const mockCreate = vi.fn();
vi.mock('../hooks/useStudyPlans', () => ({
  useMyStudyPlans: () => ({ data: [], isLoading: false }),
  useCreateStudyPlan: () => mockCreate(),
  useDeleteStudyPlan: () => ({ mutate: vi.fn(), isPending: false }),
}));

const mockCourses = vi.fn(() => ({ data: undefined }));
vi.mock('../hooks/useCourses', () => ({
  useCourse: () => mockCourses(),
  useSubjects: () => ({ data: [] }),
}));

import StudyPage from './StudyPage';

function renderPage() {
  return render(
    <MemoryRouter>
      <StudyPage />
    </MemoryRouter>,
  );
}

// ── Tests ──

describe('StudyPage — botón de crear curso', () => {
  beforeEach(() => vi.clearAllMocks());

  it('dice qué está haciendo mientras genera, no solo un spinner', () => {
    mockCreate.mockReturnValue({ mutate: vi.fn(), isPending: true, isError: false });

    renderPage();

    // La generación con IA tarda: un spinner mudo no dice si sigue viva
    expect(screen.getByText('Creando curso…')).toBeInTheDocument();
  });

  it('vuelve al texto normal cuando no está generando', () => {
    mockCreate.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false });

    renderPage();

    expect(screen.getByText('Crear curso de estudio')).toBeInTheDocument();
    expect(screen.queryByText('Creando curso…')).not.toBeInTheDocument();
  });
});

describe('StudyPage — asignatura fuera del listado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false });
  });

  it('ofrece escribir la asignatura cuando no está en el desplegable', async () => {
    renderPage();

    const selector = screen.getByLabelText('Asignatura');
    expect(within(selector).getByText('Otra asignatura (la escribo yo)')).toBeInTheDocument();

    // El campo de texto solo aparece al elegir esa opción
    expect(screen.queryByLabelText('¿Qué asignatura?')).not.toBeInTheDocument();
    await userEvent.selectOptions(selector, '__other__');
    expect(screen.getByLabelText('¿Qué asignatura?')).toBeInTheDocument();
  });

  it('avisa de que no hay temario oficial y no lo intenta cargar', async () => {
    renderPage();

    await userEvent.selectOptions(screen.getByLabelText('Asignatura'), '__other__');

    expect(screen.getByText(/No hay temario oficial/)).toBeInTheDocument();
    expect(screen.queryByText('Temario oficial')).not.toBeInTheDocument();
  });

  it('envía subject en vez de courseId al crear', async () => {
    const mutate = vi.fn();
    mockCreate.mockReturnValue({ mutate, isPending: false, isError: false });

    renderPage();
    await userEvent.selectOptions(screen.getByLabelText('Asignatura'), '__other__');
    await userEvent.type(screen.getByLabelText('¿Qué asignatura?'), 'Química');

    // Un tema propio, que es la única vía sin temario oficial
    await userEvent.type(screen.getByLabelText('Tema'), 'El enlace covalente');
    await userEvent.click(screen.getByRole('button', { name: /Añadir$/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Crear curso de estudio' }));

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Química',
        topics: [{ title: 'El enlace covalente' }],
      }),
      expect.anything(),
    );
    expect(mutate.mock.calls[0][0]).not.toHaveProperty('courseId');
  });
});
