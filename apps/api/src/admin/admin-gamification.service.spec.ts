import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ChallengeCadence, ChallengeType } from '@prisma/client';
import { AdminGamificationService } from './admin-gamification.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AdminGamificationService — cadencia', () => {
  let service: AdminGamificationService;
  const mockPrisma = {
    challenge: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [AdminGamificationService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = moduleRef.get(AdminGamificationService);
    jest.clearAllMocks();
  });

  it('rechaza WEEKLY en un tipo de estado', async () => {
    await expect(
      service.createChallenge({
        title: 'Racha imposible',
        description: 'No debería poder crearse',
        type: ChallengeType.STREAK_DAILY,
        cadence: ChallengeCadence.WEEKLY,
        target: 5,
        points: 10,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(mockPrisma.challenge.create).not.toHaveBeenCalled();
  });

  it('acepta WEEKLY en un tipo contable', async () => {
    mockPrisma.challenge.create.mockResolvedValue({ id: 'c1' });

    await service.createChallenge({
      title: 'Semana intensa',
      description: 'Resuelve 20 ejercicios esta semana',
      type: ChallengeType.EXERCISES_SOLVED,
      cadence: ChallengeCadence.WEEKLY,
      target: 20,
      points: 15,
    });

    expect(mockPrisma.challenge.create).toHaveBeenCalled();
  });

  it('rechaza cambiar a WEEKLY un reto de tipo de estado al editarlo', async () => {
    mockPrisma.challenge.findUnique.mockResolvedValue({
      id: 'c1',
      type: ChallengeType.EXAM_SCORE,
      cadence: ChallengeCadence.PERMANENT,
    });

    await expect(
      service.updateChallenge('c1', { cadence: ChallengeCadence.WEEKLY }),
    ).rejects.toThrow(BadRequestException);
  });
});
