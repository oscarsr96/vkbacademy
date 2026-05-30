import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SchoolYearsService } from './school-years.service';
import { PrismaService } from '../prisma/prisma.service';

// ─── Mock manual de PrismaService ────────────────────────────────────────────

const mockPrisma = {
  schoolYear: {
    findMany: jest.fn(),
    upsert: jest.fn(),
  },
};

// ─── Suite principal ──────────────────────────────────────────────────────────

describe('SchoolYearsService', () => {
  let service: SchoolYearsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SchoolYearsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<SchoolYearsService>(SchoolYearsService);

    jest.clearAllMocks();
  });

  // ─── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('devuelve la lista de niveles educativos ordenada por nombre', async () => {
      const expected = [
        { id: '1', name: '1bach', label: '1º Bach' },
        { id: '2', name: '1eso', label: '1º ESO' },
        { id: '3', name: '2bach', label: '2º Bach' },
        { id: '4', name: '2eso', label: '2º ESO' },
      ];
      mockPrisma.schoolYear.findMany.mockResolvedValue(expected);

      const result = await service.findAll();

      expect(mockPrisma.schoolYear.findMany).toHaveBeenCalledWith({
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual(expected);
    });

    it('devuelve array vacío cuando no hay niveles educativos registrados', async () => {
      mockPrisma.schoolYear.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(mockPrisma.schoolYear.findMany).toHaveBeenCalledTimes(1);
      expect(result).toEqual([]);
    });
  });

  // ─── onApplicationBootstrap (ensure de niveles por defecto) ──────────────────

  describe('onApplicationBootstrap', () => {
    it('hace upsert idempotente de los 6 niveles educativos por defecto', async () => {
      mockPrisma.schoolYear.upsert.mockResolvedValue({});

      await service.onApplicationBootstrap();

      // Un upsert por cada nivel: 1º ESO … 2º Bachillerato
      expect(mockPrisma.schoolYear.upsert).toHaveBeenCalledTimes(6);

      const names = mockPrisma.schoolYear.upsert.mock.calls.map(
        ([arg]) => (arg as { where: { name: string } }).where.name,
      );
      expect(names).toEqual(['1eso', '2eso', '3eso', '4eso', '1bach', '2bach']);

      // Cada llamada usa `where` por el campo único `name` y no borra nada
      for (const [arg] of mockPrisma.schoolYear.upsert.mock.calls) {
        const call = arg as {
          where: { name: string };
          create: { name: string; label: string };
          update: Record<string, unknown>;
        };
        expect(call.where).toHaveProperty('name');
        expect(call.create).toHaveProperty('label');
      }
    });

    it('no relanza si un upsert falla (no debe tumbar el arranque)', async () => {
      mockPrisma.schoolYear.upsert.mockRejectedValue(new Error('DB caída'));
      // Silenciamos el log de error esperado para no ensuciar la salida de tests
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
      expect(errorSpy).toHaveBeenCalledTimes(1);

      errorSpy.mockRestore();
    });
  });
});
