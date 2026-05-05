import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { AiExamsService } from './ai-exams.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiProviderService } from '../ai/ai-provider.service';

// Payload válido devuelto por la IA: 5 preguntas mezclando tipos.
function validPayload(count: number) {
  const base = [
    {
      text: '¿Cuál es la capital de España?',
      type: 'SINGLE',
      answers: [
        { text: 'Madrid', isCorrect: true },
        { text: 'Barcelona', isCorrect: false },
        { text: 'Sevilla', isCorrect: false },
      ],
      explanation: 'Madrid es la capital política de España.',
    },
    {
      text: 'Selecciona los planetas rocosos.',
      type: 'MULTIPLE',
      answers: [
        { text: 'Mercurio', isCorrect: true },
        { text: 'Venus', isCorrect: true },
        { text: 'Júpiter', isCorrect: false },
        { text: 'Saturno', isCorrect: false },
      ],
      explanation: 'Mercurio y Venus son rocosos; Júpiter y Saturno son gaseosos.',
    },
    {
      text: 'El agua hierve a 100°C a nivel del mar.',
      type: 'TRUE_FALSE',
      answers: [
        { text: 'Verdadero', isCorrect: true },
        { text: 'Falso', isCorrect: false },
      ],
      explanation: 'A 1 atm el punto de ebullición del agua es 100°C.',
    },
  ];
  // Repetimos para llegar a `count`
  const questions = [];
  for (let i = 0; i < count; i++) questions.push(base[i % base.length]);
  return { title: 'Examen de prueba', questions };
}

describe('AiExamsService', () => {
  let service: AiExamsService;

  const mockPrisma = {
    course: { findUnique: jest.fn() },
    module: { findFirst: jest.fn() },
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

  // ─── generate ────────────────────────────────────────────────────────────

  describe('generate', () => {
    const dto = { courseId: 'c1', topic: 'Logaritmos', numQuestions: 5 as const };

    it('lanza NotFoundException si el curso no existe', async () => {
      mockPrisma.course.findUnique.mockResolvedValue(null);
      await expect(service.generate('user1', dto)).rejects.toThrow(NotFoundException);
    });

    it('lanza ForbiddenException si el alumno no está matriculado', async () => {
      mockPrisma.course.findUnique.mockResolvedValue({ id: 'c1', title: 'Mate', schoolYear: null });
      mockPrisma.enrollment.findFirst.mockResolvedValue(null);
      await expect(service.generate('user1', dto)).rejects.toThrow(ForbiddenException);
    });

    it('lanza NotFoundException si el módulo no pertenece al curso', async () => {
      mockPrisma.course.findUnique.mockResolvedValue({ id: 'c1', title: 'Mate', schoolYear: null });
      mockPrisma.enrollment.findFirst.mockResolvedValue({ id: 'e1' });
      mockPrisma.module.findFirst.mockResolvedValue(null);
      await expect(service.generate('user1', { ...dto, moduleId: 'm1' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lanza error si la IA devuelve número incorrecto de preguntas', async () => {
      mockPrisma.course.findUnique.mockResolvedValue({ id: 'c1', title: 'Mate', schoolYear: null });
      mockPrisma.enrollment.findFirst.mockResolvedValue({ id: 'e1' });
      mockAi.generate.mockResolvedValue(JSON.stringify(validPayload(3))); // pidió 5

      await expect(service.generate('user1', dto)).rejects.toThrow(InternalServerErrorException);
    });

    it('lanza error si SINGLE no tiene exactamente 1 respuesta correcta', async () => {
      const bad = validPayload(5);
      bad.questions[0] = {
        ...bad.questions[0],
        answers: bad.questions[0].answers.map((a) => ({ ...a, isCorrect: true })),
      };
      mockPrisma.course.findUnique.mockResolvedValue({ id: 'c1', title: 'Mate', schoolYear: null });
      mockPrisma.enrollment.findFirst.mockResolvedValue({ id: 'e1' });
      mockAi.generate.mockResolvedValue(JSON.stringify(bad));

      await expect(service.generate('user1', dto)).rejects.toThrow(InternalServerErrorException);
    });

    it('persiste el banco y NO devuelve isCorrect en la respuesta', async () => {
      mockPrisma.course.findUnique.mockResolvedValue({ id: 'c1', title: 'Mate', schoolYear: null });
      mockPrisma.enrollment.findFirst.mockResolvedValue({ id: 'e1' });
      mockAi.generate.mockResolvedValue(JSON.stringify(validPayload(5)));

      const created = {
        id: 'bank1',
        title: 'Examen de prueba',
        topic: 'Logaritmos',
        numQuestions: 5,
        createdAt: new Date('2026-05-05T12:00:00Z'),
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
      };
      mockPrisma.aiExamBank.create.mockResolvedValue(created);

      const result = await service.generate('user1', dto);

      expect(mockPrisma.aiExamBank.create).toHaveBeenCalledTimes(1);
      const callArgs = mockPrisma.aiExamBank.create.mock.calls[0][0];
      expect(callArgs.data.userId).toBe('user1');
      expect(callArgs.data.numQuestions).toBe(5);
      expect(result.id).toBe('bank1');
      // Crítico: no exponer isCorrect en la respuesta
      const resultStr = JSON.stringify(result);
      expect(resultStr).not.toContain('isCorrect');
    });
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
          createdAt: new Date('2026-05-05T12:00:00Z'),
          course: { id: 'c1', title: 'Mate' },
          module: null,
          _count: { attempts: 2, questions: 5 },
        },
      ]);

      const result = await service.listMyBanks('user1');
      expect(result).toHaveLength(1);
      expect(result[0].attemptCount).toBe(2);
      expect(result[0].questionCount).toBe(5);
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
    it('snapshotiza preguntas y NO expone isCorrect', async () => {
      mockPrisma.aiExamBank.findUnique.mockResolvedValue({
        id: 'bank1',
        userId: 'user1',
        courseId: 'c1',
        moduleId: null,
        title: 't',
        topic: 't',
        numQuestions: 5,
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
      });
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
  });
});
