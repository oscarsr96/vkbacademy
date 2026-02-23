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

export function chatStream(payload: TutorChatPayload): Promise<Response> {
  const token = useAuthStore.getState().accessToken;
  const baseUrl = import.meta.env.VITE_API_URL ?? '/api';

  return fetch(`${baseUrl}/tutor/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token ?? ''}`,
    },
    body: JSON.stringify(payload),
  });
}
