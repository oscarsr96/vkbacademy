import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { PrismaService } from '../prisma/prisma.service';

// ─── Mock manual de PrismaService ────────────────────────────────────────────

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
  },
  teacherProfile: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  availabilitySlot: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  booking: {
    findMany: jest.fn(),
  },
};

// ─── Suite principal ──────────────────────────────────────────────────────────

describe('AvailabilityService', () => {
  let service: AvailabilityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AvailabilityService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<AvailabilityService>(AvailabilityService);

    // Limpia todas las implementaciones/llamadas entre tests
    jest.clearAllMocks();
  });

  // ─── findAllTeachers ───────────────────────────────────────────────────────

  describe('findAllTeachers', () => {
    it('devuelve todos los perfiles de profesor con usuario y disponibilidad', async () => {
      const expected = [
        {
          id: 'prof-1',
          user: { id: 'user-1', name: 'Ana García', avatarUrl: null },
          availability: [],
        },
      ];
      mockPrisma.teacherProfile.findMany.mockResolvedValue(expected);

      const result = await service.findAllTeachers();

      expect(mockPrisma.teacherProfile.findMany).toHaveBeenCalledWith({
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
          availability: true,
        },
      });
      expect(result).toEqual(expected);
    });
  });

  // ─── getFreeSlots ──────────────────────────────────────────────────────────

  describe('getFreeSlots', () => {
    // Fija el reloj en 2026-06-01 08:00 UTC para que los slots del 2026-06-02
    // a las 10:00 sean inequívocamente futuros.
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-06-01T08:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('devuelve array vacío cuando el profesor no tiene disponibilidad configurada', async () => {
      mockPrisma.availabilitySlot.findMany.mockResolvedValue([]);
      mockPrisma.booking.findMany.mockResolvedValue([]);

      const from = new Date('2026-06-02T00:00:00Z');
      const to = new Date('2026-06-02T23:59:59Z');

      const result = await service.getFreeSlots('prof-1', from, to);

      expect(result).toEqual([]);
    });

    it('omite slots cuyo startAt ya ha pasado respecto a la hora actual', async () => {
      // dayOfWeek para 2026-06-01 (lunes) = 1
      // Slot a las 07:00–08:00 → ya pasó (sistema ficticio = 08:00)
      mockPrisma.availabilitySlot.findMany.mockResolvedValue([
        { dayOfWeek: 1, startTime: '07:00', endTime: '08:00' },
      ]);
      mockPrisma.booking.findMany.mockResolvedValue([]);

      // Rango: solo el 2026-06-01
      const from = new Date('2026-06-01T00:00:00Z');
      const to = new Date('2026-06-01T23:59:59Z');

      const result = await service.getFreeSlots('prof-1', from, to);

      expect(result).toEqual([]);
    });

    it('omite slots que solapan con reservas existentes', async () => {
      // 2026-06-02 es martes → dayOfWeek = 2
      mockPrisma.availabilitySlot.findMany.mockResolvedValue([
        { dayOfWeek: 2, startTime: '10:00', endTime: '11:00' },
      ]);
      // Reserva que cubre exactamente ese slot
      mockPrisma.booking.findMany.mockResolvedValue([
        {
          startAt: new Date('2026-06-02T10:00:00'),
          endAt: new Date('2026-06-02T11:00:00'),
        },
      ]);

      const from = new Date('2026-06-02T00:00:00');
      const to = new Date('2026-06-02T23:59:59');

      const result = await service.getFreeSlots('prof-1', from, to);

      expect(result).toEqual([]);
    });

    it('incluye slots libres futuros sin conflictos', async () => {
      // 2026-06-02 es martes → dayOfWeek = 2
      mockPrisma.availabilitySlot.findMany.mockResolvedValue([
        { dayOfWeek: 2, startTime: '10:00', endTime: '11:00' },
      ]);
      mockPrisma.booking.findMany.mockResolvedValue([]);

      const from = new Date('2026-06-02T00:00:00');
      const to = new Date('2026-06-02T23:59:59');

      const result = await service.getFreeSlots('prof-1', from, to);

      expect(result).toHaveLength(1);
      expect(result[0].teacherId).toBe('prof-1');
      expect(result[0].startAt.getHours()).toBe(10);
      expect(result[0].endAt.getHours()).toBe(11);
    });

    it('itera múltiples días y acumula todos los slots libres', async () => {
      // 2026-06-02 = martes (2), 2026-06-03 = miércoles (3)
      mockPrisma.availabilitySlot.findMany.mockResolvedValue([
        { dayOfWeek: 2, startTime: '10:00', endTime: '11:00' },
        { dayOfWeek: 3, startTime: '15:00', endTime: '16:00' },
      ]);
      mockPrisma.booking.findMany.mockResolvedValue([]);

      const from = new Date('2026-06-02T00:00:00');
      const to = new Date('2026-06-03T23:59:59');

      const result = await service.getFreeSlots('prof-1', from, to);

      expect(result).toHaveLength(2);
      expect(result[0].startAt.getHours()).toBe(10);
      expect(result[1].startAt.getHours()).toBe(15);
    });
  });

  // ─── getMySlots ────────────────────────────────────────────────────────────

  describe('getMySlots', () => {
    it('devuelve array vacío cuando el usuario no tiene perfil de profesor', async () => {
      mockPrisma.teacherProfile.findUnique.mockResolvedValue(null);

      const result = await service.getMySlots('user-sin-perfil');

      expect(result).toEqual([]);
      expect(mockPrisma.availabilitySlot.findMany).not.toHaveBeenCalled();
    });

    it('devuelve los slots del profesor ordenados por día y hora', async () => {
      const profile = { id: 'prof-1', userId: 'user-1' };
      const slots = [
        { id: 'slot-1', dayOfWeek: 1, startTime: '09:00', endTime: '10:00' },
        { id: 'slot-2', dayOfWeek: 2, startTime: '10:00', endTime: '11:00' },
      ];
      mockPrisma.teacherProfile.findUnique.mockResolvedValue(profile);
      mockPrisma.availabilitySlot.findMany.mockResolvedValue(slots);

      const result = await service.getMySlots('user-1');

      expect(mockPrisma.availabilitySlot.findMany).toHaveBeenCalledWith({
        where: { teacherId: 'prof-1' },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      });
      expect(result).toEqual(slots);
    });
  });

  // ─── addSlot ───────────────────────────────────────────────────────────────

  describe('addSlot', () => {
    const dto = { dayOfWeek: 1, startTime: '10:00', endTime: '11:00' };

    it('lanza NotFoundException cuando el usuario no es profesor', async () => {
      mockPrisma.teacherProfile.findUnique.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-x', role: 'STUDENT' });

      await expect(service.addSlot('user-x', dto)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.teacherProfile.create).not.toHaveBeenCalled();
      expect(mockPrisma.availabilitySlot.create).not.toHaveBeenCalled();
    });

    it('auto-crea TeacherProfile cuando el usuario es TEACHER pero no tiene perfil (self-heal)', async () => {
      const created = { id: 'slot-nuevo', teacherId: 'prof-nuevo', ...dto };
      mockPrisma.teacherProfile.findUnique.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', role: 'TEACHER' });
      mockPrisma.teacherProfile.create.mockResolvedValue({ id: 'prof-nuevo', userId: 'user-1' });
      mockPrisma.availabilitySlot.findFirst.mockResolvedValue(null);
      mockPrisma.availabilitySlot.create.mockResolvedValue(created);

      const result = await service.addSlot('user-1', dto);

      expect(mockPrisma.teacherProfile.create).toHaveBeenCalledWith({
        data: { userId: 'user-1' },
      });
      expect(mockPrisma.availabilitySlot.create).toHaveBeenCalledWith({
        data: { teacherId: 'prof-nuevo', ...dto },
      });
      expect(result).toEqual(created);
    });

    it('lanza ConflictException cuando ya existe un slot en ese día y hora', async () => {
      const profile = { id: 'prof-1', userId: 'user-1' };
      mockPrisma.teacherProfile.findUnique.mockResolvedValue(profile);
      mockPrisma.availabilitySlot.findFirst.mockResolvedValue({ id: 'slot-existente' });

      await expect(service.addSlot('user-1', dto)).rejects.toThrow(ConflictException);
      expect(mockPrisma.availabilitySlot.create).not.toHaveBeenCalled();
    });

    it('crea y devuelve el slot cuando no existe conflicto', async () => {
      const profile = { id: 'prof-1', userId: 'user-1' };
      const created = { id: 'slot-nuevo', teacherId: 'prof-1', ...dto };
      mockPrisma.teacherProfile.findUnique.mockResolvedValue(profile);
      mockPrisma.availabilitySlot.findFirst.mockResolvedValue(null);
      mockPrisma.availabilitySlot.create.mockResolvedValue(created);

      const result = await service.addSlot('user-1', dto);

      expect(mockPrisma.availabilitySlot.create).toHaveBeenCalledWith({
        data: { teacherId: 'prof-1', ...dto },
      });
      expect(result).toEqual(created);
    });
  });

  // ─── removeSlot ───────────────────────────────────────────────────────────

  describe('removeSlot', () => {
    it('lanza NotFoundException cuando el slot no existe', async () => {
      mockPrisma.availabilitySlot.findUnique.mockResolvedValue(null);

      await expect(service.removeSlot('slot-inexistente', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.availabilitySlot.delete).not.toHaveBeenCalled();
    });

    it('lanza ForbiddenException cuando el slot pertenece a otro profesor', async () => {
      mockPrisma.availabilitySlot.findUnique.mockResolvedValue({
        id: 'slot-1',
        teacher: { userId: 'otro-user' },
      });

      await expect(service.removeSlot('slot-1', 'user-1')).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.availabilitySlot.delete).not.toHaveBeenCalled();
    });

    it('elimina y devuelve el slot cuando el usuario es el propietario', async () => {
      const slot = { id: 'slot-1', teacher: { userId: 'user-1' } };
      mockPrisma.availabilitySlot.findUnique.mockResolvedValue(slot);
      mockPrisma.availabilitySlot.delete.mockResolvedValue(slot);

      const result = await service.removeSlot('slot-1', 'user-1');

      expect(mockPrisma.availabilitySlot.delete).toHaveBeenCalledWith({
        where: { id: 'slot-1' },
      });
      expect(result).toEqual(slot);
    });
  });
});
