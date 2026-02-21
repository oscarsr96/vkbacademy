import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { User } from '@vkbacademy/shared';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  isLoading: boolean;
  /** Carga tokens desde SecureStore al iniciar la app */
  hydrate: () => Promise<void>;
  setSession: (tokens: { accessToken: string; refreshToken: string }, user: User) => Promise<void>;
  clearSession: () => Promise<void>;
}

const KEYS = {
  access: 'vkb_access_token',
  refresh: 'vkb_refresh_token',
};

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  isLoading: true,

  hydrate: async () => {
    try {
      const [access, refresh] = await Promise.all([
        SecureStore.getItemAsync(KEYS.access),
        SecureStore.getItemAsync(KEYS.refresh),
      ]);
      set({ accessToken: access, refreshToken: refresh, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  setSession: async ({ accessToken, refreshToken }, user) => {
    await Promise.all([
      SecureStore.setItemAsync(KEYS.access, accessToken),
      SecureStore.setItemAsync(KEYS.refresh, refreshToken),
    ]);
    set({ accessToken, refreshToken, user });
  },

  clearSession: async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(KEYS.access),
      SecureStore.deleteItemAsync(KEYS.refresh),
    ]);
    set({ accessToken: null, refreshToken: null, user: null });
  },
}));
