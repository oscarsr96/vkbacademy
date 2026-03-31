import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAcademyDto, UpdateAcademyDto } from './dto/create-academy.dto';

@Injectable()
export class AcademiesService {
  private readonly logger = new Logger(AcademiesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

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

    // Generar dominio automáticamente si no se proporciona
    const domain = dto.domain ?? `${dto.slug.replace(/-/g, '')}academy.vercel.app`;

    const academy = await this.prisma.academy.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        logoUrl: dto.logoUrl,
        primaryColor: dto.primaryColor,
        domain,
      },
    });

    // Registrar dominio en Vercel automáticamente
    void this.registerVercelDomain(domain);

    return academy;
  }

  async update(id: string, dto: UpdateAcademyDto) {
    const current = await this.findById(id);
    const academy = await this.prisma.academy.update({
      where: { id },
      data: dto,
    });

    // Si cambió el dominio, registrar el nuevo y quitar el viejo
    if (dto.domain && dto.domain !== current.domain) {
      void this.registerVercelDomain(dto.domain);
      if (current.domain) {
        void this.removeVercelDomain(current.domain);
      }
    }

    return academy;
  }

  /**
   * Registra un dominio en el proyecto de Vercel.
   * Requiere VERCEL_TOKEN y VERCEL_PROJECT_ID en las variables de entorno.
   */
  private async registerVercelDomain(domain: string): Promise<void> {
    const token = this.config.get<string>('VERCEL_TOKEN');
    const projectId = this.config.get<string>('VERCEL_PROJECT_ID');
    if (!token || !projectId) {
      this.logger.warn('VERCEL_TOKEN o VERCEL_PROJECT_ID no configurados — dominio no registrado automáticamente');
      return;
    }

    try {
      const res = await fetch(`https://api.vercel.com/v10/projects/${projectId}/domains`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: domain }),
      });

      if (res.ok) {
        this.logger.log(`Dominio ${domain} registrado en Vercel`);
      } else {
        const body = await res.text();
        this.logger.warn(`Error registrando dominio ${domain} en Vercel: ${res.status} ${body}`);
      }
    } catch (err) {
      this.logger.error(`Error llamando a Vercel API para dominio ${domain}`, err);
    }
  }

  /** Elimina un dominio del proyecto de Vercel */
  private async removeVercelDomain(domain: string): Promise<void> {
    const token = this.config.get<string>('VERCEL_TOKEN');
    const projectId = this.config.get<string>('VERCEL_PROJECT_ID');
    if (!token || !projectId) return;

    try {
      await fetch(`https://api.vercel.com/v10/projects/${projectId}/domains/${domain}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      this.logger.log(`Dominio ${domain} eliminado de Vercel`);
    } catch (err) {
      this.logger.error(`Error eliminando dominio ${domain} de Vercel`, err);
    }
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
