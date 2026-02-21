import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TutorsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Devuelve la lista de alumnos asignados a un tutor */
  async getMyStudents(tutorId: string) {
    return this.prisma.user.findMany({
      where: { tutorId },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        schoolYear: {
          select: { id: true, name: true, label: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  /** Devuelve los cursos en los que está matriculado un alumno del tutor */
  async getStudentCourses(tutorId: string, studentId: string) {
    // Verificar que el alumno pertenece al tutor
    const student = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: { tutorId: true },
    });
    if (!student || student.tutorId !== tutorId) {
      throw new ForbiddenException('No tienes acceso a este alumno');
    }

    const enrollments = await this.prisma.enrollment.findMany({
      where: { userId: studentId },
      select: {
        course: {
          select: { id: true, title: true, schoolYear: { select: { id: true, name: true, label: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return enrollments.map((e) => e.course);
  }
}
