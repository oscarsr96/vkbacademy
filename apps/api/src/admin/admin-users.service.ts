import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { AiUsageCategory, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import * as bcrypt from 'bcrypt';

/** Coste de IA de un usuario, en dólares, tal y como lo consume el panel. */
export interface AiCostBreakdown {
  courseUsd: number;
  examUsd: number;
  chatbotUsd: number;
  totalUsd: number;
  totalTokens: number;
}

const MICRO_USD = 1_000_000;

const EMPTY_AI_COST: AiCostBreakdown = {
  courseUsd: 0,
  examUsd: 0,
  chatbotUsd: 0,
  totalUsd: 0,
  totalTokens: 0,
};

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getUsers(
    academyId?: string | null,
    params?: { page?: number; limit?: number; search?: string; role?: Role },
  ) {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const skip = (page - 1) * limit;

    // Si hay academyId, solo devolver miembros de esa academia
    const where: Prisma.UserWhereInput = {
      ...(academyId ? { academyMembers: { some: { academyId } } } : {}),
      ...(params?.role ? { role: params.role } : {}),
      ...(params?.search
        ? {
            OR: [
              { name: { contains: params.search, mode: 'insensitive' as const } },
              { email: { contains: params.search, mode: 'insensitive' as const } },
              { username: { contains: params.search, mode: 'insensitive' as const } },
              { guardianEmail: { contains: params.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          username: true,
          guardianEmail: true,
          name: true,
          role: true,
          avatarUrl: true,
          createdAt: true,
          // Actividad del alumno para el panel de admin: la mantiene al día
          // checkAndAward en cada ejercicio, tema o examen. Es un dato de
          // seguimiento, no una clasificación — no se ordena ni se muestra
          // como ranking en la app del alumno.
          totalPoints: true,
          currentDailyStreak: true,
          longestDailyStreak: true,
          currentStreak: true,
          academyMembers: {
            select: { academy: { select: { id: true, slug: true, name: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    const aiCostByUser = await this.aiCostFor(items.map((u) => u.id));

    return {
      data: items.map((u) => ({ ...u, aiCost: aiCostByUser.get(u.id) ?? EMPTY_AI_COST })),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  /**
   * Coste de IA por usuario, desglosado por categoría.
   *
   * Un solo groupBy para toda la página en vez de una consulta por fila: el
   * listado carga hasta 1.000 usuarios de golpe (la página filtra en cliente).
   * Los importes van en microdólares enteros hasta el borde de la API, donde se
   * convierten a dólares — sumar decimales por millares acumula error.
   */
  private async aiCostFor(userIds: string[]): Promise<Map<string, AiCostBreakdown>> {
    if (userIds.length === 0) return new Map();

    const rows = await this.prisma.aiUsage.groupBy({
      by: ['userId', 'category'],
      where: { userId: { in: userIds } },
      _sum: { costMicroUsd: true, inputTokens: true, outputTokens: true },
    });

    const byUser = new Map<string, AiCostBreakdown>();
    for (const row of rows) {
      const entry = byUser.get(row.userId) ?? { ...EMPTY_AI_COST };
      const micro = row._sum.costMicroUsd ?? 0;
      const tokens = (row._sum.inputTokens ?? 0) + (row._sum.outputTokens ?? 0);

      if (row.category === AiUsageCategory.COURSE) entry.courseUsd = micro / MICRO_USD;
      if (row.category === AiUsageCategory.EXAM) entry.examUsd = micro / MICRO_USD;
      if (row.category === AiUsageCategory.CHATBOT) entry.chatbotUsd = micro / MICRO_USD;
      entry.totalUsd += micro / MICRO_USD;
      entry.totalTokens += tokens;

      byUser.set(row.userId, entry);
    }
    return byUser;
  }

  async updateRole(userId: string, role: Role) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, email: true, name: true, role: true },
    });
  }

  async createUser(dto: CreateAdminUserDto, academyId?: string | null) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new BadRequestException('Ya existe un usuario con ese email');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        passwordHash,
        role: dto.role,
        schoolYearId: dto.schoolYearId ?? null,
        ...(academyId ? { academyMembers: { create: { academyId } } } : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
        academyMembers: {
          select: { academy: { select: { id: true, slug: true, name: true } } },
        },
      },
    });
  }

  async updateUser(userId: string, dto: UpdateAdminUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    if (dto.email && dto.email !== user.email) {
      const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (existing) throw new BadRequestException('Ya existe un usuario con ese email');
    }

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.email !== undefined) data.email = dto.email;
    if ('schoolYearId' in dto) data.schoolYearId = dto.schoolYearId ?? null;
    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
      },
    });
  }

  async deleteUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    await this.prisma.user.delete({ where: { id: userId } });
    return { message: 'Usuario eliminado correctamente' };
  }

  // ─── Matrículas manuales ──────────────────────────────────────────────────

  async getEnrollments(userId: string) {
    return this.prisma.enrollment.findMany({
      where: { userId },
      include: { course: { include: { schoolYear: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async enroll(userId: string, courseId: string) {
    return this.prisma.enrollment.upsert({
      where: { userId_courseId: { userId, courseId } },
      update: {},
      create: { userId, courseId },
      include: { course: { include: { schoolYear: true } } },
    });
  }

  async unenroll(userId: string, courseId: string) {
    await this.prisma.enrollment.deleteMany({ where: { userId, courseId } });
    return { message: 'Matrícula eliminada' };
  }

  /** Restablece la contraseña de un usuario. Es la única vía de recuperación
   *  para alumnos, que no tienen email con el que usar forgot-password. */
  async resetPassword(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const passwordHash = await bcrypt.hash(password, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return { message: 'Contraseña restablecida' };
  }
}
