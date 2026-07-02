import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import * as bcrypt from 'bcrypt';

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
          name: true,
          role: true,
          avatarUrl: true,
          createdAt: true,
          tutorId: true,
          tutor: { select: { id: true, name: true } },
          _count: { select: { students: true } },
          academyMembers: {
            select: { academy: { select: { id: true, slug: true, name: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data: items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  async assignTutor(studentId: string, tutorId: string | null | undefined) {
    // Si se proporciona tutorId, verificar que el usuario tiene rol TUTOR
    if (tutorId) {
      const tutorUser = await this.prisma.user.findUnique({ where: { id: tutorId } });
      if (!tutorUser) throw new NotFoundException('Tutor no encontrado');
      if (tutorUser.role !== Role.TUTOR) {
        throw new BadRequestException('El usuario especificado no tiene el rol TUTOR');
      }
    }

    return this.prisma.user.update({
      where: { id: studentId },
      data: { tutorId: tutorId ?? null },
      select: {
        id: true,
        name: true,
        email: true,
        tutorId: true,
        tutor: { select: { id: true, name: true } },
      },
    });
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
        tutorId: dto.tutorId ?? null,
        ...(academyId ? { academyMembers: { create: { academyId } } } : {}),
        ...(dto.role === 'TEACHER' ? { teacherProfile: { create: {} } } : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
        tutorId: true,
        tutor: { select: { id: true, name: true } },
        _count: { select: { students: true } },
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
        tutorId: true,
        tutor: { select: { id: true, name: true } },
        _count: { select: { students: true } },
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
}
