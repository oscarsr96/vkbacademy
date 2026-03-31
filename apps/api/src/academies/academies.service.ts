import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAcademyDto, UpdateAcademyDto } from './dto/create-academy.dto';

@Injectable()
export class AcademiesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.academy.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        _count: { select: { members: true } },
      },
    });
  }

  /** Lista pública de academias activas (para registro y landing) */
  async findPublic() {
    return this.prisma.academy.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        slug: true,
        name: true,
        logoUrl: true,
        primaryColor: true,
      },
    });
  }

  async findByDomain(domain: string) {
    const academy = await this.prisma.academy.findFirst({
      where: { domain, isActive: true },
      select: {
        id: true,
        slug: true,
        name: true,
        logoUrl: true,
        primaryColor: true,
        isActive: true,
      },
    });
    if (!academy) throw new NotFoundException('Academia no encontrada para este dominio');
    return academy;
  }

  async findBySlug(slug: string) {
    const academy = await this.prisma.academy.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        name: true,
        logoUrl: true,
        primaryColor: true,
        isActive: true,
      },
    });
    if (!academy) throw new NotFoundException('Academia no encontrada');
    return academy;
  }

  async findById(id: string) {
    const academy = await this.prisma.academy.findUnique({
      where: { id },
      include: { _count: { select: { members: true } } },
    });
    if (!academy) throw new NotFoundException('Academia no encontrada');
    return academy;
  }

  async create(dto: CreateAcademyDto) {
    const existing = await this.prisma.academy.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException('Ya existe una academia con ese slug');

    return this.prisma.academy.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        logoUrl: dto.logoUrl,
        primaryColor: dto.primaryColor,
        domain: dto.domain,
      },
    });
  }

  async update(id: string, dto: UpdateAcademyDto) {
    await this.findById(id);
    return this.prisma.academy.update({
      where: { id },
      data: dto,
    });
  }

  async getMembers(academyId: string) {
    return this.prisma.academyMember.findMany({
      where: { academyId },
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true, avatarUrl: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addMember(academyId: string, userId: string) {
    await this.findById(academyId);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const existing = await this.prisma.academyMember.findUnique({
      where: { userId_academyId: { userId, academyId } },
    });
    if (existing) throw new ConflictException('El usuario ya es miembro de esta academia');

    return this.prisma.academyMember.create({
      data: { userId, academyId },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });
  }

  async removeMember(academyId: string, userId: string) {
    const membership = await this.prisma.academyMember.findUnique({
      where: { userId_academyId: { userId, academyId } },
    });
    if (!membership) throw new NotFoundException('Membresía no encontrada');

    await this.prisma.academyMember.delete({
      where: { id: membership.id },
    });
    return { message: 'Miembro eliminado correctamente' };
  }
}
