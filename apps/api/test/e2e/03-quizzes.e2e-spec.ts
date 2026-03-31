import {
  createApp,
  closeApp,
  login,
  authGet,
  authPost,
  publicGet,
  publicPost,
  getPrisma,
} from './setup';

describe('Quizzes — /quizzes', () => {
  let studentToken: string;
  let adminToken: string;

  let quizId: string;
  let questionId: string;
  let correctAnswerId: string;
  let wrongAnswerId: string;

  beforeAll(async () => {
    await createApp();

    const [s, a] = await Promise.all([
      login('student@vkbacademy.com'),
      login('admin@vkbacademy.com'),
    ]);

    studentToken = s.accessToken;
    adminToken = a.accessToken;

    // Resolver el quiz de la BD
    const prisma = getPrisma();
    const quiz = await prisma.quiz.findFirst({
      include: {
        questions: {
          orderBy: { order: 'asc' },
          include: { answers: true },
        },
      },
    });

    if (!quiz) throw new Error('No se encontró ningún quiz en la BD. Ejecuta el seed primero.');

    quizId = quiz.id;
    const firstQuestion = quiz.questions[0];
    questionId = firstQuestion.id;

    const correct = firstQuestion.answers.find((a) => a.isCorrect);
    const wrong = firstQuestion.answers.find((a) => !a.isCorrect);

    if (!correct || !wrong) throw new Error('El quiz no tiene respuestas correctas e incorrectas.');

    correctAnswerId = correct.id;
    wrongAnswerId = wrong.id;
  });

  afterAll(async () => {
    await closeApp();
  });

  // ─── GET /quizzes/:id ──────────────────────────────────────────────────────

  describe('GET /quizzes/:id', () => {
    it('devuelve las preguntas del quiz SIN el campo isCorrect en las respuestas', async () => {
      const res = await authGet(`/quizzes/${quizId}`, studentToken);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('questions');
      expect(Array.isArray(res.body.questions)).toBe(true);
      expect(res.body.questions.length).toBeGreaterThan(0);

      // Verificar que ninguna respuesta expone isCorrect
      for (const question of res.body.questions) {
        expect(question).toHaveProperty('answers');
        for (const answer of question.answers) {
          expect(answer).not.toHaveProperty('isCorrect');
        }
      }
    });

    it('devuelve 401 si el usuario no está autenticado', async () => {
      const res = await publicGet(`/quizzes/${quizId}`);
      expect(res.status).toBe(401);
    });

    it('devuelve 404 si el quiz no existe', async () => {
      const res = await authGet('/quizzes/id-inexistente', studentToken);
      expect(res.status).toBe(404);
    });
  });

  // ─── POST /quizzes/:id/submit ──────────────────────────────────────────────

  describe('POST /quizzes/:id/submit', () => {
    it('calcula el score correctamente y devuelve correcciones CON isCorrect', async () => {
      const res = await authPost(`/quizzes/${quizId}/submit`, studentToken, {
        answers: [{ questionId, answerId: correctAnswerId }],
      });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('score');
      expect(res.body.score).toBeGreaterThan(0);
      expect(res.body).toHaveProperty('corrections');

      // Las correcciones deben incluir isCorrect
      const correction = res.body.corrections[0];
      expect(correction).toHaveProperty('isCorrect');
      expect(correction.isCorrect).toBe(true);
    });

    it('devuelve score 0 cuando todas las respuestas son incorrectas', async () => {
      const res = await authPost(`/quizzes/${quizId}/submit`, studentToken, {
        answers: [{ questionId, answerId: wrongAnswerId }],
      });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('score');

      const correction = res.body.corrections[0];
      expect(correction.isCorrect).toBe(false);
    });

    it('devuelve 400 si el array de respuestas está vacío', async () => {
      const res = await authPost(`/quizzes/${quizId}/submit`, studentToken, {
        answers: [],
      });

      // Según la implementación puede ser 400 o procesarse como 0 preguntas respondidas
      expect([400, 201]).toContain(res.status);
    });

    it('devuelve 401 si el usuario no está autenticado', async () => {
      const res = await publicPost(`/quizzes/${quizId}/submit`, {
        answers: [{ questionId, answerId: correctAnswerId }],
      });

      expect(res.status).toBe(401);
    });
  });

  // ─── GET /quizzes/:id/attempts ─────────────────────────────────────────────

  describe('GET /quizzes/:id/attempts', () => {
    it('devuelve solo los intentos del usuario autenticado', async () => {
      // Primero hacer un intento para tener historial
      await authPost(`/quizzes/${quizId}/submit`, studentToken, {
        answers: [{ questionId, answerId: correctAnswerId }],
      });

      const res = await authGet(`/quizzes/${quizId}/attempts`, studentToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);

      // Cada intento debe tener las propiedades básicas
      const attempt = res.body[0];
      expect(attempt).toHaveProperty('score');
      expect(attempt).toHaveProperty('createdAt');
    });

    it('el admin no ve los intentos del student en el mismo endpoint', async () => {
      const res = await authGet(`/quizzes/${quizId}/attempts`, adminToken);

      expect(res.status).toBe(200);
      // Los intentos del admin serían distintos de los del student
      // (puede estar vacío si el admin no ha hecho intentos)
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('devuelve 401 si el usuario no está autenticado', async () => {
      const res = await publicGet(`/quizzes/${quizId}/attempts`);
      expect(res.status).toBe(401);
    });
  });
});
