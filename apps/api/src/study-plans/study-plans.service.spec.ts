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
    $transaction: jest.Mock;
  };
  let theory: { generate: jest.Mock; getById: jest.Mock; deleteById: jest.Mock };
  let exercises: { generateForTopics: jest.Mock };
  let aiExams: { generateForTopics: jest.Mock; getBank: jest.Mock; deleteBank: jest.Mock };
  let service: StudyPlansService;

  const theoryResult = { id: 'tm-1', title: 'Fracciones', summary: 'resumen', lessons: [] };
  const examResult = {
    id: 'bank-1',
    title: 'Simulacro',
    topic: 'Fracciones · Ecuaciones',
    numQuestions: 5,
    timeLimit: null,
    onlyOnce: false,
    attemptCount: 0,
    questions: [],
  };
  const exercisesResult = {
    exercises: [
      {
        topicLabel: 'Fracciones',
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

  function stubPlanForGetById(over: Record<string, unknown> = {}) {
    prisma.studyPlan.findUnique.mockResolvedValue({
      id: 'plan-1',
      userId: 'user-1',
      courseId: 'course-mates',
      title: 'Simulacro: Fracciones',
      summary: 'resumen',
      difficulty: 'MEDIUM',
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
      examBank: { id: 'bank-1' },
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
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
    };
    theory = {
      generate: jest.fn().mockResolvedValue(theoryResult),
      getById: jest.fn().mockResolvedValue(theoryResult),
      deleteById: jest.fn().mockResolvedValue(undefined),
    };
    exercises = { generateForTopics: jest.fn().mockResolvedValue(exercisesResult) };
    aiExams = {
      generateForTopics: jest.fn().mockResolvedValue(examResult),
      getBank: jest.fn().mockResolvedValue(examResult),
      deleteBank: jest.fn().mockResolvedValue({ ok: true }),
    };
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
      numExercises: 5,
      difficulty: 'MEDIUM' as const,
      numQuestions: 5 as const,
    };

    it('rechaza con 422 si numQuestions < número de temas', async () => {
      await expect(
        service.create('user-1', {
          ...dto,
          numQuestions: 5,
          topics: [
            { title: 'tema uno' },
            { title: 'tema dos' },
            { title: 'tema tres' },
            { title: 'tema cuatro' },
            { title: 'tema cinco' },
            { title: 'tema seis' },
          ],
        }),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(prisma.studyPlan.create).not.toHaveBeenCalled();
    });

    it('crea el plan, genera teoría con el contexto de cada tema y enlaza las secciones', async () => {
      stubPlanForGetById();
      const result = await service.create('user-1', dto);

      expect(prisma.studyPlan.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Simulacro: Fracciones',
            difficulty: 'MEDIUM',
          }),
        }),
      );
      expect(theory.generate).toHaveBeenCalledWith('user-1', {
        courseId: 'course-mates',
        topic: 'Fracciones',
      });
      expect(exercises.generateForTopics).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ topics: ['Fracciones'], count: 5, difficulty: 'MEDIUM' }),
      );
      expect(aiExams.generateForTopics).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ topics: ['Fracciones'], numQuestions: 5 }),
      );
      expect(prisma.theoryModule.update).toHaveBeenCalledWith({
        where: { id: 'tm-1' },
        data: { studyPlanTopicId: 'topic-0' },
      });
      expect(prisma.aiExamBank.update).toHaveBeenCalledWith({
        where: { id: 'bank-1' },
        data: { studyPlanId: 'plan-1' },
      });
      expect(result.sections).toEqual({ theory: true, exercises: true, exam: true });
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
      expect(prisma.aiExamBank.update).toHaveBeenCalled(); // el examen sí se enlaza
      expect(result.sections.theory).toBe(false);
      expect(result.topics[0].hasTheory).toBe(false);
    });

    it('fallo total: si TODO falla, borra la cáscara y lanza 500 (sin plan huérfano)', async () => {
      theory.generate.mockRejectedValue(new Error('IA caída'));
      exercises.generateForTopics.mockRejectedValue(new Error('IA caída'));
      aiExams.generateForTopics.mockRejectedValue(new Error('IA caída'));

      await expect(service.create('user-1', dto)).rejects.toThrow(InternalServerErrorException);
      expect(prisma.studyPlan.delete).toHaveBeenCalledWith({ where: { id: 'plan-1' } });
    });

    it('si el enlace transaccional falla, borra la cáscara y propaga el error', async () => {
      prisma.$transaction.mockRejectedValue(new Error('conexión perdida'));

      await expect(service.create('user-1', dto)).rejects.toThrow('conexión perdida');
      expect(prisma.studyPlan.delete).toHaveBeenCalledWith({ where: { id: 'plan-1' } });
      // Los artefactos generados pero sin enlazar tampoco quedan huérfanos
      expect(prisma.theoryModule.delete).toHaveBeenCalledWith({ where: { id: 'tm-1' } });
      expect(prisma.aiExamBank.delete).toHaveBeenCalledWith({ where: { id: 'bank-1' } });
    });

    it('rechaza con 422 si numExercises < número de temas', async () => {
      await expect(
        service.create('user-1', {
          ...dto,
          numQuestions: 10,
          numExercises: 5,
          topics: [
            { title: 'tema uno' },
            { title: 'tema dos' },
            { title: 'tema tres' },
            { title: 'tema cuatro' },
            { title: 'tema cinco' },
            { title: 'tema seis' },
          ],
        }),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(prisma.studyPlan.create).not.toHaveBeenCalled();
    });
  });

  // ─── getById / deleteById: ownership ────────────────────────────────────────

  describe('getById', () => {
    it('lanza 404 si el plan no existe', async () => {
      prisma.studyPlan.findUnique.mockResolvedValue(null);
      await expect(service.getById('user-1', 'plan-fake')).rejects.toThrow(NotFoundException);
    });

    it('lanza 403 si el plan es de otro usuario', async () => {
      stubPlanForGetById({ userId: 'user-2' });
      await expect(service.getById('user-1', 'plan-1')).rejects.toThrow(ForbiddenException);
    });

    it('devuelve el examen vía aiExams.getBank (serialización sin isCorrect)', async () => {
      stubPlanForGetById();
      const result = await service.getById('user-1', 'plan-1');
      // getBank es el único camino al examen: su serialización ya oculta isCorrect
      expect(aiExams.getBank).toHaveBeenCalledWith('user-1', 'bank-1');
      expect(result.exam).toBe(examResult);
      expect(JSON.stringify(result.exam)).not.toContain('isCorrect');
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
});
