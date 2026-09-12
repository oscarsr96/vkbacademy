import { TutorChatPayload, TutorMessageDto } from '@vkbacademy/shared';
import { useAuthStore } from '../store/auth.store';
import api from '../lib/axios';

// ─── REST endpoints (axios) ───────────────────────────────────────────────────

export async function getTutorHistory(): Promise<TutorMessageDto[]> {
  const { data } = await api.get<TutorMessageDto[]>('/tutor/history');
  return data;
}

export async function clearTutorHistory(): Promise<void> {
  await api.delete('/tutor/history');
}

// ─── Streaming (fetch nativo — axios no soporta ReadableStream) ───────────────

/**
 * Siempre multipart, haya foto o no: un solo camino en el cliente. Los campos
 * vacíos no se mandan para que class-validator vea `undefined`, no `''`.
 */
export function chatStream(payload: TutorChatPayload, image?: Blob): Promise<Response> {
  const token = useAuthStore.getState().accessToken;
  const baseUrl = import.meta.env.VITE_API_URL ?? '/api';

  const form = new FormData();
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === 'string' && value.trim() !== '') form.append(key, value);
  }
  if (image) form.append('image', image, 'foto.jpg');

  return fetch(`${baseUrl}/tutor/chat`, {
    method: 'POST',
    // Sin Content-Type: el navegador pone multipart/form-data con su boundary.
    headers: { Authorization: `Bearer ${token ?? ''}` },
    body: form,
  });
}
