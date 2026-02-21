import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/api';

const KEYS = { access: 'vkb_access_token', refresh: 'vkb_refresh_token' };

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Adjuntar access token en cada request
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(KEYS.access);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Renovar token automáticamente en 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken = await SecureStore.getItemAsync(KEYS.refresh);
      if (!refreshToken) return Promise.reject(error);

      try {
        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        await SecureStore.setItemAsync(KEYS.access, data.accessToken);
        await SecureStore.setItemAsync(KEYS.refresh, data.refreshToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch {
        await SecureStore.deleteItemAsync(KEYS.access);
        await SecureStore.deleteItemAsync(KEYS.refresh);
      }
    }
    return Promise.reject(error);
  },
);

export default api;
