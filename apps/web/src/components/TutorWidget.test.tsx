import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const mockGetHistory = vi.fn();
const mockChatStream = vi.fn();
const mockClearHistory = vi.fn();

vi.mock('../api/tutor.api', () => ({
  chatStream: (...args: unknown[]) => mockChatStream(...args),
  getTutorHistory: () => mockGetHistory(),
  clearTutorHistory: () => mockClearHistory(),
}));

import TutorWidget from './TutorWidget';

function renderWidget(initialPath = '/dashboard') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <QueryClientProvider client={client}>
        <TutorWidget />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('TutorWidget', () => {
  it('en la página Dudas no aparece: el mismo hilo ya ocupa la pantalla', async () => {
    mockGetHistory.mockResolvedValue([]);
    renderWidget('/tutor');

    expect(screen.queryByRole('button', { name: /abrir tutor virtual/i })).not.toBeInTheDocument();
    // Sigue montada (no se pierde lo escrito), solo oculta
    expect(await screen.findByPlaceholderText(/escribe tu pregunta/i)).not.toBeVisible();
  });

  it('conserva el hilo escrito al cerrar y reabrir la burbuja', async () => {
    mockGetHistory.mockResolvedValue([]);
    renderWidget();

    await userEvent.click(screen.getByRole('button', { name: /abrir tutor virtual/i }));
    const textarea = await screen.findByPlaceholderText(/escribe tu pregunta/i);
    await userEvent.type(textarea, 'hola');
    expect(textarea).toHaveValue('hola');

    await userEvent.click(screen.getByRole('button', { name: /cerrar/i }));
    // El panel sigue en el DOM (TutorChat no se desmonta) pero oculto
    expect(textarea).not.toBeVisible();

    await userEvent.click(screen.getByRole('button', { name: /abrir tutor virtual/i }));
    const textareaAfterReopen = screen.getByPlaceholderText(/escribe tu pregunta/i);
    expect(textareaAfterReopen).toHaveValue('hola');
  });
});
