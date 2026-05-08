import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role, BookingMode, BookingStatus } from '@prisma/client';
import { BookingsService } from './bookings.service';
import { PrismaService } from '../prisma/prisma.service';
import { DailyService } from '../daily/daily.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('BookingsService', () => {
  let service: BookingsService;

  const mockPrisma = {
    booking: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    teacherProfile: {
      findUnique: jest.fn(),
    },
    course: {
      findUnique: jest.fn(),
    },
  };

  const mockDaily = {
    createRoom: jest.fn(),
    deleteRoom: jest.fn(),
  };

  const mockNotifications = {
    sendBookingCreated: jest.fn().mockResolvedValue(undefined),
    sendBookingConfirmed: jest.fn().mockResolvedValue(undefined),
    sendBookingCancelled: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: DailyService, useValue: mockDaily },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
    jest.clearAllMocks();
    mockNotifications.sendBookingCreated.mockResolvedValue(undefined);
    mockNotifications.sendBookingConfirmed.mockResolvedValue(undefined);
    mockNotifications.sendBookingCancelled.mockResolvedValue(undefined);
  });

  // ─── getMyBookings ────────────────────────────────────────────────────────────

  describe('getMyBookings', () => {
    it('STUDENT: filtra las reservas por studentId', async () => {
      const expectedBookings = [{ id: 'b1', studentId: 'user1' }];
      mockPrisma.booking.findMany.mockResolvedValue(expectedBookings);

      const result = await service.getMyBookings('user1', Role.STUDENT);

      expect(mockPrisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { studentId: 'user1' },
        }),
      );
      expect(result).toBe(expectedBookings);
    });

    it('TUTOR: obtiene los studentIds de sus alumnos y filtra por ellos', async () => {
      mockPrisma.user.findMany.mockResolvedValue([{ id: 's1' }, { id: 's2' }]);
      const expectedBookings = [{ id: 'b1' }, { id: 'b2' }];
      mockPrisma.booking.findMany.mockResolvedValue(expectedBookings);

      const result = await service.getMyBookings('tutor1', Role.TUTOR);

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: { tutorId: 'tutor1' },
        select: { id: true },
      });
      expect(mockPrisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { studentId: { in: ['s1', 's2'] } },
        }),
      );
      expect(result).toBe(expectedBookings);
    });

    it('TEACHER: busca su perfil y filtra las reservas por teacherId', async () => {
      mockPrisma.teacherProfile.findUnique.mockResolvedValue({ id: 'tp1', userId: 'teacher1' });
      const expectedBookings = [{ id: 'b1', teacherId: 'tp1' }];
      mockPrisma.booking.findMany.mockResolvedValue(expectedBookings);

      const result = await service.getMyBookings('teacher1', Role.TEACHER);

      expect(mockPrisma.teacherProfile.findUnique).toHaveBeenCalledWith({
        where: { userId: 'teacher1' },
      });
      expect(mockPrisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { teacherId: 'tp1' },
        }),
      );
      expect(result).toBe(expectedBookings);
    });

    it('TEACHER sin perfil: devuelve array vacío', async () => {
      mockPrisma.teacherProfile.findUnique.mockResolvedValue(null);

      const result = await service.getMyBookings('teacher1', Role.TEACHER);

      expect(result).toEqual([]);
      expect(mockPrisma.booking.findMany).not.toHaveBeenCalled();
    });

    it('ADMIN: devuelve todas las reservas sin filtro de usuario', async () => {
      const expectedBookings = [{ id: 'b1' }, { id: 'b2' }, { id: 'b3' }];
      mockPrisma.booking.findMany.mockResolvedValue(expectedBookings);

      const result = await service.getMyBookings('admin1', Role.ADMIN);

      expect(mockPrisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        }),
      );
      expect(result).toBe(expectedBookings);
    });
  });

  // ─── create ───────────────────────────────────────────────────────────────────

  describe('create', () => {
    // Fijar la fecha actual en 2026-01-15 para controlar "el pasado"
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-01-15T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    const validDto = {
      studentId: 'student1',
      teacherId: 'tp1',
      startAt: '2026-01-20T10:00:00Z',
      endAt: '2026-01-20T11:00:00Z',
      mode: BookingMode.IN_PERSON,
    };

    it('TUTOR: lanza ForbiddenException si el alumno no le pertenece', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ tutorId: 'otherTutor' });

      await expect(service.create(validDto, 'tutor1', Role.TUTOR)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('lanza NotFoundException si el profesor no existe', async () => {
      mockPrisma.teacherProfile.findUnique.mockResolvedValue(null);

      await expect(service.create(validDto, 'admin1', Role.ADMIN)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lanza NotFoundException si el courseId indicado no existe', async () => {
      mockPrisma.teacherProfile.findUnique.mockResolvedValue({
        id: 'tp1',
        user: { name: 'Profesor', email: 'profesor@test.com' },
      });
      mockPrisma.course.findUnique.mockResolvedValue(null);

      const dto = { ...validDto, courseId: 'nonexistent-course' };

      await expect(service.create(dto, 'admin1', Role.ADMIN)).rejects.toThrow(NotFoundException);
    });

    it('lanza BadRequestException si startAt >= endAt', async () => {
      mockPrisma.teacherProfile.findUnique.mockResolvedValue({
        id: 'tp1',
        user: { name: 'Profesor', email: 'profesor@test.com' },
      });

      const dto = {
        ...validDto,
        startAt: '2026-01-20T11:00:00Z',
        endAt: '2026-01-20T10:00:00Z',
      };

      await expect(service.create(dto, 'admin1', Role.ADMIN)).rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException si startAt es en el pasado', async () => {
      mockPrisma.teacherProfile.findUnique.mockResolvedValue({
        id: 'tp1',
        user: { name: 'Profesor', email: 'profesor@test.com' },
      });

      const dto = {
        ...validDto,
        startAt: '2026-01-10T10:00:00Z', // antes de 2026-01-15 (fecha fijada)
        endAt: '2026-01-10T11:00:00Z',
      };

      await expect(service.create(dto, 'admin1', Role.ADMIN)).rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException si hay conflicto de horario con otra reserva', async () => {
      mockPrisma.teacherProfile.findUnique.mockResolvedValue({
        id: 'tp1',
        user: { name: 'Profesor', email: 'profesor@test.com' },
      });
      mockPrisma.booking.findFirst.mockResolvedValue({ id: 'existing-booking' });

      await expect(service.create(validDto, 'admin1', Role.ADMIN)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('crea la reserva correctamente en el happy path', async () => {
      mockPrisma.teacherProfile.findUnique.mockResolvedValue({
        id: 'tp1',
        user: { name: 'Profesor Test', email: 'profesor@test.com' },
      });
      mockPrisma.booking.findFirst.mockResolvedValue(null);
      const createdBooking = { id: 'new-booking', studentId: 'student1', teacherId: 'tp1' };
      mockPrisma.booking.create.mockResolvedValue(createdBooking);
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ name: 'Admin User' }) // creador
        .mockResolvedValueOnce({ name: 'Alumno Test' }); // alumno

      const result = await service.create(validDto, 'admin1', Role.ADMIN);

      expect(mockPrisma.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            studentId: 'student1',
            teacherId: 'tp1',
            mode: BookingMode.IN_PERSON,
          }),
        }),
      );
      expect(result).toBe(createdBooking);
    });

    it('llama a notifications.sendBookingCreated tras crear la reserva', async () => {
      mockPrisma.teacherProfile.findUnique.mockResolvedValue({
        id: 'tp1',
        user: { name: 'Profesor Test', email: 'profesor@test.com' },
      });
      mockPrisma.booking.findFirst.mockResolvedValue(null);
      mockPrisma.booking.create.mockResolvedValue({ id: 'new-booking' });
      // Para Role.ADMIN no hay verificación de tutorId, solo las dos llamadas finales
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ name: 'Admin User' }) // creador
        .mockResolvedValueOnce({ name: 'Alumno Test' }); // alumno

      await service.create(validDto, 'admin1', Role.ADMIN, 'academy1');

      // Aunque sendBookingCreated se llama con .catch(), verificamos que fue invocado
      expect(mockNotifications.sendBookingCreated).toHaveBeenCalledWith(
        expect.objectContaining({
          teacherEmail: 'profesor@test.com',
          teacherName: 'Profesor Test',
          studentName: 'Alumno Test',
          tutorName: 'Admin User',
          mode: BookingMode.IN_PERSON,
        }),
      );
    });
  });

  // ─── confirm ─────────────────────────────────────────────────────────────────

  describe('confirm', () => {
    it('lanza NotFoundException si la reserva no existe', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(null);

      await expect(service.confirm('nonexistent', 'teacher1')).rejects.toThrow(NotFoundException);
    });

    it('lanza ForbiddenException si el userId no corresponde al teacher de la reserva', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'b1',
        teacherId: 'tp-correct',
        mode: BookingMode.IN_PERSON,
        studentId: 'student1',
      });
      // El perfil encontrado tiene un id diferente al teacherId de la reserva
      mockPrisma.teacherProfile.findUnique.mockResolvedValue({
        id: 'tp-other',
        user: { name: 'Otro Profesor' },
      });

      await expect(service.confirm('b1', 'otherTeacher')).rejects.toThrow(ForbiddenException);
    });

    it('reserva IN_PERSON: no llama a daily.createRoom', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'b1',
        teacherId: 'tp1',
        mode: BookingMode.IN_PERSON,
        meetingUrl: null,
        studentId: 'student1',
        courseId: null,
        startAt: new Date('2026-01-20T10:00:00Z'),
        endAt: new Date('2026-01-20T11:00:00Z'),
      });
      mockPrisma.teacherProfile.findUnique.mockResolvedValue({
        id: 'tp1',
        user: { name: 'Profesor Test' },
      });
      const confirmedBooking = { id: 'b1', status: BookingStatus.CONFIRMED };
      mockPrisma.booking.update.mockResolvedValue(confirmedBooking);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await service.confirm('b1', 'teacher1');

      expect(mockDaily.createRoom).not.toHaveBeenCalled();
    });

    it('reserva ONLINE sin meetingUrl: llama a daily.createRoom', async () => {
      const startAt = new Date('2026-01-20T10:00:00Z');
      const endAt = new Date('2026-01-20T11:00:00Z');
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'b1',
        teacherId: 'tp1',
        mode: BookingMode.ONLINE,
        meetingUrl: null,
        studentId: 'student1',
        courseId: null,
        startAt,
        endAt,
      });
      mockPrisma.teacherProfile.findUnique.mockResolvedValue({
        id: 'tp1',
        user: { name: 'Profesor Test' },
      });
      mockDaily.createRoom.mockResolvedValue('https://daily.co/room/b1');
      const confirmedBooking = {
        id: 'b1',
        status: BookingStatus.CONFIRMED,
        meetingUrl: 'https://daily.co/room/b1',
      };
      mockPrisma.booking.update.mockResolvedValue(confirmedBooking);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await service.confirm('b1', 'teacher1');

      expect(mockDaily.createRoom).toHaveBeenCalledWith('b1', startAt, endAt);
      expect(mockPrisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: BookingStatus.CONFIRMED,
            meetingUrl: 'https://daily.co/room/b1',
          }),
        }),
      );
    });
  });

  // ─── cancel ───────────────────────────────────────────────────────────────────

  describe('cancel', () => {
    const baseBooking = {
      id: 'b1',
      studentId: 'student1',
      teacherId: 'tp1',
      mode: BookingMode.IN_PERSON,
      meetingUrl: null,
      startAt: new Date('2026-01-20T10:00:00Z'),
      endAt: new Date('2026-01-20T11:00:00Z'),
    };

    it('lanza NotFoundException si la reserva no existe', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(null);

      await expect(service.cancel('nonexistent', 'user1', Role.STUDENT)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('STUDENT puede cancelar su propia reserva', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(baseBooking);
      mockPrisma.teacherProfile.findUnique.mockResolvedValue(null); // no es teacher
      const cancelledBooking = { ...baseBooking, status: BookingStatus.CANCELLED };
      mockPrisma.booking.update.mockResolvedValue(cancelledBooking);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.cancel('b1', 'student1', Role.STUDENT);

      expect(mockPrisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'b1' },
          data: { status: BookingStatus.CANCELLED, meetingUrl: null },
        }),
      );
      expect(result).toBe(cancelledBooking);
    });

    it('TEACHER puede cancelar su propia reserva asignada', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(baseBooking);
      mockPrisma.teacherProfile.findUnique.mockResolvedValue({ id: 'tp1' }); // coincide con teacherId de la reserva
      const cancelledBooking = { ...baseBooking, status: BookingStatus.CANCELLED };
      mockPrisma.booking.update.mockResolvedValue(cancelledBooking);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.cancel('b1', 'teacher1', Role.TEACHER);

      expect(mockPrisma.booking.update).toHaveBeenCalled();
      expect(result).toBe(cancelledBooking);
    });

    it('ADMIN puede cancelar cualquier reserva sin ser propietario', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(baseBooking);
      mockPrisma.teacherProfile.findUnique.mockResolvedValue(null); // admin no tiene perfil de teacher
      const cancelledBooking = { ...baseBooking, status: BookingStatus.CANCELLED };
      mockPrisma.booking.update.mockResolvedValue(cancelledBooking);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.cancel('b1', 'admin1', Role.ADMIN);

      expect(mockPrisma.booking.update).toHaveBeenCalled();
      expect(result).toBe(cancelledBooking);
    });

    it('usuario sin relación con la reserva lanza ForbiddenException', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(baseBooking);
      mockPrisma.teacherProfile.findUnique.mockResolvedValue(null); // no es teacher

      // El usuario 'random1' no es el student (student1), no es teacher, y es STUDENT (no ADMIN/TUTOR)
      await expect(service.cancel('b1', 'random1', Role.STUDENT)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('reserva ONLINE con meetingUrl: llama a daily.deleteRoom al cancelar', async () => {
      const onlineBooking = {
        ...baseBooking,
        mode: BookingMode.ONLINE,
        meetingUrl: 'https://daily.co/room/b1',
      };
      mockPrisma.booking.findUnique.mockResolvedValue(onlineBooking);
      mockPrisma.teacherProfile.findUnique.mockResolvedValue(null);
      const cancelledBooking = { ...onlineBooking, status: BookingStatus.CANCELLED };
      mockPrisma.booking.update.mockResolvedValue(cancelledBooking);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockDaily.deleteRoom.mockResolvedValue(undefined);

      // El student cancela su propia reserva
      await service.cancel('b1', 'student1', Role.STUDENT);

      expect(mockDaily.deleteRoom).toHaveBeenCalledWith('b1');
    });
  });
});
