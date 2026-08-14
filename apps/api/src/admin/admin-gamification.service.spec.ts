import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ChallengeCadence, ChallengeType } from '@prisma/client';
import { AdminGamificationService } from './admin-gamification.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AdminGamificationService — cadencia', () => {
  let service: AdminGamificationService;
  const mockPrisma = {
    challenge: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    userChallenge: { count: jest.fn() },
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

  it('rechaza cambiar el tipo a estado en un reto que ya tiene cadencia WEEKLY', async () => {
    mockPrisma.challenge.findUnique.mockResolvedValue({
      id: 'c1',
      type: ChallengeType.EXERCISES_SOLVED,
      cadence: ChallengeCadence.WEEKLY,
    });

    await expect(
      service.updateChallenge('c1', { type: ChallengeType.STREAK_DAILY }),
    ).rejects.toThrow(BadRequestException);
    expect(mockPrisma.challenge.update).not.toHaveBeenCalled();
  });

  // ── I3: cambiar la cadencia de un reto ya jugado vuelve a pagarlo ──────────

  it('rechaza cambiar la cadencia si ya hay alumnos con progreso en el reto', async () => {
    mockPrisma.challenge.findUnique.mockResolvedValue({
      id: 'c1',
      type: ChallengeType.EXERCISES_SOLVED,
      cadence: ChallengeCadence.PERMANENT,
    });
    mockPrisma.userChallenge.count.mockResolvedValue(37);

    await expect(
      service.updateChallenge('c1', { cadence: ChallengeCadence.WEEKLY }),
    ).rejects.toThrow(ConflictException);
    expect(mockPrisma.userChallenge.count).toHaveBeenCalledWith({ where: { challengeId: 'c1' } });
    expect(mockPrisma.challenge.update).not.toHaveBeenCalled();
  });

  it('el mensaje explica el porqué y la alternativa (crear otro reto y desactivar este)', async () => {
    mockPrisma.challenge.findUnique.mockResolvedValue({
      id: 'c1',
      type: ChallengeType.EXERCISES_SOLVED,
      cadence: ChallengeCadence.WEEKLY,
    });
    mockPrisma.userChallenge.count.mockResolvedValue(4);

    await expect(
      service.updateChallenge('c1', { cadence: ChallengeCadence.PERMANENT }),
    ).rejects.toThrow(/Crea un reto nuevo con la cadencia que quieras y desactiva este/);
  });

  it('permite cambiar la cadencia si nadie ha jugado todavía el reto', async () => {
    mockPrisma.challenge.findUnique.mockResolvedValue({
      id: 'c1',
      type: ChallengeType.EXERCISES_SOLVED,
      cadence: ChallengeCadence.PERMANENT,
    });
    mockPrisma.userChallenge.count.mockResolvedValue(0);
    mockPrisma.challenge.update.mockResolvedValue({ id: 'c1' });

    await service.updateChallenge('c1', { cadence: ChallengeCadence.WEEKLY });

    expect(mockPrisma.challenge.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { cadence: ChallengeCadence.WEEKLY },
    });
  });

  it('editar otros campos de un reto ya jugado sigue permitido (no se consulta el progreso)', async () => {
    mockPrisma.challenge.findUnique.mockResolvedValue({
      id: 'c1',
      type: ChallengeType.EXERCISES_SOLVED,
      cadence: ChallengeCadence.WEEKLY,
    });
    mockPrisma.challenge.update.mockResolvedValue({ id: 'c1' });

    await service.updateChallenge('c1', { title: 'Semana intensa (renombrado)' });

    expect(mockPrisma.userChallenge.count).not.toHaveBeenCalled();
    expect(mockPrisma.challenge.update).toHaveBeenCalled();
  });

  it('reenviar la MISMA cadencia en el PATCH no se considera un cambio', async () => {
    mockPrisma.challenge.findUnique.mockResolvedValue({
      id: 'c1',
      type: ChallengeType.EXERCISES_SOLVED,
      cadence: ChallengeCadence.WEEKLY,
    });
    mockPrisma.challenge.update.mockResolvedValue({ id: 'c1' });

    await service.updateChallenge('c1', { cadence: ChallengeCadence.WEEKLY, points: 20 });

    expect(mockPrisma.userChallenge.count).not.toHaveBeenCalled();
    expect(mockPrisma.challenge.update).toHaveBeenCalled();
  });
});
