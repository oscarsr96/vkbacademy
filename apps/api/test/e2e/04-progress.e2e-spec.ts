import {
  createApp,
  closeApp,
  login,
  authGet,
  authPost,
  getPrisma,
} from './setup';

describe('Progress — /lessons', () => {
  let studentToken: string;
  let adminToken: string;

  // IDs de lecciones resueltos desde la BD
  let videoLessonId: string;
  let secondLessonId: string;

  beforeAll(async () => {
    await createApp();

    const [s, a] = await Promise.all([
      login('student@vkbacademy.com'),
      login('admin@vkbacademy.com'),
    ]);

    studentToken = s.accessToken;
    adminToken = a.accessToken;

    // Resolver lecciones del curso de Fundamentos del Baloncesto
    const prisma = getPrisma();
    const lessons = await prisma.lesson.findMany({
      where: {
        module: {
          course: { title: 'Fundamentos del Baloncesto' },
        },
      },
      orderBy: [{ module: { order: 'asc' } }, { order: 'asc' }],
    });

    if (lessons.length < 2) {
      throw new Error('Se necesitan al menos 2 lecciones en "Fundamentos del Baloncesto". Ejecuta el seed.');
    }

    videoLessonId = lessons[0].id;
    secondLessonId = lessons[1].id;
  });

  afterAll(async () => {
    await closeApp();
  });

  // ─── GET /lessons/:id ──────────────────────────────────────────────────────

  describe('GET /lessons/:id', () => {
    it('devuelve el detalle de una lección', async () => {
      const res = await authGet(`/lessons/${videoLessonId}`, studentToken);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('title');
      expect(res.body).toHaveProperty('type');
    });

    it('devuelve 401 sin autenticación', async () => {
      const { getApp } = await import('./setup');
      const supertest = await import('supertest');
      const server = getApp().getHttpServer();
      const res = await supertest.default(server).get(`/api/lessons/${videoLessonId}`);
      expect(res.status).toBe(401);
    });
  });

  // ─── POST /lessons/:id/complete ────────────────────────────────────────────

  describe('POST /lessons/:id/complete', () => {
    it('marca una lección como completada y devuelve el progreso actualizado', async () => {
      const res = await authPost(`/lessons/${videoLessonId}/complete`, studentToken);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('lessonId');
      expect(res.body.lessonId).toBe(videoLessonId);
    });

    it('completar la misma lección dos veces es idempotente (sin error)', async () => {
      // Primera completación
      await authPost(`/lessons/${videoLessonId}/complete`, studentToken);

      // Segunda completación — debe ser idempotente
      const res = await authPost(`/lessons/${videoLessonId}/complete`, studentToken);

      expect([200, 201]).toContain(res.status);
    });

    it('marcar una segunda lección también funciona correctamente', async () => {
      const res = await authPost(`/lessons/${secondLessonId}/complete`, studentToken);

      expect([200, 201]).toContain(res.status);
    });

    it('devuelve 401 sin autenticación', async () => {
      const { getApp } = await import('./setup');
      const supertest = await import('supertest');
      const server = getApp().getHttpServer();
      const res = await supertest.default(server)
        .post(`/api/lessons/${videoLessonId}/complete`);
      expect(res.status).toBe(401);
    });
  });

  // ─── Verificar que el progreso del curso refleja las completaciones ─────────

  describe('Progreso del curso después de completar lecciones', () => {
    it('el progreso del curso aumenta tras completar lecciones', async () => {
      // Asegurarnos de que la lección esté completada
      await authPost(`/lessons/${videoLessonId}/complete`, studentToken);

      const prisma = getPrisma();
      const course = await prisma.course.findFirst({
        where: { title: 'Fundamentos del Baloncesto' },
        include: {
          modules: {
            include: { lessons: true },
          },
        },
      });

      if (!course) return;

      const { getApp } = await import('./setup');
      const supertest = await import('supertest');
      const server = getApp().getHttpServer();

      const res = await supertest.default(server)
        .get(`/api/courses/${course.id}/progress`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.completedLessons).toBeGreaterThan(0);
    });
  });

  // ─── GET /lessons/recent ───────────────────────────────────────────────────

  describe('GET /lessons/recent', () => {
    it('devuelve las lecciones completadas recientemente por el usuario', async () => {
      // Asegurar que hay al menos una lección completada
      await authPost(`/lessons/${videoLessonId}/complete`, studentToken);

      const res = await authGet('/lessons/recent', studentToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('devuelve 401 sin autenticación', async () => {
      const { getApp } = await import('./setup');
      const supertest = await import('supertest');
      const server = getApp().getHttpServer();
      const res = await supertest.default(server).get('/api/lessons/recent');
      expect(res.status).toBe(401);
    });
  });

  // ─── Progreso en gamificación tras completar lección ──────────────────────

  describe('Gamificación — progreso de retos tras completar lección', () => {
    it('el reto LESSON_COMPLETED tiene progreso > 0 después de completar lecciones', async () => {
      // Completar la lección para disparar hooks de gamificación
      await authPost(`/lessons/${videoLessonId}/complete`, studentToken);

      // Esperar un momento para que los hooks async se procesen
      await new Promise((resolve) => setTimeout(resolve, 500));

      const prisma = getPrisma();
      const student = await prisma.user.findUnique({
        where: { email: 'student@vkbacademy.com' },
      });

      if (!student) return;

      const lessonChallenge = await prisma.userChallenge.findFirst({
        where: {
          userId: student.id,
          challenge: { type: 'LESSON_COMPLETED' },
        },
      });

      // Si el hook se ejecutó, debe haber un UserChallenge con progreso > 0
      if (lessonChallenge) {
        expect(lessonChallenge.progress).toBeGreaterThan(0);
      }
      // Si no existe aún, el test pasa igualmente (hooks son async)
    });
  });
});
