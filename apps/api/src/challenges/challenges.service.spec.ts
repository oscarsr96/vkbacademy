import { Test, TestingModule } from '@nestjs/testing';
import { ChallengeType } from '@prisma/client';
import { ChallengesService } from './challenges.service';
import { PrismaService } from '../prisma/prisma.service';

// Fechas fijas con ISO weeks conocidas:
//   2026-02-16 (lunes) → semana ISO "2026-W08"
//   2026-02-09 (lunes) → semana ISO "2026-W07"
const WEEK_08 = new Date('2026-02-16T12:00:00Z'); // lunes de la W08
const ISO_W08 = '2026-W08';
const ISO_W07 = '2026-W07';

describe('ChallengesService', () => {
  let service: ChallengesService;
  let mockPrisma: {
    user: { findUnique: jest.Mock; update: jest.Mock };
    challenge: { findMany: jest.Mock };
    userChallenge: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
      findMany: jest.Mock;
    };
    userProgress: { count: jest.Mock };
    module: { findMany: jest.Mock };
    course: { findMany: jest.Mock };
    quizAttempt: { aggregate: jest.Mock };
    booking: { count: jest.Mock; findMany: jest.Mock };
    redemption: { create: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    mockPrisma = {
      user: { findUnique: jest.fn(), update: jest.fn() },
      challenge: { findMany: jest.fn() },
      userChallenge: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        findMany: jest.fn(),
      },
      userProgress: { count: jest.fn() },
      module: { findMany: jest.fn() },
      course: { findMany: jest.fn() },
      quizAttempt: { aggregate: jest.fn() },
      booking: { count: jest.fn(), findMany: jest.fn() },
      redemption: { create: jest.fn() },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChallengesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
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
      });

      await service.updateStreak('user1');

      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('incrementa la racha si la semana anterior fue la última activa', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        currentStreak: 3,
        longestStreak: 5,
        lastActiveWeek: ISO_W07, // semana consecutiva anterior a W08
      });
      mockPrisma.user.update.mockResolvedValue({});

      await service.updateStreak('user1');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user1' },
        data: {
          lastActiveWeek: ISO_W08,
          currentStreak: 4, // 3 + 1
          longestStreak: 5, // max(5, 4) = 5 (no bate récord)
        },
      });
    });

    it('reinicia la racha a 1 si se saltó una semana', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        currentStreak: 5,
        longestStreak: 10,
        lastActiveWeek: '2026-W05', // saltó W06 y W07
      });
      mockPrisma.user.update.mockResolvedValue({});

      await service.updateStreak('user1');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user1' },
        data: {
          lastActiveWeek: ISO_W08,
          currentStreak: 1, // racha rota
          longestStreak: 10, // max(10, 1) no cambia
        },
      });
    });

    it('inicia la racha en 1 si es la primera actividad (lastActiveWeek null)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        currentStreak: 0,
        longestStreak: 0,
        lastActiveWeek: null,
      });
      mockPrisma.user.update.mockResolvedValue({});

      await service.updateStreak('user1');

      const updateCall = mockPrisma.user.update.mock.calls[0][0];
      expect(updateCall.data.currentStreak).toBe(1);
      expect(updateCall.data.longestStreak).toBe(1); // max(0, 1)
    });

    it('actualiza longestStreak cuando la nueva racha bate el récord', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        currentStreak: 4, // la racha actual coincide con el récord
        longestStreak: 4,
        lastActiveWeek: ISO_W07,
      });
      mockPrisma.user.update.mockResolvedValue({});

      await service.updateStreak('user1');

      const updateCall = mockPrisma.user.update.mock.calls[0][0];
      expect(updateCall.data.currentStreak).toBe(5); // 4 + 1
      expect(updateCall.data.longestStreak).toBe(5); // nuevo récord
    });
  });

  // ─── redeemItem ──────────────────────────────────────────────────────────────

  describe('redeemItem', () => {
    it('lanza error si el usuario no existe', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.redeemItem('user1', 'Camiseta', 500),
      ).rejects.toThrow('Usuario no encontrado');
    });

    it('lanza error si el usuario no tiene puntos suficientes', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ totalPoints: 50 });

      await expect(
        service.redeemItem('user1', 'Camiseta', 500),
      ).rejects.toThrow(/insuficientes/);
    });

    it('ejecuta la transacción atómica y devuelve el resultado del canje', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ totalPoints: 1000 });
      mockPrisma.$transaction.mockResolvedValue([
        { totalPoints: 800 }, // resultado de user.update
        {},                    // resultado de redemption.create
      ]);

      const result = await service.redeemItem('user1', 'Balón firmado', 200);

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(result.remainingPoints).toBe(800);
      expect(result.pointsSpent).toBe(200);
      expect(result.message).toContain('Balón firmado');
    });

    it('la transacción incluye user.update (decrement) y redemption.create', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ totalPoints: 500 });
      mockPrisma.$transaction.mockImplementation(
        (operations: unknown[]) => Promise.resolve(operations.map(() => ({}))),
      );

      await service.redeemItem('user1', 'Gorra', 350);

      // La transacción recibe un array de operaciones Prisma
      const transactionArg = mockPrisma.$transaction.mock.calls[0][0] as unknown[];
      expect(transactionArg).toHaveLength(2);
    });

    it('el error de puntos incluye el mensaje con los puntos actuales y necesarios', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ totalPoints: 100 });

      await expect(
        service.redeemItem('user1', 'Botella', 200),
      ).rejects.toThrow(/100/);
    });
  });

  // ─── checkAndAward ───────────────────────────────────────────────────────────

  describe('checkAndAward', () => {
    // updateStreak requiere user.findUnique; configurar respuesta neutral
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(WEEK_08);
      // Usuario ya activo esta semana → updateStreak no hace nada
      mockPrisma.user.findUnique.mockResolvedValue({
        currentStreak: 2,
        longestStreak: 3,
        lastActiveWeek: ISO_W08,
      });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('no lanza excepción si Prisma falla — captura el error internamente', async () => {
      mockPrisma.challenge.findMany.mockRejectedValue(new Error('DB error'));

      await expect(
        service.checkAndAward('user1', ChallengeType.LESSON_COMPLETED),
      ).resolves.toBeUndefined();
    });

    it('consulta solo los retos activos de los tipos de evento recibidos', async () => {
      mockPrisma.challenge.findMany.mockResolvedValue([]);

      await service.checkAndAward(
        'user1',
        ChallengeType.LESSON_COMPLETED,
        ChallengeType.MODULE_COMPLETED,
      );

      expect(mockPrisma.challenge.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          type: { in: [ChallengeType.LESSON_COMPLETED, ChallengeType.MODULE_COMPLETED] },
        },
      });
    });

    it('crea un nuevo UserChallenge cuando el usuario completa el reto por primera vez', async () => {
      const challenge = {
        id: 'ch1',
        type: ChallengeType.LESSON_COMPLETED,
        target: 5,
        points: 100,
      };
      mockPrisma.challenge.findMany.mockResolvedValue([challenge]);
      mockPrisma.userProgress.count.mockResolvedValue(5); // exactamente el target
      mockPrisma.userChallenge.findUnique.mockResolvedValue(null); // no existía
      mockPrisma.userChallenge.upsert.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});

      await service.checkAndAward('user1', ChallengeType.LESSON_COMPLETED);

      expect(mockPrisma.userChallenge.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            completed: true,
            awardedPoints: 100,
          }),
        }),
      );
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { totalPoints: { increment: 100 } },
        }),
      );
    });

    it('actualiza el progreso sin completar si no llega al target', async () => {
      const challenge = {
        id: 'ch1',
        type: ChallengeType.LESSON_COMPLETED,
        target: 10,
        points: 200,
      };
      mockPrisma.challenge.findMany.mockResolvedValue([challenge]);
      mockPrisma.userProgress.count.mockResolvedValue(3); // por debajo del target
      mockPrisma.userChallenge.findUnique.mockResolvedValue(null);
      mockPrisma.userChallenge.upsert.mockResolvedValue({});

      await service.checkAndAward('user1', ChallengeType.LESSON_COMPLETED);

      expect(mockPrisma.userChallenge.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ completed: false, awardedPoints: 0 }),
        }),
      );
      // No se incrementan puntos porque no se completó
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('omite el reto si ya estaba completado — no duplica los puntos', async () => {
      const challenge = {
        id: 'ch1',
        type: ChallengeType.LESSON_COMPLETED,
        target: 5,
        points: 100,
      };
      mockPrisma.challenge.findMany.mockResolvedValue([challenge]);
      mockPrisma.userProgress.count.mockResolvedValue(10); // supera target
      mockPrisma.userChallenge.findUnique.mockResolvedValue({ completed: true }); // ya completado

      await service.checkAndAward('user1', ChallengeType.LESSON_COMPLETED);

      // Al estar ya completado, no debe upsertarse ni incrementar puntos
      expect(mockPrisma.userChallenge.upsert).not.toHaveBeenCalled();
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('no incrementa puntos si el reto existía pero no estaba completado y aún no llega al target', async () => {
      const challenge = {
        id: 'ch1',
        type: ChallengeType.LESSON_COMPLETED,
        target: 20,
        points: 500,
      };
      mockPrisma.challenge.findMany.mockResolvedValue([challenge]);
      mockPrisma.userProgress.count.mockResolvedValue(8);
      mockPrisma.userChallenge.findUnique.mockResolvedValue({
        completed: false,
        progress: 5,
      });
      mockPrisma.userChallenge.upsert.mockResolvedValue({});

      await service.checkAndAward('user1', ChallengeType.LESSON_COMPLETED);

      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('no hace nada si no hay retos activos para los tipos de evento', async () => {
      mockPrisma.challenge.findMany.mockResolvedValue([]); // sin retos

      await service.checkAndAward('user1', ChallengeType.QUIZ_SCORE);

      expect(mockPrisma.userChallenge.upsert).not.toHaveBeenCalled();
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
      expect(result.completedCount).toBe(0);
      expect(result.recentBadges).toHaveLength(0);
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
        title: 'Completar 10 lecciones',
        type: ChallengeType.LESSON_COMPLETED,
        target: 10,
        points: 100,
        isActive: true,
        createdAt: new Date(),
      };
      mockPrisma.challenge.findMany.mockResolvedValue([challenge]);
      mockPrisma.userChallenge.findMany.mockResolvedValue([
        { challengeId: 'ch1', progress: 7, completed: false, completedAt: null, awardedPoints: 0 },
      ]);
      mockPrisma.user.findUnique.mockResolvedValue({
        totalPoints: 0,
        currentStreak: 0,
        longestStreak: 0,
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
        type: ChallengeType.QUIZ_SCORE,
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
      });

      const result = await service.getMyProgress('user1');

      expect(result.challenges[0].progress).toBe(0);
      expect(result.challenges[0].completed).toBe(false);
      expect(result.challenges[0].awardedPoints).toBe(0);
    });

    it('incluye meta con totalPoints, currentStreak y longestStreak del usuario', async () => {
      mockPrisma.challenge.findMany.mockResolvedValue([]);
      mockPrisma.userChallenge.findMany.mockResolvedValue([]);
      mockPrisma.user.findUnique.mockResolvedValue({
        totalPoints: 750,
        currentStreak: 5,
        longestStreak: 8,
      });

      const result = await service.getMyProgress('user1');

      expect(result.meta).toEqual({
        totalPoints: 750,
        currentStreak: 5,
        longestStreak: 8,
      });
    });

    it('devuelve meta con ceros si el usuario no existe', async () => {
      mockPrisma.challenge.findMany.mockResolvedValue([]);
      mockPrisma.userChallenge.findMany.mockResolvedValue([]);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.getMyProgress('nonexistent');

      expect(result.meta.totalPoints).toBe(0);
      expect(result.meta.currentStreak).toBe(0);
    });
  });
});
