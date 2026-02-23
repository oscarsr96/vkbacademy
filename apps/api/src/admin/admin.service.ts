import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { BookingStatus, LessonType, Prisma, QuestionType, Role } from '@prisma/client';
import { ImportCourseDto } from './dto/import-course.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { CreateQuestionDto, UpdateQuestionDto } from './dto/create-question.dto';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { CreateChallengeDto } from './dto/create-challenge.dto';
import { UpdateChallengeDto } from './dto/update-challenge.dto';
import { CreateExamQuestionDto, UpdateExamQuestionDto } from './dto/create-exam-question.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
        tutorId: true,
        tutor: { select: { id: true, name: true } },
        _count: { select: { students: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async assignTutor(studentId: string, tutorId: string | null | undefined) {
    // Si se proporciona tutorId, verificar que el usuario tiene rol TUTOR
    if (tutorId) {
      const tutorUser = await this.prisma.user.findUnique({ where: { id: tutorId } });
      if (!tutorUser) throw new NotFoundException('Tutor no encontrado');
      if (tutorUser.role !== Role.TUTOR) {
        throw new BadRequestException('El usuario especificado no tiene el rol TUTOR');
      }
    }

    return this.prisma.user.update({
      where: { id: studentId },
      data: { tutorId: tutorId ?? null },
      select: { id: true, name: true, email: true, tutorId: true, tutor: { select: { id: true, name: true } } },
    });
  }

  async updateRole(userId: string, role: Role) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, email: true, name: true, role: true },
    });
  }

  async createUser(dto: CreateAdminUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new BadRequestException('Ya existe un usuario con ese email');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        passwordHash,
        role: dto.role,
        schoolYearId: dto.schoolYearId ?? null,
        tutorId: dto.tutorId ?? null,
      },
      select: {
        id: true, email: true, name: true, role: true,
        avatarUrl: true, createdAt: true, tutorId: true,
        tutor: { select: { id: true, name: true } },
        _count: { select: { students: true } },
      },
    });
  }

  async updateUser(userId: string, dto: UpdateAdminUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    if (dto.email && dto.email !== user.email) {
      const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (existing) throw new BadRequestException('Ya existe un usuario con ese email');
    }

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.email !== undefined) data.email = dto.email;
    if ('schoolYearId' in dto) data.schoolYearId = dto.schoolYearId ?? null;
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true, email: true, name: true, role: true,
        avatarUrl: true, createdAt: true, tutorId: true,
        tutor: { select: { id: true, name: true } },
        _count: { select: { students: true } },
      },
    });
  }

  async deleteUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    await this.prisma.user.delete({ where: { id: userId } });
    return { message: 'Usuario eliminado correctamente' };
  }

  async listCourses(params: {
    page: number;
    limit: number;
    schoolYearId?: string;
    search?: string;
  }) {
    const { page, limit, schoolYearId, search } = params;
    const skip = (page - 1) * limit;

    const where = {
      ...(schoolYearId ? { schoolYearId } : {}),
      ...(search ? { title: { contains: search, mode: 'insensitive' as const } } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.course.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          schoolYear: true,
          _count: { select: { modules: true } },
        },
      }),
      this.prisma.course.count({ where }),
    ]);

    // Alumnos accesibles por curso:
    // (1) alumnos cuyo schoolYearId coincide con el del curso
    // (2) + alumnos de OTRO nivel con matrícula explícita en el curso

    const courseIds = items.map((c) => c.id);

    const [studentsByLevel, crossEnrollments] = await Promise.all([
      // (1) conteo de alumnos STUDENT agrupados por schoolYear
      this.prisma.user.groupBy({
        by: ['schoolYearId'],
        where: { role: Role.STUDENT, schoolYearId: { not: null } },
        _count: { _all: true },
      }),
      // (2) matrículas explícitas con el schoolYear del alumno
      courseIds.length > 0
        ? this.prisma.enrollment.findMany({
            where: { courseId: { in: courseIds } },
            select: { courseId: true, user: { select: { schoolYearId: true } } },
          })
        : Promise.resolve([]),
    ]);

    const syStudentCount = new Map(
      studentsByLevel.map((r) => [r.schoolYearId!, r._count._all]),
    );

    // Alumnos de otro nivel matriculados explícitamente en cada curso
    const courseSchoolYear = new Map(items.map((c) => [c.id, c.schoolYearId]));
    const crossLevelCount = new Map<string, number>();
    for (const e of crossEnrollments) {
      if (e.user.schoolYearId !== courseSchoolYear.get(e.courseId)) {
        crossLevelCount.set(e.courseId, (crossLevelCount.get(e.courseId) ?? 0) + 1);
      }
    }

    const enrichedItems = items.map((course) => ({
      ...course,
      studentCount:
        (syStudentCount.get(course.schoolYearId ?? '') ?? 0) +
        (crossLevelCount.get(course.id) ?? 0),
    }));

    return {
      data: enrichedItems,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async deleteCourse(id: string) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) {
      throw new NotFoundException(`Curso con id "${id}" no encontrado`);
    }
    await this.prisma.course.delete({ where: { id } });
    return { message: 'Curso eliminado correctamente' };
  }

  // ─── Detalle de curso con contenido completo ──────────────────────────────

  async getCourseDetail(courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        schoolYear: true,
        modules: {
          orderBy: { order: 'asc' },
          include: {
            lessons: {
              orderBy: { order: 'asc' },
              include: {
                quiz: {
                  include: {
                    questions: {
                      orderBy: { order: 'asc' },
                      include: {
                        answers: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!course) {
      throw new NotFoundException(`Curso con id "${courseId}" no encontrado`);
    }

    return course;
  }

  // ─── Módulos ──────────────────────────────────────────────────────────────

  async createModule(courseId: string, dto: CreateModuleDto) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
      throw new NotFoundException(`Curso con id "${courseId}" no encontrado`);
    }

    // Calcular el order siguiente
    const lastModule = await this.prisma.module.findFirst({
      where: { courseId },
      orderBy: { order: 'desc' },
    });
    const order = (lastModule?.order ?? 0) + 1;

    return this.prisma.module.create({
      data: { title: dto.title, courseId, order },
    });
  }

  async updateModule(moduleId: string, dto: UpdateModuleDto) {
    const module = await this.prisma.module.findUnique({ where: { id: moduleId } });
    if (!module) {
      throw new NotFoundException(`Módulo con id "${moduleId}" no encontrado`);
    }
    return this.prisma.module.update({
      where: { id: moduleId },
      data: { ...(dto.title !== undefined ? { title: dto.title } : {}) },
    });
  }

  async deleteModule(moduleId: string) {
    const module = await this.prisma.module.findUnique({ where: { id: moduleId } });
    if (!module) {
      throw new NotFoundException(`Módulo con id "${moduleId}" no encontrado`);
    }
    await this.prisma.module.delete({ where: { id: moduleId } });
    return { message: 'Módulo eliminado correctamente' };
  }

  // ─── Lecciones ────────────────────────────────────────────────────────────

  async createLesson(moduleId: string, dto: CreateLessonDto) {
    const module = await this.prisma.module.findUnique({ where: { id: moduleId } });
    if (!module) {
      throw new NotFoundException(`Módulo con id "${moduleId}" no encontrado`);
    }

    // Calcular el order siguiente
    const lastLesson = await this.prisma.lesson.findFirst({
      where: { moduleId },
      orderBy: { order: 'desc' },
    });
    const order = (lastLesson?.order ?? 0) + 1;

    // Si es QUIZ, crear la lección y el quiz en una transacción
    if (dto.type === LessonType.QUIZ) {
      return this.prisma.$transaction(async (tx) => {
        const lesson = await tx.lesson.create({
          data: { title: dto.title, type: dto.type, moduleId, order },
        });
        const quiz = await tx.quiz.create({
          data: { lessonId: lesson.id },
          include: { questions: { include: { answers: true } } },
        });
        return { ...lesson, quiz };
      });
    }

    return this.prisma.lesson.create({
      data: { title: dto.title, type: dto.type, moduleId, order },
      include: { quiz: { include: { questions: { include: { answers: true } } } } },
    });
  }

  async updateLesson(lessonId: string, dto: UpdateLessonDto) {
    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) {
      throw new NotFoundException(`Lección con id "${lessonId}" no encontrada`);
    }
    return this.prisma.lesson.update({
      where: { id: lessonId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.youtubeId !== undefined ? { youtubeId: dto.youtubeId } : {}),
        ...(dto.content !== undefined
          ? { content: dto.content === null ? Prisma.JsonNull : (dto.content as Prisma.InputJsonValue) }
          : {}),
      },
      include: { quiz: { include: { questions: { include: { answers: true } } } } },
    });
  }

  async deleteLesson(lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) {
      throw new NotFoundException(`Lección con id "${lessonId}" no encontrada`);
    }
    await this.prisma.lesson.delete({ where: { id: lessonId } });
    return { message: 'Lección eliminada correctamente' };
  }

  // ─── Quiz ─────────────────────────────────────────────────────────────────

  async initQuiz(lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) {
      throw new NotFoundException(`Lección con id "${lessonId}" no encontrada`);
    }

    // Upsert: devuelve el existente o crea uno nuevo
    return this.prisma.quiz.upsert({
      where: { lessonId },
      update: {},
      create: { lessonId },
      include: { questions: { include: { answers: true } } },
    });
  }

  // ─── Preguntas ────────────────────────────────────────────────────────────

  async createQuestion(quizId: string, dto: CreateQuestionDto) {
    const quiz = await this.prisma.quiz.findUnique({ where: { id: quizId } });
    if (!quiz) {
      throw new NotFoundException(`Quiz con id "${quizId}" no encontrado`);
    }

    // Calcular el order siguiente
    const lastQuestion = await this.prisma.question.findFirst({
      where: { quizId },
      orderBy: { order: 'desc' },
    });
    const order = (lastQuestion?.order ?? 0) + 1;

    return this.prisma.$transaction(async (tx) => {
      const question = await tx.question.create({
        data: { text: dto.text, type: dto.type, quizId, order },
      });
      await tx.answer.createMany({
        data: dto.answers.map((a) => ({
          text: a.text,
          isCorrect: a.isCorrect,
          questionId: question.id,
        })),
      });
      return tx.question.findUnique({
        where: { id: question.id },
        include: { answers: true },
      });
    });
  }

  async updateQuestion(questionId: string, dto: UpdateQuestionDto) {
    const question = await this.prisma.question.findUnique({ where: { id: questionId } });
    if (!question) {
      throw new NotFoundException(`Pregunta con id "${questionId}" no encontrada`);
    }

    return this.prisma.$transaction(async (tx) => {
      // Reemplazar respuestas completamente
      await tx.answer.deleteMany({ where: { questionId } });
      const updated = await tx.question.update({
        where: { id: questionId },
        data: { text: dto.text, type: dto.type },
      });
      await tx.answer.createMany({
        data: dto.answers.map((a) => ({
          text: a.text,
          isCorrect: a.isCorrect,
          questionId: updated.id,
        })),
      });
      return tx.question.findUnique({
        where: { id: questionId },
        include: { answers: true },
      });
    });
  }

  async deleteQuestion(questionId: string) {
    const question = await this.prisma.question.findUnique({ where: { id: questionId } });
    if (!question) {
      throw new NotFoundException(`Pregunta con id "${questionId}" no encontrada`);
    }
    await this.prisma.question.delete({ where: { id: questionId } });
    return { message: 'Pregunta eliminada correctamente' };
  }

  // ─── Analytics avanzado ───────────────────────────────────────────────────

  async getAnalytics(query: AnalyticsQueryDto) {
    const { courseId, schoolYearId, granularity = 'day' } = query;

    // ── Rango de fechas ────────────────────────────────────────────────────
    const now = new Date();
    const dateFrom = query.from
      ? new Date(query.from)
      : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29, 0, 0, 0, 0);
    const dateTo = query.to
      ? new Date(new Date(query.to).setHours(23, 59, 59, 999))
      : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // ── Helpers ────────────────────────────────────────────────────────────
    const truncDate = (date: Date): string => {
      const d = new Date(date);
      if (granularity === 'month') return d.toISOString().substring(0, 7);
      if (granularity === 'week') {
        const day = d.getDay();
        d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
        d.setHours(0, 0, 0, 0);
      } else {
        d.setHours(0, 0, 0, 0);
      }
      return d.toISOString().split('T')[0];
    };

    const generateRange = (): string[] => {
      const result: string[] = [];
      const cur = new Date(dateFrom);
      cur.setHours(0, 0, 0, 0);
      if (granularity === 'week') {
        const day = cur.getDay();
        cur.setDate(cur.getDate() - day + (day === 0 ? -6 : 1));
      }
      const limit = new Date(dateTo);
      while (cur <= limit) {
        const key =
          granularity === 'month'
            ? cur.toISOString().substring(0, 7)
            : cur.toISOString().split('T')[0];
        if (!result.includes(key)) result.push(key);
        if (granularity === 'month') cur.setMonth(cur.getMonth() + 1);
        else if (granularity === 'week') cur.setDate(cur.getDate() + 7);
        else cur.setDate(cur.getDate() + 1);
      }
      return result;
    };

    // ── Filtros anidados ───────────────────────────────────────────────────
    const progressLessonFilter = courseId
      ? { lesson: { module: { courseId } } }
      : schoolYearId
        ? { lesson: { module: { course: { schoolYearId } } } }
        : {};

    const quizLessonFilter = courseId
      ? { quiz: { lesson: { module: { courseId } } } }
      : schoolYearId
        ? { quiz: { lesson: { module: { course: { schoolYearId } } } } }
        : {};

    const progressWhere = {
      completed: true,
      completedAt: { gte: dateFrom, lte: dateTo },
      ...progressLessonFilter,
    };

    const quizWhere = {
      completedAt: { gte: dateFrom, lte: dateTo },
      ...quizLessonFilter,
    };

    const enrollmentWhere = {
      createdAt: { gte: dateFrom, lte: dateTo },
      ...(courseId ? { courseId } : {}),
      ...(schoolYearId && !courseId ? { course: { schoolYearId } } : {}),
    };

    const bookingWhere = {
      createdAt: { gte: dateFrom, lte: dateTo },
      ...(courseId ? { courseId } : {}),
    };

    const userWhere = {
      createdAt: { gte: dateFrom, lte: dateTo },
      role: Role.STUDENT,
      ...(schoolYearId ? { schoolYearId } : {}),
    };

    // ── Consultas principales ──────────────────────────────────────────────
    const [
      newUsers,
      newEnrollments,
      progressRecords,
      quizRecords,
      newBookings,
      confirmedBookings,
      cancelledBookings,
      usersTimeSeries,
      bookingsTimeSeries,
    ] = await Promise.all([
      this.prisma.user.count({ where: userWhere }),
      this.prisma.enrollment.count({ where: enrollmentWhere }),
      this.prisma.userProgress.findMany({ where: progressWhere, select: { completedAt: true } }),
      this.prisma.quizAttempt.findMany({ where: quizWhere, select: { completedAt: true, score: true } }),
      this.prisma.booking.count({ where: bookingWhere }),
      this.prisma.booking.count({ where: { ...bookingWhere, status: BookingStatus.CONFIRMED } }),
      this.prisma.booking.count({ where: { ...bookingWhere, status: BookingStatus.CANCELLED } }),
      this.prisma.user.findMany({ where: userWhere, select: { createdAt: true } }),
      this.prisma.booking.findMany({ where: bookingWhere, select: { createdAt: true } }),
    ]);

    const completedLessons = progressRecords.length;
    const avgQuizScore =
      quizRecords.length > 0
        ? Math.round(
            (quizRecords.reduce((sum, r) => sum + r.score, 0) / quizRecords.length) * 10,
          ) / 10
        : 0;

    // ── Serie temporal ─────────────────────────────────────────────────────
    const buildMap = (records: { date: Date }[]): Map<string, number> => {
      const map = new Map<string, number>();
      for (const r of records) {
        const key = truncDate(r.date);
        map.set(key, (map.get(key) ?? 0) + 1);
      }
      return map;
    };

    const progressByDate = buildMap(
      progressRecords.filter((r) => r.completedAt).map((r) => ({ date: r.completedAt! })),
    );
    const quizByDate = buildMap(quizRecords.map((r) => ({ date: r.completedAt })));
    const bookingsByDate = buildMap(bookingsTimeSeries.map((r) => ({ date: r.createdAt })));
    const newUsersByDate = buildMap(usersTimeSeries.map((r) => ({ date: r.createdAt })));

    const timeSeries = generateRange().map((date) => ({
      date,
      completedLessons: progressByDate.get(date) ?? 0,
      quizAttempts: quizByDate.get(date) ?? 0,
      newBookings: bookingsByDate.get(date) ?? 0,
      newUsers: newUsersByDate.get(date) ?? 0,
    }));

    // ── Top cursos ─────────────────────────────────────────────────────────
    const topCoursesRaw = await this.prisma.enrollment.groupBy({
      by: ['courseId'],
      where: enrollmentWhere,
      _count: { courseId: true },
      orderBy: { _count: { courseId: 'desc' } },
      take: 5,
    });

    const courseData = await this.prisma.course.findMany({
      where: { id: { in: topCoursesRaw.map((r) => r.courseId) } },
      select: { id: true, title: true, schoolYear: { select: { label: true } } },
    });
    const courseMap = new Map(courseData.map((c) => [c.id, c]));

    const topCourses = topCoursesRaw.map((r) => ({
      courseId: r.courseId,
      title: courseMap.get(r.courseId)?.title ?? 'Desconocido',
      schoolYear: courseMap.get(r.courseId)?.schoolYear?.label,
      enrollments: r._count.courseId,
    }));

    // ── Top alumnos ────────────────────────────────────────────────────────
    const topStudentsRaw = await this.prisma.userProgress.groupBy({
      by: ['userId'],
      where: progressWhere,
      _count: { userId: true },
      orderBy: { _count: { userId: 'desc' } },
      take: 5,
    });

    const studentIds = topStudentsRaw.map((r) => r.userId);
    const [studentData, quizScoresByStudent] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: studentIds } },
        select: { id: true, name: true, email: true },
      }),
      studentIds.length > 0
        ? this.prisma.quizAttempt.groupBy({
            by: ['userId'],
            where: { ...quizWhere, userId: { in: studentIds } },
            _avg: { score: true },
            _count: { userId: true },
          })
        : Promise.resolve([]),
    ]);

    const studentMap = new Map(studentData.map((s) => [s.id, s]));
    const scoreMap = new Map(
      quizScoresByStudent.map((r) => [
        r.userId,
        { avg: Math.round((r._avg.score ?? 0) * 10) / 10, count: r._count.userId },
      ]),
    );

    const topStudents = topStudentsRaw.map((r) => ({
      studentId: r.userId,
      name: studentMap.get(r.userId)?.name ?? 'Desconocido',
      email: studentMap.get(r.userId)?.email ?? '',
      completedLessons: r._count.userId,
      quizAttempts: scoreMap.get(r.userId)?.count ?? 0,
      avgScore: scoreMap.get(r.userId)?.avg ?? 0,
    }));

    // ── Desglose reservas ──────────────────────────────────────────────────
    const [bookingsByStatus, bookingsByMode] = await Promise.all([
      this.prisma.booking.groupBy({
        by: ['status'],
        where: bookingWhere,
        _count: { status: true },
      }),
      this.prisma.booking.groupBy({
        by: ['mode'],
        where: bookingWhere,
        _count: { mode: true },
      }),
    ]);

    // ── Estadísticas de profesores ─────────────────────────────────────────
    const teacherBookings = await this.prisma.booking.findMany({
      where: { createdAt: { gte: dateFrom, lte: dateTo } },
      select: {
        teacherId: true,
        status: true,
        mode: true,
        startAt: true,
        endAt: true,
      },
    });

    const uniqueTeacherIds = [...new Set(teacherBookings.map((b) => b.teacherId))];
    const teacherProfiles =
      uniqueTeacherIds.length > 0
        ? await this.prisma.teacherProfile.findMany({
            where: { id: { in: uniqueTeacherIds } },
            select: { id: true, user: { select: { name: true, email: true } } },
          })
        : [];

    const teacherProfileMap = new Map(teacherProfiles.map((tp) => [tp.id, tp]));

    const teacherStatsMap = new Map<
      string,
      { confirmed: number; pending: number; cancelled: number; minutesTaught: number; online: number; inPerson: number }
    >();

    for (const booking of teacherBookings) {
      const existing = teacherStatsMap.get(booking.teacherId) ?? {
        confirmed: 0,
        pending: 0,
        cancelled: 0,
        minutesTaught: 0,
        online: 0,
        inPerson: 0,
      };
      if (booking.status === BookingStatus.CONFIRMED) {
        existing.confirmed++;
        existing.minutesTaught += Math.round(
          (booking.endAt.getTime() - booking.startAt.getTime()) / 60_000,
        );
      } else if (booking.status === BookingStatus.PENDING) {
        existing.pending++;
      } else {
        existing.cancelled++;
      }
      if ((booking.mode as string) === 'ONLINE') existing.online++;
      else existing.inPerson++;
      teacherStatsMap.set(booking.teacherId, existing);
    }

    const topTeachers = [...teacherStatsMap.entries()]
      .sort(([, a], [, b]) => b.confirmed - a.confirmed)
      .slice(0, 10)
      .map(([teacherId, t]) => {
        const profile = teacherProfileMap.get(teacherId);
        return {
          teacherId,
          name: profile?.user.name ?? 'Desconocido',
          email: profile?.user.email ?? '',
          confirmed: t.confirmed,
          pending: t.pending,
          cancelled: t.cancelled,
          hoursTaught: Math.round((t.minutesTaught / 60) * 10) / 10,
          online: t.online,
          inPerson: t.inPerson,
        };
      });

    const totalConfirmedSessions = [...teacherStatsMap.values()].reduce(
      (acc, t) => acc + t.confirmed,
      0,
    );
    const totalMinutesTaught = [...teacherStatsMap.values()].reduce(
      (acc, t) => acc + t.minutesTaught,
      0,
    );

    // ── Alumnos en riesgo (sin actividad en 14 días, independiente del rango) ──
    const riskCutoff = new Date(now);
    riskCutoff.setDate(now.getDate() - 14);

    const allStudents = await this.prisma.user.findMany({
      where: { role: Role.STUDENT },
      select: { id: true, name: true, email: true },
    });

    const [latestProgress, latestQuiz] = await Promise.all([
      this.prisma.userProgress.groupBy({
        by: ['userId'],
        _max: { completedAt: true },
        where: { completed: true },
      }),
      this.prisma.quizAttempt.groupBy({
        by: ['userId'],
        _max: { completedAt: true },
      }),
    ]);

    const lastActivityMap = new Map<string, Date>();
    for (const p of latestProgress) {
      if (p._max.completedAt) lastActivityMap.set(p.userId, p._max.completedAt);
    }
    for (const q of latestQuiz) {
      if (q._max.completedAt) {
        const existing = lastActivityMap.get(q.userId);
        if (!existing || q._max.completedAt > existing) {
          lastActivityMap.set(q.userId, q._max.completedAt);
        }
      }
    }

    const atRiskStudents = allStudents
      .filter((s) => {
        const last = lastActivityMap.get(s.id);
        return !last || last < riskCutoff;
      })
      .map((s) => {
        const last = lastActivityMap.get(s.id);
        return {
          studentId: s.id,
          name: s.name,
          email: s.email,
          daysSinceLastActivity: last
            ? Math.floor((now.getTime() - last.getTime()) / 86_400_000)
            : null,
        };
      })
      .sort((a, b) => (b.daysSinceLastActivity ?? 9999) - (a.daysSinceLastActivity ?? 9999))
      .slice(0, 10);

    // ── Distribución de scores de quiz ─────────────────────────────────────────
    const scoreBuckets = [0, 0, 0, 0, 0]; // 0-20, 20-40, 40-60, 60-80, 80-100
    for (const attempt of quizRecords) {
      scoreBuckets[Math.min(Math.floor(attempt.score / 20), 4)]++;
    }
    const scoreDistribution = [
      { bucket: '0–20%', count: scoreBuckets[0] },
      { bucket: '20–40%', count: scoreBuckets[1] },
      { bucket: '40–60%', count: scoreBuckets[2] },
      { bucket: '60–80%', count: scoreBuckets[3] },
      { bucket: '80–100%', count: scoreBuckets[4] },
    ];

    // ── Lecciones con menor tasa de completado ─────────────────────────────────
    const lowCompletionGroups = await this.prisma.userProgress.groupBy({
      by: ['lessonId'],
      where: { completed: true, completedAt: { gte: dateFrom, lte: dateTo }, ...progressLessonFilter },
      _count: { userId: true },
      orderBy: { _count: { userId: 'asc' } },
      take: 5,
    });

    const lowLessonIds = lowCompletionGroups.map((g) => g.lessonId);
    const lowLessonData =
      lowLessonIds.length > 0
        ? await this.prisma.lesson.findMany({
            where: { id: { in: lowLessonIds } },
            select: {
              id: true,
              title: true,
              module: { select: { title: true, course: { select: { title: true } } } },
            },
          })
        : [];

    const lowLessonMap = new Map(lowLessonData.map((l) => [l.id, l]));
    const lowCompletionLessons = lowCompletionGroups.map((g) => {
      const l = lowLessonMap.get(g.lessonId);
      return {
        lessonId: g.lessonId,
        title: l?.title ?? 'Desconocida',
        moduleTitle: l?.module.title ?? '',
        courseTitle: l?.module.course.title ?? '',
        completedCount: g._count.userId,
      };
    });

    // ── Heatmap de reservas + lead time ────────────────────────────────────────
    const bookingsForHeatmap = await this.prisma.booking.findMany({
      where: { createdAt: { gte: dateFrom, lte: dateTo } },
      select: { startAt: true, createdAt: true },
    });

    const heatmapCounts = new Map<string, number>();
    for (const b of bookingsForHeatmap) {
      const key = `${b.startAt.getDay()}-${b.startAt.getHours()}`;
      heatmapCounts.set(key, (heatmapCounts.get(key) ?? 0) + 1);
    }
    const bookingHeatmap = [...heatmapCounts.entries()].map(([key, count]) => {
      const [day, hour] = key.split('-').map(Number);
      return { day, hour, count };
    });

    const avgBookingLeadDays =
      bookingsForHeatmap.length > 0
        ? Math.round(
            (bookingsForHeatmap.reduce(
              (acc, b) => acc + (b.startAt.getTime() - b.createdAt.getTime()) / 86_400_000,
              0,
            ) /
              bookingsForHeatmap.length) *
              10,
          ) / 10
        : 0;

    return {
      kpis: {
        newUsers,
        newEnrollments,
        completedLessons,
        quizAttempts: quizRecords.length,
        avgQuizScore,
        newBookings,
        confirmedBookings,
        cancelledBookings,
      },
      timeSeries,
      topCourses,
      topStudents,
      bookings: {
        byStatus: bookingsByStatus.map((b) => ({ status: b.status as string, count: b._count.status })),
        byMode: bookingsByMode.map((b) => ({ mode: b.mode as string, count: b._count.mode })),
      },
      teachers: {
        summary: {
          activeTeachers: uniqueTeacherIds.length,
          totalHoursTaught: Math.round((totalMinutesTaught / 60) * 10) / 10,
          totalConfirmedSessions,
        },
        top: topTeachers,
      },
      insights: {
        atRiskStudents,
        scoreDistribution,
        lowCompletionLessons,
        bookingHeatmap,
        avgBookingLeadDays,
      },
    };
  }

  // ─── Canjes ───────────────────────────────────────────────────────────────

  async listRedemptions() {
    return this.prisma.redemption.findMany({
      orderBy: { redeemedAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });
  }

  async markRedemptionDelivered(id: string) {
    const redemption = await this.prisma.redemption.findUnique({ where: { id } });
    if (!redemption) throw new NotFoundException('Canje no encontrado');
    return this.prisma.redemption.update({
      where: { id },
      data: { delivered: true, deliveredAt: new Date() },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    });
  }

  // ─── Retos ────────────────────────────────────────────────────────────────

  async listChallenges() {
    return this.prisma.challenge.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        _count: { select: { userChallenges: { where: { completed: true } } } },
      },
    });
  }

  async createChallenge(dto: CreateChallengeDto) {
    return this.prisma.challenge.create({ data: dto });
  }

  async updateChallenge(id: string, dto: UpdateChallengeDto) {
    const challenge = await this.prisma.challenge.findUnique({ where: { id } });
    if (!challenge) throw new NotFoundException('Reto no encontrado');
    return this.prisma.challenge.update({ where: { id }, data: dto });
  }

  async deleteChallenge(id: string) {
    const challenge = await this.prisma.challenge.findUnique({ where: { id } });
    if (!challenge) throw new NotFoundException('Reto no encontrado');
    await this.prisma.challenge.delete({ where: { id } });
    return { message: 'Reto eliminado correctamente' };
  }

  async toggleChallenge(id: string) {
    const challenge = await this.prisma.challenge.findUnique({ where: { id } });
    if (!challenge) throw new NotFoundException('Reto no encontrado');
    return this.prisma.challenge.update({
      where: { id },
      data: { isActive: !challenge.isActive },
    });
  }

  // ─── Banco de preguntas de examen ─────────────────────────────────────────

  async getExamQuestions(courseId?: string, moduleId?: string) {
    const where = courseId ? { courseId } : moduleId ? { moduleId } : {};
    return this.prisma.examQuestion.findMany({
      where,
      include: { answers: true },
      orderBy: { order: 'asc' },
    });
  }

  async createExamQuestion(dto: CreateExamQuestionDto) {
    if (!dto.courseId && !dto.moduleId) {
      throw new BadRequestException('Debes especificar courseId o moduleId');
    }

    // Calcular el order siguiente
    const where = dto.courseId ? { courseId: dto.courseId } : { moduleId: dto.moduleId };
    const lastQuestion = await this.prisma.examQuestion.findFirst({
      where,
      orderBy: { order: 'desc' },
    });
    const order = (lastQuestion?.order ?? 0) + 1;

    return this.prisma.$transaction(async (tx) => {
      const question = await tx.examQuestion.create({
        data: {
          text: dto.text,
          type: dto.type,
          order,
          courseId: dto.courseId ?? null,
          moduleId: dto.moduleId ?? null,
        },
      });
      await tx.examAnswer.createMany({
        data: dto.answers.map((a) => ({
          text: a.text,
          isCorrect: a.isCorrect,
          questionId: question.id,
        })),
      });
      return tx.examQuestion.findUnique({
        where: { id: question.id },
        include: { answers: true },
      });
    });
  }

  async updateExamQuestion(id: string, dto: UpdateExamQuestionDto) {
    const question = await this.prisma.examQuestion.findUnique({ where: { id } });
    if (!question) throw new NotFoundException('Pregunta de examen no encontrada');

    return this.prisma.$transaction(async (tx) => {
      // Reemplazar respuestas completamente
      await tx.examAnswer.deleteMany({ where: { questionId: id } });
      const updated = await tx.examQuestion.update({
        where: { id },
        data: { text: dto.text, type: dto.type },
      });
      await tx.examAnswer.createMany({
        data: dto.answers.map((a) => ({
          text: a.text,
          isCorrect: a.isCorrect,
          questionId: updated.id,
        })),
      });
      return tx.examQuestion.findUnique({
        where: { id },
        include: { answers: true },
      });
    });
  }

  async deleteExamQuestion(id: string) {
    const question = await this.prisma.examQuestion.findUnique({ where: { id } });
    if (!question) throw new NotFoundException('Pregunta de examen no encontrada');
    await this.prisma.examQuestion.delete({ where: { id } });
    return { message: 'Pregunta eliminada correctamente' };
  }

  async getExamAttempts(courseId?: string, moduleId?: string) {
    const where = courseId ? { courseId } : moduleId ? { moduleId } : {};
    return this.prisma.examAttempt.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }

  // ─── Matrículas manuales ──────────────────────────────────────────────────

  async getEnrollments(userId: string) {
    return this.prisma.enrollment.findMany({
      where: { userId },
      include: { course: { include: { schoolYear: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async enroll(userId: string, courseId: string) {
    return this.prisma.enrollment.upsert({
      where: { userId_courseId: { userId, courseId } },
      update: {},
      create: { userId, courseId },
      include: { course: { include: { schoolYear: true } } },
    });
  }

  async unenroll(userId: string, courseId: string) {
    await this.prisma.enrollment.deleteMany({ where: { userId, courseId } });
    return { message: 'Matrícula eliminada' };
  }

  // ─── Métricas ─────────────────────────────────────────────────────────────

  async getMetrics() {
    const [
      totalUsers,
      totalStudents,
      totalTutors,
      totalTeachers,
      totalCourses,
      publishedCourses,
      totalBookings,
      confirmedBookings,
      pendingBookings,
      totalEnrollments,
      totalQuizAttempts,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: Role.STUDENT } }),
      this.prisma.user.count({ where: { role: Role.TUTOR } }),
      this.prisma.user.count({ where: { role: Role.TEACHER } }),
      this.prisma.course.count(),
      this.prisma.course.count({ where: { published: true } }),
      this.prisma.booking.count(),
      this.prisma.booking.count({ where: { status: 'CONFIRMED' } }),
      this.prisma.booking.count({ where: { status: 'PENDING' } }),
      this.prisma.enrollment.count(),
      this.prisma.quizAttempt.count(),
    ]);

    return {
      users: { total: totalUsers, students: totalStudents, tutors: totalTutors, teachers: totalTeachers },
      courses: { total: totalCourses, published: publishedCourses },
      bookings: { total: totalBookings, confirmed: confirmedBookings, pending: pendingBookings },
      enrollments: totalEnrollments,
      quizAttempts: totalQuizAttempts,
    };
  }

  // ─── Importación de curso desde JSON ─────────────────────────────────────

  async importCourse(dto: ImportCourseDto) {
    // Resolver el schoolYear por nombre ("1eso", "2eso", etc.)
    const schoolYear = await this.prisma.schoolYear.findFirst({
      where: { name: dto.schoolYear },
    });
    if (!schoolYear) {
      throw new BadRequestException(
        `Nivel educativo "${dto.schoolYear}" no encontrado. Valores válidos: 1eso, 2eso, 3eso, 4eso, 1bach, 2bach`,
      );
    }

    // Crear todo en una transacción para garantizar atomicidad
    const course = await this.prisma.$transaction(async (tx) => {
      // 1. Crear el curso
      const newCourse = await tx.course.create({
        data: {
          title: dto.name,
          schoolYearId: schoolYear.id,
        },
      });

      // 2. Preguntas de examen a nivel de curso (si las hay)
      if (dto.examQuestions?.length) {
        await tx.examQuestion.createMany({
          data: dto.examQuestions.map((q, i) => ({
            courseId: newCourse.id,
            text: q.text,
            type: QuestionType.SINGLE,
            order: i + 1,
          })),
        });

        // Recuperar los IDs creados para asociarles las respuestas
        const createdExamQs = await tx.examQuestion.findMany({
          where: { courseId: newCourse.id },
          orderBy: { order: 'asc' },
        });

        for (let i = 0; i < dto.examQuestions.length; i++) {
          await tx.examAnswer.createMany({
            data: dto.examQuestions[i].answers.map((a) => ({
              questionId: createdExamQs[i].id,
              text: a.text,
              isCorrect: a.isCorrect,
            })),
          });
        }
      }

      // 3. Módulos
      for (const modDto of dto.modules) {
        const newModule = await tx.module.create({
          data: {
            title: modDto.title,
            order: modDto.order,
            courseId: newCourse.id,
          },
        });

        // 3a. Preguntas de examen del módulo
        if (modDto.examQuestions?.length) {
          await tx.examQuestion.createMany({
            data: modDto.examQuestions.map((q, i) => ({
              moduleId: newModule.id,
              text: q.text,
              type: QuestionType.SINGLE,
              order: i + 1,
            })),
          });

          const createdModExamQs = await tx.examQuestion.findMany({
            where: { moduleId: newModule.id },
            orderBy: { order: 'asc' },
          });

          for (let i = 0; i < modDto.examQuestions.length; i++) {
            await tx.examAnswer.createMany({
              data: modDto.examQuestions[i].answers.map((a) => ({
                questionId: createdModExamQs[i].id,
                text: a.text,
                isCorrect: a.isCorrect,
              })),
            });
          }
        }

        // 3b. Lecciones
        for (const lesDto of modDto.lessons) {
          const newLesson = await tx.lesson.create({
            data: {
              title: lesDto.title,
              type: lesDto.type,
              order: lesDto.order,
              moduleId: newModule.id,
              youtubeId: lesDto.youtubeId ?? null,
              content: (lesDto.content as Prisma.InputJsonValue) ?? Prisma.JsonNull,
            },
          });

          // 3c. Quiz (solo si type === QUIZ y hay preguntas)
          if (lesDto.type === LessonType.QUIZ && lesDto.quiz?.questions?.length) {
            const newQuiz = await tx.quiz.create({
              data: { lessonId: newLesson.id },
            });

            for (let qi = 0; qi < lesDto.quiz.questions.length; qi++) {
              const qDto = lesDto.quiz.questions[qi];
              const newQuestion = await tx.question.create({
                data: {
                  text: qDto.text,
                  type: QuestionType.SINGLE,
                  order: qi + 1,
                  quizId: newQuiz.id,
                },
              });

              await tx.answer.createMany({
                data: qDto.answers.map((a) => ({
                  text: a.text,
                  isCorrect: a.isCorrect,
                  questionId: newQuestion.id,
                })),
              });
            }
          }
        }
      }

      // Devolver el curso con estructura completa
      return tx.course.findUnique({
        where: { id: newCourse.id },
        include: {
          schoolYear: true,
          _count: { select: { modules: true } },
        },
      });
    });

    return {
      message: `Curso "${dto.name}" importado correctamente`,
      course,
    };
  }
}
