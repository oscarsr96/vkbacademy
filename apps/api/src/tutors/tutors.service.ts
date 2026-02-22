import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TutorsService {
  constructor(private readonly prisma: PrismaService) {}

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
          select: { id: true, title: true, schoolYear: { select: { id: true, name: true, label: true } } },
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
  async getStudentStats(
    tutorId: string,
    studentId: string,
    from?: Date,
    to?: Date,
  ) {
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
}
