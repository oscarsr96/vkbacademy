import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockChatStream = vi.fn();
const mockGetHistory = vi.fn();
const mockClearHistory = vi.fn();
const mockDownscale = vi.fn();

vi.mock('../../api/tutor.api', () => ({
  chatStream: (...args: unknown[]) => mockChatStream(...args),
  getTutorHistory: () => mockGetHistory(),
  clearTutorHistory: () => mockClearHistory(),
}));
vi.mock('../../utils/downscaleImage', () => ({
  downscaleImage: (...args: unknown[]) => mockDownscale(...args),
}));

import TutorChat from './TutorChat';

function sseResponse(text: string): Response {
  return new Response(
    `data: ${JSON.stringify({ text })}\n\ndata: ${JSON.stringify({ done: true })}\n\n`,
    { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
  );
}

function renderChat() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TutorChat />
    </QueryClientProvider>,
  );
}

const photo = new File(['jpeg-bytes'], 'ejercicio.jpg', { type: 'image/jpeg' });
const smallBlob = new Blob(['small'], { type: 'image/jpeg' });

describe('TutorChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetHistory.mockResolvedValue([]);
    mockDownscale.mockResolvedValue(smallBlob);
    mockChatStream.mockResolvedValue(sseResponse('Veo una ecuación'));
    // jsdom no implementa createObjectURL; se añade sin tocar el resto de URL
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => vi.restoreAllMocks());

  it('sin texto ni foto no se puede enviar', async () => {
    renderChat();
    expect(await screen.findByRole('button', { name: /enviar/i })).toBeDisabled();
  });

  it('adjuntar muestra la miniatura y "quitar" la retira', async () => {
    renderChat();

    await userEvent.upload(screen.getByLabelText(/adjuntar foto/i), photo);

    expect(await screen.findByAltText(/foto adjunta/i)).toHaveAttribute('src', 'blob:preview');
    expect(mockDownscale).toHaveBeenCalledWith(photo);
    expect(screen.getByRole('button', { name: /enviar/i })).toBeEnabled();

    await userEvent.click(screen.getByRole('button', { name: /quitar foto/i }));

    expect(screen.queryByAltText(/foto adjunta/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enviar/i })).toBeDisabled();
  });

  it('desmontar con una foto pendiente libera su object URL', async () => {
    const { unmount } = renderChat();

    await userEvent.upload(screen.getByLabelText(/adjuntar foto/i), photo);
    await screen.findByAltText(/foto adjunta/i);

    unmount();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
  });

  it('enviar con foto manda la imagen reducida y pinta el chip en el hilo', async () => {
    renderChat();

    await userEvent.upload(screen.getByLabelText(/adjuntar foto/i), photo);
    await screen.findByAltText(/foto adjunta/i);
    await userEvent.type(screen.getByPlaceholderText(/escribe tu pregunta/i), '¿Qué es esto?');
    await userEvent.click(screen.getByRole('button', { name: /enviar/i }));

    await waitFor(() =>
      expect(mockChatStream).toHaveBeenCalledWith(
        expect.objectContaining({ message: '¿Qué es esto?' }),
        smallBlob,
      ),
    );
    expect(await screen.findByText(/foto adjunta/i)).toBeInTheDocument();
    expect(await screen.findByText('Veo una ecuación')).toBeInTheDocument();
    // La miniatura no sobrevive al envío
    expect(screen.queryByAltText(/foto adjunta/i)).not.toBeInTheDocument();
  });

  it('enviar solo texto no manda imagen', async () => {
    renderChat();

    await userEvent.type(screen.getByPlaceholderText(/escribe tu pregunta/i), 'Hola');
    await userEvent.click(screen.getByRole('button', { name: /enviar/i }));

    await waitFor(() =>
      expect(mockChatStream).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Hola' }),
        undefined,
      ),
    );
  });

  it('dos instancias bajo la misma caché comparten el hilo (burbuja + página Dudas)', async () => {
    // La caché de React Query es la fuente de verdad: enviar en una instancia
    // debe reflejarse en la otra sin recargar, tanto el mensaje del alumno
    // como la respuesta del tutor.
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <TutorChat />
        <TutorChat />
      </QueryClientProvider>,
    );

    const textareas = await screen.findAllByPlaceholderText(/escribe tu pregunta/i);
    expect(textareas).toHaveLength(2);

    await userEvent.type(textareas[0], 'Hola');
    const sendButtons = screen.getAllByRole('button', { name: /enviar/i });
    await userEvent.click(sendButtons[0]);

    expect(await screen.findAllByText('Hola')).toHaveLength(2);
    expect(await screen.findAllByText('Veo una ecuación')).toHaveLength(2);
  });

  it('un mensaje del historial con hasImage muestra el chip', async () => {
    mockGetHistory.mockResolvedValue([
      {
        id: 'm1',
        role: 'user',
        content: 'Mira esto',
        hasImage: true,
        createdAt: '2026-09-12T10:00:00Z',
      },
      {
        id: 'm2',
        role: 'assistant',
        content: 'Veo una fracción',
        hasImage: false,
        createdAt: '2026-09-12T10:00:05Z',
      },
    ]);

    renderChat();

    expect(await screen.findByText('Mira esto')).toBeInTheDocument();
    expect(screen.getByText(/foto adjunta/i)).toBeInTheDocument();
  });
});
