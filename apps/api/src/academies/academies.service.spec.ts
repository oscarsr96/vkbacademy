import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AcademiesService } from './academies.service';
import { PrismaService } from '../prisma/prisma.service';

// Mockear bcrypt para evitar el coste de rondas reales en los tests
jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('AcademiesService', () => {
  let service: AcademiesService;
  let mockPrisma: {
    academy: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    academyMember: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      delete: jest.Mock;
    };
    user: {
      findUnique: jest.Mock;
    };
  };
  let mockConfig: { get: jest.Mock };

  // Academia de ejemplo con todos los campos necesarios
  const fakeAcademy = {
    id: 'academy-uuid-1',
    slug: 'vallekas-basket',
    name: 'Vallekas Basket Academy',
    logoUrl: 'https://example.com/logo.png',
    primaryColor: '#6366f1',
    domain: 'vallekas-basket.academy.vercel.app',
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    _count: { members: 3 },
  };

  const fakeAcademyNoDomain = {
    ...fakeAcademy,
    domain: null,
  };

  beforeEach(async () => {
    mockPrisma = {
      academy: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      academyMember: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
    };

    // Sin tokens de Vercel configurados → registerVercelDomain retorna sin hacer fetch
    mockConfig = { get: jest.fn().mockReturnValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AcademiesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<AcademiesService>(AcademiesService);
    jest.clearAllMocks();

    // Valor por defecto: bcrypt.hash devuelve un hash ficticio
    mockedBcrypt.hash.mockResolvedValue('$2b$10$hashed' as never);
  });

  // ─── findAll ─────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('devuelve lista de academias con _count.members', async () => {
      mockPrisma.academy.findMany.mockResolvedValue([fakeAcademy]);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(fakeAcademy.id);
      expect(result[0]._count.members).toBe(3);
      expect(mockPrisma.academy.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'asc' },
          include: { _count: { select: { members: true } } },
        }),
      );
    });

    it('devuelve array vacío si no hay academias', async () => {
      mockPrisma.academy.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  // ─── findPublic ──────────────────────────────────────────────────────────────

  describe('findPublic', () => {
    it('devuelve solo academias activas con campos públicos', async () => {
      const publicAcademy = {
        id: fakeAcademy.id,
        slug: fakeAcademy.slug,
        name: fakeAcademy.name,
        logoUrl: fakeAcademy.logoUrl,
        primaryColor: fakeAcademy.primaryColor,
      };
      mockPrisma.academy.findMany.mockResolvedValue([publicAcademy]);

      const result = await service.findPublic();

      expect(result).toHaveLength(1);
      expect(mockPrisma.academy.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
          orderBy: { name: 'asc' },
        }),
      );
    });

    it('devuelve array vacío si no hay academias activas', async () => {
      mockPrisma.academy.findMany.mockResolvedValue([]);

      const result = await service.findPublic();

      expect(result).toEqual([]);
    });
  });

  // ─── findByDomain ─────────────────────────────────────────────────────────────

  describe('findByDomain', () => {
    it('devuelve academia activa que coincide con el dominio', async () => {
      const publicAcademy = {
        id: fakeAcademy.id,
        slug: fakeAcademy.slug,
        name: fakeAcademy.name,
        logoUrl: fakeAcademy.logoUrl,
        primaryColor: fakeAcademy.primaryColor,
        isActive: true,
      };
      mockPrisma.academy.findFirst.mockResolvedValue(publicAcademy);

      const result = await service.findByDomain('vallekas-basket.academy.vercel.app');

      expect(result.id).toBe(fakeAcademy.id);
      expect(mockPrisma.academy.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { domain: 'vallekas-basket.academy.vercel.app', isActive: true },
        }),
      );
    });

    it('lanza NotFoundException si no existe academia para ese dominio', async () => {
      mockPrisma.academy.findFirst.mockResolvedValue(null);

      await expect(
        service.findByDomain('dominio-inexistente.com'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── findBySlug ───────────────────────────────────────────────────────────────

  describe('findBySlug', () => {
    it('devuelve academia que coincide con el slug', async () => {
      const publicAcademy = {
        id: fakeAcademy.id,
        slug: fakeAcademy.slug,
        name: fakeAcademy.name,
        logoUrl: fakeAcademy.logoUrl,
        primaryColor: fakeAcademy.primaryColor,
        isActive: true,
      };
      mockPrisma.academy.findUnique.mockResolvedValue(publicAcademy);

      const result = await service.findBySlug('vallekas-basket');

      expect(result.slug).toBe('vallekas-basket');
      expect(mockPrisma.academy.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { slug: 'vallekas-basket' } }),
      );
    });

    it('lanza NotFoundException si no existe academia con ese slug', async () => {
      mockPrisma.academy.findUnique.mockResolvedValue(null);

      await expect(service.findBySlug('slug-inexistente')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── findById ─────────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('devuelve academia con _count.members por id', async () => {
      mockPrisma.academy.findUnique.mockResolvedValue(fakeAcademy);

      const result = await service.findById('academy-uuid-1');

      expect(result.id).toBe('academy-uuid-1');
      expect(result._count.members).toBe(3);
      expect(mockPrisma.academy.findUnique).toHaveBeenCalledWith({
        where: { id: 'academy-uuid-1' },
        include: { _count: { select: { members: true } } },
      });
    });

    it('lanza NotFoundException si no existe academia con ese id', async () => {
      mockPrisma.academy.findUnique.mockResolvedValue(null);

      await expect(service.findById('id-inexistente')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── create ───────────────────────────────────────────────────────────────────

  describe('create', () => {
    const createDto = {
      name: 'Nueva Academia',
      slug: 'nueva-academia',
      logoUrl: undefined,
      primaryColor: '#6366f1',
      domain: undefined as string | undefined,
    };

    it('lanza ConflictException si ya existe una academia con ese slug', async () => {
      mockPrisma.academy.findUnique.mockResolvedValue(fakeAcademy);

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
      expect(mockPrisma.academy.create).not.toHaveBeenCalled();
    });

    it('genera el dominio automáticamente si no se proporciona', async () => {
      mockPrisma.academy.findUnique.mockResolvedValue(null);
      mockPrisma.academy.create.mockResolvedValue({
        ...fakeAcademy,
        slug: 'nueva-academia',
        domain: 'nuevaacademiaacademy.vercel.app',
      });

      await service.create({ ...createDto, domain: undefined });

      const createCall = mockPrisma.academy.create.mock.calls[0][0];
      // El dominio generado elimina guiones del slug y añade "academy.vercel.app"
      expect(createCall.data.domain).toBe('nuevaacademiaacademy.vercel.app');
    });

    it('usa el domain explícito si se proporciona', async () => {
      mockPrisma.academy.findUnique.mockResolvedValue(null);
      mockPrisma.academy.create.mockResolvedValue({
        ...fakeAcademy,
        domain: 'mi-dominio-personalizado.com',
      });

      await service.create({ ...createDto, domain: 'mi-dominio-personalizado.com' });

      const createCall = mockPrisma.academy.create.mock.calls[0][0];
      expect(createCall.data.domain).toBe('mi-dominio-personalizado.com');
    });

    it('crea la academia con 3 usuarios por defecto (admin, tutor, student)', async () => {
      mockPrisma.academy.findUnique.mockResolvedValue(null);
      mockPrisma.academy.create.mockResolvedValue(fakeAcademy);

      await service.create(createDto);

      const createCall = mockPrisma.academy.create.mock.calls[0][0];
      const members = createCall.data.members.create as Array<{ user: { create: { role: string } } }>;
      expect(members).toHaveLength(3);
      const roles = members.map((m) => m.user.create.role);
      expect(roles).toContain('ADMIN');
      expect(roles).toContain('TUTOR');
      expect(roles).toContain('STUDENT');
    });

    it('no usa "password123" como contraseña de los usuarios por defecto', async () => {
      mockPrisma.academy.findUnique.mockResolvedValue(null);
      mockPrisma.academy.create.mockResolvedValue(fakeAcademy);

      await service.create(createDto);

      // bcrypt.hash nunca debe recibir la cadena literal "password123"
      const hashCalls = mockedBcrypt.hash.mock.calls;
      for (const [plaintext] of hashCalls) {
        expect(plaintext).not.toBe('password123');
      }
    });

    it('la contraseña temporal es aleatoria y no predecible', async () => {
      mockPrisma.academy.findUnique.mockResolvedValue(null);
      mockPrisma.academy.create.mockResolvedValue(fakeAcademy);

      // Llamar a create dos veces y verificar que bcrypt.hash recibió contraseñas distintas
      await service.create(createDto);
      const firstCall = mockedBcrypt.hash.mock.calls[0][0] as string;

      jest.clearAllMocks();
      mockedBcrypt.hash.mockResolvedValue('$2b$10$hashed' as never);
      mockPrisma.academy.findUnique.mockResolvedValue(null);
      mockPrisma.academy.create.mockResolvedValue(fakeAcademy);

      await service.create(createDto);
      const secondCall = mockedBcrypt.hash.mock.calls[0][0] as string;

      // Dos invocaciones distintas deben generar contraseñas distintas (randomBytes)
      expect(firstCall).not.toBe(secondCall);
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('actualiza los campos de la academia correctamente', async () => {
      mockPrisma.academy.findUnique.mockResolvedValue(fakeAcademy);
      const updated = { ...fakeAcademy, name: 'Nuevo Nombre' };
      mockPrisma.academy.update.mockResolvedValue(updated);

      const result = await service.update('academy-uuid-1', { name: 'Nuevo Nombre' });

      expect(result.name).toBe('Nuevo Nombre');
      expect(mockPrisma.academy.update).toHaveBeenCalledWith({
        where: { id: 'academy-uuid-1' },
        data: { name: 'Nuevo Nombre' },
      });
    });

    it('llama a registerVercelDomain y removeVercelDomain cuando el dominio cambia', async () => {
      mockPrisma.academy.findUnique.mockResolvedValue(fakeAcademy);
      mockPrisma.academy.update.mockResolvedValue({
        ...fakeAcademy,
        domain: 'nuevo-dominio.com',
      });

      const registerSpy = jest
        .spyOn(service as any, 'registerVercelDomain')
        .mockResolvedValue(undefined);
      const removeSpy = jest
        .spyOn(service as any, 'removeVercelDomain')
        .mockResolvedValue(undefined);

      await service.update('academy-uuid-1', { domain: 'nuevo-dominio.com' });

      expect(registerSpy).toHaveBeenCalledWith('nuevo-dominio.com');
      expect(removeSpy).toHaveBeenCalledWith(fakeAcademy.domain);
    });

    it('no llama a registerVercelDomain si el dominio no cambió', async () => {
      // dto.domain no está presente → no hay cambio de dominio
      mockPrisma.academy.findUnique.mockResolvedValue(fakeAcademy);
      mockPrisma.academy.update.mockResolvedValue(fakeAcademy);

      const registerSpy = jest
        .spyOn(service as any, 'registerVercelDomain')
        .mockResolvedValue(undefined);

      await service.update('academy-uuid-1', { name: 'Solo cambio de nombre' });

      expect(registerSpy).not.toHaveBeenCalled();
    });
  });

  // ─── delete ───────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('elimina la academia existente', async () => {
      mockPrisma.academy.findUnique.mockResolvedValue(fakeAcademy);
      mockPrisma.academy.delete.mockResolvedValue(fakeAcademy);

      await service.delete('academy-uuid-1');

      expect(mockPrisma.academy.delete).toHaveBeenCalledWith({
        where: { id: 'academy-uuid-1' },
      });
    });

    it('lanza NotFoundException si la academia no existe', async () => {
      mockPrisma.academy.findUnique.mockResolvedValue(null);

      await expect(service.delete('id-inexistente')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.academy.delete).not.toHaveBeenCalled();
    });

    it('devuelve mensaje de confirmación con el nombre de la academia', async () => {
      mockPrisma.academy.findUnique.mockResolvedValue(fakeAcademy);
      mockPrisma.academy.delete.mockResolvedValue(fakeAcademy);

      const result = await service.delete('academy-uuid-1');

      expect(result.message).toContain('Vallekas Basket Academy');
      expect(result.message).toContain('eliminada');
    });
  });

  // ─── getMembers ───────────────────────────────────────────────────────────────

  describe('getMembers', () => {
    it('devuelve los miembros de la academia con datos del usuario', async () => {
      const fakeMembers = [
        {
          id: 'member-uuid-1',
          academyId: 'academy-uuid-1',
          userId: 'user-uuid-1',
          createdAt: new Date(),
          user: { id: 'user-uuid-1', name: 'Admin Test', email: 'admin@test.academy', role: 'ADMIN', avatarUrl: null, createdAt: new Date() },
        },
      ];
      mockPrisma.academyMember.findMany.mockResolvedValue(fakeMembers);

      const result = await service.getMembers('academy-uuid-1');

      expect(result).toHaveLength(1);
      expect(result[0].user.role).toBe('ADMIN');
      expect(mockPrisma.academyMember.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { academyId: 'academy-uuid-1' },
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });

  // ─── addMember ────────────────────────────────────────────────────────────────

  describe('addMember', () => {
    const fakeUser = {
      id: 'user-uuid-2',
      email: 'nuevo@vkbacademy.es',
      name: 'Nuevo Usuario',
      role: 'STUDENT',
      passwordHash: '$2b$10$hashed',
    };

    it('lanza NotFoundException si el usuario no existe', async () => {
      // findById necesita academy.findUnique
      mockPrisma.academy.findUnique.mockResolvedValue(fakeAcademy);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.addMember('academy-uuid-1', 'user-inexistente'),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.academyMember.create).not.toHaveBeenCalled();
    });

    it('lanza ConflictException si el usuario ya es miembro de la academia', async () => {
      mockPrisma.academy.findUnique.mockResolvedValue(fakeAcademy);
      mockPrisma.user.findUnique.mockResolvedValue(fakeUser);
      mockPrisma.academyMember.findUnique.mockResolvedValue({
        id: 'member-uuid-1',
        userId: fakeUser.id,
        academyId: 'academy-uuid-1',
      });

      await expect(
        service.addMember('academy-uuid-1', fakeUser.id),
      ).rejects.toThrow(ConflictException);
      expect(mockPrisma.academyMember.create).not.toHaveBeenCalled();
    });

    it('añade el miembro correctamente si no existía la membresía', async () => {
      mockPrisma.academy.findUnique.mockResolvedValue(fakeAcademy);
      mockPrisma.user.findUnique.mockResolvedValue(fakeUser);
      mockPrisma.academyMember.findUnique.mockResolvedValue(null);
      const newMember = {
        id: 'member-uuid-nuevo',
        userId: fakeUser.id,
        academyId: 'academy-uuid-1',
        user: { id: fakeUser.id, name: fakeUser.name, email: fakeUser.email, role: fakeUser.role },
      };
      mockPrisma.academyMember.create.mockResolvedValue(newMember);

      const result = await service.addMember('academy-uuid-1', fakeUser.id);

      expect(mockPrisma.academyMember.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { userId: fakeUser.id, academyId: 'academy-uuid-1' },
        }),
      );
      expect(result.user.email).toBe(fakeUser.email);
    });
  });

  // ─── removeMember ─────────────────────────────────────────────────────────────

  describe('removeMember', () => {
    it('lanza NotFoundException si la membresía no existe', async () => {
      mockPrisma.academyMember.findUnique.mockResolvedValue(null);

      await expect(
        service.removeMember('academy-uuid-1', 'user-inexistente'),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.academyMember.delete).not.toHaveBeenCalled();
    });

    it('elimina la membresía existente y devuelve mensaje de confirmación', async () => {
      const fakeMembership = {
        id: 'member-uuid-1',
        userId: 'user-uuid-1',
        academyId: 'academy-uuid-1',
      };
      mockPrisma.academyMember.findUnique.mockResolvedValue(fakeMembership);
      mockPrisma.academyMember.delete.mockResolvedValue(fakeMembership);

      const result = await service.removeMember('academy-uuid-1', 'user-uuid-1');

      expect(mockPrisma.academyMember.delete).toHaveBeenCalledWith({
        where: { id: 'member-uuid-1' },
      });
      expect(result.message).toContain('eliminado');
    });
  });
});
