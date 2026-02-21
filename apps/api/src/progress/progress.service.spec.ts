import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ChallengeType } from '@prisma/client';
import { ProgressService } from './progress.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChallengesService } from '../challenges/challenges.service';
import { CertificatesService } from '../certificates/certificates.service';

describe('ProgressService', () => {
  let service: ProgressService;
  let mockPrisma: {
    lesson: { findUnique: jest.Mock };
    userProgress: { upsert: jest.Mock; findMany: jest.Mock };
  };
  let mockChallenges: { checkAndAward: jest.Mock };
  let mockCertificates: { checkAndIssueLessonCertificates: jest.Mock };

  beforeEach(async () => {
    mockPrisma = {
      lesson: { findUnique: jest.fn() },
      userProgress: { upsert: jest.fn(), findMany: jest.fn() },
    };
    mockChallenges = { checkAndAward: jest.fn().mockResolvedValue(undefined) };
    mockCertificates = {
      checkAndIssueLessonCertificates: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProgressService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ChallengesService, useValue: mockChallenges },
        { provide: CertificatesService, useValue: mockCertificates },
      ],
    }).compile();

    service = module.get<ProgressService>(ProgressService);
    jest.clearAllMocks();
    mockChallenges.checkAndAward.mockResolvedValue(undefined);
    mockCertificates.checkAndIssueLessonCertificates.mockResolvedValue(undefined);
  });

  // ─── findLesson ──────────────────────────────────────────────────────────────

  describe('findLesson', () => {
    it('lanza NotFoundException si la lección no existe', async () => {
      mockPrisma.lesson.findUnique.mockResolvedValue(null);

      await expect(service.findLesson('nonexistent', 'user1')).rejects.toThrow(NotFoundException);
    });

    it('devuelve la lección con el progreso del usuario cuando existe', async () => {
      const now = new Date();
      const fakeLesson = {
        id: 'lesson1',
        title: 'Introducción al Baloncesto',
        type: 'VIDEO',
        youtubeId: 'abc123',
        content: null,
        quiz: null,
        progress: [{ userId: 'user1', lessonId: 'lesson1', completed: true, completedAt: now }],
      };
      mockPrisma.lesson.findUnique.mockResolvedValue(fakeLesson);

      const result = await service.findLesson('lesson1', 'user1');

      expect(result.id).toBe('lesson1');
      expect(result.progress).not.toBeNull();
      expect(result.progress?.completed).toBe(true);
    });

    it('devuelve progress null si el usuario no ha iniciado la lección', async () => {
      const fakeLesson = {
        id: 'lesson1',
        title: 'Intro',
        type: 'VIDEO',
        youtubeId: null,
        content: null,
        quiz: null,
        progress: [], // sin progreso del usuario
      };
      mockPrisma.lesson.findUnique.mockResolvedValue(fakeLesson);

      const result = await service.findLesson('lesson1', 'user1');

      expect(result.progress).toBeNull();
    });

    it('no expone isCorrect en las respuestas del quiz de la lección — seguridad crítica', async () => {
      // La query de Prisma usa select explícito (id, text) sin isCorrect
      const lessonWithQuiz = {
        id: 'lesson1',
        title: 'Quiz de Defensa',
        type: 'QUIZ',
        youtubeId: null,
        content: null,
        quiz: {
          id: 'quiz1',
          questions: [
            {
              id: 'q1',
              text: '¿Cuántos pasos se pueden dar sin botar?',
              order: 0,
              answers: [
                { id: 'a1', text: 'Uno' },  // sin isCorrect (select explícito)
                { id: 'a2', text: 'Dos' },
              ],
            },
          ],
        },
        progress: [],
      };
      mockPrisma.lesson.findUnique.mockResolvedValue(lessonWithQuiz);

      const result = await service.findLesson('lesson1', 'user1');

      result.quiz?.questions.forEach((q) => {
        q.answers.forEach((a) => {
          expect(a).not.toHaveProperty('isCorrect');
        });
      });
    });

    it('usa select sin isCorrect en la query de Prisma para el quiz', async () => {
      mockPrisma.lesson.findUnique.mockResolvedValue({
        id: 'lesson1',
        title: 'Intro',
        type: 'VIDEO',
        quiz: null,
        progress: [],
      });

      await service.findLesson('lesson1', 'user1');

      const prismaCall = mockPrisma.lesson.findUnique.mock.calls[0][0];
      const answersSelect =
        prismaCall?.include?.quiz?.include?.questions?.include?.answers?.select;

      // El select debe existir y no incluir isCorrect
      expect(answersSelect).toBeDefined();
      expect(answersSelect.id).toBe(true);
      expect(answersSelect.text).toBe(true);
      expect(answersSelect.isCorrect).toBeUndefined();
    });

    it('filtra el progreso por userId en la query', async () => {
      mockPrisma.lesson.findUnique.mockResolvedValue({
        id: 'lesson1',
        title: 'Intro',
        type: 'VIDEO',
        quiz: null,
        progress: [],
      });

      await service.findLesson('lesson1', 'user42');

      const prismaCall = mockPrisma.lesson.findUnique.mock.calls[0][0];
      const progressWhere = prismaCall?.include?.progress?.where;
      expect(progressWhere?.userId).toBe('user42');
    });
  });

  // ─── completeLesson ──────────────────────────────────────────────────────────

  describe('completeLesson', () => {
    it('hace upsert del progreso del usuario con completed=true', async () => {
      const fakeProgress = {
        userId: 'user1',
        lessonId: 'lesson1',
        completed: true,
        completedAt: new Date(),
      };
      mockPrisma.userProgress.upsert.mockResolvedValue(fakeProgress);

      const result = await service.completeLesson('lesson1', 'user1');

      expect(mockPrisma.userProgress.upsert).toHaveBeenCalledWith({
        where: { userId_lessonId: { userId: 'user1', lessonId: 'lesson1' } },
        update: expect.objectContaining({ completed: true, completedAt: expect.any(Date) }),
        create: expect.objectContaining({
          userId: 'user1',
          lessonId: 'lesson1',
          completed: true,
          completedAt: expect.any(Date),
        }),
      });
      expect(result.completed).toBe(true);
    });

    it('devuelve el registro de progreso resultante del upsert', async () => {
      const fakeProgress = {
        userId: 'user1',
        lessonId: 'lesson1',
        completed: true,
        completedAt: new Date('2026-02-16T10:00:00Z'),
      };
      mockPrisma.userProgress.upsert.mockResolvedValue(fakeProgress);

      const result = await service.completeLesson('lesson1', 'user1');

      expect(result).toEqual(fakeProgress);
    });

    it('dispara checkAndAward con los 4 tipos de evento de una lección', async () => {
      mockPrisma.userProgress.upsert.mockResolvedValue({});

      await service.completeLesson('lesson1', 'user1');

      expect(mockChallenges.checkAndAward).toHaveBeenCalledWith(
        'user1',
        ChallengeType.LESSON_COMPLETED,
        ChallengeType.MODULE_COMPLETED,
        ChallengeType.COURSE_COMPLETED,
        ChallengeType.TOTAL_HOURS,
      );
    });

    it('llama a checkAndIssueLessonCertificates con el userId y lessonId correctos', async () => {
      mockPrisma.userProgress.upsert.mockResolvedValue({});

      await service.completeLesson('lesson1', 'user1');

      expect(mockCertificates.checkAndIssueLessonCertificates).toHaveBeenCalledWith(
        'user1',
        'lesson1',
      );
    });

    it('no espera a checkAndIssueLessonCertificates — patrón void (non-blocking)', async () => {
      let resolveCertificates!: () => void;
      mockCertificates.checkAndIssueLessonCertificates.mockReturnValue(
        new Promise<void>((resolve) => { resolveCertificates = resolve; }),
      );
      mockPrisma.userProgress.upsert.mockResolvedValue({ completed: true });

      const result = await service.completeLesson('lesson1', 'user1');

      expect(result).toBeDefined(); // retorna sin esperar a checkAndIssueLessonCertificates
      resolveCertificates();
    });

    it('no espera a que checkAndAward termine — patrón void (non-blocking)', async () => {
      // checkAndAward devuelve una promesa que resuelve más tarde
      let resolveCheckAndAward!: () => void;
      mockChallenges.checkAndAward.mockReturnValue(
        new Promise<void>((resolve) => { resolveCheckAndAward = resolve; }),
      );
      mockPrisma.userProgress.upsert.mockResolvedValue({ completed: true });

      // completeLesson debe retornar antes de que checkAndAward resuelva
      const result = await service.completeLesson('lesson1', 'user1');

      expect(result).toBeDefined(); // retorna sin esperar a checkAndAward
      resolveCheckAndAward(); // resolver la promesa pendiente (cleanup)
    });
  });

  // ─── recentLessons ───────────────────────────────────────────────────────────

  describe('recentLessons', () => {
    it('devuelve las lecciones completadas más recientes con contexto de curso', async () => {
      const now = new Date();
      mockPrisma.userProgress.findMany.mockResolvedValue([
        {
          lessonId: 'l1',
          completedAt: now,
          lesson: {
            title: 'Defensa individual',
            type: 'VIDEO',
            module: {
              title: 'Módulo de Defensa',
              course: { id: 'c1', title: 'Curso Base de Baloncesto' },
            },
          },
        },
        {
          lessonId: 'l2',
          completedAt: new Date(now.getTime() - 3_600_000),
          lesson: {
            title: 'Quiz de Ataque',
            type: 'QUIZ',
            module: {
              title: 'Módulo de Ataque',
              course: { id: 'c1', title: 'Curso Base de Baloncesto' },
            },
          },
        },
      ]);

      const result = await service.recentLessons('user1', 5);

      expect(result).toHaveLength(2);
      expect(result[0].lessonId).toBe('l1');
      expect(result[0].lessonTitle).toBe('Defensa individual');
      expect(result[0].lessonType).toBe('VIDEO');
      expect(result[0].moduleTitle).toBe('Módulo de Defensa');
      expect(result[0].courseId).toBe('c1');
      expect(result[0].courseTitle).toBe('Curso Base de Baloncesto');
      expect(result[0].completedAt).toEqual(now);
    });

    it('pasa el parámetro take correcto a Prisma', async () => {
      mockPrisma.userProgress.findMany.mockResolvedValue([]);

      await service.recentLessons('user1', 3);

      expect(mockPrisma.userProgress.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 3 }),
      );
    });

    it('usa el valor por defecto de 5 si no se especifica take', async () => {
      mockPrisma.userProgress.findMany.mockResolvedValue([]);

      await service.recentLessons('user1');

      expect(mockPrisma.userProgress.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });

    it('filtra solo lecciones completadas (completed: true)', async () => {
      mockPrisma.userProgress.findMany.mockResolvedValue([]);

      await service.recentLessons('user1', 10);

      const prismaCall = mockPrisma.userProgress.findMany.mock.calls[0][0];
      expect(prismaCall.where.completed).toBe(true);
    });

    it('devuelve array vacío si el usuario no tiene lecciones completadas', async () => {
      mockPrisma.userProgress.findMany.mockResolvedValue([]);

      const result = await service.recentLessons('user1', 5);

      expect(result).toHaveLength(0);
    });
  });
});
