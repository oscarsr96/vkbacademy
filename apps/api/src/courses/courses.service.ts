import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll({
    page,
    limit,
    role,
    schoolYearId,
    schoolYearIdFilter,
  }: {
    page: number;
    limit: number;
    role: Role;
    schoolYearId: string | null;
    schoolYearIdFilter?: string;
  }) {
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (role === Role.STUDENT) {
      // El STUDENT solo ve cursos publicados de su nivel
      where.published = true;
      if (schoolYearId) {
        where.schoolYearId = schoolYearId;
      } else {
        // Sin nivel asignado: no se muestran cursos
        where.id = { in: [] };
      }
    } else {
      // TUTOR/TEACHER/ADMIN ven todos los cursos (publicados o no)
      if (schoolYearIdFilter) {
        where.schoolYearId = schoolYearIdFilter;
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.course.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          schoolYear: { select: { id: true, name: true, label: true } },
        },
      }),
      this.prisma.course.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(
    id: string,
    user?: Pick<{ role: Role; schoolYearId: string | null }, 'role' | 'schoolYearId'>,
  ) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        schoolYear: { select: { id: true, name: true, label: true } },
        modules: {
          orderBy: { order: 'asc' },
          include: {
            lessons: {
              orderBy: { order: 'asc' },
              select: {
                id: true,
                title: true,
                type: true,
                order: true,
                moduleId: true,
                youtubeId: true,
              },
            },
          },
        },
      },
    });

    if (!course) throw new NotFoundException('Curso no encontrado');

    // Bloquear acceso a STUDENTs fuera de su nivel
    if (user?.role === Role.STUDENT) {
      if (course.schoolYearId && course.schoolYearId !== user.schoolYearId) {
        throw new ForbiddenException('No tienes acceso a este curso');
      }
    }

    return course;
  }

  async getCourseProgress(
    courseId: string,
    userId: string,
    user?: Pick<{ role: Role; schoolYearId: string | null }, 'role' | 'schoolYearId'>,
  ) {
    const course = await this.findOne(courseId, user);
    const lessonIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id));

    const completedRecords = await this.prisma.userProgress.findMany({
      where: { userId, lessonId: { in: lessonIds }, completed: true },
      select: { lessonId: true },
    });

    const completedLessonIds = completedRecords.map((r) => r.lessonId);

    return {
      courseId,
      totalLessons: lessonIds.length,
      completedLessons: completedLessonIds.length,
      percentageComplete:
        lessonIds.length > 0
          ? Math.round((completedLessonIds.length / lessonIds.length) * 100)
          : 0,
      completedLessonIds,
    };
  }

  /** Progreso detallado de un alumno en un curso — solo accesible para TEACHER/ADMIN */
  async getStudentCourseProgress(courseId: string, studentId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        modules: {
          orderBy: { order: 'asc' },
          include: {
            lessons: {
              orderBy: { order: 'asc' },
              select: { id: true, title: true, type: true, order: true },
            },
          },
        },
      },
    });

    if (!course) throw new NotFoundException('Curso no encontrado');

    const lessonIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id));

    const completedRecords = await this.prisma.userProgress.findMany({
      where: { userId: studentId, lessonId: { in: lessonIds }, completed: true },
      select: { lessonId: true },
    });

    const completedSet = new Set(completedRecords.map((r) => r.lessonId));

    const modules = course.modules.map((m) => ({
      id: m.id,
      title: m.title,
      order: m.order,
      totalLessons: m.lessons.length,
      completedLessons: m.lessons.filter((l) => completedSet.has(l.id)).length,
    }));

    return {
      courseId,
      courseTitle: course.title,
      totalLessons: lessonIds.length,
      completedLessons: completedSet.size,
      percentageComplete:
        lessonIds.length > 0
          ? Math.round((completedSet.size / lessonIds.length) * 100)
          : 0,
      modules,
    };
  }

  async create(dto: CreateCourseDto) {
    return this.prisma.course.create({ data: dto });
  }

  async update(id: string, dto: UpdateCourseDto) {
    await this.findOne(id);
    return this.prisma.course.update({ where: { id }, data: dto });
  }
}
