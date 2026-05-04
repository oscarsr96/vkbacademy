import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TutorsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Verifica que el alumno pertenece al tutor y devuelve sus campos básicos.
   * Lanza ForbiddenException si no existe o no es del tutor.
   */
  private async getStudentForTutor(tutorId: string, studentId: string) {
    const student = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: { id: true, tutorId: true, schoolYearId: true },
    });
    if (!student || student.tutorId !== tutorId) {
      throw new ForbiddenException('No tienes acceso a este alumno');
    }
    return student;
  }

  /** Devuelve la lista de alumnos asignados a un tutor */
  async getMyStudents(tutorId: string) {
    return this.prisma.user.findMany({
      where: { tutorId },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        totalPoints: true,
        currentStreak: true,
        schoolYear: {
          select: { id: true, name: true, label: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  /** Devuelve los cursos en los que está matriculado un alumno del tutor */
  async getStudentCourses(tutorId: string, studentId: string) {
    const student = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: { tutorId: true },
    });
    if (!student || student.tutorId !== tutorId) {
      throw new ForbiddenException('No tienes acceso a este alumno');
    }

    const enrollments = await this.prisma.enrollment.findMany({
      where: { userId: studentId },
      select: {
        course: {
          select: {
            id: true,
            title: true,
            schoolYear: { select: { id: true, name: true, label: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return enrollments.map((e) => e.course);
  }

  /**
   * Métricas detalladas de un alumno para el tutor.
   * `from` y `to` filtran el período de las métricas de actividad.
   * Los datos de gamificación (puntos, racha) son siempre all-time.
   */
  async getStudentStats(tutorId: string, studentId: string, from?: Date, to?: Date) {
    // 1. Verificar que el alumno pertenece al tutor
    const student = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        tutorId: true,
        totalPoints: true,
        currentStreak: true,
        longestStreak: true,
        createdAt: true,
        schoolYear: { select: { id: true, name: true, label: true } },
      },
    });
    if (!student || student.tutorId !== tutorId) {
      throw new ForbiddenException('No tienes acceso a este alumno');
    }

    // 2. Rango de fechas (evitar spread con claves duplicadas)
    const hasPeriod = !!(from || to);
    const dateRange = hasPeriod
      ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) }
      : null;

    // 3. Todas las queries en paralelo
    const [completedInPeriod, quizAttempts, examAttempts, certificates, bookings, enrollments] =
      await Promise.all([
        // Lecciones completadas en el período
        this.prisma.userProgress.findMany({
          where: {
            userId: studentId,
            completed: true,
            completedAt: dateRange ? dateRange : { not: null },
          },
          select: { completedAt: true },
        }),

        // Intentos de quiz en el período
        this.prisma.quizAttempt.findMany({
          where: {
            userId: studentId,
            ...(dateRange ? { completedAt: dateRange } : {}),
          },
          select: { score: true, completedAt: true },
        }),

        // Intentos de examen entregados en el período
        this.prisma.examAttempt.findMany({
          where: {
            userId: studentId,
            submittedAt: dateRange ? dateRange : { not: null },
          },
          select: { score: true, submittedAt: true },
        }),

        // Certificados emitidos en el período
        this.prisma.certificate.findMany({
          where: {
            userId: studentId,
            ...(dateRange ? { issuedAt: dateRange } : {}),
          },
          select: { type: true, issuedAt: true },
        }),

        // Reservas confirmadas en el período
        this.prisma.booking.findMany({
          where: {
            studentId,
            status: 'CONFIRMED',
            ...(dateRange ? { startAt: dateRange } : {}),
          },
          select: { startAt: true, endAt: true },
        }),

        // Matrículas + árbol de módulos/lecciones para calcular % de avance all-time
        this.prisma.enrollment.findMany({
          where: { userId: studentId },
          select: {
            course: {
              select: {
                id: true,
                title: true,
                schoolYear: { select: { id: true, name: true, label: true } },
                modules: {
                  orderBy: { order: 'asc' },
                  select: {
                    id: true,
                    title: true,
                    lessons: { select: { id: true } },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        }),
      ]);

    // 4. Progreso all-time (conteo directo, no limitado a matrículas explícitas)
    const completedAllTime = await this.prisma.userProgress.count({
      where: { userId: studentId, completed: true },
    });

    // 5. Progreso por curso (una sola query para evitar N+1)
    const allLessonIds = enrollments.flatMap((e) =>
      e.course.modules.flatMap((m) => m.lessons.map((l) => l.id)),
    );

    const completedLessons =
      allLessonIds.length > 0
        ? await this.prisma.userProgress.findMany({
            where: { userId: studentId, completed: true, lessonId: { in: allLessonIds } },
            select: { lessonId: true },
          })
        : [];

    const completedSet = new Set(completedLessons.map((p) => p.lessonId));

    const courses = enrollments.map((e) => {
      const { course } = e;
      const lessonIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id));
      const completed = lessonIds.filter((id) => completedSet.has(id)).length;
      return {
        id: course.id,
        title: course.title,
        schoolYear: course.schoolYear ?? null,
        totalLessons: lessonIds.length,
        completedLessons: completed,
        progressPct: lessonIds.length > 0 ? Math.round((completed / lessonIds.length) * 100) : 0,
        modules: course.modules.map((m) => {
          const modLessonIds = m.lessons.map((l) => l.id);
          const modCompleted = modLessonIds.filter((id) => completedSet.has(id)).length;
          return {
            id: m.id,
            title: m.title,
            totalLessons: modLessonIds.length,
            completedLessons: modCompleted,
          };
        }),
      };
    });

    // 6. Métricas de quizzes
    const quizScores = quizAttempts.map((a) => a.score);
    const avgQuizScore =
      quizScores.length > 0
        ? Math.round((quizScores.reduce((a, b) => a + b, 0) / quizScores.length) * 10) / 10
        : null;
    const bestQuizScore =
      quizScores.length > 0 ? Math.round(Math.max(...quizScores) * 10) / 10 : null;

    // 7. Métricas de exámenes
    const examScores = examAttempts.map((a) => a.score ?? 0);
    const avgExamScore =
      examScores.length > 0
        ? Math.round((examScores.reduce((a, b) => a + b, 0) / examScores.length) * 10) / 10
        : null;
    const bestExamScore =
      examScores.length > 0 ? Math.round(Math.max(...examScores) * 10) / 10 : null;
    const passedExams = examAttempts.filter((a) => (a.score ?? 0) >= 50).length;

    // 8. Certificados por tipo
    const certByType: Record<string, number> = {};
    for (const cert of certificates) {
      certByType[cert.type] = (certByType[cert.type] ?? 0) + 1;
    }

    // 9. Horas de clase (reservas confirmadas)
    const totalBookingMinutes = bookings.reduce((acc, b) => {
      return acc + (new Date(b.endAt).getTime() - new Date(b.startAt).getTime()) / 60000;
    }, 0);

    // 10. Actividad diaria — lecciones completadas y quizzes agrupados por día
    const activityMap = new Map<string, { lessons: number; quizzes: number }>();

    for (const p of completedInPeriod) {
      if (!p.completedAt) continue;
      const day = p.completedAt.toISOString().split('T')[0];
      const entry = activityMap.get(day) ?? { lessons: 0, quizzes: 0 };
      entry.lessons++;
      activityMap.set(day, entry);
    }
    for (const q of quizAttempts) {
      const day = q.completedAt.toISOString().split('T')[0];
      const entry = activityMap.get(day) ?? { lessons: 0, quizzes: 0 };
      entry.quizzes++;
      activityMap.set(day, entry);
    }

    const activity = Array.from(activityMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({ date, ...data }));

    const activeDays = new Set(
      completedInPeriod
        .filter((p) => p.completedAt)
        .map((p) => p.completedAt!.toISOString().split('T')[0]),
    ).size;

    return {
      student: {
        id: student.id,
        name: student.name,
        email: student.email,
        avatarUrl: student.avatarUrl,
        schoolYear: student.schoolYear,
        totalPoints: student.totalPoints,
        currentStreak: student.currentStreak,
        longestStreak: student.longestStreak,
        createdAt: student.createdAt,
      },
      period: { from: from ?? null, to: to ?? null },
      lessons: {
        completedInPeriod: completedInPeriod.length,
        completedAllTime,
        activeDays,
      },
      quizzes: {
        attempts: quizAttempts.length,
        avgScore: avgQuizScore,
        bestScore: bestQuizScore,
      },
      exams: {
        attempts: examAttempts.length,
        avgScore: avgExamScore,
        bestScore: bestExamScore,
        passed: passedExams,
      },
      certificates: {
        total: certificates.length,
        byType: certByType,
      },
      sessions: {
        confirmed: bookings.length,
        totalHours: Math.round(totalBookingMinutes / 6) / 10,
      },
      courses,
      activity,
    };
  }

  // ─── Matrículas gestionadas por el tutor ───────────────────────────────────

  /**
   * Cursos disponibles para matricular a un alumno: publicados y del mismo
   * nivel (schoolYearId) que el alumno. Cada item incluye `enrolled`.
   */
  async getAvailableCoursesForStudent(tutorId: string, studentId: string) {
    const student = await this.getStudentForTutor(tutorId, studentId);

    if (!student.schoolYearId) {
      return [];
    }

    const [courses, enrollments] = await Promise.all([
      this.prisma.course.findMany({
        where: { published: true, schoolYearId: student.schoolYearId },
        select: {
          id: true,
          title: true,
          subject: true,
          coverUrl: true,
          schoolYear: { select: { id: true, name: true, label: true } },
        },
        orderBy: [{ subject: 'asc' }, { title: 'asc' }],
      }),
      this.prisma.enrollment.findMany({
        where: { userId: studentId },
        select: { courseId: true },
      }),
    ]);

    const enrolledIds = new Set(enrollments.map((e) => e.courseId));

    return courses.map((c) => ({ ...c, enrolled: enrolledIds.has(c.id) }));
  }

  /** Matricula al alumno en un curso. Idempotente. Valida nivel coincidente. */
  async enrollStudent(tutorId: string, studentId: string, courseId: string) {
    const student = await this.getStudentForTutor(tutorId, studentId);

    if (!student.schoolYearId) {
      throw new BadRequestException('El alumno no tiene nivel asignado');
    }

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, schoolYearId: true, published: true },
    });
    if (!course) {
      throw new BadRequestException('Curso no encontrado');
    }
    if (course.schoolYearId !== student.schoolYearId) {
      throw new ForbiddenException('El curso no corresponde al nivel del alumno');
    }

    return this.prisma.enrollment.upsert({
      where: { userId_courseId: { userId: studentId, courseId } },
      update: {},
      create: { userId: studentId, courseId },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            subject: true,
            coverUrl: true,
            schoolYear: { select: { id: true, name: true, label: true } },
          },
        },
      },
    });
  }

  /** Desmatricula al alumno de un curso. Idempotente. */
  async unenrollStudent(tutorId: string, studentId: string, courseId: string) {
    await this.getStudentForTutor(tutorId, studentId);
    await this.prisma.enrollment.deleteMany({
      where: { userId: studentId, courseId },
    });
    return { message: 'Matrícula eliminada' };
  }
}
