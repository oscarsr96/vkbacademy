import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildRetentionCohorts, RetentionCohort } from './retention';

const DEFAULT_WEEKS = 8;

/**
 * Retención por cohortes semanales. Vive fuera de `AdminAnalyticsService` a
 * propósito: aquel método ya hace nueve cosas y devuelve un payload grande.
 */
@Injectable()
export class AdminRetentionService {
  constructor(private readonly prisma: PrismaService) {}

  async getRetention(weeks = DEFAULT_WEEKS): Promise<{ cohorts: RetentionCohort[] }> {
    const since = new Date(Date.now() - weeks * 7 * 86_400_000);

    const students = await this.prisma.user.findMany({
      where: { role: Role.STUDENT, createdAt: { gte: since } },
      select: { id: true, createdAt: true },
    });
    if (students.length === 0) return { cohorts: [] };

    const activity = await this.prisma.userActivityDay.findMany({
      where: { userId: { in: students.map((s) => s.id) } },
      select: { userId: true, day: true, worked: true },
    });

    return { cohorts: buildRetentionCohorts(students, activity, new Date()) };
  }
}
