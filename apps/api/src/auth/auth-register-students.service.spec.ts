import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UsernameService } from '../username/username.service';
import { RegisterStudentsDto } from './dto/register-students.dto';

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

const fakeSchoolYear = { id: 'sy1', name: '1eso', label: '1º ESO' };

// ─── Suite de tests ───────────────────────────────────────────────────────────

describe('AuthService.registerStudents', () => {
  let service: AuthService;
  // Cliente transaccional: los creates deben ir por aquí, no por mockPrisma
  let mockTx: { user: { create: jest.Mock } };
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
    guardianSubscription: { upsert: jest.Mock };
    academyMember: { create: jest.Mock };
    schoolYear: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let mockJwt: { sign: jest.Mock };
  let mockConfig: { get: jest.Mock };
  let mockNotifications: {
    sendPasswordReset: jest.Mock;
  };
  let mockUsernames: { slugify: jest.Mock; allocate: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();

    // El create devuelve el propio payload enriquecido: así el test comprueba
    // que el servicio mapea lo que la BD devolvió, no lo que él mismo envió.
    mockTx = {
      user: {
        create: jest.fn().mockImplementation((args: { data: Record<string, unknown> }) =>
          Promise.resolve({
            id: `student-${String(args.data.username)}`,
            name: args.data.name,
            username: args.data.username,
            email: null,
            role: args.data.role,
            passwordHash: args.data.passwordHash,
            avatarUrl: null,
            guardianEmail: args.data.guardianEmail,
            schoolYearId: args.data.schoolYearId ?? null,
            schoolYear: args.data.schoolYearId ? fakeSchoolYear : null,
          }),
        ),
      },
    };

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
      academy: { findUnique: jest.fn().mockResolvedValue(fakeAcademy) },
      guardianSubscription: { upsert: jest.fn().mockResolvedValue({}) },
      academyMember: { create: jest.fn() },
      // Por defecto todos los cursos pedidos existen
      schoolYear: {
        findMany: jest
          .fn()
          .mockImplementation((args: { where: { id: { in: string[] } } }) =>
            Promise.resolve(args.where.id.in.map((id) => ({ id }))),
          ),
      },
      // $transaction ejecuta el callback con el cliente transaccional mockTx
      $transaction: jest.fn().mockImplementation((fn: (tx: unknown) => unknown) => fn(mockTx)),
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
      sendPasswordReset: jest.fn().mockResolvedValue(undefined),
    };
    mockUsernames = {
      slugify: jest.fn((n: string) => n.toLowerCase().replace(/\s+/g, '-')),
      allocate: jest.fn(),
    };

    // Hash determinista por contraseña: permite distinguir el hash de cada hermano.
    // `as never` porque las sobrecargas de bcrypt.hash confunden a jest.Mocked.
    mockedBcrypt.hash.mockImplementation(((plain: string) =>
      Promise.resolve(`$2b$10$hashed_${plain}`)) as never);
    mockPrisma.refreshToken.create.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
        { provide: NotificationsService, useValue: mockNotifications },
        { provide: UsernameService, useValue: mockUsernames },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('crea un alumno por cada entrada, con su propio username', async () => {
    mockUsernames.allocate.mockResolvedValue(['ana-perez', 'luis-perez']);
    const result = await service.registerStudents({
      guardianEmail: 'padre@example.com',
      academySlug: 'vallekas-basket',
      students: [
        { name: 'Ana Pérez', schoolYearId: 'sy1', password: 'clave12345' },
        { name: 'Luis Pérez', schoolYearId: 'sy1', password: 'otraClave99' },
      ],
    });

    expect(result.students).toHaveLength(2);
    expect(result.students.map((s) => s.username)).toEqual(['ana-perez', 'luis-perez']);
  });

  it('no devuelve tokens: nadie inicia sesión al registrarse', async () => {
    mockUsernames.allocate.mockResolvedValue(['ana-perez']);
    const result = await service.registerStudents({
      guardianEmail: 'padre@example.com',
      academySlug: 'vallekas-basket',
      students: [{ name: 'Ana Pérez', schoolYearId: 'sy1', password: 'clave12345' }],
    });

    expect(result).not.toHaveProperty('accessToken');
    expect(result).not.toHaveProperty('refreshToken');
  });

  it('hashea cada contraseña por separado', async () => {
    mockUsernames.allocate.mockResolvedValue(['ana-perez', 'luis-perez']);
    await service.registerStudents({
      guardianEmail: 'padre@example.com',
      academySlug: 'vallekas-basket',
      students: [
        { name: 'Ana Pérez', schoolYearId: 'sy1', password: 'clave12345' },
        { name: 'Luis Pérez', schoolYearId: 'sy1', password: 'otraClave99' },
      ],
    });

    expect(mockedBcrypt.hash).toHaveBeenCalledWith('clave12345', 10);
    expect(mockedBcrypt.hash).toHaveBeenCalledWith('otraClave99', 10);
  });

  it('guarda el guardianEmail en cada alumno y no crea usuario para el padre', async () => {
    mockUsernames.allocate.mockResolvedValue(['ana-perez']);
    await service.registerStudents({
      guardianEmail: 'padre@example.com',
      academySlug: 'vallekas-basket',
      students: [{ name: 'Ana Pérez', schoolYearId: 'sy1', password: 'clave12345' }],
    });

    const creates = mockTx.user.create.mock.calls;
    expect(creates).toHaveLength(1);
    expect(creates[0][0].data.guardianEmail).toBe('padre@example.com');
    expect(creates[0][0].data.role).toBe('STUDENT');
  });

  // ─── Extras de robustez del contrato ───────────────────────────────────────

  it('los creates usan el cliente transaccional, nunca this.prisma', async () => {
    mockUsernames.allocate.mockResolvedValue(['ana-perez', 'luis-perez']);
    await service.registerStudents({
      guardianEmail: 'padre@example.com',
      academySlug: 'vallekas-basket',
      students: [
        { name: 'Ana Pérez', schoolYearId: 'sy1', password: 'clave12345' },
        { name: 'Luis Pérez', schoolYearId: 'sy1', password: 'otraClave99' },
      ],
    });

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockTx.user.create).toHaveBeenCalledTimes(2);
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it('lanza NotFoundException si la academia no existe y no crea a nadie', async () => {
    mockPrisma.academy.findUnique.mockResolvedValue(null);
    mockUsernames.allocate.mockResolvedValue(['ana-perez']);

    await expect(
      service.registerStudents({
        guardianEmail: 'padre@example.com',
        academySlug: 'academia-inexistente',
        students: [{ name: 'Ana Pérez', schoolYearId: 'sy1', password: 'clave12345' }],
      }),
    ).rejects.toThrow(NotFoundException);

    expect(mockTx.user.create).not.toHaveBeenCalled();
  });

  it('cada alumno recibe SU nombre, SU username y SU hash — sin cruces de índices', async () => {
    mockUsernames.allocate.mockResolvedValue(['ana-perez', 'luis-perez']);
    await service.registerStudents({
      guardianEmail: 'padre@example.com',
      academySlug: 'vallekas-basket',
      students: [
        { name: 'Ana Pérez', schoolYearId: 'sy1', password: 'clave12345' },
        { name: 'Luis Pérez', schoolYearId: 'sy1', password: 'otraClave99' },
      ],
    });

    const creates = mockTx.user.create.mock.calls;
    expect(creates[0][0].data).toMatchObject({
      name: 'Ana Pérez',
      username: 'ana-perez',
      passwordHash: '$2b$10$hashed_clave12345',
    });
    expect(creates[1][0].data).toMatchObject({
      name: 'Luis Pérez',
      username: 'luis-perez',
      passwordHash: '$2b$10$hashed_otraClave99',
    });
  });

  it('lanza BadRequestException si algún schoolYearId no existe, en vez de un 500 de Prisma', async () => {
    mockUsernames.allocate.mockResolvedValue(['ana-perez']);
    mockPrisma.schoolYear.findMany.mockResolvedValue([]); // "pwned" no existe

    await expect(
      service.registerStudents({
        guardianEmail: 'padre@example.com',
        academySlug: 'vallekas-basket',
        students: [{ name: 'Ana Pérez', schoolYearId: 'pwned', password: 'clave12345' }],
      }),
    ).rejects.toThrow(BadRequestException);

    expect(mockTx.user.create).not.toHaveBeenCalled();
    // Fija el ORDEN: validar cursos antes de hashear. Con ids inválidos el atacante
    // paga un findMany indexado y cero bcrypt, que es lo que impide que el abuso
    // del array vuelva por otra puerta.
    expect(mockedBcrypt.hash).not.toHaveBeenCalled();
  });

  it('traduce el P2002 de username a ConflictException, no a un 500 opaco', async () => {
    mockUsernames.allocate.mockResolvedValue(['ana-perez']);
    mockTx.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['username'] },
      }),
    );

    await expect(
      service.registerStudents({
        guardianEmail: 'padre@example.com',
        academySlug: 'vallekas-basket',
        students: [{ name: 'Ana Pérez', schoolYearId: 'sy1', password: 'clave12345' }],
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('rechaza más de 10 alumnos por solicitud (400 en el ValidationPipe)', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    });
    const payload = {
      guardianEmail: 'padre@example.com',
      academySlug: 'vallekas-basket',
      students: Array.from({ length: 11 }, (_, i) => ({
        name: `Alumno ${i}`,
        schoolYearId: 'sy1',
        password: 'clave12345',
      })),
    };

    await expect(
      pipe.transform(payload, { type: 'body', metatype: RegisterStudentsDto }),
    ).rejects.toThrow(BadRequestException);

    // 10 sí pasan
    await expect(
      pipe.transform(
        { ...payload, students: payload.students.slice(0, 10) },
        { type: 'body', metatype: RegisterStudentsDto },
      ),
    ).resolves.toBeDefined();
  });

  it('exige academySlug y normaliza el guardianEmail (trim + lowercase)', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    // Sin academia → 400: un alumno sin academia no lo ve ningún admin
    await expect(
      pipe.transform(
        {
          guardianEmail: 'padre@example.com',
          students: [{ name: 'Ana Pérez', schoolYearId: 'sy1', password: 'clave12345' }],
        },
        { type: 'body', metatype: RegisterStudentsDto },
      ),
    ).rejects.toThrow(BadRequestException);

    const normalized = (await pipe.transform(
      {
        guardianEmail: '  Padre@Example.COM  ',
        academySlug: 'vallekas-basket',
        students: [{ name: 'Ana Pérez', schoolYearId: 'sy1', password: 'clave12345' }],
      },
      { type: 'body', metatype: RegisterStudentsDto },
    )) as RegisterStudentsDto;
    expect(normalized.guardianEmail).toBe('padre@example.com');
  });

  it('lanza BadRequestException si la academia está inactiva', async () => {
    mockPrisma.academy.findUnique.mockResolvedValue({ ...fakeAcademy, isActive: false });
    mockUsernames.allocate.mockResolvedValue(['ana-perez']);

    await expect(
      service.registerStudents({
        guardianEmail: 'padre@example.com',
        academySlug: 'vallekas-basket',
        students: [{ name: 'Ana Pérez', schoolYearId: 'sy1', password: 'clave12345' }],
      }),
    ).rejects.toThrow(BadRequestException);

    expect(mockTx.user.create).not.toHaveBeenCalled();
  });
  // ─── Consentimiento del resumen semanal ────────────────────────────────────

  describe('consentimiento del resumen semanal', () => {
    const dtoBase = {
      guardianEmail: 'padre@example.com',
      academySlug: 'vallekas-basket',
      students: [{ name: 'Ana Pérez', schoolYearId: 'sy1', password: 'clave12345' }],
    };

    beforeEach(() => {
      mockUsernames.allocate.mockResolvedValue(['ana-perez']);
    });

    it('no crea suscripción si no se marca la casilla', async () => {
      await service.registerStudents(dtoBase);

      // El email sigue siendo solo un dato de contacto, como hasta ahora.
      expect(mockPrisma.guardianSubscription.upsert).not.toHaveBeenCalled();
    });

    it('crea la suscripción cuando se marca la casilla', async () => {
      await service.registerStudents({ ...dtoBase, guardianDigestConsent: true });

      const args = mockPrisma.guardianSubscription.upsert.mock.calls[0][0];
      expect(args.where.email).toBe('padre@example.com');
      expect(args.create.consentAt).toBeInstanceOf(Date);
      expect(typeof args.create.token).toBe('string');
      expect(args.create.token.length).toBeGreaterThan(30);
    });

    it('reactiva una baja anterior si la familia vuelve a marcar la casilla', async () => {
      await service.registerStudents({ ...dtoBase, guardianDigestConsent: true });

      const args = mockPrisma.guardianSubscription.upsert.mock.calls[0][0];
      expect(args.update.unsubscribedAt).toBeNull();
    });

    it('no toca el token al reactivar: los enlaces ya enviados siguen valiendo', async () => {
      await service.registerStudents({ ...dtoBase, guardianDigestConsent: true });

      const args = mockPrisma.guardianSubscription.upsert.mock.calls[0][0];
      expect(args.update).not.toHaveProperty('token');
    });

    it('el token es distinto en cada suscripción', async () => {
      await service.registerStudents({ ...dtoBase, guardianDigestConsent: true });
      mockUsernames.allocate.mockResolvedValue(['ana-perez']);
      await service.registerStudents({ ...dtoBase, guardianDigestConsent: true });

      const t1 = mockPrisma.guardianSubscription.upsert.mock.calls[0][0].create.token;
      const t2 = mockPrisma.guardianSubscription.upsert.mock.calls[1][0].create.token;
      expect(t1).not.toBe(t2);
    });

    it('el alta de los alumnos no depende de la suscripción', async () => {
      mockPrisma.guardianSubscription.upsert.mockRejectedValue(new Error('BD caída'));

      // Que falle la suscripción no puede dejar sin cuenta a los hijos.
      const result = await service.registerStudents({ ...dtoBase, guardianDigestConsent: true });

      expect(result.students).toHaveLength(1);
    });
  });
});
