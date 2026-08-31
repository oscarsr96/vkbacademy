import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { AdminRetentionService } from './admin-retention.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AdminRetentionService', () => {
  let service: AdminRetentionService;
  let mockPrisma: {
    user: { findMany: jest.Mock };
    userActivityDay: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    mockPrisma = {
      user: { findMany: jest.fn() },
      userActivityDay: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminRetentionService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get(AdminRetentionService);
    jest.clearAllMocks();
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.userActivityDay.findMany.mockResolvedValue([]);
  });

  it('solo mira a los alumnos', async () => {
    await service.getRetention();

    // Un admin entrando a diario inflaría las cohortes sin significar nada.
    const args = mockPrisma.user.findMany.mock.calls[0][0];
    expect(args.where.role).toBe(Role.STUDENT);
  });

  it('limita la ventana a las semanas pedidas', async () => {
    await service.getRetention(4);

    const args = mockPrisma.user.findMany.mock.calls[0][0];
    const desde = args.where.createdAt.gte as Date;
    const dias = (Date.now() - desde.getTime()) / 86_400_000;
    expect(Math.round(dias)).toBe(28);
  });

  it('devuelve las cohortes calculadas', async () => {
    const hace10dias = new Date(Date.now() - 10 * 86_400_000);
    mockPrisma.user.findMany.mockResolvedValue([{ id: 'a', createdAt: hace10dias }]);

    const result = await service.getRetention();

    expect(result.cohorts).toHaveLength(1);
    expect(result.cohorts[0].signups).toBe(1);
  });

  it('pide la actividad solo de los alumnos de la ventana', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'a', createdAt: new Date() },
      { id: 'b', createdAt: new Date() },
    ]);

    await service.getRetention();

    const args = mockPrisma.userActivityDay.findMany.mock.calls[0][0];
    expect(args.where.userId.in).toEqual(['a', 'b']);
  });

  it('no consulta la actividad si no hay alumnos en la ventana', async () => {
    await service.getRetention();

    expect(mockPrisma.userActivityDay.findMany).not.toHaveBeenCalled();
  });
});
