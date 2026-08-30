import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ChallengeCadence, ChallengeType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  isoWeek,
  previousIsoWeek,
  madridDay,
  previousDay,
  currentWeekStart,
} from './challenge-periods';

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

  /**
   * Calcula el progreso actual del usuario para un tipo de reto.
   * `since` llega solo en retos WEEKLY: los tipos contables filtran por
   * fecha, los de estado (máximos, rachas, variedad) lo ignoran.
   */
  private async calculateProgress(
    userId: string,
    type: ChallengeType,
    since?: Date,
  ): Promise<number> {
    switch (type) {
      // ── Plan de estudio ──
      case ChallengeType.STUDY_PLAN_CREATED:
        return this.prisma.studyPlan.count({
          where: { userId, ...(since ? { createdAt: { gte: since } } : {}) },
        });

      case ChallengeType.TOPICS_STUDIED:
        // StudyPlanTopic no tiene timestamp propio: la ventana va por el plan
        return this.prisma.studyPlanTopic.count({
          where: { plan: { userId, ...(since ? { createdAt: { gte: since } } : {}) } },
        });

      case ChallengeType.SUBJECT_VARIETY: {
        // contextCourseId cubre también los temas CUSTOM fuera de la asignatura base
        const rows = await this.prisma.studyPlanTopic.findMany({
          where: { plan: { userId } },
          select: { contextCourseId: true },
          distinct: ['contextCourseId'],
        });
        return rows.length;
      }

      case ChallengeType.THEORY_COMPLETED:
        return this.prisma.theoryModule.count({
          where: { userId, ...(since ? { createdAt: { gte: since } } : {}) },
        });

      // ── Ejercicios del plan ──
      case ChallengeType.EXERCISES_SOLVED:
        return this.prisma.exerciseAttempt.count({
          where: {
            userId,
            verdict: 'correct',
            ...(since ? { answeredAt: { gte: since } } : {}),
          },
        });

      case ChallengeType.HARD_EXERCISES_SOLVED:
        return this.prisma.exerciseAttempt.count({
          where: {
            userId,
            verdict: 'correct',
            difficulty: 'HARD',
            ...(since ? { answeredAt: { gte: since } } : {}),
          },
        });

      case ChallengeType.EXERCISES_CORRECT_STREAK: {
        const u = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { currentCorrectStreak: true },
        });
        return u?.currentCorrectStreak ?? 0;
      }

      // ── Exámenes ──
      case ChallengeType.EXAM_COMPLETED:
        return this.prisma.examAttempt.count({
          where: { userId, submittedAt: since ? { gte: since } : { not: null } },
        });

      case ChallengeType.EXAM_SCORE: {
        const agg = await this.prisma.examAttempt.aggregate({
          where: { userId, submittedAt: { not: null } },
          _max: { score: true },
        });
        return Math.round(agg._max.score ?? 0);
      }

      case ChallengeType.EXAM_PERFECT:
        return this.prisma.examAttempt.count({
          where: {
            userId,
            score: 100,
            submittedAt: since ? { gte: since } : { not: null },
          },
        });

      case ChallengeType.EXAM_HARD_SCORE: {
        const agg = await this.prisma.examAttempt.aggregate({
          where: { userId, submittedAt: { not: null }, aiExamBank: { level: 'HARD' } },
          _max: { score: true },
        });
        return Math.round(agg._max.score ?? 0);
      }

      // ── Hábito ──
      case ChallengeType.TUTOR_QUESTIONS:
        return this.prisma.tutorMessage.count({
          where: { userId, role: 'user', ...(since ? { createdAt: { gte: since } } : {}) },
        });

      case ChallengeType.STREAK_DAILY: {
        const u = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { currentDailyStreak: true },
        });
        return u?.currentDailyStreak ?? 0;
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

  /** Clave de periodo del reto: "ALL" si es permanente, la semana ISO si es semanal */
  private periodKeyFor(cadence: ChallengeCadence, weekKey: string): string {
    return cadence === ChallengeCadence.WEEKLY ? weekKey : 'ALL';
  }

  /**
   * Evalúa y otorga retos para el userId dados uno o varios tipos de evento.
   * Llamar con void (sin await) para no bloquear la respuesta HTTP.
   */
  async checkAndAward(userId: string, ...eventTypes: ChallengeType[]): Promise<void> {
    try {
      // 1. Actualizar rachas primero (necesarias para STREAK_DAILY / STREAK_WEEKLY)
      await this.updateStreak(userId);

      // 2. Los retos de racha se evalúan siempre, los pase o no el punto de llamada
      const types = [
        ...new Set([...eventTypes, ChallengeType.STREAK_DAILY, ChallengeType.STREAK_WEEKLY]),
      ];
      const challenges = await this.prisma.challenge.findMany({
        where: { isActive: true, type: { in: types } },
      });
      if (challenges.length === 0) return;

      const now = new Date();
      const weekKey = isoWeek(now);
      const weekStart = currentWeekStart(now);

      // 3. Progreso por (tipo, cadencia): la ventana cambia el número, así que
      //    dos retos del mismo tipo con distinta cadencia no comparten cálculo
      const progressKey = (c: { type: ChallengeType; cadence: ChallengeCadence }) =>
        `${c.type}|${c.cadence}`;
      const uniqueCombos = [...new Map(challenges.map((c) => [progressKey(c), c])).values()];
      const progressEntries = await Promise.all(
        uniqueCombos.map(
          async (c) =>
            [
              progressKey(c),
              await this.calculateProgress(
                userId,
                c.type,
                c.cadence === ChallengeCadence.WEEKLY ? weekStart : undefined,
              ),
            ] as const,
        ),
      );
      const progressByCombo = new Map(progressEntries);

      // 4. UserChallenge existentes del periodo relevante, en una sola consulta
      const existingList = await this.prisma.userChallenge.findMany({
        where: {
          userId,
          challengeId: { in: challenges.map((c) => c.id) },
          periodKey: { in: ['ALL', weekKey] },
        },
      });
      const existingMap = new Map(
        existingList.map((uc) => [`${uc.challengeId}|${uc.periodKey}`, uc]),
      );

      // 5. Escrituras en paralelo (cada una afecta a una clave distinta)
      await Promise.all(
        challenges.map(async (challenge) => {
          const periodKey = this.periodKeyFor(challenge.cadence, weekKey);
          const existing = existingMap.get(`${challenge.id}|${periodKey}`);

          // Si ya está completado en ESTE periodo, no tocar
          if (existing?.completed) return;

          const progress = progressByCombo.get(progressKey(challenge)) ?? 0;

          if (progress < challenge.target) {
            // Progreso sin completar: no hay pago, así que dos escrituras
            // concurrentes del mismo número son inocuas.
            await this.prisma.userChallenge.upsert({
              where: {
                userId_challengeId_periodKey: { userId, challengeId: challenge.id, periodKey },
              },
              update: { progress },
              create: {
                userId,
                challengeId: challenge.id,
                periodKey,
                progress,
                completed: false,
                completedAt: null,
                awardedPoints: 0,
              },
            });
            return;
          }

          await this.awardCompletion(userId, challenge, periodKey, progress);
        }),
      );
    } catch (err) {
      this.logger.error(`Error en checkAndAward para userId=${userId}`, err);
    }
  }

  /**
   * Marca un reto como completado y paga sus puntos, de forma atómica.
   *
   * La transición `completed: false → true` es la que decide el pago: el
   * `updateMany` condicionado a `completed: false` solo afecta a una fila si
   * este proceso es el que la completa, y el incremento de `totalPoints` va
   * en la MISMA transacción. Dos `checkAndAward` concurrentes del mismo
   * alumno (dos ejercicios enviados casi a la vez, o un ejercicio y un
   * examen) ya no pueden pagar los mismos puntos dos veces, y un fallo al
   * sumar puntos revierte también la marca de completado — nunca queda una
   * medalla sin pagar e irrecuperable.
   */
  private async awardCompletion(
    userId: string,
    challenge: { id: string; points: number },
    periodKey: string,
    progress: number,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // La fila puede no existir todavía (primera vez que se ve el reto).
      // `update: {}` deja intacta la que ya estuviera: el estado lo decide
      // el updateMany de abajo, no este upsert.
      await tx.userChallenge.upsert({
        where: { userId_challengeId_periodKey: { userId, challengeId: challenge.id, periodKey } },
        update: {},
        create: {
          userId,
          challengeId: challenge.id,
          periodKey,
          progress,
          completed: false,
          completedAt: null,
          awardedPoints: 0,
        },
      });

      const transitioned = await tx.userChallenge.updateMany({
        where: { userId, challengeId: challenge.id, periodKey, completed: false },
        data: {
          progress,
          completed: true,
          completedAt: new Date(),
          awardedPoints: challenge.points,
        },
      });
      // Otro proceso ya lo completó y ya pagó: no volver a pagar.
      if (transitioned.count === 0) return;

      await tx.user.update({
        where: { id: userId },
        data: { totalPoints: { increment: challenge.points } },
      });
    });
  }

  /**
   * Mueve la racha de aciertos en ejercicios. Se llama SOLO al crear un
   * ExerciseAttempt nuevo: reintentar uno ya respondido no la mueve.
   */
  async bumpCorrectStreak(userId: string, correct: boolean): Promise<void> {
    // Este método SÍ se espera con await (submitExerciseAttempt lo necesita
    // resuelto antes de evaluar los retos), así que lo que escape de aquí
    // llega al cliente. La versión anterior, que leía el usuario antes de
    // escribir, salía por un `if (!u) return`; con el incremento atómico ya
    // no hay lectura, y un usuario inexistente haría que Prisma lanzara P2025
    // crudo. Se traduce a "no hay nada que actualizar".
    try {
      if (!correct) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { currentCorrectStreak: 0 },
        });
        return;
      }

      // Incremento atómico en BD: leer-modificar-escribir perdía una unidad
      // cuando dos aciertos entraban en paralelo, y esa racha paga puntos
      // (EXERCISES_CORRECT_STREAK).
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data: { currentCorrectStreak: { increment: 1 } },
        select: { currentCorrectStreak: true, longestCorrectStreak: true },
      });

      // El récord solo sube, nunca baja: la condición `lt` evita que una
      // escritura concurrente más lenta lo devuelva a un valor anterior.
      if (updated.currentCorrectStreak > updated.longestCorrectStreak) {
        await this.prisma.user.updateMany({
          where: { id: userId, longestCorrectStreak: { lt: updated.currentCorrectStreak } },
          data: { longestCorrectStreak: updated.currentCorrectStreak },
        });
      }
    } catch (err) {
      // P2025 = la fila del usuario no existe. Es inalcanzable con un JWT
      // válido, pero no debe convertirse en un 500 con texto de Prisma.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        this.logger.warn(`No se pudo mover la racha: el usuario ${userId} ya no existe`);
        return;
      }
      throw err;
    }
  }

  /** Lista todos los retos activos enriquecidos con el progreso del usuario */
  async getMyProgress(userId: string) {
    const weekKey = isoWeek(new Date());

    const [challenges, userChallenges, user] = await Promise.all([
      this.prisma.challenge.findMany({ where: { isActive: true }, orderBy: { createdAt: 'asc' } }),
      this.prisma.userChallenge.findMany({
        where: { userId, periodKey: { in: ['ALL', weekKey] } },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          totalPoints: true,
          currentStreak: true,
          longestStreak: true,
          currentDailyStreak: true,
          longestDailyStreak: true,
        },
      }),
    ]);

    // Indexado por (challengeId, periodKey): un reto semanal tiene una fila
    // por semana, así que indexar solo por challengeId se queda con una
    // fila arbitraria (la última que llegue de Prisma).
    const progressMap = new Map(
      userChallenges.map((uc) => [`${uc.challengeId}|${uc.periodKey}`, uc]),
    );

    return {
      meta: {
        totalPoints: user?.totalPoints ?? 0,
        currentStreak: user?.currentStreak ?? 0,
        longestStreak: user?.longestStreak ?? 0,
        currentDailyStreak: user?.currentDailyStreak ?? 0,
        longestDailyStreak: user?.longestDailyStreak ?? 0,
      },
      challenges: challenges.map((c) => {
        const uc = progressMap.get(`${c.id}|${this.periodKeyFor(c.cadence, weekKey)}`);
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
    return this.prisma.$transaction(async (tx) => {
      // La condición del saldo viaja en el WHERE de la escritura: decide la base de
      // datos, no el proceso. Leer y luego decrementar dejaba que dos canjes
      // simultáneos del mismo alumno pasaran ambos la comprobación con el mismo
      // saldo y se llevaran dos artículos físicos dejando totalPoints en negativo.
      const { count } = await tx.user.updateMany({
        where: { id: userId, totalPoints: { gte: cost } },
        data: { totalPoints: { decrement: cost } },
      });

      // Sin descuento no hay canje: el Redemption solo se crea si count === 1.
      if (count === 0) {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { totalPoints: true },
        });
        // Excepciones de Nest, no Error pelado: el cliente debe recibir
        // { message, statusCode } y no depender de que el controlador adivine el código.
        if (!user) throw new NotFoundException('Usuario no encontrado');
        throw new BadRequestException(
          `Puntos insuficientes. Tienes ${user.totalPoints} pts y necesitas ${cost} pts.`,
        );
      }

      await tx.redemption.create({
        data: { userId, itemName, cost, academyId: academyId ?? undefined },
      });

      const updated = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { totalPoints: true },
      });

      return {
        message: `¡${itemName} canjeado correctamente!`,
        pointsSpent: cost,
        remainingPoints: updated.totalPoints,
      };
    });
  }

  /** Resumen compacto del usuario */
  async getSummary(userId: string) {
    // Mismo criterio de periodo que getMyProgress: sin filtrar, las misiones
    // semanales de semanas pasadas seguirían contando en completedCount y
    // podrían repetirse cinco veces en recentBadges.
    const weekKey = isoWeek(new Date());

    const [user, userChallenges] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          totalPoints: true,
          currentStreak: true,
          longestStreak: true,
          currentDailyStreak: true,
          longestDailyStreak: true,
        },
      }),
      this.prisma.userChallenge.findMany({
        where: { userId, periodKey: { in: ['ALL', weekKey] } },
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
      currentDailyStreak: user?.currentDailyStreak ?? 0,
      longestDailyStreak: user?.longestDailyStreak ?? 0,
      completedCount,
      recentBadges,
    };
  }
}
