import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';

// Mockear bcrypt para evitar el coste de rondas reales en los tests
jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('AdminService', () => {
  let service: AdminService;
  let mockPrisma: {
    user: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    enrollment: {
      findMany: jest.Mock;
      upsert: jest.Mock;
      deleteMany: jest.Mock;
    };
  };

  const fakeUser = {
    id: 'user-1',
    email: 'alumno@vkbacademy.es',
    name: 'Alumno Test',
    role: 'STUDENT',
    passwordHash: '$2b$10$hashedpassword',
    avatarUrl: null,
    createdAt: new Date('2026-01-01'),
    tutorId: null,
    tutor: null,
    _count: { students: 0 },
  };

  const fakeCourse = {
    id: 'course-1',
    title: 'Baloncesto Básico',
    schoolYear: { id: 'sy1', name: '1eso', label: '1º ESO' },
  };

  beforeEach(async () => {
    mockPrisma = {
      user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      enrollment: {
        findMany: jest.fn(),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    jest.clearAllMocks();
    mockedBcrypt.hash.mockResolvedValue('$2b$10$hashedpassword' as never);
  });

  // ─── createUser ────────────────────────────────────────────────────────────

  describe('createUser', () => {
    it('hashea la contraseña con bcrypt antes de persistir', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(fakeUser);

      await service.createUser({
        email: 'nuevo@vkbacademy.es',
        name: 'Nuevo Alumno',
        password: 'mi_password_segura',
        role: 'STUDENT' as never,
      });

      expect(mockedBcrypt.hash).toHaveBeenCalledWith('mi_password_segura', 10);
    });

    it('no almacena la contraseña en texto plano', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(fakeUser);

      await service.createUser({
        email: 'nuevo@vkbacademy.es',
        name: 'Test',
        password: 'plaintext',
        role: 'STUDENT' as never,
      });

      const createData = mockPrisma.user.create.mock.calls[0][0].data;
      expect(createData).not.toHaveProperty('password');
      expect(createData.passwordHash).toBe('$2b$10$hashedpassword');
    });

    it('lanza BadRequestException si el email ya está registrado', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(fakeUser);

      await expect(
        service.createUser({
          email: 'alumno@vkbacademy.es',
          name: 'Test',
          password: 'pass1234',
          role: 'STUDENT' as never,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('crea el usuario con el rol y nivel educativo correctos', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ ...fakeUser, schoolYearId: 'sy1' });

      await service.createUser({
        email: 'nuevo@vkbacademy.es',
        name: 'Test',
        password: 'pass1234',
        role: 'STUDENT' as never,
        schoolYearId: 'sy1',
      });

      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ role: 'STUDENT', schoolYearId: 'sy1' }),
        }),
      );
    });
  });

  // ─── updateUser ────────────────────────────────────────────────────────────

  describe('updateUser', () => {
    it('actualiza solo los campos enviados (partial update)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(fakeUser);
      mockPrisma.user.update.mockResolvedValue({ ...fakeUser, name: 'Nombre Nuevo' });

      await service.updateUser('user-1', { name: 'Nombre Nuevo' });

      const updateData = mockPrisma.user.update.mock.calls[0][0].data;
      expect(updateData).toHaveProperty('name', 'Nombre Nuevo');
      // No debe tocar el email ni otros campos no enviados
      expect(updateData).not.toHaveProperty('email');
    });

    it('lanza NotFoundException si el usuario no existe', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.updateUser('no-existe', { name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza BadRequestException si el nuevo email ya está en uso por otro usuario', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(fakeUser) // primer findUnique: el usuario existe
        .mockResolvedValueOnce({ ...fakeUser, id: 'otro-user' }); // segundo: email ya en uso

      await expect(
        service.updateUser('user-1', { email: 'ocupado@vkb.es' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('hashea la contraseña si se actualiza', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(fakeUser);
      mockPrisma.user.update.mockResolvedValue(fakeUser);

      await service.updateUser('user-1', { password: 'nueva_pass_segura' });

      expect(mockedBcrypt.hash).toHaveBeenCalledWith('nueva_pass_segura', 10);
      const updateData = mockPrisma.user.update.mock.calls[0][0].data;
      expect(updateData).toHaveProperty('passwordHash');
      expect(updateData).not.toHaveProperty('password');
    });
  });

  // ─── deleteUser ────────────────────────────────────────────────────────────

  describe('deleteUser', () => {
    it('llama a prisma.user.delete con el id correcto', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(fakeUser);
      mockPrisma.user.delete.mockResolvedValue(fakeUser);

      await service.deleteUser('user-1');

      expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    });

    it('lanza NotFoundException si el usuario no existe', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.deleteUser('no-existe')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.user.delete).not.toHaveBeenCalled();
    });

    it('devuelve mensaje de confirmación tras eliminar', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(fakeUser);
      mockPrisma.user.delete.mockResolvedValue(fakeUser);

      const result = await service.deleteUser('user-1');

      expect(result.message).toBeDefined();
    });
  });

  // ─── enroll ────────────────────────────────────────────────────────────────

  describe('enroll', () => {
    it('crea una matrícula con el userId y courseId correctos', async () => {
      const fakeEnrollment = {
        id: 'enroll-1',
        userId: 'user-1',
        courseId: 'course-1',
        createdAt: new Date(),
        course: fakeCourse,
      };
      mockPrisma.enrollment.upsert.mockResolvedValue(fakeEnrollment);

      await service.enroll('user-1', 'course-1');

      expect(mockPrisma.enrollment.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_courseId: { userId: 'user-1', courseId: 'course-1' } },
          create: { userId: 'user-1', courseId: 'course-1' },
        }),
      );
    });

    it('es idempotente: si ya existe, hace upsert sin duplicar', async () => {
      const fakeEnrollment = {
        id: 'enroll-1',
        userId: 'user-1',
        courseId: 'course-1',
        createdAt: new Date(),
        course: fakeCourse,
      };
      mockPrisma.enrollment.upsert.mockResolvedValue(fakeEnrollment);

      // Llamar dos veces
      await service.enroll('user-1', 'course-1');
      await service.enroll('user-1', 'course-1');

      // update: {} garantiza idempotencia — siempre debe haberse llamado con update vacío
      const calls = mockPrisma.enrollment.upsert.mock.calls;
      expect(calls[0][0].update).toEqual({});
      expect(calls[1][0].update).toEqual({});
    });
  });

  // ─── unenroll ──────────────────────────────────────────────────────────────

  describe('unenroll', () => {
    it('elimina la matrícula con el userId y courseId correctos', async () => {
      mockPrisma.enrollment.deleteMany.mockResolvedValue({ count: 1 });

      await service.unenroll('user-1', 'course-1');

      expect(mockPrisma.enrollment.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', courseId: 'course-1' },
      });
    });

    it('devuelve mensaje de confirmación', async () => {
      mockPrisma.enrollment.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.unenroll('user-1', 'course-1');

      expect(result.message).toBeDefined();
    });

    it('no lanza error si la matrícula no existe (deleteMany es idempotente)', async () => {
      mockPrisma.enrollment.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.unenroll('user-1', 'sin-matricula')).resolves.toBeDefined();
    });
  });

  // ─── getEnrollments ────────────────────────────────────────────────────────

  describe('getEnrollments', () => {
    it('devuelve las matrículas del alumno con datos del curso y schoolYear', async () => {
      const fakeEnrollments = [
        {
          id: 'enroll-1',
          userId: 'user-1',
          courseId: 'course-1',
          createdAt: new Date(),
          course: fakeCourse,
        },
      ];
      mockPrisma.enrollment.findMany.mockResolvedValue(fakeEnrollments);

      const result = await service.getEnrollments('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].course.title).toBe('Baloncesto Básico');
      expect(result[0].course.schoolYear?.label).toBe('1º ESO');
    });

    it('devuelve array vacío si el alumno no tiene matrículas', async () => {
      mockPrisma.enrollment.findMany.mockResolvedValue([]);

      const result = await service.getEnrollments('user-sin-matriculas');

      expect(result).toHaveLength(0);
    });

    it('llama a findMany filtrando por el userId correcto', async () => {
      mockPrisma.enrollment.findMany.mockResolvedValue([]);

      await service.getEnrollments('user-1');

      expect(mockPrisma.enrollment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1' } }),
      );
    });
  });
});
