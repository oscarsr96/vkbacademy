import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import type { AuthTokens, JwtPayload } from '@vkbacademy/shared';

export type AuthResponse = AuthTokens & {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    avatarUrl: string | null;
    schoolYearId: string | null;
    schoolYear: { id: string; name: string; label: string } | null;
  };
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) {
      throw new ConflictException('El email ya está registrado');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
        ...(dto.schoolYearId ? { schoolYearId: dto.schoolYearId } : {}),
      },
      include: { schoolYear: true },
    });

    const tokens = await this.generateTokens({ sub: user.id, email: user.email, role: user.role });
    return { ...tokens, user: this.toPublic(user) };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { schoolYear: true },
    });
    if (!user) throw new UnauthorizedException('Credenciales incorrectas');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Credenciales incorrectas');

    const tokens = await this.generateTokens({ sub: user.id, email: user.email, role: user.role });
    return { ...tokens, user: this.toPublic(user) };
  }

  async refresh(token: string): Promise<AuthTokens> {
    const stored = await this.prisma.refreshToken.findUnique({ where: { token } });
    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    // Invalidar el token usado (rotación)
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revoked: true },
    });

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: stored.userId } });
    return this.generateTokens({ sub: user.id, email: user.email, role: user.role });
  }

  async logout(token: string): Promise<{ message: string }> {
    await this.prisma.refreshToken.updateMany({
      where: { token },
      data: { revoked: true },
    });
    return { message: 'Sesión cerrada correctamente' };
  }

  /**
   * Solicita restablecimiento de contraseña.
   * Responde siempre con mensaje genérico para evitar enumeración de emails.
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return { message: 'Si el email existe, recibirás un enlace en breve' };

    // El secret incluye el passwordHash actual → el token queda invalidado al cambiar la contraseña
    const resetSecret = this.config.get<string>('JWT_SECRET')! + user.passwordHash;
    const token = this.jwtService.sign(
      { sub: user.id, purpose: 'reset' },
      { secret: resetSecret, expiresIn: '1h' },
    );

    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:5173').split(',')[0];
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    void this.notifications.sendPasswordReset({ email: user.email, name: user.name, resetUrl });

    return { message: 'Si el email existe, recibirás un enlace en breve' };
  }

  /** Valida el token y actualiza la contraseña */
  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    // Extraer payload sin verificar para leer el userId
    let payload: { sub: string; purpose: string } | null = null;
    try {
      payload = this.jwtService.decode(token) as { sub: string; purpose: string };
    } catch {
      throw new BadRequestException('Token inválido');
    }

    if (!payload?.sub || payload.purpose !== 'reset') {
      throw new BadRequestException('Token inválido');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new BadRequestException('Token inválido');

    // Verificar con el secret que incluye el passwordHash actual
    const resetSecret = this.config.get<string>('JWT_SECRET')! + user.passwordHash;
    try {
      this.jwtService.verify(token, { secret: resetSecret });
    } catch {
      throw new BadRequestException('Token inválido o expirado');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

    return { message: 'Contraseña actualizada correctamente' };
  }

  private async generateTokens(payload: JwtPayload): Promise<AuthTokens> {
    const accessToken = this.jwtService.sign(payload);

    const refreshSecret = this.config.get<string>('JWT_REFRESH_SECRET');
    const refreshExpiresIn = this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');

    const refreshToken = this.jwtService.sign(payload, {
      secret: refreshSecret,
      expiresIn: refreshExpiresIn,
    });

    // Calcular expiración del refresh token
    const days = parseInt(refreshExpiresIn.replace('d', ''), 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: payload.sub,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  private toPublic(user: {
    id: string;
    email: string;
    name: string;
    role: string;
    avatarUrl: string | null;
    schoolYearId?: string | null;
    schoolYear?: { id: string; name: string; label: string } | null;
  }) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl,
      schoolYearId: user.schoolYearId ?? null,
      schoolYear: user.schoolYear ?? null,
    };
  }
}
