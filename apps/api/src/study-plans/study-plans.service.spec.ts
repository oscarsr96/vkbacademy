import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { StudyPlansService, withExerciseIds } from './study-plans.service';

describe('StudyPlansService', () => {
  let prisma: {
    course: { findUnique: jest.Mock; findMany: jest.Mock };
    module: { findUnique: jest.Mock };
    studyPlan: {
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
    };
    theoryModule: { update: jest.Mock; delete: jest.Mock };
    aiExamBank: { update: jest.Mock; delete: jest.Mock };
    examAttempt: { groupBy: jest.Mock };
    exerciseAttempt: { upsert: jest.Mock; updateMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let theory: { generate: jest.Mock; getById: jest.Mock; deleteById: jest.Mock };
  let exercises: { generateForTopics: jest.Mock; evaluate: jest.Mock };
  let aiExams: { generateForTopics: jest.Mock };
  let challenges: { checkAndAward: jest.Mock; bumpCorrectStreak: jest.Mock };
  let service: StudyPlansService;

  const theoryResult = { id: 'tm-1', title: 'Fracciones', summary: 'resumen', lessons: [] };
  const exercisesResult = {
    exercises: [
      {
        topicLabel: 'Fracciones',
        difficulty: 'EASY',
        statement: 'x',
        type: 'OPEN',
        options: [],
        solution: 'y',
        explanation: 'z',
      },
    ],
  };

  // Asignaturas publicadas: la base de Matemáticas; opcionalmente también Lengua.
  // No hay matrícula: cualquier asignatura publicada es estudiable.
  const mathCourse = { id: 'course-mates', subject: 'Matemáticas' };
  const lenguaCourse = { id: 'course-lengua', subject: 'Lengua' };

  // Sirve tanto a getById como a requireOwnedPlan: mismo mock de
  // studyPlan.findUnique para ambos caminos (union de campos usados por los dos).
  function stubPlanForGetById(over: Record<string, unknown> = {}) {
    prisma.studyPlan.findUnique.mockResolvedValue({
      id: 'plan-1',
      userId: 'user-1',
      courseId: 'course-mates',
      title: 'Fracciones',
      summary: 'resumen',
      difficulty: 'MEDIUM',
      exercisesConfig: null,
      createdAt: new Date(),
      exercises: exercisesResult.exercises,
      course: { id: 'course-mates', title: 'Matemáticas 3º ESO' },
      topics: [
        {
          id: 'topic-0',
          order: 0,
          source: 'CUSTOM',
          moduleId: null,
          title: 'Fracciones',
          subject: null,
          contextCourseId: 'course-mates',
          theoryModule: { id: 'tm-1' },
        },
      ],
      examBanks: [],
      ...over,
    });
  }

  beforeEach(() => {
    prisma = {
      course: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'course-mates', title: 'Matemáticas 3º ESO' }),
        findMany: jest.fn().mockResolvedValue([mathCourse]),
      },
      module: { findUnique: jest.fn() },
      studyPlan: {
        create: jest.fn().mockResolvedValue({
          id: 'plan-1',
          topics: [
            {
              id: 'topic-0',
              order: 0,
              title: 'Fracciones',
              contextCourseId: 'course-mates',
            },
          ],
        }),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      theoryModule: {
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
      aiExamBank: {
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
      examAttempt: { groupBy: jest.fn().mockResolvedValue([]) },
      exerciseAttempt: {
        upsert: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
    };
    theory = {
      generate: jest.fn().mockResolvedValue(theoryResult),
      getById: jest.fn().mockResolvedValue(theoryResult),
      deleteById: jest.fn().mockResolvedValue(undefined),
    };
    exercises = {
      generateForTopics: jest.fn().mockResolvedValue(exercisesResult),
      evaluate: jest.fn(),
    };
    aiExams = { generateForTopics: jest.fn().mockResolvedValue({ id: 'bank-1' }) };
    challenges = { checkAndAward: jest.fn(), bumpCorrectStreak: jest.fn() };
    service = new StudyPlansService(
      prisma as never,
      theory as never,
      exercises as never,
      aiExams as never,
      challenges as never,
    );
  });

  // ─── resolveAndAssertTopics: regla de coherencia (criterio 2) ─────────────

  describe('resolveAndAssertTopics', () => {
    it('rechaza con 422 un tema con subject de una materia inexistente, listando las válidas', async () => {
      // Solo existe Matemáticas → "lengua" no es coherente
      await expect(
        service.resolveAndAssertTopics('course-mates', [
          { title: 'análisis morfológico', subject: 'lengua' },
        ]),
      ).rejects.toThrow(UnprocessableEntityException);

      await expect(
        service.resolveAndAssertTopics('course-mates', [
          { title: 'análisis morfológico', subject: 'lengua' },
        ]),
      ).rejects.toThrow(/Materias válidas: Matemáticas/);
    });

    it('acepta un tema con subject de una materia existente, ignorando mayúsculas y acentos', async () => {
      // "matematicas" (sin tilde, minúsculas) debe casar con "Matemáticas"
      const resolved = await service.resolveAndAssertTopics('course-mates', [
        { title: 'ecuaciones de segundo grado', subject: 'matematicas' },
      ]);
      expect(resolved).toHaveLength(1);
      expect(resolved[0].source).toBe('CUSTOM');
      expect(resolved[0].contextCourseId).toBe('course-mates');
      expect(resolved[0].subject).toBe('matematicas');
    });

    it('atribuye a la asignatura base un tema libre sin subject', async () => {
      const resolved = await service.resolveAndAssertTopics('course-mates', [
        { title: 'proporcionalidad' },
      ]);
      expect(resolved[0]).toMatchObject({
        source: 'CUSTOM',
        moduleId: null,
        title: 'proporcionalidad',
        subject: null,
        contextCourseId: 'course-mates',
      });
    });

    it('resuelve un tema de otra asignatura con el contexto de esa asignatura', async () => {
      // Existen Mates + Lengua → "análisis morfológico" (lengua) es coherente
      prisma.course.findMany.mockResolvedValue([mathCourse, lenguaCourse]);

      const resolved = await service.resolveAndAssertTopics('course-mates', [
        { title: 'análisis morfológico', subject: 'lengua' },
      ]);
      expect(resolved[0].contextCourseId).toBe('course-lengua');
      expect(resolved[0].source).toBe('CUSTOM');
    });

    it('resuelve un tema oficial (moduleId) copiando título y curso del módulo', async () => {
      prisma.module.findUnique.mockResolvedValue({
        id: 'mod-1',
        title: 'Tema 1 — Fracciones',
        courseId: 'course-mates',
      });

      const resolved = await service.resolveAndAssertTopics('course-mates', [
        { moduleId: 'mod-1' },
      ]);
      expect(resolved[0]).toMatchObject({
        source: 'OFFICIAL',
        moduleId: 'mod-1',
        title: 'Tema 1 — Fracciones',
        contextCourseId: 'course-mates',
      });
    });

    it('rechaza con 404 un moduleId inexistente', async () => {
      prisma.module.findUnique.mockResolvedValue(null);

      await expect(
        service.resolveAndAssertTopics('course-mates', [{ moduleId: 'mod-fake' }]),
      ).rejects.toThrow(NotFoundException);
    });

    it('acepta un módulo de otra asignatura sin exigir matrícula, con el curso del módulo como contexto', async () => {
      prisma.module.findUnique.mockResolvedValue({
        id: 'mod-2',
        title: 'Sintaxis',
        courseId: 'course-lengua', // la base es Mates: ya no hace falta matrícula
      });

      const resolved = await service.resolveAndAssertTopics('course-mates', [
        { moduleId: 'mod-2' },
      ]);
      expect(resolved[0]).toMatchObject({
        source: 'OFFICIAL',
        moduleId: 'mod-2',
        title: 'Sintaxis',
        contextCourseId: 'course-lengua',
      });
    });

    it('rechaza con 422 temas duplicados por moduleId', async () => {
      prisma.module.findUnique.mockResolvedValue({
        id: 'mod-1',
        title: 'Fracciones',
        courseId: 'course-mates',
      });

      await expect(
        service.resolveAndAssertTopics('course-mates', [
          { moduleId: 'mod-1' },
          { moduleId: 'mod-1' },
        ]),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('rechaza con 422 temas duplicados por título normalizado (acentos/mayúsculas)', async () => {
      await expect(
        service.resolveAndAssertTopics('course-mates', [
          { title: 'Ecuaciones' },
          { title: '  ecuaciónes '.replace('ó', 'o') }, // "ecuaciones" normalizado
        ]),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('rechaza con 400 un tema con moduleId y title a la vez', async () => {
      await expect(
        service.resolveAndAssertTopics('course-mates', [
          { moduleId: 'mod-1', title: 'Fracciones' },
        ]),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza con 400 un subject acompañando a un moduleId', async () => {
      await expect(
        service.resolveAndAssertTopics('course-mates', [
          { moduleId: 'mod-1', subject: 'lengua' } as never,
        ]),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── create: orquestación y fallos (criterio 5) ────────────────────────────

  describe('create', () => {
    const dto = {
      courseId: 'course-mates',
      topics: [{ title: 'Fracciones' }],
      exercisesPerTopic: { easy: 2, medium: 2, hard: 1 },
    };

    it('rechaza con 422 si el reparto de ejercicios por tema no suma entre 1 y 10', async () => {
      await expect(
        service.create('user-1', { ...dto, exercisesPerTopic: { easy: 0, medium: 0, hard: 0 } }),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(prisma.studyPlan.create).not.toHaveBeenCalled();

      await expect(
        service.create('user-1', { ...dto, exercisesPerTopic: { easy: 10, medium: 10, hard: 10 } }),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(prisma.studyPlan.create).not.toHaveBeenCalled();
    });

    it('crea el plan, genera teoría y ejercicios por tema, y enlaza las secciones (sin examen)', async () => {
      stubPlanForGetById();
      const result = await service.create('user-1', dto);

      expect(prisma.studyPlan.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Fracciones',
            exercisesConfig: { easy: 2, medium: 2, hard: 1 },
          }),
        }),
      );
      expect(theory.generate).toHaveBeenCalledWith('user-1', {
        courseId: 'course-mates',
        topic: 'Fracciones',
      });
      expect(exercises.generateForTopics).toHaveBeenCalledWith({
        courseId: 'course-mates',
        topics: ['Fracciones'],
        perTopic: { easy: 2, medium: 2, hard: 1 },
      });
      expect(aiExams.generateForTopics).not.toHaveBeenCalled();
      expect(prisma.theoryModule.update).toHaveBeenCalledWith({
        where: { id: 'tm-1' },
        data: { studyPlanTopicId: 'topic-0' },
      });
      expect(prisma.aiExamBank.update).not.toHaveBeenCalled();
      expect(result.sections).toEqual({ theory: true, exercises: true, exam: false });
    });

    it('la teoría de cada tema usa su contextCourseId (tema de otra asignatura)', async () => {
      prisma.course.findMany.mockResolvedValue([mathCourse, lenguaCourse]);
      prisma.studyPlan.create.mockResolvedValue({
        id: 'plan-1',
        topics: [
          { id: 'topic-0', order: 0, title: 'Fracciones', contextCourseId: 'course-mates' },
          {
            id: 'topic-1',
            order: 1,
            title: 'análisis morfológico',
            contextCourseId: 'course-lengua',
          },
        ],
      });
      stubPlanForGetById();

      await service.create('user-1', {
        ...dto,
        topics: [{ title: 'Fracciones' }, { title: 'análisis morfológico', subject: 'lengua' }],
      });

      expect(theory.generate).toHaveBeenCalledWith('user-1', {
        courseId: 'course-mates',
        topic: 'Fracciones',
      });
      expect(theory.generate).toHaveBeenCalledWith('user-1', {
        courseId: 'course-lengua',
        topic: 'análisis morfológico',
      });
    });

    it('fallo parcial: si la teoría falla pero el resto no, el plan se crea sin ese enlace', async () => {
      theory.generate.mockRejectedValue(new Error('IA caída'));
      stubPlanForGetById({
        topics: [
          {
            id: 'topic-0',
            order: 0,
            source: 'CUSTOM',
            moduleId: null,
            title: 'Fracciones',
            subject: null,
            contextCourseId: 'course-mates',
            theoryModule: null, // sin deck
          },
        ],
      });

      const result = await service.create('user-1', dto);

      expect(prisma.studyPlan.delete).not.toHaveBeenCalled();
      expect(prisma.theoryModule.update).not.toHaveBeenCalled();
      expect(result.sections.theory).toBe(false);
      expect(result.topics[0].hasTheory).toBe(false);
    });

    it('fallo total: si TODO falla, borra la cáscara y lanza 500 (sin plan huérfano)', async () => {
      theory.generate.mockRejectedValue(new Error('IA caída'));
      exercises.generateForTopics.mockRejectedValue(new Error('IA caída'));

      await expect(service.create('user-1', dto)).rejects.toThrow(InternalServerErrorException);
      expect(prisma.studyPlan.delete).toHaveBeenCalledWith({ where: { id: 'plan-1' } });
    });

    it('si el enlace transaccional falla, borra la cáscara y propaga el error', async () => {
      prisma.$transaction.mockRejectedValue(new Error('conexión perdida'));

      await expect(service.create('user-1', dto)).rejects.toThrow('conexión perdida');
      expect(prisma.studyPlan.delete).toHaveBeenCalledWith({ where: { id: 'plan-1' } });
      // Los artefactos generados pero sin enlazar tampoco quedan huérfanos
      expect(prisma.theoryModule.delete).toHaveBeenCalledWith({ where: { id: 'tm-1' } });
    });
  });

  // ─── getById / deleteById: ownership y exámenes lazy ────────────────────────

  describe('getById', () => {
    it('lanza 404 si el plan no existe', async () => {
      prisma.studyPlan.findUnique.mockResolvedValue(null);
      await expect(service.getById('user-1', 'plan-fake')).rejects.toThrow(NotFoundException);
    });

    it('lanza 403 si el plan es de otro usuario', async () => {
      stubPlanForGetById({ userId: 'user-2' });
      await expect(service.getById('user-1', 'plan-1')).rejects.toThrow(ForbiddenException);
    });

    it('no llama a examAttempt.groupBy si el plan no tiene examBanks', async () => {
      stubPlanForGetById(); // examBanks: []
      const result = await service.getById('user-1', 'plan-1');
      expect(prisma.examAttempt.groupBy).not.toHaveBeenCalled();
      expect(result.exams).toEqual([]);
      expect(result.sections.exam).toBe(false);
    });

    it('devuelve exams desde examBanks con attemptCount y bestScore vía examAttempt.groupBy', async () => {
      stubPlanForGetById({
        examBanks: [
          {
            id: 'bank-1',
            title: 'Básico',
            level: 'BASIC',
            studyPlanTopicId: null,
            numQuestions: 5,
            timeLimit: null,
            onlyOnce: false,
          },
        ],
      });
      prisma.examAttempt.groupBy.mockResolvedValue([
        { aiExamBankId: 'bank-1', _count: { _all: 3 }, _max: { score: 80 } },
      ]);

      const result = await service.getById('user-1', 'plan-1');

      expect(prisma.examAttempt.groupBy).toHaveBeenCalledWith({
        by: ['aiExamBankId'],
        where: { aiExamBankId: { in: ['bank-1'] }, userId: 'user-1' },
        _count: { _all: true },
        _max: { score: true },
      });
      expect(result.exams).toEqual([
        {
          id: 'bank-1',
          title: 'Básico',
          level: 'BASIC',
          topicId: null,
          numQuestions: 5,
          timeLimit: null,
          onlyOnce: false,
          attemptCount: 3,
          bestScore: 80,
        },
      ]);
      expect(result.sections.exam).toBe(true);
    });
  });

  describe('regenerateTopicTheory', () => {
    it('regenera el deck de un tema fallido y lo enlaza al tema', async () => {
      stubPlanForGetById({
        topics: [
          {
            id: 'topic-0',
            order: 0,
            source: 'CUSTOM',
            moduleId: null,
            title: 'Fracciones',
            subject: null,
            contextCourseId: 'course-mates',
            theoryModule: null,
          },
        ],
      });

      await service.regenerateTopicTheory('user-1', 'plan-1', 'topic-0');

      expect(theory.deleteById).not.toHaveBeenCalled(); // no había deck previo
      expect(theory.generate).toHaveBeenCalledWith('user-1', {
        courseId: 'course-mates',
        topic: 'Fracciones',
      });
      expect(prisma.theoryModule.update).toHaveBeenCalledWith({
        where: { id: 'tm-1' },
        data: { studyPlanTopicId: 'topic-0' },
      });
    });

    it('lanza 404 si el tema no pertenece al plan', async () => {
      stubPlanForGetById();
      await expect(
        service.regenerateTopicTheory('user-1', 'plan-1', 'topic-ajeno'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('regenerateExercises', () => {
    it('usa el exercisesConfig guardado como fallback cuando el dto va vacío', async () => {
      stubPlanForGetById({
        exercisesConfig: { easy: 3, medium: 1, hard: 0 },
        topics: [
          {
            id: 'topic-0',
            order: 0,
            source: 'CUSTOM',
            moduleId: null,
            title: 'Fracciones',
            subject: null,
            contextCourseId: 'course-mates',
            theoryModule: { id: 'tm-1' },
          },
        ],
      });

      await service.regenerateExercises('user-1', 'plan-1', {});

      expect(exercises.generateForTopics).toHaveBeenCalledWith({
        courseId: 'course-mates',
        topics: ['Fracciones'],
        perTopic: { easy: 3, medium: 1, hard: 0 },
      });
      expect(prisma.studyPlan.update).toHaveBeenCalledWith({
        where: { id: 'plan-1' },
        data: {
          exercises: exercisesResult.exercises,
          exercisesConfig: { easy: 3, medium: 1, hard: 0 },
        },
      });
    });

    it('el dto sobreescribe el reparto guardado campo a campo', async () => {
      stubPlanForGetById({ exercisesConfig: { easy: 3, medium: 1, hard: 0 } });

      await service.regenerateExercises('user-1', 'plan-1', { hard: 2 });

      expect(exercises.generateForTopics).toHaveBeenCalledWith(
        expect.objectContaining({ perTopic: { easy: 3, medium: 1, hard: 2 } }),
      );
    });
  });

  describe('generateExam', () => {
    it('preset BASIC: numQuestions 5, difficulty EASY, enlaza el banco con level BASIC', async () => {
      stubPlanForGetById();
      aiExams.generateForTopics.mockResolvedValue({ id: 'bank-1' });

      await service.generateExam('user-1', 'plan-1', { level: 'BASIC' });

      expect(aiExams.generateForTopics).toHaveBeenCalledWith('user-1', {
        courseId: 'course-mates',
        topics: ['Fracciones'],
        numQuestions: 5,
        difficulty: 'EASY',
      });
      expect(prisma.aiExamBank.update).toHaveBeenCalledWith({
        where: { id: 'bank-1' },
        data: { studyPlanId: 'plan-1', studyPlanTopicId: null, level: 'BASIC' },
      });
    });

    it('con topicId usa el contextCourseId del tema y genera solo su título', async () => {
      stubPlanForGetById({
        topics: [
          {
            id: 'topic-0',
            order: 0,
            source: 'CUSTOM',
            moduleId: null,
            title: 'Fracciones',
            subject: null,
            contextCourseId: 'course-mates',
            theoryModule: { id: 'tm-1' },
          },
          {
            id: 'topic-1',
            order: 1,
            source: 'CUSTOM',
            moduleId: null,
            title: 'análisis morfológico',
            subject: null,
            contextCourseId: 'course-lengua',
            theoryModule: null,
          },
        ],
      });
      aiExams.generateForTopics.mockResolvedValue({ id: 'bank-2' });

      await service.generateExam('user-1', 'plan-1', { level: 'MEDIUM', topicId: 'topic-1' });

      expect(aiExams.generateForTopics).toHaveBeenCalledWith('user-1', {
        courseId: 'course-lengua',
        topics: ['análisis morfológico'],
        numQuestions: 8,
        difficulty: 'MEDIUM',
      });
      expect(prisma.aiExamBank.update).toHaveBeenCalledWith({
        where: { id: 'bank-2' },
        data: { studyPlanId: 'plan-1', studyPlanTopicId: 'topic-1', level: 'MEDIUM' },
      });
    });

    it('idempotente: si ya existe un banco con el mismo (level, topicId), no llama a la IA', async () => {
      stubPlanForGetById({
        examBanks: [
          {
            id: 'bank-1',
            title: 'Básico',
            level: 'BASIC',
            studyPlanTopicId: null,
            numQuestions: 5,
            timeLimit: null,
            onlyOnce: false,
          },
        ],
      });

      await service.generateExam('user-1', 'plan-1', { level: 'BASIC' });

      expect(aiExams.generateForTopics).not.toHaveBeenCalled();
      expect(prisma.aiExamBank.update).not.toHaveBeenCalled();
    });

    it('rechaza con 422 si numQuestions es menor que el número de temas', async () => {
      stubPlanForGetById({
        topics: [
          {
            id: 'topic-0',
            order: 0,
            source: 'CUSTOM',
            moduleId: null,
            title: 'Tema 1',
            subject: null,
            contextCourseId: 'course-mates',
            theoryModule: null,
          },
          {
            id: 'topic-1',
            order: 1,
            source: 'CUSTOM',
            moduleId: null,
            title: 'Tema 2',
            subject: null,
            contextCourseId: 'course-mates',
            theoryModule: null,
          },
          {
            id: 'topic-2',
            order: 2,
            source: 'CUSTOM',
            moduleId: null,
            title: 'Tema 3',
            subject: null,
            contextCourseId: 'course-mates',
            theoryModule: null,
          },
        ],
      });

      await expect(
        service.generateExam('user-1', 'plan-1', { level: 'BASIC', numQuestions: 2 }),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(aiExams.generateForTopics).not.toHaveBeenCalled();
    });
  });

  describe('rename', () => {
    it('actualiza el título recortando espacios', async () => {
      stubPlanForGetById();

      await service.rename('user-1', 'plan-1', { title: '  Nuevo título  ' });

      expect(prisma.studyPlan.update).toHaveBeenCalledWith({
        where: { id: 'plan-1' },
        data: { title: 'Nuevo título' },
      });
    });

    it('lanza 403 si el plan pertenece a otro usuario', async () => {
      stubPlanForGetById({ userId: 'user-2' });

      await expect(service.rename('user-1', 'plan-1', { title: 'Nuevo título' })).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.studyPlan.update).not.toHaveBeenCalled();
    });
  });

  // ─── submitExerciseAttempt: corrección server-side, racha y checkAndAward ─

  describe('submitExerciseAttempt', () => {
    const PLAN = {
      id: 'plan-1',
      userId: 'user-1',
      courseId: 'course-mates',
      topics: [],
      exercises: [
        {
          id: 'ex-1',
          statement: '¿Cuánto es 1/2 + 1/2?',
          type: 'SINGLE',
          options: ['1', '2'],
          solution: '1',
          explanation: 'Suma de fracciones con igual denominador.',
          topicLabel: 'Fracciones',
          difficulty: 'HARD',
        },
      ],
    };

    // Plan con un ejercicio de respuesta abierta (rama OPEN → exercises.evaluate)
    const OPEN_PLAN = {
      ...PLAN,
      exercises: [
        {
          id: 'ex-open',
          statement: 'Explica cómo se suman fracciones con igual denominador',
          type: 'OPEN',
          options: [],
          solution: 'Se suman los numeradores y se mantiene el denominador',
          explanation: 'Regla básica.',
          topicLabel: 'Fracciones',
          difficulty: 'MEDIUM',
        },
      ],
    };

    // Plan anterior a Retos v2: los ejercicios no llevan `id`
    const LEGACY_PLAN = {
      ...PLAN,
      exercises: [{ ...PLAN.exercises[0], id: undefined }],
    };

    // El upsert devuelve la fila resultante. Si el id que vuelve es el que
    // generó el servicio, la fila la ha creado este intento; si no, ya existía.
    function upsertCreates() {
      prisma.exerciseAttempt.upsert.mockImplementation((args: { create: { id: string } }) =>
        Promise.resolve({ id: args.create.id }),
      );
    }
    function upsertFindsExisting() {
      prisma.exerciseAttempt.upsert.mockResolvedValue({ id: 'att-preexistente' });
    }

    it('corrige en servidor y guarda el intento como correcto', async () => {
      prisma.studyPlan.findUnique.mockResolvedValue(PLAN);
      upsertCreates();

      const res = await service.submitExerciseAttempt('user-1', 'plan-1', 'ex-1', {
        answer: '1',
      });

      expect(res.verdict).toBe('correct');
      expect(prisma.exerciseAttempt.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_exerciseId: { userId: 'user-1', exerciseId: 'ex-1' } },
          update: expect.objectContaining({ verdict: 'correct' }),
          create: expect.objectContaining({
            userId: 'user-1',
            studyPlanId: 'plan-1',
            exerciseId: 'ex-1',
            topicLabel: 'Fracciones',
            difficulty: 'HARD',
            verdict: 'correct',
          }),
        }),
      );
      expect(challenges.bumpCorrectStreak).toHaveBeenCalledWith('user-1', true);
      expect(challenges.checkAndAward).toHaveBeenCalledWith(
        'user-1',
        'EXERCISES_SOLVED',
        'HARD_EXERCISES_SOLVED',
        'EXERCISES_CORRECT_STREAK',
      );
    });

    it('marca incorrecto cuando la respuesta no coincide', async () => {
      prisma.studyPlan.findUnique.mockResolvedValue(PLAN);
      upsertCreates();

      const res = await service.submitExerciseAttempt('user-1', 'plan-1', 'ex-1', {
        answer: '2',
      });

      expect(res.verdict).toBe('incorrect');
      expect(challenges.bumpCorrectStreak).toHaveBeenCalledWith('user-1', false);
    });

    it('un reintento actualiza sin mover la racha de aciertos', async () => {
      prisma.studyPlan.findUnique.mockResolvedValue(PLAN);
      upsertFindsExisting();

      await service.submitExerciseAttempt('user-1', 'plan-1', 'ex-1', { answer: '1' });

      expect(prisma.exerciseAttempt.upsert).toHaveBeenCalledTimes(1);
      expect(challenges.bumpCorrectStreak).not.toHaveBeenCalled();
    });

    // I5 — carrera en el registro del intento
    it('dos envíos simultáneos del mismo ejercicio: el que pierde el unique no da 500 ni mueve la racha', async () => {
      prisma.studyPlan.findUnique.mockResolvedValue(PLAN);
      prisma.exerciseAttempt.upsert.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '5.22.0',
        }),
      );
      prisma.exerciseAttempt.updateMany.mockResolvedValue({ count: 1 });

      const res = await service.submitExerciseAttempt('user-1', 'plan-1', 'ex-1', { answer: '1' });

      expect(res.verdict).toBe('correct');
      expect(prisma.exerciseAttempt.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', exerciseId: 'ex-1' },
        data: expect.objectContaining({ verdict: 'correct' }),
      });
      // El intento ya existía: la racha no se mueve dos veces
      expect(challenges.bumpCorrectStreak).not.toHaveBeenCalled();
    });

    it('un fallo de BD distinto del unique sale como 500 con mensaje en español, no como error crudo de Prisma', async () => {
      prisma.studyPlan.findUnique.mockResolvedValue(PLAN);
      prisma.exerciseAttempt.upsert.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Timed out fetching a connection', {
          code: 'P2024',
          clientVersion: '5.22.0',
        }),
      );

      await expect(
        service.submitExerciseAttempt('user-1', 'plan-1', 'ex-1', { answer: '1' }),
      ).rejects.toThrow(InternalServerErrorException);
      await expect(
        service.submitExerciseAttempt('user-1', 'plan-1', 'ex-1', { answer: '1' }),
      ).rejects.toThrow(/No se pudo registrar tu respuesta/);
    });

    // M2 — la rama OPEN no tenía cobertura
    it('un ejercicio OPEN delega la corrección en exercises.evaluate y devuelve su feedback', async () => {
      prisma.studyPlan.findUnique.mockResolvedValue(OPEN_PLAN);
      upsertCreates();
      exercises.evaluate.mockResolvedValue({ verdict: 'correct', feedback: 'Bien razonado' });

      const res = await service.submitExerciseAttempt('user-1', 'plan-1', 'ex-open', {
        answer: 'Se suman los numeradores',
      });

      expect(exercises.evaluate).toHaveBeenCalledWith({
        statement: 'Explica cómo se suman fracciones con igual denominador',
        studentAnswer: 'Se suman los numeradores',
        solution: 'Se suman los numeradores y se mantiene el denominador',
      });
      expect(res.verdict).toBe('correct');
      expect(res.feedback).toBe('Bien razonado');
      expect(challenges.bumpCorrectStreak).toHaveBeenCalledWith('user-1', true);
    });

    it('un veredicto partial en un OPEN no cuenta como acierto: pone la racha a 0', async () => {
      prisma.studyPlan.findUnique.mockResolvedValue(OPEN_PLAN);
      upsertCreates();
      exercises.evaluate.mockResolvedValue({ verdict: 'partial', feedback: 'A medias' });

      const res = await service.submitExerciseAttempt('user-1', 'plan-1', 'ex-open', {
        answer: 'Se suman',
      });

      expect(res.verdict).toBe('partial');
      expect(challenges.bumpCorrectStreak).toHaveBeenCalledWith('user-1', false);
      expect(prisma.exerciseAttempt.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ create: expect.objectContaining({ verdict: 'partial' }) }),
      );
    });

    // I1 — ids legacy con el plan dentro
    it('un plan antiguo sin ids resuelve el ejercicio por su id legacy con el plan dentro', async () => {
      prisma.studyPlan.findUnique.mockResolvedValue(LEGACY_PLAN);
      upsertCreates();

      const res = await service.submitExerciseAttempt('user-1', 'plan-1', 'legacy-plan-1-0', {
        answer: '1',
      });

      expect(res.verdict).toBe('correct');
      expect(prisma.exerciseAttempt.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_exerciseId: { userId: 'user-1', exerciseId: 'legacy-plan-1-0' },
          },
        }),
      );
    });

    it('el id legacy de OTRO plan no resuelve en este (los planes antiguos no comparten ids)', async () => {
      prisma.studyPlan.findUnique.mockResolvedValue(LEGACY_PLAN);

      // "legacy-0" era el id que colisionaba entre planes antes del arreglo
      await expect(
        service.submitExerciseAttempt('user-1', 'plan-1', 'legacy-0', { answer: '1' }),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.submitExerciseAttempt('user-1', 'plan-1', 'legacy-plan-2-0', { answer: '1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('devuelve 404 si el ejercicio no esta en el plan', async () => {
      prisma.studyPlan.findUnique.mockResolvedValue(PLAN);

      await expect(
        service.submitExerciseAttempt('user-1', 'plan-1', 'no-existe', { answer: '1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('devuelve 403 si el plan no es del alumno', async () => {
      prisma.studyPlan.findUnique.mockResolvedValue({ ...PLAN, userId: 'otro' });

      await expect(
        service.submitExerciseAttempt('user-1', 'plan-1', 'ex-1', { answer: '1' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});

// ─── withExerciseIds: ids legacy únicos por plan (I1) ───────────────────────

describe('withExerciseIds', () => {
  // Los planes anteriores a Retos v2 llevan el id vacío
  const legacyExercise = {
    id: '',
    topicLabel: 'Fracciones',
    difficulty: 'EASY' as const,
    statement: 'x',
    type: 'OPEN' as const,
    options: [],
    solution: 'y',
    explanation: 'z',
  };

  it('respeta el id que ya trae el ejercicio', () => {
    const withId = { ...legacyExercise, id: 'ex-1' };
    expect(withExerciseIds([withId], 'plan-a')[0].id).toBe('ex-1');
  });

  it('deriva el id legacy del plan y del índice', () => {
    const ids = withExerciseIds([legacyExercise, legacyExercise], 'plan-a').map((e) => e.id);
    expect(ids).toEqual(['legacy-plan-a-0', 'legacy-plan-a-1']);
  });

  // El unique de ExerciseAttempt es (userId, exerciseId) SIN studyPlanId: si el
  // id legacy no llevara el plan, el ejercicio 0 de dos planes antiguos del
  // mismo alumno compartiría fila de intento.
  it('dos planes antiguos del mismo alumno no comparten ningún id', () => {
    const a = withExerciseIds([legacyExercise, legacyExercise], 'plan-a').map((e) => e.id);
    const b = withExerciseIds([legacyExercise, legacyExercise], 'plan-b').map((e) => e.id);
    expect(a.filter((id) => b.includes(id))).toEqual([]);
  });
});
