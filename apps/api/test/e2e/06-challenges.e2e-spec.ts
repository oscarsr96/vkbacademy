import {
  createApp,
  closeApp,
  login,
  authGet,
  authPost,
  publicGet,
  getPrisma,
} from './setup';

describe('Challenges — /challenges', () => {
  let studentToken: string;
  let tutorToken: string;

  beforeAll(async () => {
    await createApp();

    const [s, tu] = await Promise.all([
      login('student@vkbacademy.com'),
      login('oscar.sanchez@egocogito.com'),
    ]);

    studentToken = s.accessToken;
    tutorToken = tu.accessToken;
  });

  afterAll(async () => {
    await closeApp();
  });

  // ─── GET /challenges ───────────────────────────────────────────────────────

  describe('GET /challenges', () => {
    it('devuelve los retos activos con el progreso del usuario', async () => {
      const res = await authGet('/challenges', studentToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);

      const challenge = res.body[0];
      expect(challenge).toHaveProperty('id');
      expect(challenge).toHaveProperty('title');
      expect(challenge).toHaveProperty('description');
      expect(challenge).toHaveProperty('type');
      expect(challenge).toHaveProperty('target');
      expect(challenge).toHaveProperty('points');
    });

    it('incluye el progreso del usuario en cada reto', async () => {
      const res = await authGet('/challenges', studentToken);

      expect(res.status).toBe(200);

      for (const challenge of res.body) {
        expect(challenge).toHaveProperty('progress');
        expect(typeof challenge.progress).toBe('number');
      }
    });

    it('TUTOR también puede ver los retos', async () => {
      const res = await authGet('/challenges', tutorToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('devuelve 401 sin autenticación', async () => {
      const res = await publicGet('/challenges');
      expect(res.status).toBe(401);
    });
  });

  // ─── GET /challenges/summary ───────────────────────────────────────────────

  describe('GET /challenges/summary', () => {
    it('devuelve el resumen de gamificación del usuario', async () => {
      const res = await authGet('/challenges/summary', studentToken);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalPoints');
      expect(res.body).toHaveProperty('currentStreak');
      expect(res.body).toHaveProperty('longestStreak');
      expect(res.body).toHaveProperty('completedCount');
    });

    it('los puntos totales son un número no negativo', async () => {
      const res = await authGet('/challenges/summary', studentToken);

      expect(res.status).toBe(200);
      expect(typeof res.body.totalPoints).toBe('number');
      expect(res.body.totalPoints).toBeGreaterThanOrEqual(0);
    });

    it('devuelve 401 sin autenticación', async () => {
      const res = await publicGet('/challenges/summary');
      expect(res.status).toBe(401);
    });
  });

  // ─── POST /challenges/redeem ───────────────────────────────────────────────

  describe('POST /challenges/redeem', () => {
    it('devuelve 400 si el alumno no tiene suficientes puntos', async () => {
      // El student recién registrado tiene 0 puntos
      const res = await authPost('/challenges/redeem', studentToken, {
        itemName: 'Balón firmado por el equipo',
        cost: 1000,
      });

      expect(res.status).toBe(400);
    });

    it('canjea un artículo correctamente cuando hay puntos suficientes', async () => {
      const prisma = getPrisma();
      const student = await prisma.user.findUnique({
        where: { email: 'student@vkbacademy.com' },
      });

      if (!student) return;

      // Dar puntos suficientes al student directamente en BD
      await prisma.user.update({
        where: { id: student.id },
        data: { totalPoints: 500 },
      });

      const res = await authPost('/challenges/redeem', studentToken, {
        itemName: 'Camiseta oficial del club',
        cost: 500,
      });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.itemName).toBe('Camiseta oficial del club');

      // Verificar que los puntos se descontaron
      const updatedStudent = await prisma.user.findUnique({
        where: { id: student.id },
      });
      expect(updatedStudent!.totalPoints).toBe(0);
    });

    it('devuelve 400 si el coste es cero (mínimo es 1)', async () => {
      const res = await authPost('/challenges/redeem', studentToken, {
        itemName: 'Pack de stickers VKB',
        cost: 0,
      });

      expect(res.status).toBe(400);
    });

    it('devuelve 400 si faltan campos requeridos', async () => {
      const res = await authPost('/challenges/redeem', studentToken, {
        itemName: 'Pack de stickers VKB',
        // falta cost
      });

      expect(res.status).toBe(400);
    });

    it('devuelve 401 sin autenticación', async () => {
      const res = await publicGet('/challenges/redeem');
      expect(res.status).toBe(401);
    });
  });
});
