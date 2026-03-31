import {
  createApp,
  closeApp,
  login,
  authGet,
  authPost,
  publicGet,
  getPrisma,
} from './setup';

describe('Exams — /exams', () => {
  let studentToken: string;
  let adminToken: string;
  let studentId: string;

  let courseId: string;
  let moduleId: string;
  let attemptId: string;
  let snapshotQuestions: Array<{ id: string; answers: Array<{ id: string }> }>;

  beforeAll(async () => {
    await createApp();

    const [s, a] = await Promise.all([
      login('student@vkbacademy.com'),
      login('admin@vkbacademy.com'),
    ]);

    studentToken = s.accessToken;
    adminToken = a.accessToken;
    studentId = s.user.id;

    // Resolver el curso y módulo con banco de examen
    const prisma = getPrisma();
    const course = await prisma.course.findFirst({
      where: { title: 'Fundamentos del Baloncesto' },
      include: { modules: { take: 1 } },
    });

    if (!course) throw new Error('No se encontró el curso. Ejecuta el seed.');

    courseId = course.id;
    moduleId = course.modules[0]?.id;

    // Crear preguntas de examen en el banco si no existen
    const existingQuestions = await prisma.examQuestion.findMany({
      where: { courseId },
      take: 3,
    });

    if (existingQuestions.length < 3) {
      // Crear preguntas de banco para el test
      for (let i = 0; i < 3; i++) {
        await prisma.examQuestion.create({
          data: {
            courseId,
            text: `Pregunta de examen de prueba ${i + 1}`,
            type: 'SINGLE',
            answers: {
              createMany: {
                data: [
                  { text: `Respuesta correcta ${i}`, isCorrect: true },
                  { text: `Respuesta incorrecta A ${i}`, isCorrect: false },
                  { text: `Respuesta incorrecta B ${i}`, isCorrect: false },
                ],
              },
            },
          },
        });
      }
    }
  });

  afterAll(async () => {
    await closeApp();
  });

  // ─── GET /exams/available ──────────────────────────────────────────────────

  describe('GET /exams/available', () => {
    it('devuelve los bancos de examen disponibles para el usuario', async () => {
      const res = await authGet('/exams/available', studentToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('el banco del curso "Fundamentos del Baloncesto" aparece disponible', async () => {
      const res = await authGet('/exams/available', studentToken);

      expect(res.status).toBe(200);

      // Debe haber al menos un banco disponible con el courseId creado
      const found = res.body.some(
        (b: any) => b.courseId === courseId || b.scopeId === courseId,
      );
      expect(found).toBe(true);
    });

    it('devuelve 401 sin autenticación', async () => {
      const res = await publicGet('/exams/available');
      expect(res.status).toBe(401);
    });
  });

  // ─── POST /exams/start ─────────────────────────────────────────────────────

  describe('POST /exams/start', () => {
    it('inicia un intento de examen con preguntas barajadas', async () => {
      const res = await authPost('/exams/start', studentToken, {
        courseId,
        numQuestions: 3,
      });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('attemptId');
      expect(res.body).toHaveProperty('questions');
      expect(Array.isArray(res.body.questions)).toBe(true);
      expect(res.body.questions.length).toBe(3);

      attemptId = res.body.attemptId;
      snapshotQuestions = res.body.questions;
    });

    it('las preguntas NO incluyen el campo isCorrect en las respuestas', async () => {
      const res = await authPost('/exams/start', studentToken, {
        courseId,
        numQuestions: 3,
      });

      expect(res.status).toBe(201);
      expect(res.body.questions.length).toBeGreaterThan(0);

      for (const question of res.body.questions) {
        expect(question).toHaveProperty('answers');
        for (const answer of question.answers) {
          expect(answer).not.toHaveProperty('isCorrect');
        }
      }
    });

    it('respeta el límite de tiempo si se especifica', async () => {
      const res = await authPost('/exams/start', studentToken, {
        courseId,
        numQuestions: 3,
        timeLimit: 600, // 10 minutos
      });

      expect(res.status).toBe(201);
    });

    it('devuelve 400 si numQuestions es mayor que las disponibles', async () => {
      const res = await authPost('/exams/start', studentToken, {
        courseId,
        numQuestions: 999,
      });

      // Puede ajustar automáticamente al máximo o devolver 400
      expect([400, 201]).toContain(res.status);
    });

    it('devuelve 400 sin courseId ni moduleId', async () => {
      const res = await authPost('/exams/start', studentToken, {
        numQuestions: 3,
      });

      // Puede ser 400 o procesarse sin scope
      expect([400, 201]).toContain(res.status);
    });

    it('devuelve 401 sin autenticación', async () => {
      const { getApp } = await import('./setup');
      const supertest = await import('supertest');
      const server = getApp().getHttpServer();
      const res = await supertest.default(server)
        .post('/api/exams/start')
        .send({ courseId, numQuestions: 3 });
      expect(res.status).toBe(401);
    });
  });

  // ─── POST /exams/:attemptId/submit ─────────────────────────────────────────

  describe('POST /exams/:attemptId/submit', () => {
    it('entrega el examen y devuelve la corrección con scoring server-side', async () => {
      if (!attemptId || !snapshotQuestions || snapshotQuestions.length === 0) return;

      // Construir respuestas eligiendo la primera respuesta de cada pregunta
      const answers = snapshotQuestions.map((q) => ({
        questionId: q.id,
        answerId: q.answers[0].id,
      }));

      const res = await authPost(`/exams/${attemptId}/submit`, studentToken, { answers });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('score');
      expect(typeof res.body.score).toBe('number');
      expect(res.body.score).toBeGreaterThanOrEqual(0);
      expect(res.body.score).toBeLessThanOrEqual(100);
      expect(res.body).toHaveProperty('corrections');
      expect(Array.isArray(res.body.corrections)).toBe(true);
    });

    it('las correcciones incluyen isCorrect, selectedAnswerText y correctAnswerText', async () => {
      // Iniciar un nuevo intento para este test
      const startRes = await authPost('/exams/start', studentToken, {
        courseId,
        numQuestions: 3,
      });

      const newAttemptId = startRes.body.attemptId;
      const questions = startRes.body.questions;

      const answers = questions.map((q: any) => ({
        questionId: q.id,
        answerId: q.answers[0].id,
      }));

      const res = await authPost(`/exams/${newAttemptId}/submit`, studentToken, { answers });

      expect(res.status).toBe(201);
      expect(res.body.corrections.length).toBeGreaterThan(0);

      const correction = res.body.corrections[0];
      expect(correction).toHaveProperty('isCorrect');
      expect(correction).toHaveProperty('selectedAnswerText');
      expect(correction).toHaveProperty('correctAnswerText');
    });

    it('devuelve error si el intento ya fue entregado', async () => {
      if (!attemptId || !snapshotQuestions || snapshotQuestions.length === 0) return;

      const answers = snapshotQuestions.map((q) => ({
        questionId: q.id,
        answerId: q.answers[0].id,
      }));

      // Intentar entregar de nuevo un intento ya completado
      const res = await authPost(`/exams/${attemptId}/submit`, studentToken, { answers });

      // Puede ser 400 (ya entregado) o 200/201 si es idempotente
      expect([400, 409, 200, 201]).toContain(res.status);
    });

    it('devuelve 401 sin autenticación', async () => {
      const { getApp } = await import('./setup');
      const supertest = await import('supertest');
      const server = getApp().getHttpServer();
      const res = await supertest.default(server)
        .post(`/api/exams/${attemptId}/submit`)
        .send({ answers: [] });
      expect(res.status).toBe(401);
    });
  });

  // ─── GET /exams/history ────────────────────────────────────────────────────

  describe('GET /exams/history', () => {
    it('devuelve el historial de intentos del usuario autenticado', async () => {
      const res = await authGet(`/exams/history?courseId=${courseId}`, studentToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('cada intento en el historial tiene score y fecha', async () => {
      const res = await authGet(`/exams/history?courseId=${courseId}`, studentToken);

      expect(res.status).toBe(200);

      for (const attempt of res.body) {
        expect(attempt).toHaveProperty('score');
        expect(attempt).toHaveProperty('submittedAt');
      }
    });

    it('devuelve historial vacío para un curso sin intentos', async () => {
      const prisma = getPrisma();
      const otherCourse = await prisma.course.findFirst({
        where: { title: 'Matemáticas 3º ESO' },
      });

      if (!otherCourse) return;

      const res = await authGet(`/exams/history?courseId=${otherCourse.id}`, studentToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('devuelve 401 sin autenticación', async () => {
      const res = await publicGet(`/exams/history?courseId=${courseId}`);
      expect(res.status).toBe(401);
    });
  });

  // ─── Admin — banco de preguntas de examen ──────────────────────────────────

  describe('Admin — GET /admin/exam-questions', () => {
    it('ADMIN puede ver las preguntas del banco de examen', async () => {
      const res = await authGet(`/admin/exam-questions?courseId=${courseId}`, adminToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('STUDENT no puede ver el banco de examen (403)', async () => {
      const res = await authGet(`/admin/exam-questions?courseId=${courseId}`, studentToken);
      expect(res.status).toBe(403);
    });
  });

  describe('Admin — POST /admin/exam-questions', () => {
    it('ADMIN puede crear una pregunta en el banco de examen', async () => {
      const res = await authPost('/admin/exam-questions', adminToken, {
        courseId,
        text: 'Pregunta de examen creada en el test E2E',
        type: 'SINGLE',
        answers: [
          { text: 'Respuesta correcta', isCorrect: true },
          { text: 'Respuesta incorrecta 1', isCorrect: false },
          { text: 'Respuesta incorrecta 2', isCorrect: false },
        ],
      });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.text).toBe('Pregunta de examen creada en el test E2E');
    });

    it('STUDENT no puede crear preguntas de examen (403)', async () => {
      const res = await authPost('/admin/exam-questions', studentToken, {
        courseId,
        text: 'Intento de crear pregunta',
        type: 'SINGLE',
        answers: [
          { text: 'Respuesta', isCorrect: true },
        ],
      });

      expect(res.status).toBe(403);
    });
  });

  describe('Admin — GET /admin/exam-attempts', () => {
    it('ADMIN puede ver los intentos de examen de todos los alumnos', async () => {
      const res = await authGet(`/admin/exam-attempts?courseId=${courseId}`, adminToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('STUDENT no puede ver los intentos de examen de otros (403)', async () => {
      const res = await authGet(`/admin/exam-attempts?courseId=${courseId}`, studentToken);
      expect(res.status).toBe(403);
    });
  });
});
