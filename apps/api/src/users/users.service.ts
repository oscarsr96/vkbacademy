import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
        schoolYearId: true,
        schoolYear: { select: { id: true, name: true, label: true } },
        // Excluimos passwordHash
      },
    });

    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }
}
