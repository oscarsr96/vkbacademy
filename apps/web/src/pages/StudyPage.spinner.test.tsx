import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

// ── Mocks ──

const mockCreate = vi.fn();
vi.mock('../hooks/useStudyPlans', () => ({
  useMyStudyPlans: () => ({ data: [], isLoading: false }),
  useCreateStudyPlan: () => mockCreate(),
  useDeleteStudyPlan: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('../hooks/useCourses', () => ({
  useCourse: () => ({ data: undefined }),
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
