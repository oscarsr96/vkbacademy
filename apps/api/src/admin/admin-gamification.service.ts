import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
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

  async createChallenge(dto: CreateChallengeDto) {
    return this.prisma.challenge.create({ data: dto });
  }

  async updateChallenge(id: string, dto: UpdateChallengeDto) {
    const challenge = await this.prisma.challenge.findUnique({ where: { id } });
    if (!challenge) throw new NotFoundException('Reto no encontrado');
    return this.prisma.challenge.update({ where: { id }, data: dto });
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
