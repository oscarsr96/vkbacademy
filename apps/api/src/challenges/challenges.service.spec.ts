import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ChallengeType, ChallengeCadence, Prisma } from '@prisma/client';
import { ChallengesService } from './challenges.service';
import { PrismaService } from '../prisma/prisma.service';

// Fechas fijas con ISO weeks conocidas:
//   2026-02-16 (lunes) → semana ISO "2026-W08"
//   2026-02-09 (lunes) → semana ISO "2026-W07"
const WEEK_08 = new Date('2026-02-16T12:00:00Z'); // lunes de la W08
const ISO_W08 = '2026-W08';
const ISO_W07 = '2026-W07';
const DAY_W08_MON = '2026-02-16'; // el día de WEEK_08 en Europe/Madrid
const DAY_W08_SUN = '2026-02-15'; // el día anterior

/** Extrae, de las llamadas a user.update, solo las que otorgan puntos (data.totalPoints) */
function awardedPointsCalls(
  updateMock: jest.Mock,
): { where?: unknown; data?: { totalPoints?: unknown } }[] {
  return updateMock.mock.calls
    .map((c) => c[0] as { data?: { totalPoints?: unknown } })
    .filter((c) => c.data?.totalPoints !== undefined);
}

describe('ChallengesService', () => {
  let service: ChallengesService;
  let mockPrisma: {
    user: {
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    challenge: { findMany: jest.Mock };
    userChallenge: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
      updateMany: jest.Mock;
      findMany: jest.Mock;
    };
    userProgress: { count: jest.Mock };
    quizAttempt: { aggregate: jest.Mock };
    theoryModule: { count: jest.Mock };
    theoryLesson: { count: jest.Mock };
    examAttempt: { count: jest.Mock; aggregate: jest.Mock; findMany: jest.Mock };
    redemption: { create: jest.Mock };
    studyPlan: { count: jest.Mock };
    studyPlanTopic: { count: jest.Mock; findMany: jest.Mock };
    exerciseAttempt: {
      count: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    tutorMessage: { count: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      challenge: { findMany: jest.fn() },
      userChallenge: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        updateMany: jest.fn(),
        findMany: jest.fn(),
      },
      userProgress: { count: jest.fn() },
      quizAttempt: { aggregate: jest.fn() },
      theoryModule: { count: jest.fn() },
      theoryLesson: { count: jest.fn() },
      examAttempt: { count: jest.fn(), aggregate: jest.fn(), findMany: jest.fn() },
      redemption: { create: jest.fn() },
      studyPlan: { count: jest.fn() },
      studyPlanTopic: { count: jest.fn(), findMany: jest.fn() },
      exerciseAttempt: {
        count: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      tutorMessage: { count: jest.fn() },
      // $transaction se usa de dos formas: con callback (transacción
      // interactiva de awardCompletion) y con array (redeemItem).
      $transaction: jest.fn(),
    };
    mockPrisma.$transaction.mockImplementation((arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (tx: typeof mockPrisma) => Promise<unknown>)(mockPrisma)
        : Promise.all(arg as unknown[]),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [ChallengesService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<ChallengesService>(ChallengesService);
    jest.clearAllMocks();
  });

  // ─── updateStreak ────────────────────────────────────────────────────────────

  describe('updateStreak', () => {
    // Usar fake timers para controlar `new Date()` dentro del servicio
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(WEEK_08); // fijamos la "fecha actual" en la W08 de 2026
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('no actualiza si el usuario no existe', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await service.updateStreak('user1');

      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('no actualiza si ya se registró actividad en la semana actual', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        currentStreak: 3,
        longestStreak: 5,
        lastActiveWeek: ISO_W08, // ya activo esta semana
        currentDailyStreak: 1,
        longestDailyStreak: 1,
        lastActiveDay: DAY_W08_MON, // y hoy también
      });

      await service.updateStreak('user1');

      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('incrementa la racha si la semana anterior fue la última activa', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        currentStreak: 3,
        longestStreak: 5,
        lastActiveWeek: ISO_W07, // semana consecutiva anterior a W08
        currentDailyStreak: 0,
        longestDailyStreak: 0,
        lastActiveDay: null,
      });
      mockPrisma.user.update.mockResolvedValue({});

      await service.updateStreak('user1');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user1' },
        data: {
          lastActiveWeek: ISO_W08,
          currentStreak: 4, // 3 + 1
          longestStreak: 5, // max(5, 4) = 5 (no bate récord)
          lastActiveDay: DAY_W08_MON,
          currentDailyStreak: 1,
          longestDailyStreak: 1,
        },
      });
    });

    it('reinicia la racha a 1 si se saltó una semana', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        currentStreak: 5,
        longestStreak: 10,
        lastActiveWeek: '2026-W05', // saltó W06 y W07
        currentDailyStreak: 0,
        longestDailyStreak: 0,
        lastActiveDay: null,
      });
      mockPrisma.user.update.mockResolvedValue({});

      await service.updateStreak('user1');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user1' },
        data: {
          lastActiveWeek: ISO_W08,
          currentStreak: 1, // racha rota
          longestStreak: 10, // max(10, 1) no cambia
          lastActiveDay: DAY_W08_MON,
          currentDailyStreak: 1,
          longestDailyStreak: 1,
        },
      });
    });

    it('inicia la racha en 1 si es la primera actividad (lastActiveWeek null)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        currentStreak: 0,
        longestStreak: 0,
        lastActiveWeek: null,
        currentDailyStreak: 0,
        longestDailyStreak: 0,
        lastActiveDay: null,
      });
      mockPrisma.user.update.mockResolvedValue({});

      await service.updateStreak('user1');

      const updateCall = mockPrisma.user.update.mock.calls[0][0];
      expect(updateCall.data.currentStreak).toBe(1);
      expect(updateCall.data.longestStreak).toBe(1); // max(0, 1)
      expect(updateCall.data.lastActiveDay).toBe(DAY_W08_MON);
      expect(updateCall.data.currentDailyStreak).toBe(1);
      expect(updateCall.data.longestDailyStreak).toBe(1);
    });

    it('actualiza longestStreak cuando la nueva racha bate el récord', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        currentStreak: 4, // la racha actual coincide con el récord
        longestStreak: 4,
        lastActiveWeek: ISO_W07,
        currentDailyStreak: 0,
        longestDailyStreak: 0,
        lastActiveDay: null,
      });
      mockPrisma.user.update.mockResolvedValue({});

      await service.updateStreak('user1');

      const updateCall = mockPrisma.user.update.mock.calls[0][0];
      expect(updateCall.data.currentStreak).toBe(5); // 4 + 1
      expect(updateCall.data.longestStreak).toBe(5); // nuevo récord
      expect(updateCall.data.lastActiveDay).toBe(DAY_W08_MON);
      expect(updateCall.data.currentDailyStreak).toBe(1);
      expect(updateCall.data.longestDailyStreak).toBe(1);
    });

    it('inicia la racha diaria a 1 cuando no hay dia previo', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        currentStreak: 0,
        longestStreak: 0,
        lastActiveWeek: null,
        currentDailyStreak: 0,
        longestDailyStreak: 0,
        lastActiveDay: null,
      });
      mockPrisma.user.update.mockResolvedValue({});

      await service.updateStreak('user1');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user1' },
        data: {
          lastActiveWeek: ISO_W08,
          currentStreak: 1,
          longestStreak: 1,
          lastActiveDay: DAY_W08_MON,
          currentDailyStreak: 1,
          longestDailyStreak: 1,
        },
      });
    });

    it('incrementa la racha diaria si el dia anterior fue el ultimo activo', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        currentStreak: 2,
        longestStreak: 4,
        lastActiveWeek: ISO_W08, // misma semana: la racha semanal no se toca
        currentDailyStreak: 3,
        longestDailyStreak: 3,
        lastActiveDay: DAY_W08_SUN,
      });
      mockPrisma.user.update.mockResolvedValue({});

      await service.updateStreak('user1');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user1' },
        data: {
          lastActiveDay: DAY_W08_MON,
          currentDailyStreak: 4,
          longestDailyStreak: 4,
        },
      });
    });

    it('reinicia la racha diaria a 1 si se salto un dia', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        currentStreak: 2,
        longestStreak: 4,
        lastActiveWeek: ISO_W08,
        currentDailyStreak: 6,
        longestDailyStreak: 9,
        lastActiveDay: '2026-02-13', // saltó el 14 y el 15
      });
      mockPrisma.user.update.mockResolvedValue({});

      await service.updateStreak('user1');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user1' },
        data: {
          lastActiveDay: DAY_W08_MON,
          currentDailyStreak: 1,
          longestDailyStreak: 9, // el récord no baja
        },
      });
    });

    it('no escribe nada si ya hubo actividad hoy y esta semana', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        currentStreak: 2,
        longestStreak: 4,
        lastActiveWeek: ISO_W08,
        currentDailyStreak: 3,
        longestDailyStreak: 5,
        lastActiveDay: DAY_W08_MON,
      });

      await service.updateStreak('user1');

      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });
  });

  // ─── redeemItem ──────────────────────────────────────────────────────────────

  describe('redeemItem', () => {
    beforeEach(() => {
      mockPrisma.redemption.create.mockResolvedValue({});
    });

    // Las excepciones son de Nest, no Error pelado: el cliente recibe
    // { message, statusCode } sin depender de que el controlador lo adivine.
    it('lanza 404 si el usuario no existe', async () => {
      mockPrisma.user.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.redeemItem('user1', 'Camiseta', 500)).rejects.toThrow(NotFoundException);
      await expect(service.redeemItem('user1', 'Camiseta', 500)).rejects.toThrow(
        'Usuario no encontrado',
      );
      expect(mockPrisma.redemption.create).not.toHaveBeenCalled();
    });

    it('lanza 400 si el usuario no tiene puntos suficientes, no un 500', async () => {
      mockPrisma.user.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.user.findUnique.mockResolvedValue({ totalPoints: 50 });

      const error = await service.redeemItem('user1', 'Camiseta', 500).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getStatus()).toBe(400);
      expect((error as BadRequestException).message).toMatch(/insuficientes/);
    });

    it('ejecuta la transacción atómica y devuelve el resultado del canje', async () => {
      mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({ totalPoints: 800 });

      const result = await service.redeemItem('user1', 'Balón firmado', 200);

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(result.remainingPoints).toBe(800);
      expect(result.pointsSpent).toBe(200);
      expect(result.message).toContain('Balón firmado');
    });

    it('descuenta con la condición de saldo en el WHERE y crea el Redemption', async () => {
      mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({ totalPoints: 150 });

      await service.redeemItem('user1', 'Gorra', 350, 'academy1');

      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'user1', totalPoints: { gte: 350 } },
        data: { totalPoints: { decrement: 350 } },
      });
      expect(mockPrisma.redemption.create).toHaveBeenCalledWith({
        data: { userId: 'user1', itemName: 'Gorra', cost: 350, academyId: 'academy1' },
      });
    });

    it('no entrega el artículo si el descuento no afectó a ninguna fila (canje concurrente)', async () => {
      // Otro canje simultáneo vació el saldo entre la comprobación y la escritura:
      // el gte del WHERE no se cumple, este canje actualiza 0 filas y aborta.
      mockPrisma.user.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.user.findUnique.mockResolvedValue({ totalPoints: 0 });

      await expect(service.redeemItem('user1', 'Balón firmado', 1000)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrisma.redemption.create).not.toHaveBeenCalled();
    });

    it('el error de puntos incluye el mensaje con los puntos actuales y necesarios', async () => {
      mockPrisma.user.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.user.findUnique.mockResolvedValue({ totalPoints: 100 });

      await expect(service.redeemItem('user1', 'Botella', 200)).rejects.toThrow(/100/);
    });
  });

  // ─── checkAndAward ───────────────────────────────────────────────────────────

  describe('checkAndAward', () => {
    // updateStreak requiere user.findUnique; configurar respuesta neutral
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(WEEK_08);
      // Usuario ya activo hoy y esta semana → updateStreak no hace nada
      mockPrisma.user.findUnique.mockResolvedValue({
        currentStreak: 2,
        longestStreak: 3,
        lastActiveWeek: ISO_W08,
        currentDailyStreak: 1,
        longestDailyStreak: 1,
        lastActiveDay: DAY_W08_MON,
      });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('no lanza excepción si Prisma falla — captura el error internamente', async () => {
      mockPrisma.challenge.findMany.mockRejectedValue(new Error('DB error'));

      await expect(
        service.checkAndAward('user1', ChallengeType.EXAM_COMPLETED),
      ).resolves.toBeUndefined();
    });

    it('consulta solo los retos activos de los tipos de evento recibidos', async () => {
      mockPrisma.challenge.findMany.mockResolvedValue([]);

      await service.checkAndAward(
        'user1',
        ChallengeType.THEORY_COMPLETED,
        ChallengeType.EXAM_COMPLETED,
      );

      expect(mockPrisma.challenge.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          // Las rachas se evalúan siempre, además de los tipos de evento recibidos
          type: {
            in: [
              ChallengeType.THEORY_COMPLETED,
              ChallengeType.EXAM_COMPLETED,
              ChallengeType.STREAK_DAILY,
              ChallengeType.STREAK_WEEKLY,
            ],
          },
        },
      });
    });

    it('crea un nuevo UserChallenge cuando el usuario completa el reto por primera vez', async () => {
      const challenge = {
        id: 'ch1',
        type: ChallengeType.THEORY_COMPLETED,
        target: 5,
        points: 100,
      };
      mockPrisma.challenge.findMany.mockResolvedValue([challenge]);
      mockPrisma.theoryModule.count.mockResolvedValue(5); // exactamente el target
      mockPrisma.userChallenge.findMany.mockResolvedValue([]); // no existía
      mockPrisma.userChallenge.upsert.mockResolvedValue({});
      mockPrisma.userChallenge.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.user.update.mockResolvedValue({});

      await service.checkAndAward('user1', ChallengeType.THEORY_COMPLETED);

      // La fila se crea sin completar y la completa el updateMany condicionado:
      // así la transición (y con ella el pago) es de uno solo.
      expect(mockPrisma.userChallenge.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: {},
          create: expect.objectContaining({ completed: false, awardedPoints: 0 }),
        }),
      );
      expect(mockPrisma.userChallenge.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user1', challengeId: 'ch1', periodKey: 'ALL', completed: false },
        data: expect.objectContaining({ completed: true, awardedPoints: 100 }),
      });
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { totalPoints: { increment: 100 } },
        }),
      );
    });

    // C1 — la transición a completado es la que paga, y es atómica
    it('el pago y la marca de completado van en la misma transacción', async () => {
      mockPrisma.challenge.findMany.mockResolvedValue([
        { id: 'ch1', type: ChallengeType.THEORY_COMPLETED, target: 5, points: 100 },
      ]);
      mockPrisma.theoryModule.count.mockResolvedValue(5);
      mockPrisma.userChallenge.findMany.mockResolvedValue([]);
      mockPrisma.userChallenge.upsert.mockResolvedValue({});
      mockPrisma.userChallenge.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.user.update.mockResolvedValue({});

      await service.checkAndAward('user1', ChallengeType.THEORY_COMPLETED);

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(typeof mockPrisma.$transaction.mock.calls[0][0]).toBe('function');
      // El incremento ocurre DENTRO del callback de la transacción
      const tx = {
        userChallenge: { upsert: jest.fn(), updateMany: jest.fn() },
        user: { update: jest.fn() },
      };
      tx.userChallenge.upsert.mockResolvedValue({});
      tx.userChallenge.updateMany.mockResolvedValue({ count: 1 });
      tx.user.update.mockResolvedValue({});
      await (mockPrisma.$transaction.mock.calls[0][0] as (t: typeof tx) => Promise<void>)(tx);
      expect(tx.user.update).toHaveBeenCalledWith({
        where: { id: 'user1' },
        data: { totalPoints: { increment: 100 } },
      });
    });

    it('no paga si otro proceso ya había completado el reto (updateMany no afecta a ninguna fila)', async () => {
      mockPrisma.challenge.findMany.mockResolvedValue([
        { id: 'ch1', type: ChallengeType.THEORY_COMPLETED, target: 5, points: 100 },
      ]);
      mockPrisma.theoryModule.count.mockResolvedValue(5);
      // La fila leída al principio decía "sin completar"...
      mockPrisma.userChallenge.findMany.mockResolvedValue([
        { challengeId: 'ch1', periodKey: 'ALL', completed: false, progress: 4 },
      ]);
      mockPrisma.userChallenge.upsert.mockResolvedValue({});
      // ...pero al escribir, otro checkAndAward concurrente ya la había completado
      mockPrisma.userChallenge.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.user.update.mockResolvedValue({});

      await service.checkAndAward('user1', ChallengeType.THEORY_COMPLETED);

      expect(awardedPointsCalls(mockPrisma.user.update)).toHaveLength(0);
    });

    it('actualiza el progreso sin completar si no llega al target', async () => {
      const challenge = {
        id: 'ch1',
        type: ChallengeType.THEORY_COMPLETED,
        target: 10,
        points: 200,
      };
      mockPrisma.challenge.findMany.mockResolvedValue([challenge]);
      mockPrisma.theoryModule.count.mockResolvedValue(3); // por debajo del target
      mockPrisma.userChallenge.findMany.mockResolvedValue([]);
      mockPrisma.userChallenge.upsert.mockResolvedValue({});

      await service.checkAndAward('user1', ChallengeType.THEORY_COMPLETED);

      expect(mockPrisma.userChallenge.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ completed: false, awardedPoints: 0 }),
        }),
      );
      // No se incrementan puntos porque no se completó (user.update puede
      // llamarse igualmente desde updateStreak, así que no basta con
      // comprobar que no se llamó en absoluto)
      expect(awardedPointsCalls(mockPrisma.user.update)).toHaveLength(0);
    });

    it('omite el reto si ya estaba completado — no duplica los puntos', async () => {
      const challenge = {
        id: 'ch1',
        type: ChallengeType.THEORY_COMPLETED,
        target: 5,
        points: 100,
      };
      mockPrisma.challenge.findMany.mockResolvedValue([challenge]);
      mockPrisma.theoryModule.count.mockResolvedValue(10); // supera target
      mockPrisma.userChallenge.findMany.mockResolvedValue([
        { challengeId: 'ch1', periodKey: 'ALL', completed: true },
      ]); // ya completado

      await service.checkAndAward('user1', ChallengeType.THEORY_COMPLETED);

      // Al estar ya completado, no debe upsertarse ni incrementar puntos
      expect(mockPrisma.userChallenge.upsert).not.toHaveBeenCalled();
      expect(awardedPointsCalls(mockPrisma.user.update)).toHaveLength(0);
    });

    // La fila mockeada DEBE llevar periodKey: sin él, la clave del Map interno
    // es "ch1|undefined", `existing` sale undefined y la rama "el reto ya
    // existía" no se ejercita — el test pasaría solo porque 8 < 20.
    it('actualiza el progreso, sin pagar, si el reto existía sin completar y aún no llega al target', async () => {
      const challenge = {
        id: 'ch1',
        type: ChallengeType.THEORY_COMPLETED,
        cadence: ChallengeCadence.PERMANENT,
        target: 20,
        points: 500,
      };
      mockPrisma.challenge.findMany.mockResolvedValue([challenge]);
      mockPrisma.theoryModule.count.mockResolvedValue(8);
      mockPrisma.userChallenge.findMany.mockResolvedValue([
        { challengeId: 'ch1', periodKey: 'ALL', completed: false, progress: 5 },
      ]);
      mockPrisma.userChallenge.upsert.mockResolvedValue({});

      await service.checkAndAward('user1', ChallengeType.THEORY_COMPLETED);

      // Se reconoce la fila existente (la clave del Map casa) y se actualiza
      // su progreso 5 → 8 por la rama de update, sin marcar completado.
      expect(mockPrisma.userChallenge.upsert).toHaveBeenCalledWith({
        where: {
          userId_challengeId_periodKey: { userId: 'user1', challengeId: 'ch1', periodKey: 'ALL' },
        },
        update: { progress: 8 },
        create: expect.objectContaining({ progress: 8, completed: false, awardedPoints: 0 }),
      });
      expect(mockPrisma.userChallenge.updateMany).not.toHaveBeenCalled();
      expect(awardedPointsCalls(mockPrisma.user.update)).toHaveLength(0);
    });

    // Equivalente semanal del test de permanentes "omite el reto si ya estaba
    // completado": una misión ya cumplida ESTA semana no vuelve a pagar.
    it('un reto semanal ya completado esta semana no vuelve a pagar', async () => {
      mockPrisma.challenge.findMany.mockResolvedValue([
        {
          id: 'c2',
          type: ChallengeType.EXERCISES_SOLVED,
          cadence: ChallengeCadence.WEEKLY,
          target: 3,
          points: 15,
        },
      ]);
      mockPrisma.exerciseAttempt.count.mockResolvedValue(9); // muy por encima del target
      mockPrisma.userChallenge.findMany.mockResolvedValue([
        { challengeId: 'c2', periodKey: ISO_W08, completed: true },
      ]);

      await service.checkAndAward('user1', ChallengeType.EXERCISES_SOLVED);

      expect(mockPrisma.userChallenge.upsert).not.toHaveBeenCalled();
      expect(mockPrisma.userChallenge.updateMany).not.toHaveBeenCalled();
      expect(awardedPointsCalls(mockPrisma.user.update)).toHaveLength(0);
    });

    it('evalua los retos de racha aunque el evento no los mencione', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        currentStreak: 3,
        longestStreak: 3,
        lastActiveWeek: ISO_W08,
        currentDailyStreak: 3,
        longestDailyStreak: 3,
        lastActiveDay: '2026-02-16',
      });
      mockPrisma.challenge.findMany.mockResolvedValue([]);

      await service.checkAndAward('user1', ChallengeType.EXAM_COMPLETED);

      // El filtro de tipos debe incluir las dos rachas además del evento recibido
      const where = mockPrisma.challenge.findMany.mock.calls[0][0].where as {
        type: { in: ChallengeType[] };
      };
      expect(where.type.in).toEqual(
        expect.arrayContaining([
          ChallengeType.EXAM_COMPLETED,
          ChallengeType.STREAK_DAILY,
          ChallengeType.STREAK_WEEKLY,
        ]),
      );
    });

    it('usa periodKey ALL en retos permanentes', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        currentStreak: 1,
        longestStreak: 1,
        lastActiveWeek: ISO_W08,
        currentDailyStreak: 1,
        longestDailyStreak: 1,
        lastActiveDay: '2026-02-16',
      });
      mockPrisma.challenge.findMany.mockResolvedValue([
        {
          id: 'c1',
          type: ChallengeType.TUTOR_QUESTIONS,
          cadence: ChallengeCadence.PERMANENT,
          target: 5,
          points: 20,
        },
      ]);
      mockPrisma.tutorMessage.count.mockResolvedValue(2);
      mockPrisma.userChallenge.findMany.mockResolvedValue([]);
      mockPrisma.userChallenge.upsert.mockResolvedValue({});

      await service.checkAndAward('user1', ChallengeType.TUTOR_QUESTIONS);

      expect(mockPrisma.userChallenge.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_challengeId_periodKey: {
              userId: 'user1',
              challengeId: 'c1',
              periodKey: 'ALL',
            },
          },
        }),
      );
    });

    it('usa la semana ISO como periodKey en retos semanales', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        currentStreak: 1,
        longestStreak: 1,
        lastActiveWeek: ISO_W08,
        currentDailyStreak: 1,
        longestDailyStreak: 1,
        lastActiveDay: '2026-02-16',
      });
      mockPrisma.challenge.findMany.mockResolvedValue([
        {
          id: 'c2',
          type: ChallengeType.EXERCISES_SOLVED,
          cadence: ChallengeCadence.WEEKLY,
          target: 20,
          points: 15,
        },
      ]);
      mockPrisma.exerciseAttempt.count.mockResolvedValue(5);
      mockPrisma.userChallenge.findMany.mockResolvedValue([]);
      mockPrisma.userChallenge.upsert.mockResolvedValue({});

      await service.checkAndAward('user1', ChallengeType.EXERCISES_SOLVED);

      expect(mockPrisma.userChallenge.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_challengeId_periodKey: {
              userId: 'user1',
              challengeId: 'c2',
              periodKey: ISO_W08,
            },
          },
        }),
      );
    });

    it('un reto semanal completado la semana pasada vuelve a conceder puntos', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        currentStreak: 1,
        longestStreak: 1,
        lastActiveWeek: ISO_W08,
        currentDailyStreak: 1,
        longestDailyStreak: 1,
        lastActiveDay: '2026-02-16',
      });
      mockPrisma.challenge.findMany.mockResolvedValue([
        {
          id: 'c2',
          type: ChallengeType.EXERCISES_SOLVED,
          cadence: ChallengeCadence.WEEKLY,
          target: 3,
          points: 15,
        },
      ]);
      mockPrisma.exerciseAttempt.count.mockResolvedValue(3);
      // Fila de la semana ANTERIOR, ya completada: no debe bloquear la de esta
      mockPrisma.userChallenge.findMany.mockResolvedValue([
        { challengeId: 'c2', periodKey: ISO_W07, completed: true },
      ]);
      mockPrisma.userChallenge.upsert.mockResolvedValue({});
      mockPrisma.userChallenge.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.user.update.mockResolvedValue({});

      await service.checkAndAward('user1', ChallengeType.EXERCISES_SOLVED);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user1' },
        data: { totalPoints: { increment: 15 } },
      });
    });

    // Cobertura añadida tras la mutación 3 (progressKey ignorando la cadencia):
    // sin este test, dos retos del mismo tipo con distinta cadencia podían
    // compartir por error un único cálculo de progreso.
    it('dos retos del mismo tipo con distinta cadencia calculan el progreso por separado', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        currentStreak: 1,
        longestStreak: 1,
        lastActiveWeek: ISO_W08,
        currentDailyStreak: 1,
        longestDailyStreak: 1,
        lastActiveDay: '2026-02-16',
      });
      mockPrisma.challenge.findMany.mockResolvedValue([
        {
          id: 'perm1',
          type: ChallengeType.EXERCISES_SOLVED,
          cadence: ChallengeCadence.PERMANENT,
          target: 5,
          points: 10,
        },
        {
          id: 'week1',
          type: ChallengeType.EXERCISES_SOLVED,
          cadence: ChallengeCadence.WEEKLY,
          target: 3,
          points: 15,
        },
      ]);
      // El progreso PERMANENT (sin ventana) y el WEEKLY (con ventana) son distintos:
      // 4 aciertos de toda la vida, pero solo 2 desde el lunes
      mockPrisma.exerciseAttempt.count.mockImplementation(
        (args: { where: { answeredAt?: unknown } }) =>
          Promise.resolve(args.where.answeredAt ? 2 : 4),
      );
      mockPrisma.userChallenge.findMany.mockResolvedValue([]);
      mockPrisma.userChallenge.upsert.mockResolvedValue({});

      await service.checkAndAward('user1', ChallengeType.EXERCISES_SOLVED);

      // calculateProgress se invoca dos veces (una por combo tipo+cadencia),
      // con ventanas temporales distintas
      expect(mockPrisma.exerciseAttempt.count).toHaveBeenCalledTimes(2);
      expect(mockPrisma.exerciseAttempt.count).toHaveBeenCalledWith({
        where: { userId: 'user1', verdict: 'correct' },
      });
      expect(mockPrisma.exerciseAttempt.count).toHaveBeenCalledWith({
        where: {
          userId: 'user1',
          verdict: 'correct',
          answeredAt: { gte: new Date('2026-02-15T23:00:00.000Z') },
        },
      });

      type UpsertArg = {
        where: { userId_challengeId_periodKey: { challengeId: string } };
        create: { progress: number };
      };
      const upsertCalls = mockPrisma.userChallenge.upsert.mock.calls.map((c) => c[0] as UpsertArg);
      const permCall = upsertCalls.find(
        (c) => c.where.userId_challengeId_periodKey.challengeId === 'perm1',
      );
      const weekCall = upsertCalls.find(
        (c) => c.where.userId_challengeId_periodKey.challengeId === 'week1',
      );
      expect(permCall?.create.progress).toBe(4);
      expect(weekCall?.create.progress).toBe(2);
    });

    it('no hace nada si no hay retos activos para los tipos de evento', async () => {
      mockPrisma.challenge.findMany.mockResolvedValue([]); // sin retos

      await service.checkAndAward('user1', ChallengeType.EXAM_SCORE);

      expect(mockPrisma.userChallenge.upsert).not.toHaveBeenCalled();
    });
  });

  // ─── bumpCorrectStreak ───────────────────────────────────────────────────────

  describe('bumpCorrectStreak', () => {
    it('incrementa la racha con una operación atómica, no leyendo y escribiendo', async () => {
      mockPrisma.user.update.mockResolvedValue({
        currentCorrectStreak: 5,
        longestCorrectStreak: 4,
      });
      mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });

      await service.bumpCorrectStreak('user1', true);

      // El +1 lo hace la BD: dos aciertos en paralelo no pueden perder uno
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user1' },
        data: { currentCorrectStreak: { increment: 1 } },
        select: { currentCorrectStreak: true, longestCorrectStreak: true },
      });
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('sube el record solo si la racha lo supera, y nunca lo baja', async () => {
      mockPrisma.user.update.mockResolvedValue({
        currentCorrectStreak: 5,
        longestCorrectStreak: 4,
      });
      mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });

      await service.bumpCorrectStreak('user1', true);

      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
        // La condición `lt` impide que una escritura concurrente más lenta
        // devuelva el récord a un valor anterior.
        where: { id: 'user1', longestCorrectStreak: { lt: 5 } },
        data: { longestCorrectStreak: 5 },
      });
    });

    it('no toca el record si la racha actual no lo supera', async () => {
      mockPrisma.user.update.mockResolvedValue({
        currentCorrectStreak: 3,
        longestCorrectStreak: 9,
      });

      await service.bumpCorrectStreak('user1', true);

      expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
    });

    // submitExerciseAttempt espera este método con await (no con void), así
    // que un error que escape aquí llega al cliente. Con el incremento
    // atómico ya no hay lectura previa, así que la guarda "usuario que no
    // existe" tiene que estar en el manejo del P2025.
    it('no deja escapar el P2025 crudo de Prisma si el usuario ya no existe', async () => {
      mockPrisma.user.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Record to update not found', {
          code: 'P2025',
          clientVersion: '5.22.0',
        }),
      );

      await expect(service.bumpCorrectStreak('fantasma', true)).resolves.toBeUndefined();
      expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
    });

    it('tampoco lo deja escapar al reiniciar la racha por un fallo', async () => {
      mockPrisma.user.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Record to update not found', {
          code: 'P2025',
          clientVersion: '5.22.0',
        }),
      );

      await expect(service.bumpCorrectStreak('fantasma', false)).resolves.toBeUndefined();
    });

    it('un fallo de BD que no sea P2025 sí se propaga (no se traga en silencio)', async () => {
      mockPrisma.user.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Timed out fetching a connection', {
          code: 'P2024',
          clientVersion: '5.22.0',
        }),
      );

      await expect(service.bumpCorrectStreak('user1', true)).rejects.toThrow(/Timed out/);
    });

    it('pone la racha a cero al fallar sin tocar el record', async () => {
      mockPrisma.user.update.mockResolvedValue({});

      await service.bumpCorrectStreak('user1', false);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user1' },
        data: { currentCorrectStreak: 0 },
      });
    });
  });

  // ─── getSummary ──────────────────────────────────────────────────────────────

  describe('getSummary', () => {
    it('devuelve el resumen del usuario con stats y badges recientes', async () => {
      const now = new Date();
      mockPrisma.user.findUnique.mockResolvedValue({
        totalPoints: 300,
        currentStreak: 3,
        longestStreak: 5,
        currentDailyStreak: 4,
        longestDailyStreak: 7,
      });
      mockPrisma.userChallenge.findMany.mockResolvedValue([
        {
          completed: true,
          completedAt: now,
          challenge: { title: 'Primer Módulo', badgeIcon: '🏆', badgeColor: '#6366f1' },
        },
        {
          completed: true,
          completedAt: now,
          challenge: { title: 'Quiz Perfecto', badgeIcon: '⭐', badgeColor: '#f59e0b' },
        },
        {
          completed: false,
          completedAt: null,
          challenge: { title: 'Reto en curso', badgeIcon: '🔥', badgeColor: '#ef4444' },
        },
      ]);

      const result = await service.getSummary('user1');

      expect(result.totalPoints).toBe(300);
      expect(result.currentStreak).toBe(3);
      expect(result.longestStreak).toBe(5);
      expect(result.currentDailyStreak).toBe(4);
      expect(result.longestDailyStreak).toBe(7);
      expect(result.completedCount).toBe(2); // solo los completed=true
      expect(result.recentBadges).toHaveLength(2);
      expect(result.recentBadges[0].title).toBe('Primer Módulo');
    });

    it('devuelve valores por defecto si el usuario no existe', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.userChallenge.findMany.mockResolvedValue([]);

      const result = await service.getSummary('nonexistent');

      expect(result.totalPoints).toBe(0);
      expect(result.currentStreak).toBe(0);
      expect(result.currentDailyStreak).toBe(0);
      expect(result.longestDailyStreak).toBe(0);
      expect(result.completedCount).toBe(0);
      expect(result.recentBadges).toHaveLength(0);
    });

    // M3 — sin filtro de periodo, completedCount crecía cada semana con las
    // mismas cinco misiones y recentBadges podía repetir cinco veces la misma.
    it('solo cuenta el periodo vigente: permanentes y la semana en curso', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(WEEK_08);
      mockPrisma.user.findUnique.mockResolvedValue({
        totalPoints: 0,
        currentStreak: 0,
        longestStreak: 0,
        currentDailyStreak: 0,
        longestDailyStreak: 0,
      });
      mockPrisma.userChallenge.findMany.mockResolvedValue([]);

      await service.getSummary('user1');

      expect(mockPrisma.userChallenge.findMany).toHaveBeenCalledWith({
        where: { userId: 'user1', periodKey: { in: ['ALL', ISO_W08] } },
        include: { challenge: true },
        orderBy: { completedAt: 'desc' },
      });
      jest.useRealTimers();
    });

    it('limita los badges recientes a 5 aunque haya más completados', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        totalPoints: 1000,
        currentStreak: 10,
        longestStreak: 10,
      });
      // 7 retos completados
      const badges = Array.from({ length: 7 }, (_, i) => ({
        completed: true,
        completedAt: new Date(),
        challenge: { title: `Reto ${i}`, badgeIcon: '🏅', badgeColor: '#000' },
      }));
      mockPrisma.userChallenge.findMany.mockResolvedValue(badges);

      const result = await service.getSummary('user1');

      expect(result.recentBadges).toHaveLength(5); // slice(0, 5)
    });
  });

  // ─── getMyProgress ───────────────────────────────────────────────────────────

  describe('getMyProgress', () => {
    it('combina retos activos con el progreso actual del usuario', async () => {
      const challenge = {
        id: 'ch1',
        title: 'Completar 10 ejercicios',
        type: ChallengeType.THEORY_COMPLETED,
        cadence: ChallengeCadence.PERMANENT,
        target: 10,
        points: 100,
        isActive: true,
        createdAt: new Date(),
      };
      mockPrisma.challenge.findMany.mockResolvedValue([challenge]);
      mockPrisma.userChallenge.findMany.mockResolvedValue([
        {
          challengeId: 'ch1',
          periodKey: 'ALL',
          progress: 7,
          completed: false,
          completedAt: null,
          awardedPoints: 0,
        },
      ]);
      mockPrisma.user.findUnique.mockResolvedValue({
        totalPoints: 0,
        currentStreak: 0,
        longestStreak: 0,
        currentDailyStreak: 0,
        longestDailyStreak: 0,
      });

      const result = await service.getMyProgress('user1');

      expect(result.challenges).toHaveLength(1);
      expect(result.challenges[0].id).toBe('ch1');
      expect(result.challenges[0].progress).toBe(7);
      expect(result.challenges[0].completed).toBe(false);
      expect(result.meta.totalPoints).toBe(0);
    });

    it('devuelve progress=0 para retos sin UserChallenge previo', async () => {
      const challenge = {
        id: 'ch2',
        title: 'Quiz Perfecto',
        type: ChallengeType.EXAM_SCORE,
        cadence: ChallengeCadence.PERMANENT,
        target: 100,
        points: 50,
        isActive: true,
        createdAt: new Date(),
      };
      mockPrisma.challenge.findMany.mockResolvedValue([challenge]);
      mockPrisma.userChallenge.findMany.mockResolvedValue([]); // sin progreso
      mockPrisma.user.findUnique.mockResolvedValue({
        totalPoints: 200,
        currentStreak: 1,
        longestStreak: 3,
        currentDailyStreak: 0,
        longestDailyStreak: 0,
      });

      const result = await service.getMyProgress('user1');

      expect(result.challenges[0].progress).toBe(0);
      expect(result.challenges[0].completed).toBe(false);
      expect(result.challenges[0].awardedPoints).toBe(0);
    });

    it('incluye meta con totalPoints, rachas semanal y diaria del usuario', async () => {
      mockPrisma.challenge.findMany.mockResolvedValue([]);
      mockPrisma.userChallenge.findMany.mockResolvedValue([]);
      mockPrisma.user.findUnique.mockResolvedValue({
        totalPoints: 750,
        currentStreak: 5,
        longestStreak: 8,
        currentDailyStreak: 2,
        longestDailyStreak: 6,
      });

      const result = await service.getMyProgress('user1');

      expect(result.meta).toEqual({
        totalPoints: 750,
        currentStreak: 5,
        longestStreak: 8,
        currentDailyStreak: 2,
        longestDailyStreak: 6,
      });
    });

    it('devuelve meta con ceros si el usuario no existe', async () => {
      mockPrisma.challenge.findMany.mockResolvedValue([]);
      mockPrisma.userChallenge.findMany.mockResolvedValue([]);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.getMyProgress('nonexistent');

      expect(result.meta.totalPoints).toBe(0);
      expect(result.meta.currentStreak).toBe(0);
      expect(result.meta.currentDailyStreak).toBe(0);
      expect(result.meta.longestDailyStreak).toBe(0);
    });
  });

  describe('getMyProgress', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(WEEK_08);
    });
    afterEach(() => jest.useRealTimers());

    it('empareja cada reto con la fila de SU periodo', async () => {
      mockPrisma.challenge.findMany.mockResolvedValue([
        {
          id: 'perm',
          type: ChallengeType.TUTOR_QUESTIONS,
          cadence: ChallengeCadence.PERMANENT,
          target: 10,
        },
        {
          id: 'week',
          type: ChallengeType.EXERCISES_SOLVED,
          cadence: ChallengeCadence.WEEKLY,
          target: 20,
        },
      ]);
      mockPrisma.userChallenge.findMany.mockResolvedValue([
        {
          challengeId: 'perm',
          periodKey: 'ALL',
          progress: 6,
          completed: false,
          completedAt: null,
          awardedPoints: 0,
        },
        {
          challengeId: 'week',
          periodKey: ISO_W07,
          progress: 20,
          completed: true,
          completedAt: new Date(),
          awardedPoints: 15,
        },
        {
          challengeId: 'week',
          periodKey: ISO_W08,
          progress: 4,
          completed: false,
          completedAt: null,
          awardedPoints: 0,
        },
      ]);
      mockPrisma.user.findUnique.mockResolvedValue({
        totalPoints: 120,
        currentStreak: 2,
        longestStreak: 5,
        currentDailyStreak: 3,
        longestDailyStreak: 8,
      });

      const result = await service.getMyProgress('user1');

      expect(result.meta.currentDailyStreak).toBe(3);
      expect(result.meta.longestDailyStreak).toBe(8);
      // El reto semanal muestra la semana EN CURSO, no la anterior ya completada
      expect(result.challenges.find((c) => c.id === 'week')).toMatchObject({
        progress: 4,
        completed: false,
      });
      expect(result.challenges.find((c) => c.id === 'perm')).toMatchObject({ progress: 6 });
    });

    // Mismo escenario que el test anterior pero con el orden de filas invertido.
    // Un Map indexado solo por challengeId hace "gana el último insertado" con
    // clave duplicada: si la fila de la semana pasada llega DESPUÉS que la
    // actual, ese bug produciría por casualidad el resultado correcto (ver
    // test anterior, donde W08 es la última fila). Este test invierte el
    // orden para que el emparejamiento por periodo sea imprescindible.
    it('empareja el reto semanal aunque la fila de la semana actual llegue ANTES que la antigua', async () => {
      mockPrisma.challenge.findMany.mockResolvedValue([
        {
          id: 'week',
          type: ChallengeType.EXERCISES_SOLVED,
          cadence: ChallengeCadence.WEEKLY,
          target: 20,
        },
      ]);
      mockPrisma.userChallenge.findMany.mockResolvedValue([
        {
          challengeId: 'week',
          periodKey: ISO_W08,
          progress: 4,
          completed: false,
          completedAt: null,
          awardedPoints: 0,
        },
        {
          challengeId: 'week',
          periodKey: ISO_W07,
          progress: 20,
          completed: true,
          completedAt: new Date(),
          awardedPoints: 15,
        },
      ]);
      mockPrisma.user.findUnique.mockResolvedValue({
        totalPoints: 0,
        currentStreak: 0,
        longestStreak: 0,
        currentDailyStreak: 0,
        longestDailyStreak: 0,
      });

      const result = await service.getMyProgress('user1');

      expect(result.challenges.find((c) => c.id === 'week')).toMatchObject({
        progress: 4,
        completed: false,
      });
    });
  });

  // ─── calculateProgress vía checkAndAward ────────────────────────────────────

  describe('calculateProgress vía checkAndAward', () => {
    /** Monta un reto y devuelve el progreso que se escribió en el upsert */
    async function progressFor(challenge: {
      type: ChallengeType;
      cadence?: ChallengeCadence;
      target?: number;
    }): Promise<number> {
      mockPrisma.user.findUnique.mockResolvedValue({
        currentStreak: 1,
        longestStreak: 1,
        lastActiveWeek: ISO_W08,
        currentDailyStreak: 1,
        longestDailyStreak: 1,
        lastActiveDay: '2026-02-16',
        currentCorrectStreak: 7,
      });
      mockPrisma.challenge.findMany.mockResolvedValue([
        {
          id: 'c1',
          type: challenge.type,
          cadence: challenge.cadence ?? ChallengeCadence.PERMANENT,
          target: challenge.target ?? 999,
          points: 10,
        },
      ]);
      mockPrisma.userChallenge.findMany.mockResolvedValue([]);
      mockPrisma.userChallenge.upsert.mockResolvedValue({});

      await service.checkAndAward('user1', challenge.type);

      const call = mockPrisma.userChallenge.upsert.mock.calls[0][0] as {
        create: { progress: number };
      };
      return call.create.progress;
    }

    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(WEEK_08);
    });
    afterEach(() => jest.useRealTimers());

    it('STUDY_PLAN_CREATED cuenta los planes del alumno', async () => {
      mockPrisma.studyPlan.count.mockResolvedValue(4);

      expect(await progressFor({ type: ChallengeType.STUDY_PLAN_CREATED })).toBe(4);
      expect(mockPrisma.studyPlan.count).toHaveBeenCalledWith({ where: { userId: 'user1' } });
    });

    it('STUDY_PLAN_CREATED con cadencia WEEKLY filtra desde el lunes', async () => {
      mockPrisma.studyPlan.count.mockResolvedValue(1);

      await progressFor({
        type: ChallengeType.STUDY_PLAN_CREATED,
        cadence: ChallengeCadence.WEEKLY,
      });

      expect(mockPrisma.studyPlan.count).toHaveBeenCalledWith({
        where: { userId: 'user1', createdAt: { gte: new Date('2026-02-15T23:00:00.000Z') } },
      });
    });

    it('TOPICS_STUDIED cuenta los temas de los planes del alumno', async () => {
      mockPrisma.studyPlanTopic.count.mockResolvedValue(9);

      expect(await progressFor({ type: ChallengeType.TOPICS_STUDIED })).toBe(9);
      expect(mockPrisma.studyPlanTopic.count).toHaveBeenCalledWith({
        where: { plan: { userId: 'user1' } },
      });
    });

    it('SUBJECT_VARIETY cuenta cursos de contexto distintos', async () => {
      mockPrisma.studyPlanTopic.findMany.mockResolvedValue([
        { contextCourseId: 'mates' },
        { contextCourseId: 'lengua' },
      ]);

      expect(await progressFor({ type: ChallengeType.SUBJECT_VARIETY })).toBe(2);
      expect(mockPrisma.studyPlanTopic.findMany).toHaveBeenCalledWith({
        where: { plan: { userId: 'user1' } },
        select: { contextCourseId: true },
        distinct: ['contextCourseId'],
      });
    });

    it('EXERCISES_SOLVED cuenta solo los aciertos', async () => {
      mockPrisma.exerciseAttempt.count.mockResolvedValue(12);

      expect(await progressFor({ type: ChallengeType.EXERCISES_SOLVED })).toBe(12);
      expect(mockPrisma.exerciseAttempt.count).toHaveBeenCalledWith({
        where: { userId: 'user1', verdict: 'correct' },
      });
    });

    it('HARD_EXERCISES_SOLVED filtra ademas por dificultad HARD', async () => {
      mockPrisma.exerciseAttempt.count.mockResolvedValue(3);

      await progressFor({ type: ChallengeType.HARD_EXERCISES_SOLVED });

      expect(mockPrisma.exerciseAttempt.count).toHaveBeenCalledWith({
        where: { userId: 'user1', verdict: 'correct', difficulty: 'HARD' },
      });
    });

    it('EXERCISES_CORRECT_STREAK lee la racha denormalizada', async () => {
      expect(await progressFor({ type: ChallengeType.EXERCISES_CORRECT_STREAK })).toBe(7);
    });

    it('EXAM_PERFECT cuenta los examenes con 100', async () => {
      mockPrisma.examAttempt.count.mockResolvedValue(2);

      expect(await progressFor({ type: ChallengeType.EXAM_PERFECT })).toBe(2);
      expect(mockPrisma.examAttempt.count).toHaveBeenCalledWith({
        where: { userId: 'user1', score: 100, submittedAt: { not: null } },
      });
    });

    it('EXAM_HARD_SCORE toma el maximo de los examenes de nivel HARD', async () => {
      mockPrisma.examAttempt.aggregate.mockResolvedValue({ _max: { score: 87.4 } });

      expect(await progressFor({ type: ChallengeType.EXAM_HARD_SCORE })).toBe(87);
      expect(mockPrisma.examAttempt.aggregate).toHaveBeenCalledWith({
        where: { userId: 'user1', submittedAt: { not: null }, aiExamBank: { level: 'HARD' } },
        _max: { score: true },
      });
    });

    it('TUTOR_QUESTIONS cuenta solo los mensajes del alumno', async () => {
      mockPrisma.tutorMessage.count.mockResolvedValue(15);

      expect(await progressFor({ type: ChallengeType.TUTOR_QUESTIONS })).toBe(15);
      expect(mockPrisma.tutorMessage.count).toHaveBeenCalledWith({
        where: { userId: 'user1', role: 'user' },
      });
    });

    it('STREAK_DAILY lee la racha diaria actual', async () => {
      expect(await progressFor({ type: ChallengeType.STREAK_DAILY })).toBe(1);
    });

    it('EXAM_COMPLETED cuenta los exámenes entregados', async () => {
      mockPrisma.examAttempt.count.mockResolvedValue(6);

      expect(await progressFor({ type: ChallengeType.EXAM_COMPLETED })).toBe(6);
      expect(mockPrisma.examAttempt.count).toHaveBeenCalledWith({
        where: { userId: 'user1', submittedAt: { not: null } },
      });
    });

    it('THEORY_COMPLETED cuenta los decks de teoría del alumno', async () => {
      mockPrisma.theoryModule.count.mockResolvedValue(11);

      expect(await progressFor({ type: ChallengeType.THEORY_COMPLETED })).toBe(11);
      expect(mockPrisma.theoryModule.count).toHaveBeenCalledWith({
        where: { userId: 'user1' },
      });
    });

    // ── Ventana semanal: el filtro `since` por tipo ──────────────────────────
    // El lunes 00:00 de Madrid de la W08 son las 23:00 UTC del domingo 15
    // (CET). Cada tipo contable debe filtrar por SU campo de fecha.
    describe('ventana semanal (cadencia WEEKLY)', () => {
      const MONDAY = new Date('2026-02-15T23:00:00.000Z');
      const weekly = { cadence: ChallengeCadence.WEEKLY };

      it('TOPICS_STUDIED filtra por la fecha del PLAN, no del tema (el tema no tiene timestamp)', async () => {
        mockPrisma.studyPlanTopic.count.mockResolvedValue(2);

        await progressFor({ type: ChallengeType.TOPICS_STUDIED, ...weekly });

        expect(mockPrisma.studyPlanTopic.count).toHaveBeenCalledWith({
          where: { plan: { userId: 'user1', createdAt: { gte: MONDAY } } },
        });
      });

      // Único tipo que SUSTITUYE `{ not: null }` por `{ gte }` en vez de
      // añadir una condición: si se rompiera, contaría también los exámenes
      // sin entregar de esta semana.
      it('EXAM_COMPLETED sustituye submittedAt: { not: null } por { gte: lunes }', async () => {
        mockPrisma.examAttempt.count.mockResolvedValue(1);

        await progressFor({ type: ChallengeType.EXAM_COMPLETED, ...weekly });

        expect(mockPrisma.examAttempt.count).toHaveBeenCalledWith({
          where: { userId: 'user1', submittedAt: { gte: MONDAY } },
        });
      });

      it('THEORY_COMPLETED filtra por createdAt del deck', async () => {
        mockPrisma.theoryModule.count.mockResolvedValue(1);

        await progressFor({ type: ChallengeType.THEORY_COMPLETED, ...weekly });

        expect(mockPrisma.theoryModule.count).toHaveBeenCalledWith({
          where: { userId: 'user1', createdAt: { gte: MONDAY } },
        });
      });

      it('EXAM_PERFECT mantiene score 100 y acota submittedAt al lunes', async () => {
        mockPrisma.examAttempt.count.mockResolvedValue(1);

        await progressFor({ type: ChallengeType.EXAM_PERFECT, ...weekly });

        expect(mockPrisma.examAttempt.count).toHaveBeenCalledWith({
          where: { userId: 'user1', score: 100, submittedAt: { gte: MONDAY } },
        });
      });

      it('TUTOR_QUESTIONS mantiene role user y acota createdAt al lunes', async () => {
        mockPrisma.tutorMessage.count.mockResolvedValue(4);

        await progressFor({ type: ChallengeType.TUTOR_QUESTIONS, ...weekly });

        expect(mockPrisma.tutorMessage.count).toHaveBeenCalledWith({
          where: { userId: 'user1', role: 'user', createdAt: { gte: MONDAY } },
        });
      });

      it('HARD_EXERCISES_SOLVED mantiene la dificultad y acota answeredAt al lunes', async () => {
        mockPrisma.exerciseAttempt.count.mockResolvedValue(1);

        await progressFor({ type: ChallengeType.HARD_EXERCISES_SOLVED, ...weekly });

        expect(mockPrisma.exerciseAttempt.count).toHaveBeenCalledWith({
          where: {
            userId: 'user1',
            verdict: 'correct',
            difficulty: 'HARD',
            answeredAt: { gte: MONDAY },
          },
        });
      });
    });
  });
});
