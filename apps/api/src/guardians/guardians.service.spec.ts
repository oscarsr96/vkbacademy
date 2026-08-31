import { Test, TestingModule } from '@nestjs/testing';
import { GuardiansService } from './guardians.service';
import { PrismaService } from '../prisma/prisma.service';

describe('GuardiansService', () => {
  let service: GuardiansService;
  let mockPrisma: { guardianSubscription: { updateMany: jest.Mock } };

  beforeEach(async () => {
    mockPrisma = { guardianSubscription: { updateMany: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [GuardiansService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get(GuardiansService);
    jest.clearAllMocks();
    mockPrisma.guardianSubscription.updateMany.mockResolvedValue({ count: 1 });
  });

  describe('unsubscribe', () => {
    it('marca la baja con la fecha actual', async () => {
      await service.unsubscribe('tok');

      const args = mockPrisma.guardianSubscription.updateMany.mock.calls[0][0];
      expect(args.where.token).toBe('tok');
      expect(args.data.unsubscribedAt).toBeInstanceOf(Date);
    });

    it('no pisa la fecha de una baja anterior', async () => {
      await service.unsubscribe('tok');

      // Darse de baja dos veces no puede parecer una baja nueva.
      const args = mockPrisma.guardianSubscription.updateMany.mock.calls[0][0];
      expect(args.where.unsubscribedAt).toBeNull();
    });

    it('responde igual con un token que no existe', async () => {
      mockPrisma.guardianSubscription.updateMany.mockResolvedValue({ count: 0 });

      // El endpoint es público: decir "ese token no existe" lo convertiría en un
      // oráculo de qué tokens son válidos.
      await expect(service.unsubscribe('inventado')).resolves.toEqual({ ok: true });
    });

    it('es idempotente: dos llamadas responden lo mismo', async () => {
      const primera = await service.unsubscribe('tok');
      mockPrisma.guardianSubscription.updateMany.mockResolvedValue({ count: 0 });
      const segunda = await service.unsubscribe('tok');

      expect(primera).toEqual(segunda);
    });
  });
});
