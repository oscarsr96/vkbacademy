import axios from 'axios';
import { useAuthStore } from '../store/auth.store';
import { useAcademyFilterStore } from '../store/academy-filter.store';

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Interceptor: adjuntar token de acceso y X-Academy-Id (SUPER_ADMIN)
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // SUPER_ADMIN: enviar academia seleccionada como header
  const selectedAcademyId = useAcademyFilterStore.getState().selectedAcademyId;
  if (selectedAcademyId) {
    config.headers['X-Academy-Id'] = selectedAcademyId;
  }

  return config;
});

// Interceptor: manejar 401 y refrescar token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = useAuthStore.getState().refreshToken;
      if (!refreshToken) {
        useAuthStore.getState().logout();
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
        useAuthStore.getState().setTokens(data);
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(originalRequest);
      } catch {
        useAuthStore.getState().logout();
      }
    }

    return Promise.reject(error);
  },
);

export default api;
