import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../store/auth.store', () => ({
  useAuthStore: { getState: () => ({ accessToken: 'tok-123' }) },
}));

import { chatStream } from './tutor.api';

describe('chatStream', () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(''));

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockClear();
  });

  afterEach(() => vi.unstubAllGlobals());

  function sentForm(): FormData {
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.body).toBeInstanceOf(FormData);
    return init.body as FormData;
  }

  it('manda FormData con el texto y el contexto, sin fijar Content-Type', async () => {
    await chatStream({ message: 'Hola', courseId: 'c1', schoolYear: '2º ESO' });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/tutor\/chat$/);
    expect(init.method).toBe('POST');
    // El navegador pone el boundary; fijarlo a mano rompe el multipart.
    expect(init.headers).toEqual({ Authorization: 'Bearer tok-123' });

    const form = sentForm();
    expect(form.get('message')).toBe('Hola');
    expect(form.get('courseId')).toBe('c1');
    expect(form.get('schoolYear')).toBe('2º ESO');
    expect(form.has('lessonId')).toBe(false);
    expect(form.has('image')).toBe(false);
  });

  it('adjunta la foto como campo image', async () => {
    const photo = new Blob(['jpeg'], { type: 'image/jpeg' });

    await chatStream({ message: '' }, photo);

    const form = sentForm();
    expect(form.has('message')).toBe(false);
    const sent = form.get('image');
    expect(sent).toBeInstanceOf(Blob);
    expect((sent as Blob).type).toBe('image/jpeg');
  });
});
