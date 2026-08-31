import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

// ── Mocks ──

const mockMutate = vi.fn();

vi.mock('../hooks/useAuth', () => ({
  useRegisterStudents: () => ({
    mutate: mockMutate,
    isPending: false,
    error: null,
    data: undefined,
  }),
}));

vi.mock('../hooks/useCourses', () => ({
  useSchoolYears: () => ({ data: [{ id: 'sy1', name: '1eso', label: '1º ESO' }] }),
}));

vi.mock('../contexts/AcademyContext', () => ({
  useAcademyDomain: () => ({ academy: null }),
}));

import RegisterPage from './RegisterPage';

function renderPage() {
  return render(
    <MemoryRouter>
      <RegisterPage />
    </MemoryRouter>,
  );
}

/** Rellena lo mínimo para que el formulario pase su propia validación. */
async function rellenarFormularioMinimo() {
  await userEvent.type(screen.getByLabelText(/email del padre/i), 'padre@example.com');
  await userEvent.type(screen.getByLabelText(/nombre/i), 'Ana Pérez');
  await userEvent.selectOptions(screen.getByLabelText(/curso/i), 'sy1');
  await userEvent.type(screen.getByLabelText(/contraseña/i), 'clave12345');
}

// ── Tests ──

describe('RegisterPage — consentimiento del resumen semanal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dice para qué se va a usar el email del tutor', () => {
    renderPage();

    // Hoy el campo se pide sin declarar propósito, y la pantalla siguiente
    // llega a decir que no se envían correos. Si se va a escribir, hay que
    // decirlo antes de recoger la dirección.
    expect(screen.getByText(/lo usamos para poder mandarte/i)).toBeInTheDocument();
  });

  it('la casilla viene desmarcada', () => {
    renderPage();

    // Registrar a un hijo no es suscribirse: el consentimiento es un acto
    // aparte y tiene que costar un clic.
    expect(screen.getByLabelText(/quiero recibir/i)).not.toBeChecked();
  });

  it('no pide el resumen si no se marca la casilla', async () => {
    renderPage();
    await rellenarFormularioMinimo();

    await userEvent.click(screen.getByRole('button', { name: /crear/i }));

    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockMutate.mock.calls[0][0].guardianDigestConsent).toBe(false);
  });

  it('pide el resumen cuando se marca', async () => {
    renderPage();
    await rellenarFormularioMinimo();
    await userEvent.click(screen.getByLabelText(/quiero recibir/i));

    await userEvent.click(screen.getByRole('button', { name: /crear/i }));

    expect(mockMutate.mock.calls[0][0].guardianDigestConsent).toBe(true);
  });
});
