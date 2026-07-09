import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AiExamsService } from './ai-exams.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiProviderService } from '../ai/ai-provider.service';

describe('AiExamsService', () => {
  let service: AiExamsService;

  const mockPrisma = {
    course: { findUnique: jest.fn() },
    enrollment: { findFirst: jest.fn() },
    aiExamBank: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    examAttempt: {
      create: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockAi = {
    generate: jest.fn<Promise<string>, [string, number]>(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiExamsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AiProviderService, useValue: mockAi },
      ],
    }).compile();

    service = module.get<AiExamsService>(AiExamsService);
    jest.clearAllMocks();
  });

  // ─── listMyBanks ─────────────────────────────────────────────────────────

  describe('listMyBanks', () => {
    it('devuelve los bancos del alumno con conteos', async () => {
      mockPrisma.aiExamBank.findMany.mockResolvedValue([
        {
          id: 'bank1',
          title: 'Examen 1',
          topic: 'Tema',
          numQuestions: 5,
          timeLimit: null,
          onlyOnce: false,
          createdAt: new Date('2026-05-05T12:00:00Z'),
          course: { id: 'c1', title: 'Mate' },
          module: null,
          _count: { attempts: 2, questions: 5 },
          attempts: [{ id: 'att1' }],
        },
      ]);

      const result = await service.listMyBanks('user1');
      expect(result).toHaveLength(1);
      expect(result[0].attemptCount).toBe(2);
      expect(result[0].questionCount).toBe(5);
      expect(result[0].submittedAttemptCount).toBe(1);
    });
  });

  // ─── getBank ─────────────────────────────────────────────────────────────

  describe('getBank', () => {
    it('lanza NotFoundException si no existe', async () => {
      mockPrisma.aiExamBank.findUnique.mockResolvedValue(null);
      await expect(service.getBank('user1', 'x')).rejects.toThrow(NotFoundException);
    });

    it('lanza ForbiddenException si el banco es de otro alumno', async () => {
      mockPrisma.aiExamBank.findUnique.mockResolvedValue({
        id: 'bank1',
        userId: 'user2',
        title: 't',
        topic: 't',
        numQuestions: 5,
        createdAt: new Date(),
        course: { id: 'c1', title: 'Mate' },
        module: null,
        questions: [],
      });
      await expect(service.getBank('user1', 'bank1')).rejects.toThrow(ForbiddenException);
    });

    it('omite isCorrect en la respuesta', async () => {
      mockPrisma.aiExamBank.findUnique.mockResolvedValue({
        id: 'bank1',
        userId: 'user1',
        title: 't',
        topic: 't',
        numQuestions: 5,
        timeLimit: null,
        onlyOnce: false,
        createdAt: new Date(),
        course: { id: 'c1', title: 'Mate' },
        module: null,
        questions: [
          {
            id: 'q1',
            text: 'pregunta',
            type: 'SINGLE',
            order: 0,
            explanation: 'expl',
            answers: [{ id: 'a1', text: 'A', isCorrect: true, order: 0 }],
          },
        ],
      });
      mockPrisma.examAttempt.count.mockResolvedValue(3);

      const result = await service.getBank('user1', 'bank1');
      expect(result.attemptCount).toBe(3);
      expect(JSON.stringify(result)).not.toContain('isCorrect');
      // Tampoco la explicación se filtra antes del submit
      expect(JSON.stringify(result)).not.toContain('expl');
    });
  });

  // ─── deleteBank ──────────────────────────────────────────────────────────

  describe('deleteBank', () => {
    it('rechaza eliminar bancos de otros alumnos', async () => {
      mockPrisma.aiExamBank.findUnique.mockResolvedValue({ id: 'bank1', userId: 'user2' });
      await expect(service.deleteBank('user1', 'bank1')).rejects.toThrow(ForbiddenException);
    });

    it('elimina si el banco es del propio alumno', async () => {
      mockPrisma.aiExamBank.findUnique.mockResolvedValue({ id: 'bank1', userId: 'user1' });
      mockPrisma.aiExamBank.delete.mockResolvedValue({ id: 'bank1' });
      const result = await service.deleteBank('user1', 'bank1');
      expect(result).toEqual({ ok: true });
      expect(mockPrisma.aiExamBank.delete).toHaveBeenCalledWith({ where: { id: 'bank1' } });
    });
  });

  // ─── startAttempt ────────────────────────────────────────────────────────

  describe('startAttempt', () => {
    function bankFixture(overrides: Partial<{ onlyOnce: boolean; timeLimit: number | null }> = {}) {
      return {
        id: 'bank1',
        userId: 'user1',
        courseId: 'c1',
        moduleId: null,
        title: 't',
        topic: 't',
        numQuestions: 5,
        timeLimit: null,
        onlyOnce: false,
        createdAt: new Date(),
        course: { id: 'c1', title: 'Mate' },
        module: null,
        questions: [
          {
            id: 'q1',
            text: 'pregunta',
            type: 'SINGLE',
            order: 0,
            explanation: 'expl',
            answers: [
              { id: 'a1', text: 'A', isCorrect: true, order: 0 },
              { id: 'a2', text: 'B', isCorrect: false, order: 1 },
            ],
          },
        ],
        ...overrides,
      };
    }

    it('snapshotiza preguntas y NO expone isCorrect', async () => {
      mockPrisma.aiExamBank.findUnique.mockResolvedValue(bankFixture());
      mockPrisma.examAttempt.create.mockResolvedValue({
        id: 'att1',
        startedAt: new Date('2026-05-05T12:00:00Z'),
      });

      const result = await service.startAttempt('user1', 'bank1');

      expect(result.attemptId).toBe('att1');
      expect(result.bankId).toBe('bank1');
      // Las respuestas devueltas al cliente no llevan isCorrect
      const resultStr = JSON.stringify(result);
      expect(resultStr).not.toContain('isCorrect');

      // El snapshot persistido SÍ debe incluir isCorrect (corrección server-side)
      const createCall = mockPrisma.examAttempt.create.mock.calls[0][0];
      expect(createCall.data.aiExamBankId).toBe('bank1');
      expect(createCall.data.questionsSnapshot[0].answers[0].isCorrect).toBeDefined();
    });

    it('propaga timeLimit y onlyOnce del banco al ExamAttempt', async () => {
      mockPrisma.aiExamBank.findUnique.mockResolvedValue(
        bankFixture({ onlyOnce: true, timeLimit: 600 }),
      );
      mockPrisma.examAttempt.count.mockResolvedValue(0); // sin intentos previos
      mockPrisma.examAttempt.create.mockResolvedValue({ id: 'att1', startedAt: new Date() });

      await service.startAttempt('user1', 'bank1');

      const createCall = mockPrisma.examAttempt.create.mock.calls[0][0];
      expect(createCall.data.timeLimit).toBe(600);
      expect(createCall.data.onlyOnce).toBe(true);
    });

    it('rechaza repetir un banco onlyOnce con un intento ya entregado', async () => {
      mockPrisma.aiExamBank.findUnique.mockResolvedValue(bankFixture({ onlyOnce: true }));
      mockPrisma.examAttempt.count.mockResolvedValue(1);

      await expect(service.startAttempt('user1', 'bank1')).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.examAttempt.create).not.toHaveBeenCalled();
    });

    it('permite iniciar un banco onlyOnce si todavía no hay intento entregado', async () => {
      mockPrisma.aiExamBank.findUnique.mockResolvedValue(bankFixture({ onlyOnce: true }));
      mockPrisma.examAttempt.count.mockResolvedValue(0);
      mockPrisma.examAttempt.create.mockResolvedValue({ id: 'att1', startedAt: new Date() });

      await expect(service.startAttempt('user1', 'bank1')).resolves.toBeDefined();
      expect(mockPrisma.examAttempt.create).toHaveBeenCalledTimes(1);
    });
  });
});
