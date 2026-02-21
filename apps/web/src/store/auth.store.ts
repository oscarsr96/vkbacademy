import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@vkbacademy/shared';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  setTokens: (tokens: { accessToken: string; refreshToken: string }) => void;
  setUser: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setTokens: ({ accessToken, refreshToken }) => set({ accessToken, refreshToken }),
      setUser: (user) => set({ user }),
      logout: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    {
      name: 'vkb-auth',
      // Solo persiste el refresh token (el access token se renueva automáticamente)
      partialize: (state) => ({ refreshToken: state.refreshToken, user: state.user }),
    },
  ),
);
