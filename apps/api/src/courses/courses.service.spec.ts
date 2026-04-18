import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CoursesService } from './courses.service';

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

const fakeCourse = {
  id: 'course1',
  title: 'Baloncesto 1',
  schoolYearId: 'sy1',
  published: true,
  schoolYear: { id: 'sy1', name: '1eso', label: '1º ESO' },
  modules: [
    {
      id: 'm1',
      order: 1,
      lessons: [
        { id: 'l1', title: 'L1', type: 'VIDEO', order: 1, moduleId: 'm1', youtubeId: 'abc' },
        { id: 'l2', title: 'L2', type: 'QUIZ', order: 2, moduleId: 'm1', youtubeId: null },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Mock manual de PrismaService
// ---------------------------------------------------------------------------

const mockPrisma = {
  course: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  enrollment: {
    findMany: jest.fn(),
  },
  userProgress: {
    findMany: jest.fn(),
  },
};

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('CoursesService', () => {
  let service: CoursesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoursesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CoursesService>(CoursesService);
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // findAll
  // -------------------------------------------------------------------------

  describe('findAll', () => {
    it('STUDENT: filtra cursos publicados de su nivel (schoolYearId)', async () => {
      mockPrisma.enrollment.findMany.mockResolvedValue([]);
      mockPrisma.course.findMany.mockResolvedValue([fakeCourse]);
      mockPrisma.course.count.mockResolvedValue(1);

      const result = await service.findAll({
        page: 1,
        limit: 10,
        role: Role.STUDENT,
        userId: 'u1',
        schoolYearId: 'sy1',
      });

      expect(mockPrisma.enrollment.findMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        select: { courseId: true },
      });

      const whereArg = mockPrisma.course.findMany.mock.calls[0][0].where;
      expect(whereArg.published).toBe(true);
      expect(whereArg.schoolYearId).toBe('sy1');

      expect(result.data).toEqual([fakeCourse]);
      expect(result.total).toBe(1);
    });

    it('STUDENT sin nivel y sin matrículas: devuelve where.id = { in: [] }', async () => {
      mockPrisma.enrollment.findMany.mockResolvedValue([]);
      mockPrisma.course.findMany.mockResolvedValue([]);
      mockPrisma.course.count.mockResolvedValue(0);

      await service.findAll({
        page: 1,
        limit: 10,
        role: Role.STUDENT,
        userId: 'u1',
        schoolYearId: null,
      });

      const whereArg = mockPrisma.course.findMany.mock.calls[0][0].where;
      expect(whereArg.published).toBe(true);
      expect(whereArg.id).toEqual({ in: [] });
    });

    it('STUDENT con matrículas: incluye cursos enrolled vía OR', async () => {
      mockPrisma.enrollment.findMany.mockResolvedValue([{ courseId: 'courseX' }]);
      mockPrisma.course.findMany.mockResolvedValue([fakeCourse]);
      mockPrisma.course.count.mockResolvedValue(1);

      await service.findAll({
        page: 1,
        limit: 10,
        role: Role.STUDENT,
        userId: 'u1',
        schoolYearId: 'sy1',
      });

      const whereArg = mockPrisma.course.findMany.mock.calls[0][0].where;
      expect(whereArg.published).toBe(true);
      expect(whereArg.OR).toEqual([
        { schoolYearId: 'sy1' },
        { id: { in: ['courseX'] } },
      ]);
    });

    it('ADMIN: devuelve todos los cursos sin filtro published', async () => {
      mockPrisma.course.findMany.mockResolvedValue([fakeCourse]);
      mockPrisma.course.count.mockResolvedValue(1);

      await service.findAll({
        page: 1,
        limit: 10,
        role: Role.ADMIN,
        userId: 'admin1',
        schoolYearId: null,
      });

      expect(mockPrisma.enrollment.findMany).not.toHaveBeenCalled();

      const whereArg = mockPrisma.course.findMany.mock.calls[0][0].where;
      expect(whereArg.published).toBeUndefined();
    });

    it('Paginación: skip = (page - 1) * limit', async () => {
      mockPrisma.course.findMany.mockResolvedValue([]);
      mockPrisma.course.count.mockResolvedValue(0);

      await service.findAll({
        page: 3,
        limit: 10,
        role: Role.ADMIN,
        userId: 'admin1',
        schoolYearId: null,
      });

      const callArgs = mockPrisma.course.findMany.mock.calls[0][0];
      expect(callArgs.skip).toBe(20);
      expect(callArgs.take).toBe(10);

      const result = await service.findAll({
        page: 3,
        limit: 10,
        role: Role.ADMIN,
        userId: 'admin1',
        schoolYearId: null,
      });
      expect(result.totalPages).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // findOne
  // -------------------------------------------------------------------------

  describe('findOne', () => {
    it('Lanza NotFoundException si el curso no existe', async () => {
      mockPrisma.course.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('STUDENT lanza ForbiddenException para curso de otro nivel', async () => {
      mockPrisma.course.findUnique.mockResolvedValue(fakeCourse); // schoolYearId = 'sy1'

      await expect(
        service.findOne('course1', { role: Role.STUDENT, schoolYearId: 'sy2' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Devuelve curso con módulos y lecciones cuando el acceso es válido', async () => {
      mockPrisma.course.findUnique.mockResolvedValue(fakeCourse);

      const result = await service.findOne('course1', {
        role: Role.STUDENT,
        schoolYearId: 'sy1',
      });

      expect(result).toEqual(fakeCourse);
      expect(result.modules[0].lessons).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // getCourseProgress
  // -------------------------------------------------------------------------

  describe('getCourseProgress', () => {
    beforeEach(() => {
      mockPrisma.course.findUnique.mockResolvedValue(fakeCourse);
    });

    it('percentageComplete = 0 si no hay lecciones completadas', async () => {
      mockPrisma.userProgress.findMany.mockResolvedValue([]);

      const result = await service.getCourseProgress('course1', 'u1');

      expect(result.percentageComplete).toBe(0);
      expect(result.completedLessons).toBe(0);
      expect(result.completedLessonIds).toEqual([]);
    });

    it('percentageComplete = 100 si todas las lecciones están completadas', async () => {
      mockPrisma.userProgress.findMany.mockResolvedValue([
        { lessonId: 'l1' },
        { lessonId: 'l2' },
      ]);

      const result = await service.getCourseProgress('course1', 'u1');

      expect(result.percentageComplete).toBe(100);
      expect(result.completedLessons).toBe(2);
      expect(result.totalLessons).toBe(2);
    });

    it('Calcula correctamente con lecciones parcialmente completadas', async () => {
      mockPrisma.userProgress.findMany.mockResolvedValue([{ lessonId: 'l1' }]);

      const result = await service.getCourseProgress('course1', 'u1');

      expect(result.percentageComplete).toBe(50);
      expect(result.completedLessons).toBe(1);
      expect(result.totalLessons).toBe(2);
    });

    it('Devuelve completedLessonIds con los ids correctos', async () => {
      mockPrisma.userProgress.findMany.mockResolvedValue([{ lessonId: 'l1' }]);

      const result = await service.getCourseProgress('course1', 'u1');

      expect(result.completedLessonIds).toEqual(['l1']);
      expect(result.courseId).toBe('course1');
    });
  });

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------

  describe('create', () => {
    it('Delega a prisma.course.create con el DTO recibido', async () => {
      const dto = { title: 'Nuevo curso', schoolYearId: 'sy1' } as any;
      const created = { id: 'newId', ...dto };
      mockPrisma.course.create.mockResolvedValue(created);

      const result = await service.create(dto);

      expect(mockPrisma.course.create).toHaveBeenCalledWith({ data: dto });
      expect(result).toEqual(created);
    });
  });

  // -------------------------------------------------------------------------
  // update
  // -------------------------------------------------------------------------

  describe('update', () => {
    it('Actualiza el curso correctamente cuando existe', async () => {
      const dto = { title: 'Título actualizado' } as any;
      const updated = { ...fakeCourse, title: 'Título actualizado' };

      mockPrisma.course.findUnique.mockResolvedValue(fakeCourse);
      mockPrisma.course.update.mockResolvedValue(updated);

      const result = await service.update('course1', dto);

      expect(mockPrisma.course.update).toHaveBeenCalledWith({
        where: { id: 'course1' },
        data: dto,
      });
      expect(result.title).toBe('Título actualizado');
    });

    it('Lanza NotFoundException si el curso no existe al actualizar', async () => {
      mockPrisma.course.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent', { title: 'X' } as any)).rejects.toThrow(
        NotFoundException,
      );

      expect(mockPrisma.course.update).not.toHaveBeenCalled();
    });
  });
});
