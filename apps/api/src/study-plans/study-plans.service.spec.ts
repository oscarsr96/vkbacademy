import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { StudyPlansService } from './study-plans.service';

describe('StudyPlansService', () => {
  let prisma: {
    course: { findUnique: jest.Mock };
    enrollment: { findFirst: jest.Mock; findMany: jest.Mock };
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
    $transaction: jest.Mock;
  };
  let theory: { generate: jest.Mock; getById: jest.Mock; deleteById: jest.Mock };
  let exercises: { generateForTopics: jest.Mock };
  let aiExams: { generateForTopics: jest.Mock };
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

  // Matrículas: curso base de Matemáticas; opcionalmente también Lengua.
  const mathEnrollment = {
    id: 'enr-1',
    courseId: 'course-mates',
    course: { id: 'course-mates', subject: 'Matemáticas' },
  };
  const lenguaEnrollment = {
    id: 'enr-2',
    courseId: 'course-lengua',
    course: { id: 'course-lengua', subject: 'Lengua' },
  };

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
        findUnique: jest.fn().mockResolvedValue({ id: 'course-mates', title: 'Matemáticas 3º ESO' }),
      },
      enrollment: {
        findFirst: jest.fn().mockResolvedValue({ id: 'enr-1' }),
        findMany: jest.fn().mockResolvedValue([mathEnrollment]),
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
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
    };
    theory = {
      generate: jest.fn().mockResolvedValue(theoryResult),
      getById: jest.fn().mockResolvedValue(theoryResult),
      deleteById: jest.fn().mockResolvedValue(undefined),
    };
    exercises = { generateForTopics: jest.fn().mockResolvedValue(exercisesResult) };
    aiExams = { generateForTopics: jest.fn().mockResolvedValue({ id: 'bank-1' }) };
    service = new StudyPlansService(
      prisma as never,
      theory as never,
      exercises as never,
      aiExams as never,
    );
  });

  // ─── resolveAndAssertTopics: regla de coherencia (criterio 2) ─────────────

  describe('resolveAndAssertTopics', () => {
    it('rechaza con 422 un tema con subject de una materia NO matriculada, listando las válidas', async () => {
      // Matriculado solo en Matemáticas → "lengua" no es coherente
      await expect(
        service.resolveAndAssertTopics('user-1', 'course-mates', [
          { title: 'análisis morfológico', subject: 'lengua' },
        ]),
      ).rejects.toThrow(UnprocessableEntityException);

      await expect(
        service.resolveAndAssertTopics('user-1', 'course-mates', [
          { title: 'análisis morfológico', subject: 'lengua' },
        ]),
      ).rejects.toThrow(/Materias válidas: Matemáticas/);
    });

    it('acepta un tema con subject matriculado, ignorando mayúsculas y acentos', async () => {
      // "matematicas" (sin tilde, minúsculas) debe casar con "Matemáticas"
      const resolved = await service.resolveAndAssertTopics('user-1', 'course-mates', [
        { title: 'ecuaciones de segundo grado', subject: 'matematicas' },
      ]);
      expect(resolved).toHaveLength(1);
      expect(resolved[0].source).toBe('CUSTOM');
      expect(resolved[0].contextCourseId).toBe('course-mates');
      expect(resolved[0].subject).toBe('matematicas');
    });

    it('atribuye a la asignatura base un tema libre sin subject', async () => {
      const resolved = await service.resolveAndAssertTopics('user-1', 'course-mates', [
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

    it('resuelve un tema de otra asignatura matriculada con el contexto de esa asignatura', async () => {
      // Matriculado en Mates + Lengua → "análisis morfológico" (lengua) es coherente
      prisma.enrollment.findMany.mockResolvedValue([mathEnrollment, lenguaEnrollment]);

      const resolved = await service.resolveAndAssertTopics('user-1', 'course-mates', [
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

      const resolved = await service.resolveAndAssertTopics('user-1', 'course-mates', [
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
        service.resolveAndAssertTopics('user-1', 'course-mates', [{ moduleId: 'mod-fake' }]),
      ).rejects.toThrow(NotFoundException);
    });

    it('rechaza con 403 un módulo de un curso donde el alumno NO está matriculado', async () => {
      prisma.module.findUnique.mockResolvedValue({
        id: 'mod-2',
        title: 'Sintaxis',
        courseId: 'course-lengua', // solo matriculado en Mates
      });

      await expect(
        service.resolveAndAssertTopics('user-1', 'course-mates', [{ moduleId: 'mod-2' }]),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rechaza con 422 temas duplicados por moduleId', async () => {
      prisma.module.findUnique.mockResolvedValue({
        id: 'mod-1',
        title: 'Fracciones',
        courseId: 'course-mates',
      });

      await expect(
        service.resolveAndAssertTopics('user-1', 'course-mates', [
          { moduleId: 'mod-1' },
          { moduleId: 'mod-1' },
        ]),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('rechaza con 422 temas duplicados por título normalizado (acentos/mayúsculas)', async () => {
      await expect(
        service.resolveAndAssertTopics('user-1', 'course-mates', [
          { title: 'Ecuaciones' },
          { title: '  ecuaciónes '.replace('ó', 'o') }, // "ecuaciones" normalizado
        ]),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('rechaza con 400 un tema con moduleId y title a la vez', async () => {
      await expect(
        service.resolveAndAssertTopics('user-1', 'course-mates', [
          { moduleId: 'mod-1', title: 'Fracciones' },
        ]),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza con 400 un subject acompañando a un moduleId', async () => {
      await expect(
        service.resolveAndAssertTopics('user-1', 'course-mates', [
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
      expect(exercises.generateForTopics).toHaveBeenCalledWith('user-1', {
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
      prisma.enrollment.findMany.mockResolvedValue([mathEnrollment, lenguaEnrollment]);
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

      expect(exercises.generateForTopics).toHaveBeenCalledWith('user-1', {
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
        'user-1',
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
});
