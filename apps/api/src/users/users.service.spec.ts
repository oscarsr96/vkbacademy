import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

jest.mock('bcrypt');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_USER = {
  id: 'user-1',
  email: 'alumno@vkb.com',
  name: 'Álvaro García',
  role: 'STUDENT' as const,
  avatarUrl: null,
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  schoolYearId: 'sy-1',
  passwordHash: '$2b$10$existingHash',
  schoolYear: { id: 'sy-1', name: '1eso', label: '1º ESO' },
};

const PROFILE_RESPONSE = {
  id: BASE_USER.id,
  email: BASE_USER.email,
  name: BASE_USER.name,
  role: BASE_USER.role,
  avatarUrl: BASE_USER.avatarUrl,
  createdAt: BASE_USER.createdAt,
  schoolYearId: BASE_USER.schoolYearId,
  schoolYear: BASE_USER.schoolYear,
};

// ---------------------------------------------------------------------------
// Mock de PrismaService
// ---------------------------------------------------------------------------

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

// ---------------------------------------------------------------------------
// Suite principal
// ---------------------------------------------------------------------------

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);

    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // getProfile
  // -------------------------------------------------------------------------

  describe('getProfile', () => {
    it('devuelve el perfil del usuario cuando existe', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(PROFILE_RESPONSE);

      const result = await service.getProfile('user-1');

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: expect.objectContaining({
          id: true,
          email: true,
          name: true,
          role: true,
          avatarUrl: true,
          createdAt: true,
          schoolYearId: true,
          schoolYear: expect.any(Object),
        }),
      });
      expect(result).toEqual(PROFILE_RESPONSE);
    });

    it('lanza NotFoundException cuando el usuario no existe', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('inexistente')).rejects.toThrow(
        new NotFoundException('Usuario no encontrado'),
      );
    });
  });

  // -------------------------------------------------------------------------
  // updateProfile
  // -------------------------------------------------------------------------

  describe('updateProfile', () => {
    it('lanza NotFoundException cuando el usuario no existe', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const dto: UpdateProfileDto = { name: 'Nuevo Nombre' };

      await expect(service.updateProfile('inexistente', dto)).rejects.toThrow(
        new NotFoundException('Usuario no encontrado'),
      );
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('lanza BadRequestException cuando el email nuevo ya está en uso por otro usuario', async () => {
      // Primera llamada: usuario actual encontrado
      mockPrisma.user.findUnique.mockResolvedValueOnce(BASE_USER);
      // Segunda llamada: el nuevo email ya existe en BD
      mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'user-2', email: 'otro@vkb.com' });

      const dto: UpdateProfileDto = { email: 'otro@vkb.com' };

      await expect(service.updateProfile('user-1', dto)).rejects.toThrow(
        new BadRequestException('El email ya está en uso'),
      );
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('actualiza el nombre correctamente', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(BASE_USER);
      const updatedProfile = { ...PROFILE_RESPONSE, name: 'Nuevo Nombre' };
      mockPrisma.user.update.mockResolvedValue(updatedProfile);

      const dto: UpdateProfileDto = { name: 'Nuevo Nombre' };
      const result = await service.updateProfile('user-1', dto);

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: { name: 'Nuevo Nombre' },
        }),
      );
      expect(result.name).toBe('Nuevo Nombre');
    });

    it('actualiza el email al mismo valor del usuario sin verificar duplicados', async () => {
      // El email del DTO es idéntico al actual → no debe hacer la segunda consulta
      mockPrisma.user.findUnique.mockResolvedValue(BASE_USER);
      mockPrisma.user.update.mockResolvedValue(PROFILE_RESPONSE);

      const dto: UpdateProfileDto = { email: BASE_USER.email };
      await service.updateProfile('user-1', dto);

      // Solo se llama a findUnique una vez (para obtener el usuario)
      expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(1);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { email: BASE_USER.email },
        }),
      );
    });

    it('hashea la contraseña con bcrypt antes de guardarla', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(BASE_USER);
      mockPrisma.user.update.mockResolvedValue(PROFILE_RESPONSE);
      (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$10$hashed');

      const dto: UpdateProfileDto = { password: 'nuevaPass123' };
      await service.updateProfile('user-1', dto);

      expect(bcrypt.hash).toHaveBeenCalledWith('nuevaPass123', 10);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { passwordHash: '$2b$10$hashed' },
        }),
      );
    });

    it('no incluye passwordHash en la respuesta devuelta al cliente', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(BASE_USER);
      // Simulamos que Prisma devuelve únicamente los campos del select (sin passwordHash)
      mockPrisma.user.update.mockResolvedValue(PROFILE_RESPONSE);
      (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$10$hashed');

      const dto: UpdateProfileDto = { password: 'nuevaPass123' };
      const result = await service.updateProfile('user-1', dto);

      expect(result).not.toHaveProperty('passwordHash');
      // El select de Prisma es la garantía real; comprobamos que se pasa correctamente
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            id: true,
            email: true,
            name: true,
            role: true,
          }),
        }),
      );
    });
  });
});
