import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mockUnsubscribe = vi.fn();

vi.mock('../../api/guardians.api', () => ({
  guardiansApi: { unsubscribe: (...args: unknown[]) => mockUnsubscribe(...args) },
}));

import UnsubscribePage from './UnsubscribePage';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/baja/tok']}>
      <Routes>
        <Route path="/baja/:token" element={<UnsubscribePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('UnsubscribePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUnsubscribe.mockResolvedValue({ ok: true });
  });

  it('no da de baja solo por abrir la página', async () => {
    renderPage();

    // Los escáneres de los clientes de correo abren solos los enlaces de un
    // mensaje: si bastara con abrir, darían de baja a quien no lo ha pedido.
    await screen.findByRole('button', { name: /darme de baja/i });
    expect(mockUnsubscribe).not.toHaveBeenCalled();
  });

  it('da de baja al pulsar el botón', async () => {
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /darme de baja/i }));

    expect(mockUnsubscribe).toHaveBeenCalledWith('tok');
    expect(await screen.findByText(/no volverás a recibir/i)).toBeInTheDocument();
  });

  it('deja claro que las cuentas de los hijos no se tocan', async () => {
    renderPage();

    expect(screen.getByText(/no afecta a sus cuentas/i)).toBeInTheDocument();
  });
});
