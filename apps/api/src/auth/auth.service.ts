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
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UsernameService } from '../username/username.service';
import { DEFAULT_STUDENT_PASSWORD } from './auth.constants';
import { RegisterDto } from './dto/register.dto';
import { RegisterTutorDto } from './dto/register-tutor.dto';
import { RegisterStudentsDto } from './dto/register-students.dto';
import { LoginDto } from './dto/login.dto';
import type { AuthTokens, JwtPayload } from '@vkbacademy/shared';

export type AuthResponse = AuthTokens & {
  user: {
    id: string;
    email: string | null;
    username: string | null;
    name: string;
    role: string;
    avatarUrl: string | null;
    mustChangePassword: boolean;
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
    private readonly usernames: UsernameService,
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
      email: user.email ?? '',
      role: user.role,
      academyId,
    });
    return { ...tokens, user: this.toPublic(user, academyId, academy) };
  }

  /**
   * Registro de tutor con alumnos.
   *
   * Los alumnos no aportan email — se les asigna un username único derivado del
   * nombre (vía UsernameService) y nacen con la contraseña por defecto y el flag
   * mustChangePassword=true. El tutor recibe un único email con los usernames de
   * sus alumnos y la contraseña por defecto.
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

    // 3. Generar username único para cada alumno (slug del nombre + sufijo si colisiona)
    const studentUsernames = await this.usernames.allocate(dto.students.map((s) => s.name));

    // 4. Hashes de contraseñas: el tutor con la suya; los alumnos con la por defecto
    const tutorPasswordHash = await bcrypt.hash(dto.password, 10);
    const defaultStudentHash = await bcrypt.hash(DEFAULT_STUDENT_PASSWORD, 10);

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
              username: studentUsernames[index],
              passwordHash: defaultStudentHash,
              mustChangePassword: true,
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

    // 6. Enviar UN email al tutor con los usernames de los alumnos y la contraseña por defecto
    const frontendUrl = this.config
      .get<string>('FRONTEND_URL', 'http://localhost:5173')
      .split(',')[0];
    const loginUrl = `${frontendUrl}/login`;

    void this.notifications.sendTutorWelcomeWithStudents({
      tutorEmail: tutor.email!,
      tutorName: tutor.name,
      tutorPassword: dto.password,
      students: students.map((student, index) => ({
        name: student.name,
        username: studentUsernames[index],
      })),
      defaultPassword: DEFAULT_STUDENT_PASSWORD,
      academyName: academy.name,
      loginUrl,
    });

    // 7. Auto-login del tutor: generar tokens y devolver respuesta
    const tokens = await this.generateTokens({
      sub: tutor.id,
      email: tutor.email!,
      role: tutor.role,
      academyId: academy.id,
    });

    return { ...tokens, user: this.toPublic(tutor, academy.id, academy) };
  }

  /**
   * Registro por familia: el padre o la madre da de alta a sus hijos y no
   * obtiene cuenta. Su email queda como dato de contacto en cada alumno.
   * Devuelve los usernames generados — es el único momento en que se muestran.
   */
  async registerStudents(dto: RegisterStudentsDto): Promise<{
    students: { name: string; username: string; schoolYear: string | null }[];
  }> {
    // 1. Resolver academia (obligatoria: sin ella el alumno no lo vería ningún admin)
    const academy = await this.prisma.academy.findUnique({
      where: { slug: dto.academySlug },
    });
    if (!academy) {
      throw new NotFoundException(`La academia "${dto.academySlug}" no existe`);
    }
    if (!academy.isActive) {
      throw new BadRequestException(`La academia "${dto.academySlug}" no está activa`);
    }
    const academyId = academy.id;

    // 2. Validar los cursos antes de tocar nada: un id inventado debe ser 400, no
    //    un fallo de clave foránea de Prisma sin envolver
    const requestedYearIds = [...new Set(dto.students.map((s) => s.schoolYearId))];
    const foundYears = await this.prisma.schoolYear.findMany({
      where: { id: { in: requestedYearIds } },
      select: { id: true },
    });
    const foundYearIds = new Set(foundYears.map((y) => y.id));
    const missingYearIds = requestedYearIds.filter((id) => !foundYearIds.has(id));
    if (missingYearIds.length > 0) {
      throw new BadRequestException(`Curso no válido: ${missingYearIds.join(', ')}`);
    }

    // 3. Usernames únicos, también entre hermanos del mismo formulario
    const usernames = await this.usernames.allocate(dto.students.map((s) => s.name));

    // 4. Hash independiente por alumno
    const passwordHashes = await Promise.all(dto.students.map((s) => bcrypt.hash(s.password, 10)));

    // 5. Todos los hermanos o ninguno
    const created = await this.prisma
      .$transaction((tx) =>
        Promise.all(
          dto.students.map((studentDto, index) =>
            tx.user.create({
              data: {
                username: usernames[index],
                passwordHash: passwordHashes[index],
                name: studentDto.name,
                role: 'STUDENT',
                guardianEmail: dto.guardianEmail,
                schoolYearId: studentDto.schoolYearId,
                academyMembers: { create: { academyId } },
              },
              include: { schoolYear: true },
            }),
          ),
        ),
      )
      .catch((error: unknown) => {
        // Carrera con otro registro simultáneo que se llevó el mismo username:
        // los usernames se reservan fuera de la transacción, así que puede colisionar
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictException(
            'No se ha podido completar el registro por un conflicto de nombres. Inténtalo de nuevo.',
          );
        }
        throw error;
      });

    return {
      students: created.map((u) => ({
        name: u.name,
        username: u.username!,
        schoolYear: u.schoolYear?.label ?? null,
      })),
    };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const isEmail = dto.identifier.includes('@');
    const user = isEmail
      ? await this.prisma.user.findUnique({
          where: { email: dto.identifier },
          include: { schoolYear: true, academyMembers: { take: 1, include: { academy: true } } },
        })
      : await this.prisma.user.findUnique({
          where: { username: dto.identifier.toLowerCase() },
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
      email: user.email ?? '',
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
    return this.generateTokens({
      sub: user.id,
      email: user.email ?? '',
      role: user.role,
      academyId,
    });
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

    void this.notifications.sendPasswordReset({ email: user.email!, name: user.name, resetUrl });

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

    // Al fijar una contraseña propia, el alumno deja de estar obligado a cambiarla
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false },
    });

    return { message: 'Contraseña actualizada correctamente' };
  }

  /** Cambia la contraseña del usuario autenticado y limpia el flag de cambio obligatorio */
  async changePassword(userId: string, newPassword: string): Promise<{ message: string }> {
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    });
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
      email: string | null;
      username?: string | null;
      name: string;
      role: string;
      avatarUrl: string | null;
      mustChangePassword?: boolean;
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
      username: user.username ?? null,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl,
      mustChangePassword: user.mustChangePassword ?? false,
      schoolYearId: user.schoolYearId ?? null,
      schoolYear: user.schoolYear ?? null,
      academyId: academyId ?? null,
      academy: academy ?? null,
    };
  }
}
