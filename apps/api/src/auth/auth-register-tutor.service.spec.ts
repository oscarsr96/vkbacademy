import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RegisterTutorDto } from './dto/register-tutor.dto';

// Mockear bcrypt para evitar el coste de rondas reales en los tests
jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

// ─── Datos de ejemplo ────────────────────────────────────────────────────────

const fakeAcademy = {
  id: 'academy-uuid-1',
  slug: 'vallekas-basket',
  name: 'Vallekas Basket Academy',
  logoUrl: null,
  primaryColor: '#6366f1',
  isActive: true,
};

const fakeTutor = {
  id: 'tutor-uuid-1',
  email: 'tutor@vkbacademy.es',
  name: 'Tutor Test',
  role: 'TUTOR',
  passwordHash: '$2b$10$hashed_tutor',
  avatarUrl: null,
  schoolYearId: null,
  schoolYear: null,
  academyMembers: [],
};

const fakeStudent1 = {
  id: 'student-uuid-1',
  email: 'alumno1@vkbacademy.es',
  name: 'Alumno Uno',
  role: 'STUDENT',
  passwordHash: '$2b$10$hashed_student1',
  avatarUrl: null,
  schoolYearId: 'sy1',
  schoolYear: { id: 'sy1', name: '1eso', label: '1º ESO' },
  tutorId: 'tutor-uuid-1',
  academyMembers: [],
};

const fakeStudent2 = {
  id: 'student-uuid-2',
  email: 'alumno2@vkbacademy.es',
  name: 'Alumno Dos',
  role: 'STUDENT',
  passwordHash: '$2b$10$hashed_student2',
  avatarUrl: null,
  schoolYearId: 'sy1',
  schoolYear: { id: 'sy1', name: '1eso', label: '1º ESO' },
  tutorId: 'tutor-uuid-1',
  academyMembers: [],
};

const fakeStudent3 = {
  id: 'student-uuid-3',
  email: 'alumno3@vkbacademy.es',
  name: 'Alumno Tres',
  role: 'STUDENT',
  passwordHash: '$2b$10$hashed_student3',
  avatarUrl: null,
  schoolYearId: 'sy2',
  schoolYear: { id: 'sy2', name: '2eso', label: '2º ESO' },
  tutorId: 'tutor-uuid-1',
  academyMembers: [],
};

// ─── Suite de tests ───────────────────────────────────────────────────────────

describe('AuthService.registerTutor', () => {
  let service: AuthService;
  let mockPrisma: {
    user: {
      findUnique: jest.Mock;
      create: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      findFirst: jest.Mock;
    };
    refreshToken: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    academy: { findUnique: jest.Mock };
    academyMember: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let mockJwt: { sign: jest.Mock };
  let mockConfig: { get: jest.Mock };
  let mockNotifications: {
    sendWelcomeTutor: jest.Mock;
    sendWelcomeStudent: jest.Mock;
    sendPasswordReset: jest.Mock;
  };

  beforeEach(async () => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      refreshToken: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      academy: { findUnique: jest.fn() },
      academyMember: { create: jest.fn() },
      // $transaction ejecuta el callback inmediatamente con el mismo prisma
      $transaction: jest.fn().mockImplementation((fn: (tx: unknown) => unknown) => fn(mockPrisma)),
    };

    mockJwt = { sign: jest.fn().mockReturnValue('mocked_token') };
    mockConfig = {
      get: jest.fn().mockImplementation((key: string, fallback?: string) => {
        if (key === 'JWT_REFRESH_SECRET') return 'test_refresh_secret';
        if (key === 'JWT_REFRESH_EXPIRES_IN') return fallback ?? '7d';
        if (key === 'FRONTEND_URL') return 'http://localhost:5173';
        return undefined;
      }),
    };
    mockNotifications = {
      sendWelcomeTutor: jest.fn().mockResolvedValue(undefined),
      sendWelcomeStudent: jest.fn().mockResolvedValue(undefined),
      sendPasswordReset: jest.fn().mockResolvedValue(undefined),
    };

    mockedBcrypt.hash.mockResolvedValue('$2b$10$hashed' as never);
    mockPrisma.refreshToken.create.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ─── Caso feliz: tutor + 1 alumno ──────────────────────────────────────────

  describe('happy path: tutor + 1 alumno', () => {
    const dto: RegisterTutorDto = {
      name: 'Tutor Test',
      email: 'tutor@vkbacademy.es',
      password: 'password123',
      academySlug: 'vallekas-basket',
      students: [{ name: 'Alumno Uno', email: 'alumno1@vkbacademy.es', schoolYearId: 'sy1' }],
    };

    beforeEach(() => {
      mockPrisma.academy.findUnique.mockResolvedValue(fakeAcademy);
      mockPrisma.user.findUnique.mockResolvedValue(null); // sin duplicados
      mockPrisma.user.create
        .mockResolvedValueOnce(fakeTutor) // tutor
        .mockResolvedValueOnce(fakeStudent1); // alumno1
    });

    it('devuelve accessToken, refreshToken y datos públicos del tutor', async () => {
      const result = await service.registerTutor(dto);

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user.id).toBe(fakeTutor.id);
      expect(result.user.email).toBe(fakeTutor.email);
    });

    it('el tutor se crea con rol TUTOR', async () => {
      await service.registerTutor(dto);

      const tutorCreateCall = mockPrisma.user.create.mock.calls[0][0];
      expect(tutorCreateCall.data.role).toBe('TUTOR');
    });

    it('el alumno se crea con rol STUDENT', async () => {
      await service.registerTutor(dto);

      const studentCreateCall = mockPrisma.user.create.mock.calls[1][0];
      expect(studentCreateCall.data.role).toBe('STUDENT');
    });

    it('el alumno tiene tutorId apuntando al tutor', async () => {
      await service.registerTutor(dto);

      const studentCreateCall = mockPrisma.user.create.mock.calls[1][0];
      expect(studentCreateCall.data.tutorId).toBe(fakeTutor.id);
    });

    it('el alumno tiene el schoolYearId correcto', async () => {
      await service.registerTutor(dto);

      const studentCreateCall = mockPrisma.user.create.mock.calls[1][0];
      expect(studentCreateCall.data.schoolYearId).toBe('sy1');
    });

    it('nunca expone passwordHash en la respuesta del tutor', async () => {
      const result = await service.registerTutor(dto);

      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('se crean membresías de academia para tutor y alumno', async () => {
      await service.registerTutor(dto);

      // tutor y alumno se crean con academyMembers.create dentro de user.create
      const tutorCreateCall = mockPrisma.user.create.mock.calls[0][0];
      expect(tutorCreateCall.data.academyMembers.create.academyId).toBe(fakeAcademy.id);

      const studentCreateCall = mockPrisma.user.create.mock.calls[1][0];
      expect(studentCreateCall.data.academyMembers.create.academyId).toBe(fakeAcademy.id);
    });

    it('envía email de bienvenida al tutor', async () => {
      await service.registerTutor(dto);

      expect(mockNotifications.sendWelcomeTutor).toHaveBeenCalledWith(
        expect.objectContaining({ email: fakeTutor.email }),
      );
    });

    it('envía email de bienvenida al alumno con contraseña generada', async () => {
      await service.registerTutor(dto);

      expect(mockNotifications.sendWelcomeStudent).toHaveBeenCalledTimes(1);
      expect(mockNotifications.sendWelcomeStudent).toHaveBeenCalledWith(
        expect.objectContaining({ email: fakeStudent1.email }),
      );
    });

    it('ejecuta todo dentro de una transacción Prisma', async () => {
      await service.registerTutor(dto);

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Caso feliz: tutor + 3 alumnos ─────────────────────────────────────────

  describe('happy path: tutor + 3 alumnos', () => {
    const dto: RegisterTutorDto = {
      name: 'Tutor Test',
      email: 'tutor@vkbacademy.es',
      password: 'password123',
      academySlug: 'vallekas-basket',
      students: [
        { name: 'Alumno Uno', email: 'alumno1@vkbacademy.es', schoolYearId: 'sy1' },
        { name: 'Alumno Dos', email: 'alumno2@vkbacademy.es', schoolYearId: 'sy1' },
        { name: 'Alumno Tres', email: 'alumno3@vkbacademy.es', schoolYearId: 'sy2' },
      ],
    };

    beforeEach(() => {
      mockPrisma.academy.findUnique.mockResolvedValue(fakeAcademy);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create
        .mockResolvedValueOnce(fakeTutor)
        .mockResolvedValueOnce(fakeStudent1)
        .mockResolvedValueOnce(fakeStudent2)
        .mockResolvedValueOnce(fakeStudent3);
    });

    it('crea exactamente 4 usuarios (1 tutor + 3 alumnos)', async () => {
      await service.registerTutor(dto);

      expect(mockPrisma.user.create).toHaveBeenCalledTimes(4);
    });

    it('envía 3 emails de bienvenida a los alumnos', async () => {
      await service.registerTutor(dto);

      expect(mockNotifications.sendWelcomeStudent).toHaveBeenCalledTimes(3);
    });

    it('cada alumno tiene tutorId del tutor recién creado', async () => {
      await service.registerTutor(dto);

      for (let i = 1; i <= 3; i++) {
        const studentCreateCall = mockPrisma.user.create.mock.calls[i][0];
        expect(studentCreateCall.data.tutorId).toBe(fakeTutor.id);
      }
    });

    it('cada alumno conserva su propio schoolYearId', async () => {
      await service.registerTutor(dto);

      const student1Call = mockPrisma.user.create.mock.calls[1][0];
      const student3Call = mockPrisma.user.create.mock.calls[3][0];

      expect(student1Call.data.schoolYearId).toBe('sy1');
      expect(student3Call.data.schoolYearId).toBe('sy2');
    });
  });

  // ─── Validaciones de error ──────────────────────────────────────────────────

  describe('validaciones', () => {
    it('lanza NotFoundException si la academia no existe', async () => {
      mockPrisma.academy.findUnique.mockResolvedValue(null);

      await expect(
        service.registerTutor({
          name: 'Tutor',
          email: 'tutor@test.es',
          password: 'password123',
          academySlug: 'academia-inexistente',
          students: [{ name: 'Alumno', email: 'alumno@test.es' }],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza BadRequestException si la academia está inactiva', async () => {
      mockPrisma.academy.findUnique.mockResolvedValue({ ...fakeAcademy, isActive: false });

      await expect(
        service.registerTutor({
          name: 'Tutor',
          email: 'tutor@test.es',
          password: 'password123',
          academySlug: 'vallekas-basket',
          students: [{ name: 'Alumno', email: 'alumno@test.es' }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza ConflictException si el email del tutor ya está registrado', async () => {
      mockPrisma.academy.findUnique.mockResolvedValue(fakeAcademy);
      // El tutor ya existe
      mockPrisma.user.findUnique.mockResolvedValueOnce(fakeTutor);

      await expect(
        service.registerTutor({
          name: 'Tutor',
          email: 'tutor@vkbacademy.es',
          password: 'password123',
          academySlug: 'vallekas-basket',
          students: [{ name: 'Alumno', email: 'alumno@test.es' }],
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('lanza ConflictException si el email de un alumno ya está registrado', async () => {
      mockPrisma.academy.findUnique.mockResolvedValue(fakeAcademy);
      // Tutor no existe, pero alumno sí
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null) // tutor email → libre
        .mockResolvedValueOnce(fakeStudent1); // alumno email → duplicado

      await expect(
        service.registerTutor({
          name: 'Tutor',
          email: 'tutor@nuevo.es',
          password: 'password123',
          academySlug: 'vallekas-basket',
          students: [{ name: 'Alumno', email: 'alumno1@vkbacademy.es' }],
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('no crea ningún usuario si alguna validación falla (rollback implícito con mock de transaction)', async () => {
      mockPrisma.academy.findUnique.mockResolvedValue(null); // academia inexistente

      try {
        await service.registerTutor({
          name: 'Tutor',
          email: 'tutor@test.es',
          password: 'password123',
          academySlug: 'inexistente',
          students: [{ name: 'Alumno', email: 'alumno@test.es' }],
        });
      } catch {
        // esperado
      }

      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });
  });

  // ─── Generación de contraseña para alumnos ──────────────────────────────────

  describe('generación de contraseña para alumnos', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      // Restaurar los valores por defecto tras limpiar los mocks
      mockJwt.sign.mockReturnValue('mocked_token');
      mockConfig.get.mockImplementation((key: string, fallback?: string) => {
        if (key === 'JWT_REFRESH_SECRET') return 'test_refresh_secret';
        if (key === 'JWT_REFRESH_EXPIRES_IN') return fallback ?? '7d';
        if (key === 'FRONTEND_URL') return 'http://localhost:5173';
        return undefined;
      });
      mockedBcrypt.hash.mockResolvedValue('$2b$10$hashed' as never);
      mockPrisma.refreshToken.create.mockResolvedValue({});

      mockPrisma.academy.findUnique.mockResolvedValue(fakeAcademy);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValueOnce(fakeTutor).mockResolvedValueOnce(fakeStudent1);
    });

    it('hashea la contraseña del alumno antes de persistir', async () => {
      await service.registerTutor({
        name: 'Tutor',
        email: 'tutor@test.es',
        password: 'password123',
        academySlug: 'vallekas-basket',
        students: [{ name: 'Alumno', email: 'alumno1@vkbacademy.es', schoolYearId: 'sy1' }],
      });

      // bcrypt.hash se llama exactamente 2 veces: una para el tutor y otra para el alumno
      expect(mockedBcrypt.hash).toHaveBeenCalledTimes(2);
    });

    it('la contraseña generada para el alumno se envía por email en texto plano', async () => {
      await service.registerTutor({
        name: 'Tutor',
        email: 'tutor@test.es',
        password: 'password123',
        academySlug: 'vallekas-basket',
        students: [{ name: 'Alumno', email: 'alumno1@vkbacademy.es', schoolYearId: 'sy1' }],
      });

      const studentEmailCall = mockNotifications.sendWelcomeStudent.mock.calls[0][0];
      // La contraseña generada debe ser una cadena no vacía de al menos 8 caracteres
      expect(typeof studentEmailCall.password).toBe('string');
      expect(studentEmailCall.password.length).toBeGreaterThanOrEqual(8);
    });
  });
});
