/**
 * Utilidades compartidas por scripts/vkb-import.mjs y scripts/vkb-export.mjs:
 * lectura de credenciales, login y cliente HTTP autenticado.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

/**
 * Lee .env.scripts del directorio de trabajo y devuelve { apiUrl, email, password }.
 * Aborta el proceso si falta el fichero o alguna credencial.
 */
export function loadEnv() {
  const envPath = resolve(process.cwd(), '.env.scripts');
  if (!existsSync(envPath)) {
    console.error(
      '❌  No se encontró .env.scripts. Copia .env.scripts.example y rellena tus credenciales.',
    );
    process.exit(1);
  }

  const envVars = Object.fromEntries(
    readFileSync(envPath, 'utf8')
      .split('\n')
      .filter((l) => l.trim() && !l.startsWith('#'))
      .map((l) => l.split('=').map((s) => s.trim()))
      .filter(([k]) => k)
      .map(([k, ...v]) => [k, v.join('=').replace(/^["']|["']$/g, '')]),
  );

  const apiUrl = envVars.VKB_API_URL || 'http://localhost:3001/api';
  const email = envVars.VKB_ADMIN_EMAIL;
  const password = envVars.VKB_ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('❌  Faltan VKB_ADMIN_EMAIL o VKB_ADMIN_PASSWORD en .env.scripts.');
    process.exit(1);
  }

  return { apiUrl, email, password };
}

/**
 * Inicia sesión y devuelve un cliente ligado al token.
 * Aborta el proceso si el login falla.
 */
export async function login({ apiUrl, email, password }) {
  console.log(`🔐  Iniciando sesión como ${email} en ${apiUrl} ...`);

  // El endpoint acepta email o username en un único campo `identifier`
  const res = await fetch(`${apiUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: email, password }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error('❌  Login fallido:', err.message ?? res.statusText);
    process.exit(1);
  }

  const { accessToken } = await res.json();
  console.log('✅  Login correcto.');

  return createClient(apiUrl, accessToken);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Cliente HTTP autenticado. `get` lanza si la respuesta no es OK;
 * `post` devuelve { ok, status, body } para que quien llama decida.
 *
 * La API limita a 100 peticiones por minuto (ThrottlerModule), así que el
 * cliente espacia las llamadas y reintenta con espera creciente ante un 429.
 */
function createClient(apiUrl, accessToken, { minIntervalMs = 700, maxRetries = 5 } = {}) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };

  let nextSlot = 0;

  /** Espacia las peticiones para no agotar la ventana del throttler. */
  async function pace() {
    const now = Date.now();
    const wait = Math.max(0, nextSlot - now);
    nextSlot = Math.max(now, nextSlot) + minIntervalMs;
    if (wait > 0) await sleep(wait);
  }

  /** Ejecuta la petición reintentando mientras la API devuelva 429. */
  async function request(path, init) {
    for (let attempt = 0; ; attempt++) {
      await pace();
      const res = await fetch(`${apiUrl}${path}`, { ...init, headers });

      if (res.status !== 429 || attempt >= maxRetries) return res;

      // Respetamos Retry-After si viene; si no, esperamos la ventana entera
      const retryAfter = Number(res.headers.get('retry-after'));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 60_000;
      console.warn(
        `⏳  429 en ${path} — esperando ${Math.round(waitMs / 1000)}s (intento ${attempt + 1}/${maxRetries})`,
      );
      await sleep(waitMs);
    }
  }

  return {
    apiUrl,

    async get(path) {
      const res = await request(path, {});
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`GET ${path} → ${res.status}: ${err.message ?? res.statusText}`);
      }
      return res.json();
    },

    async post(path, payload) {
      const res = await request(path, { method: 'POST', body: JSON.stringify(payload) });
      const body = await res.json().catch(() => ({ message: res.statusText }));
      return { ok: res.ok, status: res.status, body };
    },
  };
}
