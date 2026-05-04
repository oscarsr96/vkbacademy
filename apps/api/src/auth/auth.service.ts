import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RegisterDto } from './dto/register.dto';
import { RegisterTutorDto } from './dto/register-tutor.dto';
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
    academyId: string | null;
    academy: {
      id: string;
      slug: string;
      name: string;
      logoUrl: string | null;
      primaryColor: string | null;
      isActive: boolean;
    } | null;
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

    // Resolver la academia por slug si se proporcionó
    let academyId: string | null = null;
    let academy: {
      id: string;
      slug: string;
      name: string;
      logoUrl: string | null;
      primaryColor: string | null;
      isActive: boolean;
    } | null = null;
    if (dto.academySlug) {
      const found = await this.prisma.academy.findUnique({ where: { slug: dto.academySlug } });
      if (found) {
        academyId = found.id;
        academy = found;
      }
    }

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
        ...(dto.schoolYearId ? { schoolYearId: dto.schoolYearId } : {}),
        ...(academyId ? { academyMembers: { create: { academyId } } } : {}),
      },
      include: { schoolYear: true },
    });

    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
      role: user.role,
      academyId,
    });
    return { ...tokens, user: this.toPublic(user, academyId, academy) };
  }

  /**
   * Registro de tutor con alumnos.
   *
   * Los alumnos no aportan email — se autogenera del nombre (slug + dominio
   * fijo) y la contraseña se genera aleatoriamente. Todas las credenciales
   * (las del tutor y las de cada alumno) se envían en un único email al tutor.
   *
   * Todo se ejecuta dentro de una transacción Prisma: si algo falla,
   * ningún usuario ni membresía queda persistido.
   */
  async registerTutor(dto: RegisterTutorDto): Promise<AuthResponse> {
    // 1. Validar academia
    const academy = await this.prisma.academy.findUnique({ where: { slug: dto.academySlug } });
    if (!academy) {
      throw new NotFoundException(`La academia "${dto.academySlug}" no existe`);
    }
    if (!academy.isActive) {
      throw new BadRequestException(`La academia "${dto.academySlug}" no está activa`);
    }

    // 2. Verificar que el email del tutor no está ya registrado
    const tutorExists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (tutorExists) {
      throw new ConflictException(`El email "${dto.email}" ya está registrado`);
    }

    // 3. Generar email único para cada alumno (slug del nombre + sufijo si colisiona)
    const studentEmails = await this.allocateStudentEmails(dto.students.map((s) => s.name));

    // 4. Hashes de contraseñas
    const tutorPasswordHash = await bcrypt.hash(dto.password, 10);
    const studentPasswords = dto.students.map(() => this.generatePassword());
    const studentPasswordHashes = await Promise.all(
      studentPasswords.map((pw) => bcrypt.hash(pw, 10)),
    );

    // 5. Crear tutor y alumnos en transacción
    const { tutor, students } = await this.prisma.$transaction(async (tx) => {
      const createdTutor = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash: tutorPasswordHash,
          name: dto.name,
          role: 'TUTOR',
          academyMembers: { create: { academyId: academy.id } },
        },
        include: { schoolYear: true },
      });

      const createdStudents = await Promise.all(
        dto.students.map((studentDto, index) =>
          tx.user.create({
            data: {
              email: studentEmails[index],
              passwordHash: studentPasswordHashes[index],
              name: studentDto.name,
              role: 'STUDENT',
              tutorId: createdTutor.id,
              ...(studentDto.schoolYearId ? { schoolYearId: studentDto.schoolYearId } : {}),
              academyMembers: { create: { academyId: academy.id } },
            },
            include: { schoolYear: true },
          }),
        ),
      );

      return { tutor: createdTutor, students: createdStudents };
    });

    // 6. Enviar UN email consolidado al tutor con todas las credenciales
    const frontendUrl = this.config
      .get<string>('FRONTEND_URL', 'http://localhost:5173')
      .split(',')[0];
    const loginUrl = `${frontendUrl}/login`;

    void this.notifications.sendTutorWelcomeWithStudents({
      tutorEmail: tutor.email,
      tutorName: tutor.name,
      tutorPassword: dto.password,
      students: students.map((student, index) => ({
        name: student.name,
        email: student.email,
        password: studentPasswords[index],
      })),
      academyName: academy.name,
      loginUrl,
    });

    // 7. Auto-login del tutor: generar tokens y devolver respuesta
    const tokens = await this.generateTokens({
      sub: tutor.id,
      email: tutor.email,
      role: tutor.role,
      academyId: academy.id,
    });

    return { ...tokens, user: this.toPublic(tutor, academy.id, academy) };
  }

  /** Genera una contraseña aleatoria alfanumérica de 8 caracteres */
  private generatePassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join(
      '',
    );
  }

  /**
   * Convierte un nombre en slug ASCII apto para email.
   * "María Pérez García" → "maria-perez-garcia".
   */
  private slugifyName(name: string): string {
    return (
      name
        .normalize('NFD')
        // Marca de diacríticos: U+0300 a U+036F (tildes, virgulillas, etc.)
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
    );
  }

  /**
   * Genera un email único @vkbacademy.com para cada nombre de alumno.
   * Resuelve colisiones con sufijo incremental (-2, -3, ...).
   */
  private async allocateStudentEmails(names: string[]): Promise<string[]> {
    const STUDENT_EMAIL_DOMAIN = 'vkbacademy.com';
    const used = new Set<string>();
    const result: string[] = [];

    for (const name of names) {
      const base = this.slugifyName(name) || 'alumno';
      let candidate = `${base}@${STUDENT_EMAIL_DOMAIN}`;
      let suffix = 1;

      while (
        used.has(candidate) ||
        (await this.prisma.user.findUnique({ where: { email: candidate } }))
      ) {
        suffix++;
        candidate = `${base}-${suffix}@${STUDENT_EMAIL_DOMAIN}`;
      }

      used.add(candidate);
      result.push(candidate);
    }

    return result;
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const isEmail = dto.identifier.includes('@');
    const user = isEmail
      ? await this.prisma.user.findUnique({
          where: { email: dto.identifier },
          include: { schoolYear: true, academyMembers: { take: 1, include: { academy: true } } },
        })
      : await this.prisma.user.findFirst({
          where: { name: { equals: dto.identifier, mode: 'insensitive' } },
          include: { schoolYear: true, academyMembers: { take: 1, include: { academy: true } } },
        });
    if (!user) throw new UnauthorizedException('Credenciales incorrectas');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Credenciales incorrectas');

    const membership = user.academyMembers[0];
    const academyId = membership?.academyId ?? null;
    const academy = membership?.academy ?? null;

    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
      role: user.role,
      academyId,
    });
    return { ...tokens, user: this.toPublic(user, academyId, academy) };
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

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: stored.userId },
      include: { academyMembers: { take: 1 } },
    });
    const academyId = user.academyMembers[0]?.academyId ?? null;
    return this.generateTokens({ sub: user.id, email: user.email, role: user.role, academyId });
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

    const frontendUrl = this.config
      .get<string>('FRONTEND_URL', 'http://localhost:5173')
      .split(',')[0];
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

  private toPublic(
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      avatarUrl: string | null;
      schoolYearId?: string | null;
      schoolYear?: { id: string; name: string; label: string } | null;
    },
    academyId?: string | null,
    academy?: {
      id: string;
      slug: string;
      name: string;
      logoUrl: string | null;
      primaryColor: string | null;
      isActive: boolean;
    } | null,
  ) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl,
      schoolYearId: user.schoolYearId ?? null,
      schoolYear: user.schoolYear ?? null,
      academyId: academyId ?? null,
      academy: academy ?? null,
    };
  }
}
