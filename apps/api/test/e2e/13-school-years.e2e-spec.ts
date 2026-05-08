import { createApp, closeApp, login, authGet, publicGet } from './setup';

describe('School Years — /school-years', () => {
  let studentToken: string;

  beforeAll(async () => {
    await createApp();
    const s = await login('student@vkbacademy.com');
    studentToken = s.accessToken;
  });

  afterAll(async () => {
    await closeApp();
  });

  // ─── GET /school-years ─────────────────────────────────────────────────────

  describe('GET /school-years', () => {
    it('usuario autenticado recibe 200 y un array no vacío', async () => {
      const res = await authGet('/school-years', studentToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('es público (no requiere token) para que el formulario de registro pueda poblarlo', async () => {
      const res = await publicGet('/school-years');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('cada item tiene id, name y label', async () => {
      const res = await authGet('/school-years', studentToken);

      expect(res.status).toBe(200);
      for (const item of res.body) {
        expect(item).toHaveProperty('id');
        expect(typeof item.id).toBe('string');
        expect(item).toHaveProperty('name');
        expect(typeof item.name).toBe('string');
        expect(item).toHaveProperty('label');
        expect(typeof item.label).toBe('string');
      }
    });

    it('los items están ordenados alfabéticamente por name (1bach → 4eso)', async () => {
      const res = await authGet('/school-years', studentToken);

      expect(res.status).toBe(200);

      const names: string[] = res.body.map((item: any) => item.name);
      const sorted = [...names].sort();

      expect(names).toEqual(sorted);

      // Los 6 niveles del seed deben estar presentes
      expect(names).toContain('1bach');
      expect(names).toContain('1eso');
      expect(names).toContain('2bach');
      expect(names).toContain('2eso');
      expect(names).toContain('3eso');
      expect(names).toContain('4eso');
    });
  });
});
