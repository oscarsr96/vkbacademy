import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import type { JwtPayload } from '@vkbacademy/shared';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        academyMembers: {
          take: 1,
          include: { academy: true },
        },
      },
    });
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    // Adjuntar academyId desde JWT payload o primera membresía
    const membership = user.academyMembers[0];
    (user as any).academyId = payload.academyId ?? membership?.academyId ?? null;
    (user as any).academy = membership?.academy ?? null;

    return user;
  }
}
