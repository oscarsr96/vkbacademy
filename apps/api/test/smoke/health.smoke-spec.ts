/**
 * Smoke tests — se ejecutan contra un entorno desplegado (PRE o PROD) para
 * verificar que los servicios están vivos tras un despliegue.
 *
 * Variables de entorno requeridas:
 *   SMOKE_API_URL  → URL base de la API (ej: https://api-pre.up.railway.app)
 *   SMOKE_WEB_URL  → URL base del frontend (ej: https://pre.vkbacademy.vercel.app)
 *
 * Estos tests NO arrancan Nest ni la BD: hacen peticiones HTTP reales y
 * validan las respuestas. Deben ser rápidos (< 30s en total) y no mutar datos.
 */

const API_URL = process.env.SMOKE_API_URL;
const WEB_URL = process.env.SMOKE_WEB_URL;

// Helper: fetch con timeout para no colgar el pipeline si el servicio no responde
async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  ms = 10000,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

describe('Smoke — entorno desplegado', () => {
  beforeAll(() => {
    if (!API_URL) {
      throw new Error('SMOKE_API_URL no está definida');
    }
    if (!WEB_URL) {
      throw new Error('SMOKE_WEB_URL no está definida');
    }
  });

  describe('API', () => {
    it('GET /api/health responde 200 con status=ok', async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/health`);
      expect(res.status).toBe(200);

      const body = (await res.json()) as {
        status: string;
        timestamp: string;
        uptime: number;
      };
      expect(body.status).toBe('ok');
      expect(typeof body.timestamp).toBe('string');
      expect(typeof body.uptime).toBe('number');
    });

    it('GET /api/courses sin token responde 401 (guard activo)', async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/courses`);
      expect(res.status).toBe(401);
    });

    it('POST /api/auth/login con credenciales inválidas responde 401', async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: 'smoke-nonexistent@vkbacademy.test',
          password: 'wrong-password',
        }),
      });
      expect(res.status).toBe(401);
    });

    it('GET /api/academies/by-slug/vallekas-basket responde 200 (endpoint público)', async () => {
      const res = await fetchWithTimeout(`${API_URL}/api/academies/by-slug/vallekas-basket`);
      // 200 si el seed está cargado, 404 si la BD está vacía — ambos indican que la API
      // está procesando la ruta correctamente (no un 5xx ni un cuelgue)
      expect([200, 404]).toContain(res.status);
    });
  });

  describe('Web', () => {
    it('GET / devuelve HTML del SPA', async () => {
      const res = await fetchWithTimeout(`${WEB_URL}/`);
      expect(res.status).toBe(200);

      const contentType = res.headers.get('content-type') ?? '';
      expect(contentType).toContain('text/html');

      const html = await res.text();
      // El index.html del SPA debe incluir el div root y el bundle de Vite
      expect(html).toMatch(/<div id="root"/);
      expect(html).toMatch(/<script[^>]+type="module"/);
    });

    it('GET /ruta-inexistente devuelve index.html (SPA rewrite)', async () => {
      const res = await fetchWithTimeout(`${WEB_URL}/ruta-que-no-existe-smoke`);
      // El rewrite de Vercel hace que cualquier ruta devuelva index.html con 200
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toMatch(/<div id="root"/);
    });
  });
});
