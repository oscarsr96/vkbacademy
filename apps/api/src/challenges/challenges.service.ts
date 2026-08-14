import { Injectable, Logger } from '@nestjs/common';
import { ChallengeType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isoWeek, previousIsoWeek, madridDay, previousDay } from './challenge-periods';

@Injectable()
export class ChallengesService {
  private readonly logger = new Logger(ChallengesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Actualiza las rachas semanal y diaria del usuario en una sola escritura */
  async updateStreak(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        currentStreak: true,
        longestStreak: true,
        lastActiveWeek: true,
        currentDailyStreak: true,
        longestDailyStreak: true,
        lastActiveDay: true,
      },
    });
    if (!user) return;

    const now = new Date();
    const currentWeek = isoWeek(now);
    const currentDay = madridDay(now);

    const weekChanged = user.lastActiveWeek !== currentWeek;
    const dayChanged = user.lastActiveDay !== currentDay;
    // Ya se contabilizó este día y esta semana: nada que escribir
    if (!weekChanged && !dayChanged) return;

    const data: Prisma.UserUpdateInput = {};

    if (weekChanged) {
      const nextWeekly =
        user.lastActiveWeek === previousIsoWeek(currentWeek) ? user.currentStreak + 1 : 1;
      data.lastActiveWeek = currentWeek;
      data.currentStreak = nextWeekly;
      data.longestStreak = Math.max(user.longestStreak, nextWeekly);
    }

    if (dayChanged) {
      const nextDaily =
        user.lastActiveDay === previousDay(currentDay) ? user.currentDailyStreak + 1 : 1;
      data.lastActiveDay = currentDay;
      data.currentDailyStreak = nextDaily;
      data.longestDailyStreak = Math.max(user.longestDailyStreak, nextDaily);
    }

    await this.prisma.user.update({ where: { id: userId }, data });
  }

  /** Calcula el progreso actual del usuario para un tipo de reto */
  private async calculateProgress(userId: string, type: ChallengeType): Promise<number> {
    switch (type) {
      case ChallengeType.THEORY_COMPLETED:
        return this.prisma.theoryModule.count({ where: { userId } });

      case ChallengeType.EXAM_COMPLETED:
        return this.prisma.examAttempt.count({
          where: { userId, submittedAt: { not: null } },
        });

      case ChallengeType.EXAM_SCORE: {
        const agg = await this.prisma.examAttempt.aggregate({
          where: { userId, submittedAt: { not: null } },
          _max: { score: true },
        });
        return Math.round(agg._max.score ?? 0);
      }

      case ChallengeType.STREAK_WEEKLY: {
        const u = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { currentStreak: true },
        });
        return u?.currentStreak ?? 0;
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

      if (challenges.length === 0) return;

      // 3. Progreso por tipo único (varios retos pueden compartir tipo; se calcula una sola vez)
      const uniqueTypes = [...new Set(challenges.map((c) => c.type))];
      const progressEntries = await Promise.all(
        uniqueTypes.map(
          async (type) => [type, await this.calculateProgress(userId, type)] as const,
        ),
      );
      const progressByType = new Map(progressEntries);

      // 4. UserChallenge existentes en una sola consulta (en vez de un findUnique por reto)
      const existingList = await this.prisma.userChallenge.findMany({
        where: { userId, challengeId: { in: challenges.map((c) => c.id) } },
      });
      const existingMap = new Map(existingList.map((uc) => [uc.challengeId, uc]));

      let pointsToAward = 0;

      // 5. Upserts en paralelo (cada uno afecta a un challengeId distinto, sin condición de carrera entre sí)
      await Promise.all(
        challenges.map(async (challenge) => {
          const existing = existingMap.get(challenge.id);

          // Si ya está completado, no tocar
          if (existing?.completed) return;

          const progress = progressByType.get(challenge.type) ?? 0;
          const completed = progress >= challenge.target;

          await this.prisma.userChallenge.upsert({
            // periodKey fijo a "ALL" (retos PERMANENT): la cadencia WEEKLY con su
            // periodo real por semana ISO se implementa en otra tarea.
            where: {
              userId_challengeId_periodKey: { userId, challengeId: challenge.id, periodKey: 'ALL' },
            },
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

          if (completed && !existing?.completed) {
            pointsToAward += challenge.points;
          }
        }),
      );

      // 6. Un único incremento de totalPoints en vez de uno por reto completado
      if (pointsToAward > 0) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { totalPoints: { increment: pointsToAward } },
        });
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
  async redeemItem(userId: string, itemName: string, cost: number, academyId?: string | null) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { totalPoints: true },
    });
    if (!user) throw new Error('Usuario no encontrado');

    if (user.totalPoints < cost) {
      throw new Error(
        `Puntos insuficientes. Tienes ${user.totalPoints} pts y necesitas ${cost} pts.`,
      );
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { totalPoints: { decrement: cost } },
        select: { totalPoints: true },
      }),
      this.prisma.redemption.create({
        data: { userId, itemName, cost, academyId: academyId ?? undefined },
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
