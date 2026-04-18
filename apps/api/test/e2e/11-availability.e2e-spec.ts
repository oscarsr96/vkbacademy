import {
  createApp,
  closeApp,
  login,
  authGet,
  authPost,
  authDelete,
  publicGet,
  getPrisma,
} from './setup';

describe('Availability — /teachers & /availability', () => {
  let teacherToken: string;
  let studentToken: string;
  let adminToken: string;

  let teacherProfileId: string;

  // ID del slot creado en el test de POST, reutilizado en DELETE y duplicado
  let createdSlotId: string;

  beforeAll(async () => {
    await createApp();

    const [t, s, a] = await Promise.all([
      login('teacher@vkbacademy.com'),
      login('student@vkbacademy.com'),
      login('admin@vkbacademy.com'),
    ]);

    teacherToken = t.accessToken;
    studentToken = s.accessToken;
    adminToken = a.accessToken;

    // Resolver el perfil del teacher desde la BD
    const prisma = getPrisma();
    const profile = await prisma.teacherProfile.findFirst({
      where: { user: { email: 'teacher@vkbacademy.com' } },
    });
    if (!profile) throw new Error('Perfil de teacher no encontrado. Ejecuta el seed.');
    teacherProfileId = profile.id;
  });

  afterAll(async () => {
    await closeApp();
  });

  // ─── GET /teachers ─────────────────────────────────────────────────────────

  describe('GET /teachers', () => {
    it('usuario autenticado recibe lista con al menos 1 teacher', async () => {
      const res = await authGet('/teachers', teacherToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);

      // Cada entrada incluye perfil + usuario + disponibilidad
      const first = res.body[0];
      expect(first).toHaveProperty('id');
      expect(first).toHaveProperty('user');
      expect(first).toHaveProperty('availability');
      expect(Array.isArray(first.availability)).toBe(true);
    });

    it('devuelve 401 sin token de autenticación', async () => {
      const res = await publicGet('/teachers');
      expect(res.status).toBe(401);
    });
  });

  // ─── GET /teachers/:teacherId/slots ────────────────────────────────────────

  describe('GET /teachers/:teacherId/slots', () => {
    it('devuelve 200 y un array de slots libres con from/to válidos', async () => {
      const from = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();      // mañana
      const to = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();   // +30 días

      const res = await authGet(
        `/teachers/${teacherProfileId}/slots?from=${from}&to=${to}`,
        teacherToken,
      );

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Cada slot libre tiene teacherId, startAt, endAt
      for (const slot of res.body) {
        expect(slot).toHaveProperty('teacherId');
        expect(slot).toHaveProperty('startAt');
        expect(slot).toHaveProperty('endAt');
      }
    });
  });

  // ─── GET /availability/mine ────────────────────────────────────────────────

  describe('GET /availability/mine', () => {
    it('devuelve 401 sin token de autenticación', async () => {
      const res = await publicGet('/availability/mine');
      expect(res.status).toBe(401);
    });

    it('TEACHER recibe 200 y un array de sus slots', async () => {
      const res = await authGet('/availability/mine', teacherToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // El seed carga 4 slots para el teacher
      expect(res.body.length).toBeGreaterThanOrEqual(4);

      const slot = res.body[0];
      expect(slot).toHaveProperty('id');
      expect(slot).toHaveProperty('dayOfWeek');
      expect(slot).toHaveProperty('startTime');
      expect(slot).toHaveProperty('endTime');
    });

    it('STUDENT obtiene 403', async () => {
      const res = await authGet('/availability/mine', studentToken);
      expect(res.status).toBe(403);
    });
  });

  // ─── POST /availability ────────────────────────────────────────────────────

  describe('POST /availability', () => {
    it('STUDENT no puede añadir un slot (403)', async () => {
      const res = await authPost('/availability', studentToken, {
        dayOfWeek: 6,
        startTime: '14:00',
        endTime: '15:00',
      });

      expect(res.status).toBe(403);
    });

    it('TEACHER crea un nuevo slot correctamente (201)', async () => {
      const res = await authPost('/availability', teacherToken, {
        dayOfWeek: 6,    // Sábado — no existe en el seed
        startTime: '14:00',
        endTime: '15:00',
      });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.dayOfWeek).toBe(6);
      expect(res.body.startTime).toBe('14:00');
      expect(res.body.endTime).toBe('15:00');

      createdSlotId = res.body.id;
    });

    it('crea un slot duplicado devuelve 409', async () => {
      // Intenta crear el mismo slot (dayOfWeek=6, startTime='14:00') que el test anterior
      const res = await authPost('/availability', teacherToken, {
        dayOfWeek: 6,
        startTime: '14:00',
        endTime: '15:00',
      });

      expect(res.status).toBe(409);
    });
  });

  // ─── DELETE /availability/:id ──────────────────────────────────────────────

  describe('DELETE /availability/:id', () => {
    it('STUDENT no puede eliminar un slot (403)', async () => {
      // Necesitamos un ID válido; si createdSlotId no existe por fallo anterior, usamos uno de seed
      const slotId = createdSlotId ?? 'id-inexistente';
      const res = await authDelete(`/availability/${slotId}`, studentToken);
      expect(res.status).toBe(403);
    });

    it('devuelve 404 al intentar eliminar un slot inexistente', async () => {
      const res = await authDelete('/availability/id-que-no-existe', teacherToken);
      expect(res.status).toBe(404);
    });

    it('TEACHER elimina su propio slot correctamente (200)', async () => {
      // Depende del slot creado en POST — si no se creó, el test es condicional
      if (!createdSlotId) {
        console.warn('createdSlotId no disponible; se omite la aserción de DELETE 200');
        return;
      }

      const res = await authDelete(`/availability/${createdSlotId}`, teacherToken);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(createdSlotId);
    });
  });
});
