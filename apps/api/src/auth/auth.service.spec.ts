import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CryptoService } from '../crypto/crypto.service';

// Mockear bcrypt para evitar el coste de rondas reales en los tests
jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('AuthService', () => {
  let service: AuthService;
  let mockPrisma: {
    user: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      findUniqueOrThrow: jest.Mock;
    };
    refreshToken: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let mockJwt: { sign: jest.Mock; decode: jest.Mock; verify: jest.Mock };
  let mockConfig: { get: jest.Mock };
  let mockCrypto: { encrypt: jest.Mock; decrypt: jest.Mock };

  // Usuario de ejemplo con todos los campos necesarios
  const fakeUser = {
    id: 'user-uuid-1',
    email: 'alumno@vkbacademy.es',
    name: 'Alumno Test',
    role: 'STUDENT',
    passwordHash: '$2b$10$hashed',
    avatarUrl: null,
    schoolYearId: 'sy1',
    schoolYear: { id: 'sy1', name: '1eso', label: '1º ESO' },
    academyMembers: [],
  };

  beforeEach(async () => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      refreshToken: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    mockJwt = {
      sign: jest.fn().mockReturnValue('mocked_access_token'),
      decode: jest.fn(),
      verify: jest.fn(),
    };
    mockConfig = { get: jest.fn() };
    mockCrypto = {
      encrypt: jest.fn((plain: string) => `enc(${plain})`),
      decrypt: jest.fn((cipher: string) => cipher.replace(/^enc\(|\)$/g, '')),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
        {
          provide: NotificationsService,
          useValue: { sendPasswordReset: jest.fn().mockResolvedValue(undefined) },
        },
        { provide: CryptoService, useValue: mockCrypto },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();

    // Valores por defecto para las dependencias
    mockJwt.sign.mockReturnValue('mocked_token');
    mockConfig.get.mockImplementation((key: string, fallback?: string) => {
      if (key === 'JWT_SECRET') return 'test_secret';
      if (key === 'JWT_REFRESH_SECRET') return 'test_refresh_secret';
      if (key === 'JWT_REFRESH_EXPIRES_IN') return fallback ?? '7d';
      return undefined;
    });
    mockedBcrypt.hash.mockResolvedValue('$2b$10$hashed' as never);
    mockedBcrypt.compare.mockResolvedValue(true as never);
    mockPrisma.refreshToken.create.mockResolvedValue({});
  });

  // ─── register ────────────────────────────────────────────────────────────────

  describe('register', () => {
    it('lanza ConflictException si el email ya está registrado', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(fakeUser);

      await expect(
        service.register({
          email: 'alumno@vkbacademy.es',
          password: 'pass123',
          name: 'Alumno Test',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('no crea usuario si el email ya existe', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(fakeUser);

      try {
        await service.register({ email: 'alumno@vkbacademy.es', password: 'pass', name: 'Test' });
      } catch {
        // ignorar la excepción, solo verificamos el efecto
      }

      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('hashea la contraseña con bcrypt antes de persistir', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(fakeUser);

      await service.register({
        email: 'nuevo@vkbacademy.es',
        password: 'mi_password_segura',
        name: 'Nuevo Alumno',
      });

      expect(mockedBcrypt.hash).toHaveBeenCalledWith('mi_password_segura', 10);
    });

    it('crea el usuario con el hash de la contraseña, no el texto plano', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(fakeUser);

      await service.register({
        email: 'nuevo@vkbacademy.es',
        password: 'plaintext',
        name: 'Test',
      });

      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'nuevo@vkbacademy.es',
            passwordHash: '$2b$10$hashed',
            name: 'Test',
          }),
        }),
      );
      // Verificar que el campo password no se guarda directamente
      const createData = mockPrisma.user.create.mock.calls[0][0].data;
      expect(createData).not.toHaveProperty('password');
    });

    it('devuelve tokens y datos públicos del usuario creado', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(fakeUser);

      const result = await service.register({
        email: 'nuevo@vkbacademy.es',
        password: 'pass123',
        name: 'Nuevo Alumno',
      });

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user.id).toBe(fakeUser.id);
      expect(result.user.email).toBe(fakeUser.email);
      expect(result.user.role).toBe('STUDENT');
    });

    it('nunca expone passwordHash en la respuesta', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(fakeUser);

      const result = await service.register({
        email: 'nuevo@vkbacademy.es',
        password: 'pass',
        name: 'Test',
      });

      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('persiste el refresh token en BD tras el registro', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(fakeUser);

      await service.register({
        email: 'nuevo@vkbacademy.es',
        password: 'pass',
        name: 'Test',
      });

      expect(mockPrisma.refreshToken.create).toHaveBeenCalledTimes(1);
    });
  });

  // ─── login ───────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('lanza UnauthorizedException si el usuario no existe', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ identifier: 'desconocido@club.es', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('lanza UnauthorizedException si la contraseña es incorrecta', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(fakeUser);
      mockedBcrypt.compare.mockResolvedValue(false as never); // contraseña incorrecta

      await expect(
        service.login({ identifier: 'alumno@vkbacademy.es', password: 'wrong_pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('el mensaje de error es genérico para evitar enumeración de usuarios', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ identifier: 'cualquiera@email.es', password: 'pass' }),
      ).rejects.toThrow('Credenciales incorrectas');
    });

    it('devuelve accessToken, refreshToken y datos del usuario con credenciales válidas', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(fakeUser);
      mockedBcrypt.compare.mockResolvedValue(true as never);

      const result = await service.login({
        identifier: 'alumno@vkbacademy.es',
        password: 'correcta',
      });

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user.id).toBe(fakeUser.id);
      expect(result.user.email).toBe(fakeUser.email);
    });

    it('nunca expone passwordHash en la respuesta de login', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(fakeUser);
      mockedBcrypt.compare.mockResolvedValue(true as never);

      const result = await service.login({
        identifier: 'alumno@vkbacademy.es',
        password: 'correcta',
      });

      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('incluye el schoolYear en la respuesta de login si el usuario lo tiene asignado', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(fakeUser);
      mockedBcrypt.compare.mockResolvedValue(true as never);

      const result = await service.login({
        identifier: 'alumno@vkbacademy.es',
        password: 'correcta',
      });

      expect(result.user.schoolYearId).toBe('sy1');
      expect(result.user.schoolYear?.label).toBe('1º ESO');
    });

    it('devuelve schoolYear null si el usuario no tiene nivel asignado', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...fakeUser,
        schoolYearId: null,
        schoolYear: null,
      });
      mockedBcrypt.compare.mockResolvedValue(true as never);

      const result = await service.login({
        identifier: 'alumno@vkbacademy.es',
        password: 'correcta',
      });

      expect(result.user.schoolYearId).toBeNull();
      expect(result.user.schoolYear).toBeNull();
    });
  });

  // ─── refresh ─────────────────────────────────────────────────────────────────

  describe('refresh', () => {
    const validStoredToken = {
      id: 'rt-uuid-1',
      token: 'valid_refresh_token',
      userId: 'user-uuid-1',
      revoked: false,
      expiresAt: new Date(Date.now() + 86_400_000), // expira mañana
    };

    it('lanza UnauthorizedException si el token no existe en BD', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refresh('unknown_token')).rejects.toThrow(UnauthorizedException);
    });

    it('lanza UnauthorizedException si el token está revocado', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        ...validStoredToken,
        revoked: true,
      });

      await expect(service.refresh('revoked_token')).rejects.toThrow(UnauthorizedException);
    });

    it('lanza UnauthorizedException si el token ha expirado', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        ...validStoredToken,
        expiresAt: new Date(Date.now() - 1_000), // expiró hace 1 segundo
      });

      await expect(service.refresh('expired_token')).rejects.toThrow(UnauthorizedException);
    });

    it('rota el token: revoca el antiguo antes de emitir uno nuevo', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(validStoredToken);
      mockPrisma.refreshToken.update.mockResolvedValue({});
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue(fakeUser);

      await service.refresh('valid_refresh_token');

      // Debe revocar el token anterior
      expect(mockPrisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: validStoredToken.id },
        data: { revoked: true },
      });
      // Debe crear uno nuevo
      expect(mockPrisma.refreshToken.create).toHaveBeenCalledTimes(1);
    });

    it('devuelve nuevos accessToken y refreshToken tras rotación exitosa', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(validStoredToken);
      mockPrisma.refreshToken.update.mockResolvedValue({});
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue(fakeUser);

      const result = await service.refresh('valid_refresh_token');

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });
  });

  // ─── logout ──────────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('revoca el refresh token del usuario en BD', async () => {
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.logout('some_refresh_token');

      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { token: 'some_refresh_token' },
        data: { revoked: true },
      });
      expect(result.message).toBeDefined();
    });

    it('no lanza error si el token no existe (logout idempotente)', async () => {
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 0 }); // 0 filas afectadas

      await expect(service.logout('nonexistent_token')).resolves.toMatchObject({
        message: expect.any(String),
      });
    });

    it('devuelve un mensaje de confirmación de cierre de sesión', async () => {
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.logout('token');

      expect(result.message).toContain('cerrada');
    });
  });

  // ─── resetPassword: sincronización viewablePassword ─────────────────────────

  describe('resetPassword viewablePassword sync', () => {
    beforeEach(() => {
      mockedBcrypt.hash.mockResolvedValue('newhash' as never);
      mockJwt.verify.mockReturnValue({ sub: 'u1', purpose: 'reset' });
    });

    it('actualiza viewablePassword cuando user es STUDENT con tutorId', async () => {
      mockJwt.decode.mockReturnValue({ sub: 'st1', purpose: 'reset' });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'st1',
        role: 'STUDENT',
        tutorId: 'tut1',
        passwordHash: 'oldhash',
      });
      mockPrisma.user.update.mockResolvedValue({ id: 'st1' });

      await service.resetPassword('any-token', 'newSecret');

      expect(mockCrypto.encrypt).toHaveBeenCalledWith('newSecret');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'st1' },
        data: {
          passwordHash: 'newhash',
          viewablePassword: 'enc(newSecret)',
        },
      });
    });

    it('NO toca viewablePassword cuando user es TUTOR', async () => {
      mockJwt.decode.mockReturnValue({ sub: 'tut1', purpose: 'reset' });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'tut1',
        role: 'TUTOR',
        tutorId: null,
        passwordHash: 'oldhash',
      });
      mockPrisma.user.update.mockResolvedValue({ id: 'tut1' });

      await service.resetPassword('any-token', 'newSecret');

      expect(mockCrypto.encrypt).not.toHaveBeenCalled();
      const updateArg = mockPrisma.user.update.mock.calls[0][0];
      expect(updateArg.data).not.toHaveProperty('viewablePassword');
    });

    it('NO toca viewablePassword cuando user es STUDENT sin tutorId', async () => {
      mockJwt.decode.mockReturnValue({ sub: 's2', purpose: 'reset' });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 's2',
        role: 'STUDENT',
        tutorId: null,
        passwordHash: 'oldhash',
      });
      mockPrisma.user.update.mockResolvedValue({ id: 's2' });

      await service.resetPassword('any-token', 'newSecret');

      expect(mockCrypto.encrypt).not.toHaveBeenCalled();
      const updateArg = mockPrisma.user.update.mock.calls[0][0];
      expect(updateArg.data).not.toHaveProperty('viewablePassword');
    });

    it('NO toca viewablePassword cuando user es TEACHER', async () => {
      mockJwt.decode.mockReturnValue({ sub: 'tch1', purpose: 'reset' });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'tch1',
        role: 'TEACHER',
        tutorId: null,
        passwordHash: 'oldhash',
      });
      mockPrisma.user.update.mockResolvedValue({ id: 'tch1' });

      await service.resetPassword('any-token', 'newSecret');

      expect(mockCrypto.encrypt).not.toHaveBeenCalled();
      const updateArg = mockPrisma.user.update.mock.calls[0][0];
      expect(updateArg.data).not.toHaveProperty('viewablePassword');
    });
  });
});
