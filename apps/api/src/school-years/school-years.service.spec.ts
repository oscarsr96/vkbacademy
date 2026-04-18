import { Test, TestingModule } from '@nestjs/testing';
import { SchoolYearsService } from './school-years.service';
import { PrismaService } from '../prisma/prisma.service';

// ─── Mock manual de PrismaService ────────────────────────────────────────────

const mockPrisma = {
  schoolYear: {
    findMany: jest.fn(),
  },
};

// ─── Suite principal ──────────────────────────────────────────────────────────

describe('SchoolYearsService', () => {
  let service: SchoolYearsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchoolYearsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
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
});
