import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

@Injectable()
export class AdminAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

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

    const userWhere = {
      createdAt: { gte: dateFrom, lte: dateTo },
      role: Role.STUDENT,
      ...(schoolYearId ? { schoolYearId } : {}),
    };

    // ── Consultas principales ──────────────────────────────────────────────
    const [newUsers, newEnrollments, progressRecords, quizRecords, usersTimeSeries] =
      await Promise.all([
        this.prisma.user.count({ where: userWhere }),
        this.prisma.enrollment.count({ where: enrollmentWhere }),
        this.prisma.userProgress.findMany({ where: progressWhere, select: { completedAt: true } }),
        this.prisma.quizAttempt.findMany({
          where: quizWhere,
          select: { completedAt: true, score: true },
        }),
        this.prisma.user.findMany({ where: userWhere, select: { createdAt: true } }),
      ]);

    const completedLessons = progressRecords.length;
    const avgQuizScore =
      quizRecords.length > 0
        ? Math.round((quizRecords.reduce((sum, r) => sum + r.score, 0) / quizRecords.length) * 10) /
          10
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
    const newUsersByDate = buildMap(usersTimeSeries.map((r) => ({ date: r.createdAt })));

    const timeSeries = generateRange().map((date) => ({
      date,
      completedLessons: progressByDate.get(date) ?? 0,
      quizAttempts: quizByDate.get(date) ?? 0,
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
      where: {
        completed: true,
        completedAt: { gte: dateFrom, lte: dateTo },
        ...progressLessonFilter,
      },
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

    return {
      kpis: {
        newUsers,
        newEnrollments,
        completedLessons,
        quizAttempts: quizRecords.length,
        avgQuizScore,
      },
      timeSeries,
      topCourses,
      topStudents,
      insights: {
        atRiskStudents,
        scoreDistribution,
        lowCompletionLessons,
      },
    };
  }

  // ─── Métricas ─────────────────────────────────────────────────────────────

  async getMetrics() {
    const [
      totalUsers,
      totalStudents,
      totalTutors,
      totalCourses,
      publishedCourses,
      totalEnrollments,
      totalQuizAttempts,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: Role.STUDENT } }),
      this.prisma.user.count({ where: { role: Role.TUTOR } }),
      this.prisma.course.count(),
      this.prisma.course.count({ where: { published: true } }),
      this.prisma.enrollment.count(),
      this.prisma.quizAttempt.count(),
    ]);

    return {
      users: {
        total: totalUsers,
        students: totalStudents,
        tutors: totalTutors,
      },
      courses: { total: totalCourses, published: publishedCourses },
      enrollments: totalEnrollments,
      quizAttempts: totalQuizAttempts,
    };
  }
}
