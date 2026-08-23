import axios from 'axios';
import { useAuthStore } from '../store/auth.store';

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

// Memoriza la promesa: /auth/refresh ROTA el token (revoca el usado), así que
// dos llamadas seguidas harían que la segunda viajase con un token ya revocado
// y cerrase la sesión. StrictMode monta dos veces en desarrollo, y sin esto el
// arreglo se convertiría en el bug que intenta corregir.
let started: Promise<void> | null = null;

/**
 * Recupera la sesión al arrancar la app.
 *
 * El access token no se persiste a propósito, así que tras recargar la página
 * solo queda el refresh token. Sin este arranque, las guardas de ruta miran un
 * access token que todavía es null y mandan al alumno a /login teniendo una
 * sesión perfectamente válida: cada F5, cada enlace guardado y cada pestaña
 * nueva lo echaban fuera.
 *
 * El interceptor de 401 de axios no cubre este caso porque nunca llega a
 * dispararse: la redirección ocurre antes de que se haga ninguna petición.
 */
export function bootstrapSession(): Promise<void> {
  if (started) return started;

  const { accessToken, refreshToken } = useAuthStore.getState();

  // Nada que recuperar: ni sesión viva ni token con el que pedirla
  if (accessToken || !refreshToken) {
    useAuthStore.getState().setSessionReady(true);
    started = Promise.resolve();
    return started;
  }

  started = axios
    .post(`${BASE_URL}/auth/refresh`, { refreshToken })
    .then(({ data }) => {
      useAuthStore.getState().setTokens(data);
    })
    .catch(() => {
      // Token caducado, revocado o API caída: sesión no recuperable
      useAuthStore.getState().logout();
    })
    .finally(() => {
      useAuthStore.getState().setSessionReady(true);
    });

  return started;
}
