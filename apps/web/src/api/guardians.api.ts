import api from '../lib/axios';

export const guardiansApi = {
  /** Baja del resumen semanal. Público: el padre o la madre no tiene cuenta. */
  unsubscribe: (token: string) =>
    api.post<{ ok: true }>(`/guardians/unsubscribe/${token}`).then((r) => r.data),
};
