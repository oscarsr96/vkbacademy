import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockForgot = vi.fn();
vi.mock('../api/auth.api', () => ({
  authApi: { forgotPassword: (...args: unknown[]) => mockForgot(...args) },
}));

import ForgotPasswordPage from './ForgotPasswordPage';

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ForgotPasswordPage (#147)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockForgot.mockResolvedValue({ message: 'ok' });
  });

  it('pide email o nombre de usuario y explica que a los alumnos les llega al email de su familia', () => {
    renderPage();

    expect(screen.getByLabelText(/email o nombre de usuario/i)).toBeInTheDocument();
    expect(screen.getByText(/email de tu padre o madre/i)).toBeInTheDocument();
  });

  it('envía el identificador tal cual (un username no es un email)', async () => {
    renderPage();

    await userEvent.type(screen.getByLabelText(/email o nombre de usuario/i), 'alvaro-garcia');
    await userEvent.click(screen.getByRole('button', { name: /enviar enlace/i }));

    expect(mockForgot).toHaveBeenCalledWith('alvaro-garcia');
    // La confirmación no presupone que el correo vaya al propio alumno
    expect(await screen.findByText(/el tuyo o el de tu familia/i)).toBeInTheDocument();
  });
});
