import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ChallengeType } from '@prisma/client';
import { QuizzesService } from './quizzes.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChallengesService } from '../challenges/challenges.service';

// Helper: construye un quiz con N preguntas (cada una con 2 respuestas: la primera es correcta)
function buildQuiz(questionCount = 2, quizId = 'quiz1') {
  return {
    id: quizId,
    lessonId: 'lesson1',
    questions: Array.from({ length: questionCount }, (_, i) => ({
      id: `q${i + 1}`,
      text: `Pregunta ${i + 1}`,
      type: 'SINGLE',
      order: i,
      answers: [
        { id: `q${i + 1}-correct`, text: 'Respuesta correcta', isCorrect: true },
        { id: `q${i + 1}-wrong`, text: 'Respuesta incorrecta', isCorrect: false },
      ],
    })),
  };
}

describe('QuizzesService', () => {
  let service: QuizzesService;
  let mockPrisma: {
    quiz: { findUnique: jest.Mock };
    quizAttempt: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
    };
  };
  let mockChallenges: { checkAndAward: jest.Mock };

  beforeEach(async () => {
    mockPrisma = {
      quiz: { findUnique: jest.fn() },
      quizAttempt: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
    };
    mockChallenges = { checkAndAward: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuizzesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ChallengesService, useValue: mockChallenges },
      ],
    }).compile();

    service = module.get<QuizzesService>(QuizzesService);
    jest.clearAllMocks();
    mockChallenges.checkAndAward.mockResolvedValue(undefined);
  });

  // ─── findOne ─────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('lanza NotFoundException si el quiz no existe', async () => {
      mockPrisma.quiz.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('devuelve el quiz si existe', async () => {
      const quizWithoutIsCorrect = {
        ...buildQuiz(2),
        questions: buildQuiz(2).questions.map((q) => ({
          ...q,
          answers: q.answers.map(({ isCorrect: _, ...rest }) => rest),
        })),
      };
      mockPrisma.quiz.findUnique.mockResolvedValue(quizWithoutIsCorrect);

      const result = await service.findOne('quiz1');

      expect(result.id).toBe('quiz1');
      expect(result.questions).toHaveLength(2);
    });

    it('las respuestas NO incluyen isCorrect — seguridad crítica', async () => {
      // Prisma devuelve las respuestas sin isCorrect gracias al select explícito
      const quizWithoutIsCorrect = {
        ...buildQuiz(3),
        questions: buildQuiz(3).questions.map((q) => ({
          ...q,
          answers: q.answers.map(({ isCorrect: _, ...rest }) => rest),
        })),
      };
      mockPrisma.quiz.findUnique.mockResolvedValue(quizWithoutIsCorrect);

      const result = await service.findOne('quiz1');

      result.questions.forEach((q) => {
        q.answers.forEach((a) => {
          expect(a).not.toHaveProperty('isCorrect');
        });
      });
    });

    it('usa select sin isCorrect en la query de Prisma', async () => {
      mockPrisma.quiz.findUnique.mockResolvedValue(buildQuiz());

      await service.findOne('quiz1');

      // Verificar que la llamada a Prisma incluye el select explícito con id y text solo
      const prismaCall = mockPrisma.quiz.findUnique.mock.calls[0][0];
      const answersSelect = prismaCall?.include?.questions?.include?.answers?.select;
      expect(answersSelect).toBeDefined();
      expect(answersSelect.id).toBe(true);
      expect(answersSelect.text).toBe(true);
      expect(answersSelect.isCorrect).toBeUndefined();
    });
  });

  // ─── submit ──────────────────────────────────────────────────────────────────

  describe('submit', () => {
    it('lanza NotFoundException si el quiz no existe', async () => {
      mockPrisma.quiz.findUnique.mockResolvedValue(null);

      await expect(
        service.submit('nonexistent', { answers: [] }, 'user1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('calcula score 100% cuando todas las respuestas son correctas', async () => {
      const quiz = buildQuiz(4);
      mockPrisma.quiz.findUnique.mockResolvedValue(quiz);
      mockPrisma.quizAttempt.create.mockResolvedValue({});

      const answers = quiz.questions.map((q) => ({
        questionId: q.id,
        answerId: q.answers[0].id, // siempre la correcta
      }));

      const result = await service.submit('quiz1', { answers }, 'user1');

      expect(result.score).toBe(100);
      expect(result.correctCount).toBe(4);
      expect(result.totalCount).toBe(4);
    });

    it('calcula score 75% con 3 de 4 respuestas correctas', async () => {
      const quiz = buildQuiz(4);
      mockPrisma.quiz.findUnique.mockResolvedValue(quiz);
      mockPrisma.quizAttempt.create.mockResolvedValue({});

      const answers = quiz.questions.map((q, i) => ({
        questionId: q.id,
        answerId: i < 3 ? q.answers[0].id : q.answers[1].id, // la última incorrecta
      }));

      const result = await service.submit('quiz1', { answers }, 'user1');

      expect(result.score).toBe(75);
      expect(result.correctCount).toBe(3);
    });

    it('devuelve score 0 si el quiz no tiene preguntas', async () => {
      const emptyQuiz = { id: 'quiz1', lessonId: 'l1', questions: [] };
      mockPrisma.quiz.findUnique.mockResolvedValue(emptyQuiz);
      mockPrisma.quizAttempt.create.mockResolvedValue({});

      const result = await service.submit('quiz1', { answers: [] }, 'user1');

      expect(result.score).toBe(0);
    });

    it('identifica correctamente aciertos y fallos en las correcciones', async () => {
      const quiz = buildQuiz(2);
      mockPrisma.quiz.findUnique.mockResolvedValue(quiz);
      mockPrisma.quizAttempt.create.mockResolvedValue({});

      const result = await service.submit('quiz1', {
        answers: [
          { questionId: 'q1', answerId: 'q1-correct' }, // correcta
          { questionId: 'q2', answerId: 'q2-wrong' },   // incorrecta
        ],
      }, 'user1');

      expect(result.corrections[0].isCorrect).toBe(true);
      expect(result.corrections[0].correctAnswerId).toBe('q1-correct');
      expect(result.corrections[1].isCorrect).toBe(false);
      expect(result.corrections[1].correctAnswerId).toBe('q2-correct');
    });

    it('persiste el intento con userId, quizId y score en Prisma', async () => {
      const quiz = buildQuiz(1);
      mockPrisma.quiz.findUnique.mockResolvedValue(quiz);
      mockPrisma.quizAttempt.create.mockResolvedValue({});

      await service.submit('quiz1', {
        answers: [{ questionId: 'q1', answerId: 'q1-correct' }],
      }, 'user1');

      expect(mockPrisma.quizAttempt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user1',
            quizId: 'quiz1',
            score: 100,
          }),
        }),
      );
    });

    it('dispara checkAndAward con QUIZ_SCORE sin bloquear la respuesta', async () => {
      const quiz = buildQuiz(1);
      mockPrisma.quiz.findUnique.mockResolvedValue(quiz);
      mockPrisma.quizAttempt.create.mockResolvedValue({});

      await service.submit('quiz1', {
        answers: [{ questionId: 'q1', answerId: 'q1-correct' }],
      }, 'user1');

      expect(mockChallenges.checkAndAward).toHaveBeenCalledWith(
        'user1',
        ChallengeType.QUIZ_SCORE,
      );
    });

    it('redondea el score a un decimal', async () => {
      const quiz = buildQuiz(3);
      mockPrisma.quiz.findUnique.mockResolvedValue(quiz);
      mockPrisma.quizAttempt.create.mockResolvedValue({});

      // 1 de 3 correctas = 33.333...%
      const result = await service.submit('quiz1', {
        answers: [
          { questionId: 'q1', answerId: 'q1-correct' },  // correcta
          { questionId: 'q2', answerId: 'q2-wrong' },    // incorrecta
          { questionId: 'q3', answerId: 'q3-wrong' },    // incorrecta
        ],
      }, 'user1');

      // Math.round(1/3 * 100 * 10) / 10 = Math.round(333.33) / 10 = 333 / 10 = 33.3
      expect(result.score).toBe(33.3);
    });
  });

  // ─── getAttempts ─────────────────────────────────────────────────────────────

  describe('getAttempts', () => {
    it('devuelve los intentos del usuario para el quiz ordenados por fecha', async () => {
      const now = new Date();
      const earlier = new Date(now.getTime() - 3_600_000);

      mockPrisma.quizAttempt.findMany.mockResolvedValue([
        { id: 'att1', score: 80, completedAt: now },
        { id: 'att2', score: 60, completedAt: earlier },
      ]);

      const result = await service.getAttempts('quiz1', 'user1');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('att1');
      expect(result[0].score).toBe(80);
    });

    it('devuelve array vacío si el usuario no tiene intentos', async () => {
      mockPrisma.quizAttempt.findMany.mockResolvedValue([]);

      const result = await service.getAttempts('quiz1', 'user1');

      expect(result).toHaveLength(0);
    });

    it('filtra por quizId y userId en la query', async () => {
      mockPrisma.quizAttempt.findMany.mockResolvedValue([]);

      await service.getAttempts('quiz1', 'user1');

      expect(mockPrisma.quizAttempt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { quizId: 'quiz1', userId: 'user1' },
        }),
      );
    });
  });

  // ─── getAttemptDetail ────────────────────────────────────────────────────────

  describe('getAttemptDetail', () => {
    it('lanza NotFoundException si el intento no pertenece al usuario o quiz', async () => {
      mockPrisma.quizAttempt.findFirst.mockResolvedValue(null);

      await expect(
        service.getAttemptDetail('quiz1', 'attempt1', 'user1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza NotFoundException si el quiz no existe al reconstruir correcciones', async () => {
      mockPrisma.quizAttempt.findFirst.mockResolvedValue({
        id: 'att1',
        score: 50,
        completedAt: new Date(),
        answers: [],
      });
      mockPrisma.quiz.findUnique.mockResolvedValue(null);

      await expect(
        service.getAttemptDetail('quiz1', 'att1', 'user1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('devuelve correcciones con textos de pregunta y respuestas', async () => {
      const quiz = buildQuiz(2);
      const storedAnswers = [
        { questionId: 'q1', answerId: 'q1-correct' }, // acierto
        { questionId: 'q2', answerId: 'q2-wrong' },   // fallo
      ];

      mockPrisma.quizAttempt.findFirst.mockResolvedValue({
        id: 'att1',
        score: 50,
        completedAt: new Date(),
        answers: storedAnswers,
      });
      mockPrisma.quiz.findUnique.mockResolvedValue(quiz);

      const result = await service.getAttemptDetail('quiz1', 'att1', 'user1');

      expect(result.corrections).toHaveLength(2);

      // Primera corrección: acierto
      expect(result.corrections[0].questionText).toBe('Pregunta 1');
      expect(result.corrections[0].selectedAnswerText).toBe('Respuesta correcta');
      expect(result.corrections[0].isCorrect).toBe(true);
      expect(result.corrections[0].correctAnswerText).toBe('Respuesta correcta');

      // Segunda corrección: fallo
      expect(result.corrections[1].questionText).toBe('Pregunta 2');
      expect(result.corrections[1].selectedAnswerText).toBe('Respuesta incorrecta');
      expect(result.corrections[1].isCorrect).toBe(false);
      expect(result.corrections[1].correctAnswerText).toBe('Respuesta correcta');
    });

    it('incluye el score y completedAt del intento en el detalle', async () => {
      const now = new Date();
      const quiz = buildQuiz(1);

      mockPrisma.quizAttempt.findFirst.mockResolvedValue({
        id: 'att1',
        score: 100,
        completedAt: now,
        answers: [{ questionId: 'q1', answerId: 'q1-correct' }],
      });
      mockPrisma.quiz.findUnique.mockResolvedValue(quiz);

      const result = await service.getAttemptDetail('quiz1', 'att1', 'user1');

      expect(result.score).toBe(100);
      expect(result.completedAt).toEqual(now);
    });
  });
});
