import { Injectable, Logger } from '@nestjs/common';
import { ChallengeType, BookingStatus, LessonType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Devuelve la semana ISO como "2026-W07" */
function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Ajustar al jueves de la semana actual (ISO: la semana empieza el lunes)
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Devuelve la semana ISO de la semana anterior a la dada */
function previousIsoWeek(week: string): string {
  const [yearStr, wStr] = week.split('-W');
  const year = parseInt(yearStr, 10);
  const w = parseInt(wStr, 10);
  if (w === 1) {
    // Semana 1 del año: la anterior es la última del año previo
    const dec28 = new Date(Date.UTC(year - 1, 11, 28));
    return isoWeek(dec28);
  }
  // Calcular lunes de la semana anterior
  const jan4 = new Date(Date.UTC(year, 0, 4));
  jan4.setUTCDate(jan4.getUTCDate() - (jan4.getUTCDay() || 7) + 1);
  jan4.setUTCDate(jan4.getUTCDate() + (w - 2) * 7);
  return isoWeek(jan4);
}

@Injectable()
export class ChallengesService {
  private readonly logger = new Logger(ChallengesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Actualiza la racha semanal del usuario */
  async updateStreak(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { currentStreak: true, longestStreak: true, lastActiveWeek: true },
    });
    if (!user) return;

    const currentWeek = isoWeek(new Date());

    // Ya se contabilizó esta semana
    if (user.lastActiveWeek === currentWeek) return;

    let newStreak: number;
    if (user.lastActiveWeek === previousIsoWeek(currentWeek)) {
      // Semana consecutiva
      newStreak = user.currentStreak + 1;
    } else {
      // Racha rota o primera actividad
      newStreak = 1;
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        lastActiveWeek: currentWeek,
        currentStreak: newStreak,
        longestStreak: Math.max(user.longestStreak, newStreak),
      },
    });
  }

  /** Calcula el progreso actual del usuario para un tipo de reto */
  private async calculateProgress(userId: string, type: ChallengeType): Promise<number> {
    switch (type) {
      case ChallengeType.LESSON_COMPLETED:
        return this.prisma.userProgress.count({ where: { userId, completed: true } });

      case ChallengeType.MODULE_COMPLETED: {
        // Módulos donde TODAS las lecciones tienen UserProgress.completed=true para el usuario
        const modules = await this.prisma.module.findMany({
          include: {
            lessons: {
              include: {
                progress: { where: { userId, completed: true } },
              },
            },
          },
        });
        return modules.filter(
          (m) => m.lessons.length > 0 && m.lessons.every((l) => l.progress.length > 0),
        ).length;
      }

      case ChallengeType.COURSE_COMPLETED: {
        // Cursos donde TODAS las lecciones de todos los módulos están completadas
        const courses = await this.prisma.course.findMany({
          include: {
            modules: {
              include: {
                lessons: {
                  include: {
                    progress: { where: { userId, completed: true } },
                  },
                },
              },
            },
          },
        });
        return courses.filter((c) => {
          const allLessons = c.modules.flatMap((m) => m.lessons);
          return allLessons.length > 0 && allLessons.every((l) => l.progress.length > 0);
        }).length;
      }

      case ChallengeType.QUIZ_SCORE: {
        const agg = await this.prisma.quizAttempt.aggregate({
          where: { userId },
          _max: { score: true },
        });
        return Math.round(agg._max.score ?? 0);
      }

      case ChallengeType.BOOKING_ATTENDED:
        return this.prisma.booking.count({
          where: { studentId: userId, status: BookingStatus.CONFIRMED, endAt: { lte: new Date() } },
        });

      case ChallengeType.STREAK_WEEKLY: {
        const u = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { currentStreak: true },
        });
        return u?.currentStreak ?? 0;
      }

      case ChallengeType.TOTAL_HOURS: {
        // Horas de bookings confirmados pasados
        const bookings = await this.prisma.booking.findMany({
          where: { studentId: userId, status: BookingStatus.CONFIRMED, endAt: { lte: new Date() } },
          select: { startAt: true, endAt: true },
        });
        const bookingHours = bookings.reduce(
          (acc, b) => acc + (b.endAt.getTime() - b.startAt.getTime()) / 3_600_000,
          0,
        );

        // Horas de lecciones VIDEO completadas (20 min cada una)
        const videoLessons = await this.prisma.userProgress.count({
          where: { userId, completed: true, lesson: { type: LessonType.VIDEO } },
        });
        const videoHours = videoLessons * (20 / 60);

        return Math.floor(bookingHours + videoHours);
      }

      default:
        return 0;
    }
  }

  /**
   * Evalúa y otorga retos para el userId dados uno o varios tipos de evento.
   * Llamar con void (sin await) para no bloquear la respuesta HTTP.
   */
  async checkAndAward(userId: string, ...eventTypes: ChallengeType[]): Promise<void> {
    try {
      // 1. Actualizar racha primero (necesaria para STREAK_WEEKLY)
      await this.updateStreak(userId);

      // 2. Obtener retos activos de los tipos indicados
      const challenges = await this.prisma.challenge.findMany({
        where: { isActive: true, type: { in: eventTypes } },
      });

      for (const challenge of challenges) {
        // 3. Calcular progreso actual
        const progress = await this.calculateProgress(userId, challenge.type);

        // 4. Obtener o crear el UserChallenge
        const existing = await this.prisma.userChallenge.findUnique({
          where: { userId_challengeId: { userId, challengeId: challenge.id } },
        });

        // Si ya está completado, no tocar
        if (existing?.completed) continue;

        const completed = progress >= challenge.target;

        await this.prisma.userChallenge.upsert({
          where: { userId_challengeId: { userId, challengeId: challenge.id } },
          update: {
            progress,
            ...(completed && !existing?.completed
              ? { completed: true, completedAt: new Date(), awardedPoints: challenge.points }
              : {}),
          },
          create: {
            userId,
            challengeId: challenge.id,
            progress,
            completed,
            completedAt: completed ? new Date() : null,
            awardedPoints: completed ? challenge.points : 0,
          },
        });

        // 5. Si se completó ahora, incrementar totalPoints en User
        if (completed && !existing?.completed) {
          await this.prisma.user.update({
            where: { id: userId },
            data: { totalPoints: { increment: challenge.points } },
          });
        }
      }
    } catch (err) {
      this.logger.error(`Error en checkAndAward para userId=${userId}`, err);
    }
  }

  /** Lista todos los retos activos enriquecidos con el progreso del usuario */
  async getMyProgress(userId: string) {
    const [challenges, userChallenges, user] = await Promise.all([
      this.prisma.challenge.findMany({ where: { isActive: true }, orderBy: { createdAt: 'asc' } }),
      this.prisma.userChallenge.findMany({ where: { userId } }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { totalPoints: true, currentStreak: true, longestStreak: true },
      }),
    ]);

    const progressMap = new Map(userChallenges.map((uc) => [uc.challengeId, uc]));

    return {
      meta: {
        totalPoints: user?.totalPoints ?? 0,
        currentStreak: user?.currentStreak ?? 0,
        longestStreak: user?.longestStreak ?? 0,
      },
      challenges: challenges.map((c) => {
        const uc = progressMap.get(c.id);
        return {
          ...c,
          progress: uc?.progress ?? 0,
          completed: uc?.completed ?? false,
          completedAt: uc?.completedAt ?? null,
          awardedPoints: uc?.awardedPoints ?? 0,
        };
      }),
    };
  }

  /** Canjea puntos del usuario por un artículo de merchandising */
  async redeemItem(userId: string, itemName: string, cost: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { totalPoints: true },
    });
    if (!user) throw new Error('Usuario no encontrado');

    if (user.totalPoints < cost) {
      throw new Error(`Puntos insuficientes. Tienes ${user.totalPoints} pts y necesitas ${cost} pts.`);
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { totalPoints: { decrement: cost } },
        select: { totalPoints: true },
      }),
      this.prisma.redemption.create({
        data: { userId, itemName, cost },
      }),
    ]);

    return {
      message: `¡${itemName} canjeado correctamente!`,
      pointsSpent: cost,
      remainingPoints: updated.totalPoints,
    };
  }

  /** Resumen compacto del usuario */
  async getSummary(userId: string) {
    const [user, userChallenges] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { totalPoints: true, currentStreak: true, longestStreak: true },
      }),
      this.prisma.userChallenge.findMany({
        where: { userId },
        include: { challenge: true },
        orderBy: { completedAt: 'desc' },
      }),
    ]);

    const completedCount = userChallenges.filter((uc) => uc.completed).length;
    const recentBadges = userChallenges
      .filter((uc) => uc.completed)
      .slice(0, 5)
      .map((uc) => ({
        title: uc.challenge.title,
        badgeIcon: uc.challenge.badgeIcon,
        badgeColor: uc.challenge.badgeColor,
        completedAt: uc.completedAt,
      }));

    return {
      totalPoints: user?.totalPoints ?? 0,
      currentStreak: user?.currentStreak ?? 0,
      longestStreak: user?.longestStreak ?? 0,
      completedCount,
      recentBadges,
    };
  }
}
