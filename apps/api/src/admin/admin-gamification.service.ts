import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ChallengeCadence, ChallengeType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isWeeklyCapable } from '../challenges/challenge-periods';
import { CreateChallengeDto } from './dto/create-challenge.dto';
import { UpdateChallengeDto } from './dto/update-challenge.dto';

@Injectable()
export class AdminGamificationService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Canjes ───────────────────────────────────────────────────────────────

  async listRedemptions(academyId?: string | null, params?: { page?: number; limit?: number }) {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const skip = (page - 1) * limit;
    const where: Prisma.RedemptionWhereInput = academyId ? { academyId } : {};

    const [items, total, sumAgg, pendingCount, distinctStudents] = await Promise.all([
      this.prisma.redemption.findMany({
        where,
        skip,
        take: limit,
        orderBy: { redeemedAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
      }),
      this.prisma.redemption.count({ where }),
      this.prisma.redemption.aggregate({ where, _sum: { cost: true } }),
      this.prisma.redemption.count({ where: { ...where, delivered: false } }),
      this.prisma.redemption.groupBy({ by: ['userId'], where }),
    ]);

    return {
      data: items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      stats: {
        totalPointsSpent: sumAgg._sum.cost ?? 0,
        pendingCount,
        distinctStudents: distinctStudents.length,
      },
    };
  }

  async markRedemptionDelivered(id: string) {
    const redemption = await this.prisma.redemption.findUnique({ where: { id } });
    if (!redemption) throw new NotFoundException('Canje no encontrado');
    return this.prisma.redemption.update({
      where: { id },
      data: { delivered: true, deliveredAt: new Date() },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    });
  }

  // ─── Retos ────────────────────────────────────────────────────────────────

  async listChallenges(params?: { page?: number; limit?: number }) {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const skip = (page - 1) * limit;

    const [items, total, activeCount] = await Promise.all([
      this.prisma.challenge.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
        include: {
          _count: { select: { userChallenges: { where: { completed: true } } } },
        },
      }),
      this.prisma.challenge.count(),
      this.prisma.challenge.count({ where: { isActive: true } }),
    ]);

    return {
      data: items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      stats: { activeCount },
    };
  }

  /**
   * Los retos de estado (máximos, rachas, variedad acumulada) no admiten
   * cadencia semanal: reiniciarlos cada lunes no significa nada.
   */
  private assertCadence(type: ChallengeType, cadence: ChallengeCadence): void {
    if (cadence === ChallengeCadence.WEEKLY && !isWeeklyCapable(type)) {
      throw new BadRequestException(
        `El tipo ${type} no admite cadencia semanal: mide un estado acumulado, no una cantidad por periodo.`,
      );
    }
  }

  async createChallenge(dto: CreateChallengeDto) {
    const cadence = dto.cadence ?? ChallengeCadence.PERMANENT;
    this.assertCadence(dto.type, cadence);
    return this.prisma.challenge.create({ data: { ...dto, cadence } });
  }

  async updateChallenge(id: string, dto: UpdateChallengeDto) {
    const challenge = await this.prisma.challenge.findUnique({ where: { id } });
    if (!challenge) throw new NotFoundException('Reto no encontrado');
    this.assertCadence(dto.type ?? challenge.type, dto.cadence ?? challenge.cadence);
    await this.assertCadenceChangeAllowed(id, challenge.cadence, dto.cadence);
    return this.prisma.challenge.update({ where: { id }, data: dto });
  }

  /**
   * Cambiar la cadencia de un reto que ya han jugado alumnos vuelve a pagarlo:
   * las filas del periodo antiguo (`ALL` de un PERMANENT, o la semana de un
   * WEEKLY) quedan huérfanas, el motor crea la fila del periodo nuevo y todos
   * los que ya lo tenían completado cobran otra vez — y de PERMANENT a WEEKLY,
   * además, cada semana. No se borra progreso de alumnos: se bloquea el cambio.
   */
  private async assertCadenceChangeAllowed(
    id: string,
    current: ChallengeCadence,
    next?: ChallengeCadence,
  ): Promise<void> {
    if (!next || next === current) return;

    const played = await this.prisma.userChallenge.count({ where: { challengeId: id } });
    if (played === 0) return;

    throw new ConflictException(
      `No se puede cambiar la cadencia de "${current}" a "${next}": ${played} alumno(s) ya tienen ` +
        `progreso en este reto y el cambio les volvería a pagar los puntos. ` +
        `Crea un reto nuevo con la cadencia que quieras y desactiva este.`,
    );
  }

  async deleteChallenge(id: string) {
    const challenge = await this.prisma.challenge.findUnique({ where: { id } });
    if (!challenge) throw new NotFoundException('Reto no encontrado');
    await this.prisma.challenge.delete({ where: { id } });
    return { message: 'Reto eliminado correctamente' };
  }

  async toggleChallenge(id: string) {
    const challenge = await this.prisma.challenge.findUnique({ where: { id } });
    if (!challenge) throw new NotFoundException('Reto no encontrado');
    return this.prisma.challenge.update({
      where: { id },
      data: { isActive: !challenge.isActive },
    });
  }
}
