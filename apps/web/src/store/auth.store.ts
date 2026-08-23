import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Academy } from '@vkbacademy/shared';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  academy: Academy | null;
  /** false hasta que el arranque decide si hay sesion recuperable (ver session-bootstrap) */
  sessionReady: boolean;
  setSessionReady: (ready: boolean) => void;
  setTokens: (tokens: { accessToken: string; refreshToken: string }) => void;
  setUser: (user: User) => void;
  setAcademy: (academy: Academy | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      academy: null,
      sessionReady: false,
      setSessionReady: (sessionReady) => set({ sessionReady }),
      setTokens: ({ accessToken, refreshToken }) => set({ accessToken, refreshToken }),
      setUser: (user) => set({ user, academy: user.academy ?? null }),
      setAcademy: (academy) => set({ academy }),
      logout: () =>
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          academy: null,
          sessionReady: true,
        }),
    }),
    {
      name: 'vkb-auth',
      // Solo persiste el refresh token (el access token se renueva automáticamente)
      partialize: (state) => ({ refreshToken: state.refreshToken, user: state.user, academy: state.academy }),
    },
  ),
);
