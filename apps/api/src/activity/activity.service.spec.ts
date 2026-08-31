import { Test, TestingModule } from '@nestjs/testing';
import { ActivityService } from './activity.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ActivityService', () => {
  let service: ActivityService;
  let mockPrisma: {
    userActivityDay: { upsert: jest.Mock };
    academyMember: { findFirst: jest.Mock };
  };

  beforeEach(async () => {
    mockPrisma = {
      userActivityDay: { upsert: jest.fn() },
      academyMember: { findFirst: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ActivityService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get(ActivityService);
    jest.clearAllMocks();
    mockPrisma.academyMember.findFirst.mockResolvedValue({ academyId: 'academy1' });
  });

  describe('recordVisit', () => {
    it('crea la fila del día como visita, sin trabajo', async () => {
      await service.recordVisit('user1');

      const args = mockPrisma.userActivityDay.upsert.mock.calls[0][0];
      expect(args.create).toMatchObject({ userId: 'user1', worked: false });
    });

    it('no pisa el trabajo ya registrado ese día', async () => {
      await service.recordVisit('user1');

      // Un update vacío: si el alumno ya trabajó hoy, la visita posterior no
      // puede devolver worked a false.
      const args = mockPrisma.userActivityDay.upsert.mock.calls[0][0];
      expect(args.update).toEqual({});
    });

    it('usa el día de Madrid como clave, no la fecha UTC', async () => {
      // 00:30 del 1 de septiembre en Madrid son las 22:30 del 31 de agosto UTC:
      // esa sesión pertenece al día de Madrid, o el histórico se parte solo.
      jest.useFakeTimers().setSystemTime(new Date('2026-08-31T22:30:00.000Z'));

      await service.recordVisit('user1');

      const args = mockPrisma.userActivityDay.upsert.mock.calls[0][0];
      expect(args.where.userId_day.day).toBe('2026-09-01');
      jest.useRealTimers();
    });

    it('guarda la academia del alumno', async () => {
      await service.recordVisit('user1');

      const args = mockPrisma.userActivityDay.upsert.mock.calls[0][0];
      expect(args.create.academyId).toBe('academy1');
    });

    it('deja la academia a null si el alumno no es miembro de ninguna', async () => {
      mockPrisma.academyMember.findFirst.mockResolvedValue(null);

      await service.recordVisit('user1');

      const args = mockPrisma.userActivityDay.upsert.mock.calls[0][0];
      expect(args.create.academyId).toBeNull();
    });

    it('no propaga el error si la escritura falla', async () => {
      mockPrisma.userActivityDay.upsert.mockRejectedValue(new Error('BD caída'));

      // Medir no puede tumbar la petición de un alumno.
      await expect(service.recordVisit('user1')).resolves.toBeUndefined();
    });
  });

  describe('recordWork', () => {
    it('marca el día como trabajado, lo hubiera visitado antes o no', async () => {
      await service.recordWork('user1');

      const args = mockPrisma.userActivityDay.upsert.mock.calls[0][0];
      expect(args.create).toMatchObject({ userId: 'user1', worked: true });
      expect(args.update).toEqual({ worked: true });
    });

    it('no propaga el error si la escritura falla', async () => {
      mockPrisma.userActivityDay.upsert.mockRejectedValue(new Error('BD caída'));

      await expect(service.recordWork('user1')).resolves.toBeUndefined();
    });
  });
});
