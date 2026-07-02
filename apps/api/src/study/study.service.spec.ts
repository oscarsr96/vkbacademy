import {
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { StudyService } from './study.service';

describe('StudyService', () => {
  let prisma: {
    course: { findUnique: jest.Mock };
    enrollment: { findFirst: jest.Mock };
    studyUnit: {
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
    };
    theoryModule: { update: jest.Mock };
    aiExamBank: { update: jest.Mock };
    $transaction: jest.Mock;
  };
  let theory: { generate: jest.Mock; getById: jest.Mock; deleteById: jest.Mock };
  let exercises: { generate: jest.Mock };
  let aiExams: { generate: jest.Mock; getBank: jest.Mock; deleteBank: jest.Mock };
  let service: StudyService;

  const theoryResult = { id: 'tm-1', title: 'Logaritmos', summary: 'resumen', lessons: [] };
  const examResult = {
    id: 'bank-1',
    title: 'Examen',
    topic: 't',
    numQuestions: 5,
    timeLimit: null,
    onlyOnce: false,
    attemptCount: 0,
    questions: [],
  };
  const exercisesResult = {
    exercises: [{ statement: 'x', type: 'OPEN', options: [], solution: 'y', explanation: 'z' }],
  };

  function stubUnitForGetById(over: Record<string, unknown> = {}) {
    prisma.studyUnit.findUnique.mockResolvedValue({
      id: 'unit-1',
      userId: 'user-1',
      courseId: 'course-1',
      topic: 't',
      title: 'Logaritmos',
      summary: 'resumen',
      createdAt: new Date(),
      exercises: exercisesResult.exercises,
      course: { id: 'course-1', title: 'Mates' },
      theoryModule: { id: 'tm-1' },
      examBank: { id: 'bank-1' },
      ...over,
    });
  }

  beforeEach(() => {
    prisma = {
      course: { findUnique: jest.fn().mockResolvedValue({ id: 'course-1', title: 'Mates' }) },
      enrollment: { findFirst: jest.fn().mockResolvedValue({ id: 'enr-1' }) },
      studyUnit: {
        create: jest.fn().mockResolvedValue({ id: 'unit-1' }),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      theoryModule: { update: jest.fn().mockResolvedValue({}) },
      aiExamBank: { update: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
    };
    theory = {
      generate: jest.fn().mockResolvedValue(theoryResult),
      getById: jest.fn().mockResolvedValue(theoryResult),
      deleteById: jest.fn().mockResolvedValue(undefined),
    };
    exercises = { generate: jest.fn().mockResolvedValue(exercisesResult) };
    aiExams = {
      generate: jest.fn().mockResolvedValue(examResult),
      getBank: jest.fn().mockResolvedValue(examResult),
      deleteBank: jest.fn().mockResolvedValue({ ok: true }),
    };
    service = new StudyService(
      prisma as never,
      theory as never,
      exercises as never,
      aiExams as never,
    );
  });

  describe('create', () => {
    it('crea la unidad y enlaza las 3 secciones cuando todas se generan', async () => {
      stubUnitForGetById();
      const result = await service.create('user-1', {
        courseId: 'course-1',
        topic: 't',
        numExercises: 1,
        numQuestions: 5,
      });
      expect(prisma.studyUnit.create).toHaveBeenCalled();
      expect(prisma.theoryModule.update).toHaveBeenCalledWith({
        where: { id: 'tm-1' },
        data: { studyUnitId: 'unit-1' },
      });
      expect(prisma.aiExamBank.update).toHaveBeenCalledWith({
        where: { id: 'bank-1' },
        data: { studyUnitId: 'unit-1' },
      });
      expect(result.sections).toEqual({ theory: true, exercises: true, exam: true });
    });

    it('crea la unidad aunque falle una sección (examen) y la marca ausente', async () => {
      aiExams.generate.mockRejectedValue(new Error('IA caída'));
      stubUnitForGetById({ examBank: null });
      const result = await service.create('user-1', {
        courseId: 'course-1',
        topic: 't',
        numExercises: 1,
        numQuestions: 5,
      });
      expect(prisma.aiExamBank.update).not.toHaveBeenCalled();
      expect(result.sections.exam).toBe(false);
      expect(result.sections.theory).toBe(true);
    });

    it('borra la unidad y lanza error si fallan las 3 secciones', async () => {
      theory.generate.mockRejectedValue(new Error('x'));
      exercises.generate.mockRejectedValue(new Error('y'));
      aiExams.generate.mockRejectedValue(new Error('z'));
      await expect(
        service.create('user-1', {
          courseId: 'course-1',
          topic: 't',
          numExercises: 1,
          numQuestions: 5,
        }),
      ).rejects.toThrow(InternalServerErrorException);
      expect(prisma.studyUnit.delete).toHaveBeenCalledWith({ where: { id: 'unit-1' } });
    });

    it('borra la unidad cáscara y relanza el error si la transacción de enlace falla', async () => {
      stubUnitForGetById();
      prisma.$transaction.mockRejectedValue(new Error('tx failed'));
      await expect(
        service.create('user-1', {
          courseId: 'course-1',
          topic: 't',
          numExercises: 1,
          numQuestions: 5,
        }),
      ).rejects.toThrow('tx failed');
      expect(prisma.studyUnit.delete).toHaveBeenCalledWith({ where: { id: 'unit-1' } });
    });

    it('lanza ForbiddenException si el alumno no está matriculado', async () => {
      prisma.enrollment.findFirst.mockResolvedValue(null);
      await expect(
        service.create('user-1', {
          courseId: 'course-1',
          topic: 't',
          numExercises: 1,
          numQuestions: 5,
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.studyUnit.create).not.toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('lanza ForbiddenException si la unidad es de otro alumno', async () => {
      stubUnitForGetById({ userId: 'someone-else' });
      await expect(service.getById('user-1', 'unit-1')).rejects.toThrow(ForbiddenException);
    });

    it('lanza NotFoundException si no existe', async () => {
      prisma.studyUnit.findUnique.mockResolvedValue(null);
      await expect(service.getById('user-1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });
});
