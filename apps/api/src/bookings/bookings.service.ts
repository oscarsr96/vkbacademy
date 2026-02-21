import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Role, BookingStatus, BookingMode, ChallengeType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DailyService } from '../daily/daily.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ChallengesService } from '../challenges/challenges.service';
import { CreateBookingDto } from './dto/create-booking.dto';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly daily: DailyService,
    private readonly notifications: NotificationsService,
    private readonly challenges: ChallengesService,
  ) {}

  async getMyBookings(userId: string, role: Role) {
    if (role === Role.STUDENT) {
      return this.prisma.booking.findMany({
        where: { studentId: userId },
        orderBy: { startAt: 'asc' },
        include: { teacher: { include: { user: { select: { name: true, avatarUrl: true } } } } },
      });
    }

    if (role === Role.TUTOR) {
      // El tutor ve todas las reservas de sus alumnos
      const students = await this.prisma.user.findMany({
        where: { tutorId: userId },
        select: { id: true },
      });
      const studentIds = students.map((s) => s.id);
      return this.prisma.booking.findMany({
        where: { studentId: { in: studentIds } },
        orderBy: { startAt: 'asc' },
        include: {
          student: { select: { name: true, avatarUrl: true } },
          teacher: { include: { user: { select: { name: true, avatarUrl: true } } } },
          course: { select: { id: true, title: true } },
        },
      });
    }

    if (role === Role.TEACHER) {
      const profile = await this.prisma.teacherProfile.findUnique({ where: { userId } });
      if (!profile) return [];
      return this.prisma.booking.findMany({
        where: { teacherId: profile.id },
        orderBy: { startAt: 'asc' },
        include: {
          student: { select: { name: true, avatarUrl: true } },
          course: { select: { id: true, title: true } },
        },
      });
    }

    // ADMIN ve todas
    return this.prisma.booking.findMany({
      orderBy: { startAt: 'asc' },
      include: {
        student: { select: { name: true, avatarUrl: true } },
        teacher: { include: { user: { select: { name: true, avatarUrl: true } } } },
        course: { select: { id: true, title: true } },
      },
    });
  }

  async create(dto: CreateBookingDto, creatorId: string, creatorRole: Role) {
    // Si es TUTOR, verificar que el studentId pertenece a sus alumnos
    if (creatorRole === Role.TUTOR) {
      const student = await this.prisma.user.findUnique({
        where: { id: dto.studentId },
        select: { tutorId: true },
      });
      if (!student || student.tutorId !== creatorId) {
        throw new ForbiddenException('No puedes crear reservas para este alumno');
      }
    }

    // Verificar que el profesor existe
    const teacher = await this.prisma.teacherProfile.findUnique({
      where: { id: dto.teacherId },
      include: { user: { select: { name: true, email: true } } },
    });
    if (!teacher) throw new NotFoundException('Profesor no encontrado');

    // Verificar que el curso existe si se ha indicado
    let courseName: string | undefined;
    if (dto.courseId) {
      const course = await this.prisma.course.findUnique({ where: { id: dto.courseId } });
      if (!course) throw new NotFoundException('Curso no encontrado');
      courseName = course.title;
    }

    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);

    if (startAt >= endAt) throw new BadRequestException('La fecha de inicio debe ser anterior a la de fin');
    if (startAt < new Date()) throw new BadRequestException('No se puede reservar en el pasado');

    // Verificar conflicto
    const conflict = await this.prisma.booking.findFirst({
      where: {
        teacherId: dto.teacherId,
        status: { not: BookingStatus.CANCELLED },
        OR: [{ startAt: { lt: endAt }, endAt: { gt: startAt } }],
      },
    });
    if (conflict) throw new BadRequestException('El horario no está disponible');

    const booking = await this.prisma.booking.create({
      data: {
        studentId: dto.studentId,
        teacherId: dto.teacherId,
        startAt,
        endAt,
        mode: dto.mode,
        notes: dto.notes,
        courseId: dto.courseId,
      },
    });

    // Obtener datos del tutor/creador y del alumno para la notificación
    const [creator, student] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: creatorId }, select: { name: true } }),
      this.prisma.user.findUnique({ where: { id: dto.studentId }, select: { name: true } }),
    ]);

    // Notificar al profesor de la nueva solicitud (en segundo plano)
    this.notifications
      .sendBookingCreated({
        teacherEmail: teacher.user.email,
        teacherName: teacher.user.name,
        studentName: student?.name ?? '—',
        tutorName: creator?.name ?? '—',
        startAt,
        endAt,
        mode: dto.mode ?? 'IN_PERSON',
        courseName,
      })
      .catch((err) => this.logger.error('Error enviando notificación de reserva creada', err));

    return booking;
  }

  async confirm(bookingId: string, userId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('Reserva no encontrada');

    const profile = await this.prisma.teacherProfile.findUnique({
      where: { userId },
      include: { user: { select: { name: true } } },
    });
    if (!profile || booking.teacherId !== profile.id) {
      throw new ForbiddenException('No tienes permisos para confirmar esta reserva');
    }

    // Crear sala Daily.co si la reserva es online y aún no tiene sala
    let meetingUrl = booking.meetingUrl;
    if (booking.mode === BookingMode.ONLINE && !meetingUrl) {
      meetingUrl = await this.daily.createRoom(bookingId, booking.startAt, booking.endAt);
    }

    const confirmed = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.CONFIRMED, meetingUrl },
    });

    // Obtener datos para la notificación: alumno + tutor + asignatura
    const student = await this.prisma.user.findUnique({
      where: { id: booking.studentId },
      select: { name: true, email: true, tutorId: true },
    });
    const tutor = student?.tutorId
      ? await this.prisma.user.findUnique({
          where: { id: student.tutorId },
          select: { name: true, email: true },
        })
      : null;
    const course = booking.courseId
      ? await this.prisma.course.findUnique({ where: { id: booking.courseId }, select: { title: true } })
      : null;

    if (student) {
      this.notifications
        .sendBookingConfirmed({
          tutorEmail: tutor?.email ?? student.email,
          studentEmail: student.email,
          tutorName: tutor?.name ?? student.name,
          studentName: student.name,
          teacherName: profile.user.name,
          startAt: booking.startAt,
          endAt: booking.endAt,
          mode: booking.mode,
          meetingUrl,
          courseName: course?.title,
        })
        .catch((err) => this.logger.error('Error enviando notificación de reserva confirmada', err));
    }

    // Disparar evaluación de retos en segundo plano para el alumno
    void this.challenges.checkAndAward(
      booking.studentId,
      ChallengeType.BOOKING_ATTENDED,
      ChallengeType.TOTAL_HOURS,
    );

    return confirmed;
  }

  async cancel(bookingId: string, userId: string, role: Role) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('Reserva no encontrada');

    // Verificar permisos
    const teacherProfile = await this.prisma.teacherProfile.findUnique({ where: { userId } });
    const isStudent = booking.studentId === userId;
    const isTeacher = teacherProfile && booking.teacherId === teacherProfile.id;

    let isTutor = false;
    if (role === Role.TUTOR) {
      const student = await this.prisma.user.findUnique({
        where: { id: booking.studentId },
        select: { tutorId: true },
      });
      isTutor = student?.tutorId === userId;
    }

    if (role !== Role.ADMIN && !isStudent && !isTeacher && !isTutor) {
      throw new ForbiddenException('No tienes permisos para cancelar esta reserva');
    }

    const cancelled = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.CANCELLED, meetingUrl: null },
    });

    // Eliminar la sala de Daily.co si existía
    if (booking.mode === BookingMode.ONLINE && booking.meetingUrl) {
      await this.daily.deleteRoom(bookingId);
    }

    // Reunir datos para las notificaciones
    const [student, teacher] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: booking.studentId },
        select: { name: true, email: true, tutorId: true },
      }),
      this.prisma.teacherProfile.findUnique({
        where: { id: booking.teacherId },
        include: { user: { select: { name: true, email: true } } },
      }),
    ]);

    const tutor = student?.tutorId
      ? await this.prisma.user.findUnique({
          where: { id: student.tutorId },
          select: { name: true, email: true },
        })
      : null;

    // Notificar solo a las partes que no cancelaron
    const notifyEmails: Array<{ email: string; name: string }> = [];
    if (!isTeacher && teacher) notifyEmails.push({ email: teacher.user.email, name: teacher.user.name });
    if (!isTutor && !isStudent && tutor) notifyEmails.push({ email: tutor.email, name: tutor.name });
    if (!isStudent && student) notifyEmails.push({ email: student.email, name: student.name });

    if (notifyEmails.length > 0 && student && teacher) {
      this.notifications
        .sendBookingCancelled({
          notifyEmails,
          studentName: student.name,
          teacherName: teacher.user.name,
          startAt: booking.startAt,
          endAt: booking.endAt,
          mode: booking.mode,
        })
        .catch((err) => this.logger.error('Error enviando notificación de reserva cancelada', err));
    }

    return cancelled;
  }
}
