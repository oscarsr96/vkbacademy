import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ExamsService } from './exams.service';
import { PrismaService } from '../prisma/prisma.service';
import { CertificatesService } from '../certificates/certificates.service';

// Helper: construye una pregunta de examen con respuestas
function buildQuestion(id: string, correctAnswerIdx = 0) {
  return {
    id,
    text: `Pregunta ${id}`,
    type: 'SINGLE',
    order: 0,
    answers: [
      { id: `${id}-a1`, text: 'Opción A', isCorrect: correctAnswerIdx === 0 },
      { id: `${id}-a2`, text: 'Opción B', isCorrect: correctAnswerIdx === 1 },
      { id: `${id}-a3`, text: 'Opción C', isCorrect: correctAnswerIdx === 2 },
    ],
  };
}

describe('ExamsService', () => {
  let service: ExamsService;

  const mockPrisma = {
    examQuestion: {
      count: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    examAttempt: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    course: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    module: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    enrollment: {
      findMany: jest.fn(),
    },
  };

  const mockCertificates = {
    issueExamCertificate: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExamsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CertificatesService, useValue: mockCertificates },
      ],
    }).compile();

    service = module.get<ExamsService>(ExamsService);
    jest.clearAllMocks();
    mockCertificates.issueExamCertificate.mockResolvedValue(undefined);
  });

  // ─── getBankInfo ─────────────────────────────────────────────────────────────

  describe('getBankInfo', () => {
    it('lanza BadRequestException si no se especifica courseId ni moduleId', async () => {
      await expect(service.getBankInfo({}, 'user1')).rejects.toThrow(BadRequestException);
    });

    it('lanza NotFoundException si el curso no existe', async () => {
      mockPrisma.examQuestion.count.mockResolvedValue(0);
      mockPrisma.examAttempt.findMany.mockResolvedValue([]);
      mockPrisma.course.findUnique.mockResolvedValue(null);

      await expect(
        service.getBankInfo({ courseId: 'nonexistent' }, 'user1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza NotFoundException si el módulo no existe', async () => {
      mockPrisma.examQuestion.count.mockResolvedValue(0);
      mockPrisma.examAttempt.findMany.mockResolvedValue([]);
      mockPrisma.module.findUnique.mockResolvedValue(null);

      await expect(
        service.getBankInfo({ moduleId: 'nonexistent' }, 'user1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('devuelve la info del banco para un curso con intentos previos', async () => {
      const now = new Date();
      mockPrisma.examQuestion.count.mockResolvedValue(15);
      mockPrisma.examAttempt.findMany.mockResolvedValue([
        { id: 'attempt1', score: 85.0, numQuestions: 10, submittedAt: now },
      ]);
      mockPrisma.course.findUnique.mockResolvedValue({ id: 'c1', title: 'Fundamentos de Baloncesto' });

      const result = await service.getBankInfo({ courseId: 'c1' }, 'user1');

      expect(result.questionCount).toBe(15);
      expect(result.scope).toBe('course');
      expect(result.scopeId).toBe('c1');
      expect(result.scopeTitle).toBe('Fundamentos de Baloncesto');
      expect(result.recentAttempts).toHaveLength(1);
      expect(result.recentAttempts[0].score).toBe(85.0);
      expect(result.recentAttempts[0].numQuestions).toBe(10);
      expect(result.recentAttempts[0].submittedAt).toBe(now.toISOString());
    });

    it('devuelve la info del banco para un módulo sin intentos', async () => {
      mockPrisma.examQuestion.count.mockResolvedValue(8);
      mockPrisma.examAttempt.findMany.mockResolvedValue([]);
      mockPrisma.module.findUnique.mockResolvedValue({ id: 'm1', title: 'Módulo 1' });

      const result = await service.getBankInfo({ moduleId: 'm1' }, 'user1');

      expect(result.scope).toBe('module');
      expect(result.scopeId).toBe('m1');
      expect(result.questionCount).toBe(8);
      expect(result.recentAttempts).toHaveLength(0);
    });

    it('usa el courseId cuando se proporciona para la query de ExamQuestion', async () => {
      mockPrisma.examQuestion.count.mockResolvedValue(5);
      mockPrisma.examAttempt.findMany.mockResolvedValue([]);
      mockPrisma.course.findUnique.mockResolvedValue({ id: 'c1', title: 'Curso' });

      await service.getBankInfo({ courseId: 'c1' }, 'user1');

      expect(mockPrisma.examQuestion.count).toHaveBeenCalledWith({
        where: { courseId: 'c1' },
      });
    });
  });

  // ─── startExam ───────────────────────────────────────────────────────────────

  describe('startExam', () => {
    it('lanza BadRequestException si no se especifica courseId ni moduleId', async () => {
      await expect(
        service.startExam('user1', { numQuestions: 10 } as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException si se especifican courseId y moduleId simultáneamente', async () => {
      await expect(
        service.startExam('user1', { courseId: 'c1', moduleId: 'm1', numQuestions: 10 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException si el banco tiene menos preguntas de las solicitadas', async () => {
      mockPrisma.examQuestion.findMany.mockResolvedValue([
        buildQuestion('q1'),
        buildQuestion('q2'),
      ]);

      await expect(
        service.startExam('user1', { courseId: 'c1', numQuestions: 10 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('crea el intento y devuelve las preguntas SIN isCorrect', async () => {
      const questions = Array.from({ length: 15 }, (_, i) => buildQuestion(`q${i + 1}`));
      mockPrisma.examQuestion.findMany.mockResolvedValue(questions);
      mockPrisma.examAttempt.create.mockResolvedValue({
        id: 'attempt1',
        startedAt: new Date(),
      });

      const result = await service.startExam('user1', { courseId: 'c1', numQuestions: 10 });

      expect(result.attemptId).toBe('attempt1');
      expect(result.questions).toHaveLength(10);
      expect(result.numQuestions).toBe(10);
      // Ninguna respuesta debe exponer isCorrect al cliente
      result.questions.forEach((q) => {
        q.answers.forEach((a) => {
          expect(a).not.toHaveProperty('isCorrect');
        });
      });
    });

    it('guarda el questionsSnapshot CON isCorrect para corrección server-side', async () => {
      const questions = Array.from({ length: 5 }, (_, i) => buildQuestion(`q${i + 1}`));
      mockPrisma.examQuestion.findMany.mockResolvedValue(questions);
      mockPrisma.examAttempt.create.mockResolvedValue({ id: 'attempt1', startedAt: new Date() });

      await service.startExam('user1', { courseId: 'c1', numQuestions: 5 });

      const createCall = mockPrisma.examAttempt.create.mock.calls[0][0];
      const snapshot = createCall.data.questionsSnapshot as Array<{
        answers: Array<{ isCorrect?: boolean }>;
      }>;
      snapshot.forEach((q) => {
        q.answers.forEach((a) => {
          expect(a).toHaveProperty('isCorrect');
        });
      });
    });

    it('selecciona exactamente numQuestions preguntas del banco', async () => {
      const questions = Array.from({ length: 20 }, (_, i) => buildQuestion(`q${i + 1}`));
      mockPrisma.examQuestion.findMany.mockResolvedValue(questions);
      mockPrisma.examAttempt.create.mockResolvedValue({ id: 'a1', startedAt: new Date() });

      const result = await service.startExam('user1', { courseId: 'c1', numQuestions: 7 });

      expect(result.questions).toHaveLength(7);
    });

    it('guarda timeLimit y onlyOnce en el intento', async () => {
      const questions = Array.from({ length: 10 }, (_, i) => buildQuestion(`q${i + 1}`));
      mockPrisma.examQuestion.findMany.mockResolvedValue(questions);
      mockPrisma.examAttempt.create.mockResolvedValue({ id: 'a1', startedAt: new Date() });

      await service.startExam('user1', {
        courseId: 'c1',
        numQuestions: 5,
        timeLimit: 300,
        onlyOnce: true,
      });

      const createCall = mockPrisma.examAttempt.create.mock.calls[0][0];
      expect(createCall.data.timeLimit).toBe(300);
      expect(createCall.data.onlyOnce).toBe(true);
    });

    it('devuelve startedAt como ISO string', async () => {
      const fakeDate = new Date('2026-02-16T10:00:00Z');
      const questions = Array.from({ length: 5 }, (_, i) => buildQuestion(`q${i + 1}`));
      mockPrisma.examQuestion.findMany.mockResolvedValue(questions);
      mockPrisma.examAttempt.create.mockResolvedValue({ id: 'a1', startedAt: fakeDate });

      const result = await service.startExam('user1', { courseId: 'c1', numQuestions: 5 });

      expect(result.startedAt).toBe(fakeDate.toISOString());
    });
  });

  // ─── submitExam ──────────────────────────────────────────────────────────────

  describe('submitExam', () => {
    // Snapshot de ejemplo: 2 preguntas, cada una con su respuesta correcta
    const snapshot = [
      {
        id: 'q1',
        text: 'Pregunta 1',
        type: 'SINGLE',
        answers: [
          { id: 'a1', text: 'Correcta', isCorrect: true },
          { id: 'a2', text: 'Incorrecta', isCorrect: false },
        ],
      },
      {
        id: 'q2',
        text: 'Pregunta 2',
        type: 'SINGLE',
        answers: [
          { id: 'b1', text: 'Incorrecta', isCorrect: false },
          { id: 'b2', text: 'Correcta', isCorrect: true },
        ],
      },
    ];

    const baseAttempt = {
      id: 'attempt1',
      userId: 'user1',
      submittedAt: null,
      questionsSnapshot: snapshot,
    };

    it('lanza NotFoundException si el intento no existe', async () => {
      mockPrisma.examAttempt.findUnique.mockResolvedValue(null);

      await expect(
        service.submitExam('attempt1', 'user1', { answers: [] }),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza ForbiddenException si el intento pertenece a otro usuario', async () => {
      mockPrisma.examAttempt.findUnique.mockResolvedValue({
        ...baseAttempt,
        userId: 'otherUser',
      });

      await expect(
        service.submitExam('attempt1', 'user1', { answers: [] }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lanza BadRequestException si el examen ya fue entregado', async () => {
      mockPrisma.examAttempt.findUnique.mockResolvedValue({
        ...baseAttempt,
        submittedAt: new Date(),
      });

      await expect(
        service.submitExam('attempt1', 'user1', { answers: [] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('calcula score 100 cuando todas las respuestas son correctas', async () => {
      mockPrisma.examAttempt.findUnique.mockResolvedValue(baseAttempt);
      mockPrisma.examAttempt.update.mockResolvedValue({});

      const result = await service.submitExam('attempt1', 'user1', {
        answers: [
          { questionId: 'q1', answerId: 'a1' },
          { questionId: 'q2', answerId: 'b2' },
        ],
      });

      expect(result.score).toBe(100);
      expect(result.correctCount).toBe(2);
      expect(result.numQuestions).toBe(2);
      expect(result.corrections.every((c) => c.isCorrect)).toBe(true);
    });

    it('calcula score 50 cuando la mitad de las respuestas son correctas', async () => {
      mockPrisma.examAttempt.findUnique.mockResolvedValue(baseAttempt);
      mockPrisma.examAttempt.update.mockResolvedValue({});

      const result = await service.submitExam('attempt1', 'user1', {
        answers: [
          { questionId: 'q1', answerId: 'a1' }, // correcta
          { questionId: 'q2', answerId: 'b1' }, // incorrecta
        ],
      });

      expect(result.score).toBe(50);
      expect(result.correctCount).toBe(1);
      expect(result.corrections[0].isCorrect).toBe(true);
      expect(result.corrections[1].isCorrect).toBe(false);
    });

    it('incluye selectedAnswerText y correctAnswerText en cada corrección', async () => {
      mockPrisma.examAttempt.findUnique.mockResolvedValue(baseAttempt);
      mockPrisma.examAttempt.update.mockResolvedValue({});

      const result = await service.submitExam('attempt1', 'user1', {
        answers: [
          { questionId: 'q1', answerId: 'a2' }, // incorrecta → selectedText = "Incorrecta"
          { questionId: 'q2', answerId: 'b2' }, // correcta → selectedText = "Correcta"
        ],
      });

      // Primer fallo: selectedAnswerText = "Incorrecta", correctAnswerText = "Correcta"
      expect(result.corrections[0].selectedAnswerText).toBe('Incorrecta');
      expect(result.corrections[0].correctAnswerText).toBe('Correcta');
      expect(result.corrections[0].isCorrect).toBe(false);

      // Segundo acierto
      expect(result.corrections[1].selectedAnswerText).toBe('Correcta');
      expect(result.corrections[1].isCorrect).toBe(true);
    });

    it('pone selectedAnswerText en null si la pregunta no fue respondida', async () => {
      mockPrisma.examAttempt.findUnique.mockResolvedValue(baseAttempt);
      mockPrisma.examAttempt.update.mockResolvedValue({});

      const result = await service.submitExam('attempt1', 'user1', {
        answers: [
          { questionId: 'q1', answerId: 'a1' }, // responde solo la primera
          // q2 sin responder
        ],
      });

      expect(result.corrections[1].selectedAnswerText).toBeNull();
      expect(result.corrections[1].selectedAnswerId).toBeNull();
      expect(result.corrections[1].isCorrect).toBe(false);
    });

    it('persiste el intento con score, answers y submittedAt', async () => {
      mockPrisma.examAttempt.findUnique.mockResolvedValue(baseAttempt);
      mockPrisma.examAttempt.update.mockResolvedValue({});

      await service.submitExam('attempt1', 'user1', {
        answers: [{ questionId: 'q1', answerId: 'a1' }],
      });

      expect(mockPrisma.examAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'attempt1' },
          data: expect.objectContaining({
            score: expect.any(Number),
            submittedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('devuelve submittedAt como ISO string', async () => {
      mockPrisma.examAttempt.findUnique.mockResolvedValue(baseAttempt);
      mockPrisma.examAttempt.update.mockResolvedValue({});

      const result = await service.submitExam('attempt1', 'user1', { answers: [] });

      expect(typeof result.submittedAt).toBe('string');
      expect(result.submittedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('llama a issueExamCertificate con userId, attemptId y score correctos', async () => {
      mockPrisma.examAttempt.findUnique.mockResolvedValue(baseAttempt);
      mockPrisma.examAttempt.update.mockResolvedValue({});

      await service.submitExam('attempt1', 'user1', {
        answers: [
          { questionId: 'q1', answerId: 'a1' }, // correcta
          { questionId: 'q2', answerId: 'b2' }, // correcta → score 100
        ],
      });

      expect(mockCertificates.issueExamCertificate).toHaveBeenCalledWith(
        'user1',
        'attempt1',
        100,
      );
    });

    it('llama a issueExamCertificate incluso con score 0 — el servicio decide si emitir', async () => {
      mockPrisma.examAttempt.findUnique.mockResolvedValue(baseAttempt);
      mockPrisma.examAttempt.update.mockResolvedValue({});

      await service.submitExam('attempt1', 'user1', { answers: [] }); // sin respuestas → score 0

      expect(mockCertificates.issueExamCertificate).toHaveBeenCalledWith(
        'user1',
        'attempt1',
        0,
      );
    });

    it('no bloquea la respuesta esperando a issueExamCertificate — patrón void', async () => {
      mockPrisma.examAttempt.findUnique.mockResolvedValue(baseAttempt);
      mockPrisma.examAttempt.update.mockResolvedValue({});

      let resolveCert!: () => void;
      mockCertificates.issueExamCertificate.mockReturnValue(
        new Promise<void>((resolve) => { resolveCert = resolve; }),
      );

      const result = await service.submitExam('attempt1', 'user1', { answers: [] });

      expect(result).toBeDefined(); // retorna sin esperar al certificado
      resolveCert();
    });
  });

  // ─── getHistory ──────────────────────────────────────────────────────────────

  describe('getHistory', () => {
    it('lanza BadRequestException si no se especifica courseId ni moduleId', async () => {
      await expect(service.getHistory({}, 'user1')).rejects.toThrow(BadRequestException);
    });

    it('devuelve el historial de intentos completados del usuario', async () => {
      const now = new Date();
      mockPrisma.examAttempt.findMany.mockResolvedValue([
        {
          id: 'a1',
          score: 90.0,
          numQuestions: 10,
          timeLimit: 300,
          onlyOnce: false,
          startedAt: now,
          submittedAt: now,
        },
        {
          id: 'a2',
          score: 60.0,
          numQuestions: 5,
          timeLimit: null,
          onlyOnce: false,
          startedAt: now,
          submittedAt: now,
        },
      ]);

      const result = await service.getHistory({ courseId: 'c1' }, 'user1');

      expect(result).toHaveLength(2);
      expect(result[0].attemptId).toBe('a1');
      expect(result[0].score).toBe(90.0);
      expect(result[0].submittedAt).toBe(now.toISOString());
      expect(result[1].timeLimit).toBeNull();
    });

    it('devuelve submittedAt null para intentos en curso', async () => {
      const now = new Date();
      mockPrisma.examAttempt.findMany.mockResolvedValue([
        {
          id: 'a1',
          score: null,
          numQuestions: 10,
          timeLimit: null,
          onlyOnce: false,
          startedAt: now,
          submittedAt: null, // aún no entregado
        },
      ]);

      const result = await service.getHistory({ moduleId: 'm1' }, 'user1');

      expect(result[0].submittedAt).toBeNull();
    });

    it('filtra por moduleId cuando se proporciona', async () => {
      mockPrisma.examAttempt.findMany.mockResolvedValue([]);

      await service.getHistory({ moduleId: 'm1' }, 'user1');

      expect(mockPrisma.examAttempt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ moduleId: 'm1' }),
        }),
      );
    });
  });
});
