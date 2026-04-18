import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { TutorsService } from './tutors.service';
import { PrismaService } from '../prisma/prisma.service';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TUTOR_ID = 'tutor1';
const STUDENT_ID = 'student1';

const mockStudent = {
  id: STUDENT_ID,
  name: 'Alumno',
  email: 'a@b.com',
  avatarUrl: null,
  tutorId: TUTOR_ID,
  totalPoints: 50,
  currentStreak: 3,
  longestStreak: 5,
  createdAt: new Date('2025-09-01'),
  schoolYear: { id: 'sy1', name: '1eso', label: '1º ESO' },
};

// ---------------------------------------------------------------------------
// Mock de PrismaService
// ---------------------------------------------------------------------------

const mockPrisma = {
  user: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  enrollment: {
    findMany: jest.fn(),
  },
  userProgress: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  quizAttempt: {
    findMany: jest.fn(),
  },
  examAttempt: {
    findMany: jest.fn(),
  },
  certificate: {
    findMany: jest.fn(),
  },
  booking: {
    findMany: jest.fn(),
  },
};

// ---------------------------------------------------------------------------
// Helper: configura todas las queries de Promise.all con valores vacíos
// ---------------------------------------------------------------------------

function setupEmptyParallelQueries() {
  mockPrisma.userProgress.findMany.mockResolvedValue([]);
  mockPrisma.quizAttempt.findMany.mockResolvedValue([]);
  mockPrisma.examAttempt.findMany.mockResolvedValue([]);
  mockPrisma.certificate.findMany.mockResolvedValue([]);
  mockPrisma.booking.findMany.mockResolvedValue([]);
  mockPrisma.enrollment.findMany.mockResolvedValue([]);
  mockPrisma.userProgress.count.mockResolvedValue(0);
}

// ---------------------------------------------------------------------------
// Suite principal
// ---------------------------------------------------------------------------

describe('TutorsService', () => {
  let service: TutorsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TutorsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<TutorsService>(TutorsService);
  });

  // -------------------------------------------------------------------------
  // getMyStudents
  // -------------------------------------------------------------------------

  describe('getMyStudents', () => {
    it('devuelve la lista de alumnos del tutor', async () => {
      const students = [
        { id: STUDENT_ID, name: 'Alumno', email: 'a@b.com', avatarUrl: null, totalPoints: 50, currentStreak: 3, schoolYear: { id: 'sy1', name: '1eso', label: '1º ESO' } },
      ];
      mockPrisma.user.findMany.mockResolvedValue(students);

      const result = await service.getMyStudents(TUTOR_ID);

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tutorId: TUTOR_ID } }),
      );
      expect(result).toEqual(students);
    });

    it('devuelve array vacío cuando el tutor no tiene alumnos', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await service.getMyStudents(TUTOR_ID);

      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // getStudentCourses
  // -------------------------------------------------------------------------

  describe('getStudentCourses', () => {
    it('lanza ForbiddenException si el alumno no existe', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getStudentCourses(TUTOR_ID, STUDENT_ID)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('lanza ForbiddenException si el alumno pertenece a otro tutor', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ tutorId: 'otro-tutor' });

      await expect(service.getStudentCourses(TUTOR_ID, STUDENT_ID)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('devuelve los cursos en los que está matriculado el alumno', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ tutorId: TUTOR_ID });

      const course = { id: 'c1', title: 'Curso 1', schoolYear: { id: 'sy1', name: '1eso', label: '1º ESO' } };
      mockPrisma.enrollment.findMany.mockResolvedValue([{ course }, { course: { id: 'c2', title: 'Curso 2', schoolYear: null } }]);

      const result = await service.getStudentCourses(TUTOR_ID, STUDENT_ID);

      expect(mockPrisma.enrollment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: STUDENT_ID } }),
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(course);
    });
  });

  // -------------------------------------------------------------------------
  // getStudentStats
  // -------------------------------------------------------------------------

  describe('getStudentStats', () => {
    it('lanza ForbiddenException si el alumno no pertenece al tutor', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockStudent, tutorId: 'otro-tutor' });

      await expect(service.getStudentStats(TUTOR_ID, STUDENT_ID)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('lanza ForbiddenException si el alumno no existe', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getStudentStats(TUTOR_ID, STUDENT_ID)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('devuelve la estructura completa con todas las secciones', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockStudent);
      setupEmptyParallelQueries();

      const result = await service.getStudentStats(TUTOR_ID, STUDENT_ID);

      expect(result).toMatchObject({
        student: expect.objectContaining({ id: STUDENT_ID, name: 'Alumno' }),
        period: { from: null, to: null },
        lessons: expect.objectContaining({ completedInPeriod: 0, completedAllTime: 0, activeDays: 0 }),
        quizzes: expect.objectContaining({ attempts: 0, avgScore: null, bestScore: null }),
        exams: expect.objectContaining({ attempts: 0, avgScore: null, bestScore: null, passed: 0 }),
        certificates: { total: 0, byType: {} },
        sessions: { confirmed: 0, totalHours: 0 },
        courses: [],
        activity: [],
      });
    });

    it('progressPct es 0 cuando no hay lecciones completadas', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockStudent);
      setupEmptyParallelQueries();

      // Curso con 2 lecciones, ninguna completada
      mockPrisma.enrollment.findMany.mockResolvedValue([
        {
          course: {
            id: 'c1',
            title: 'Curso 1',
            schoolYear: null,
            modules: [{ id: 'm1', title: 'Módulo 1', lessons: [{ id: 'l1' }, { id: 'l2' }] }],
          },
        },
      ]);
      // La segunda llamada a findMany (completedLessons) devuelve vacío
      mockPrisma.userProgress.findMany
        .mockResolvedValueOnce([]) // completedInPeriod (Promise.all)
        .mockResolvedValueOnce([]); // completedLessons

      const result = await service.getStudentStats(TUTOR_ID, STUDENT_ID);

      expect(result.courses[0].progressPct).toBe(0);
    });

    it('progressPct es 100 cuando todas las lecciones están completadas', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockStudent);
      setupEmptyParallelQueries();

      mockPrisma.enrollment.findMany.mockResolvedValue([
        {
          course: {
            id: 'c1',
            title: 'Curso 1',
            schoolYear: null,
            modules: [{ id: 'm1', title: 'Módulo 1', lessons: [{ id: 'l1' }, { id: 'l2' }] }],
          },
        },
      ]);
      mockPrisma.userProgress.findMany
        .mockResolvedValueOnce([]) // completedInPeriod
        .mockResolvedValueOnce([{ lessonId: 'l1' }, { lessonId: 'l2' }]); // completedLessons

      const result = await service.getStudentStats(TUTOR_ID, STUDENT_ID);

      expect(result.courses[0].progressPct).toBe(100);
      expect(result.courses[0].completedLessons).toBe(2);
    });

    it('avgQuizScore es null si no hay intentos de quiz', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockStudent);
      setupEmptyParallelQueries();

      const result = await service.getStudentStats(TUTOR_ID, STUDENT_ID);

      expect(result.quizzes.avgScore).toBeNull();
      expect(result.quizzes.bestScore).toBeNull();
    });

    it('avgQuizScore calcula correctamente con múltiples intentos', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockStudent);
      setupEmptyParallelQueries();

      const now = new Date('2026-01-10T10:00:00Z');
      mockPrisma.quizAttempt.findMany.mockResolvedValue([
        { score: 60, completedAt: now },
        { score: 80, completedAt: now },
        { score: 70, completedAt: now },
      ]);

      const result = await service.getStudentStats(TUTOR_ID, STUDENT_ID);

      // (60 + 80 + 70) / 3 = 70.0
      expect(result.quizzes.avgScore).toBe(70);
      expect(result.quizzes.bestScore).toBe(80);
      expect(result.quizzes.attempts).toBe(3);
    });

    it('totalHours calcula correctamente desde startAt/endAt de reservas', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockStudent);
      setupEmptyParallelQueries();

      // 2 reservas de 1 hora cada una = 2 horas
      const startAt = new Date('2026-01-10T10:00:00Z');
      const endAt = new Date('2026-01-10T11:00:00Z');
      mockPrisma.booking.findMany.mockResolvedValue([
        { startAt, endAt },
        { startAt, endAt },
      ]);

      const result = await service.getStudentStats(TUTOR_ID, STUDENT_ID);

      expect(result.sessions.confirmed).toBe(2);
      expect(result.sessions.totalHours).toBe(2);
    });

    it('activeDays cuenta los días únicos con lecciones completadas', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockStudent);
      setupEmptyParallelQueries();

      // 3 lecciones completadas: 2 el mismo día y 1 en otro
      const day1a = new Date('2026-01-10T09:00:00Z');
      const day1b = new Date('2026-01-10T15:00:00Z');
      const day2 = new Date('2026-01-11T10:00:00Z');
      mockPrisma.userProgress.findMany
        .mockResolvedValueOnce([
          { completedAt: day1a },
          { completedAt: day1b },
          { completedAt: day2 },
        ]) // completedInPeriod
        .mockResolvedValueOnce([]); // completedLessons

      const result = await service.getStudentStats(TUTOR_ID, STUDENT_ID);

      expect(result.lessons.activeDays).toBe(2);
    });

    it('aplica filtro de fecha en userProgress cuando se pasan from y to', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockStudent);
      setupEmptyParallelQueries();

      const from = new Date('2026-01-01');
      const to = new Date('2026-01-31');

      await service.getStudentStats(TUTOR_ID, STUDENT_ID, from, to);

      // userProgress.findMany (completedInPeriod) debe incluir gte/lte
      expect(mockPrisma.userProgress.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            completedAt: { gte: from, lte: to },
          }),
        }),
      );
    });

    it('el resultado incluye el período correcto cuando se pasan from y to', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockStudent);
      setupEmptyParallelQueries();

      const from = new Date('2026-01-01');
      const to = new Date('2026-01-31');

      const result = await service.getStudentStats(TUTOR_ID, STUDENT_ID, from, to);

      expect(result.period).toEqual({ from, to });
    });

    it('sin from/to usa { not: null } en lugar de rango de fechas en userProgress', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockStudent);
      setupEmptyParallelQueries();

      await service.getStudentStats(TUTOR_ID, STUDENT_ID);

      expect(mockPrisma.userProgress.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            completedAt: { not: null },
          }),
        }),
      );
    });

    it('certificates.byType agrupa correctamente por tipo', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockStudent);
      setupEmptyParallelQueries();

      mockPrisma.certificate.findMany.mockResolvedValue([
        { type: 'COURSE_COMPLETION', issuedAt: new Date() },
        { type: 'COURSE_COMPLETION', issuedAt: new Date() },
        { type: 'MODULE_EXAM', issuedAt: new Date() },
      ]);

      const result = await service.getStudentStats(TUTOR_ID, STUDENT_ID);

      expect(result.certificates.total).toBe(3);
      expect(result.certificates.byType).toEqual({
        COURSE_COMPLETION: 2,
        MODULE_EXAM: 1,
      });
    });

    it('exams.passed cuenta solo los intentos con score >= 50', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockStudent);
      setupEmptyParallelQueries();

      const submittedAt = new Date('2026-01-10T10:00:00Z');
      mockPrisma.examAttempt.findMany.mockResolvedValue([
        { score: 49, submittedAt },
        { score: 50, submittedAt },
        { score: 75, submittedAt },
        { score: null, submittedAt }, // null → 0 según el servicio
      ]);

      const result = await service.getStudentStats(TUTOR_ID, STUDENT_ID);

      expect(result.exams.passed).toBe(2); // score 50 y 75
      expect(result.exams.attempts).toBe(4);
    });

    it('el array activity está ordenado por fecha ascendente', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockStudent);
      setupEmptyParallelQueries();

      // Lecciones completadas en distintos días (desordenados)
      mockPrisma.userProgress.findMany
        .mockResolvedValueOnce([
          { completedAt: new Date('2026-01-15T10:00:00Z') },
          { completedAt: new Date('2026-01-10T10:00:00Z') },
          { completedAt: new Date('2026-01-20T10:00:00Z') },
        ]) // completedInPeriod
        .mockResolvedValueOnce([]); // completedLessons

      const result = await service.getStudentStats(TUTOR_ID, STUDENT_ID);

      const dates = result.activity.map((a) => a.date);
      expect(dates).toEqual([...dates].sort());
    });
  });
});
