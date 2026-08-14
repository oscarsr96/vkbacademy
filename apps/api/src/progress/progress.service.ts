import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChallengesService } from '../challenges/challenges.service';
import { CertificatesService } from '../certificates/certificates.service';

@Injectable()
export class ProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly challenges: ChallengesService,
    private readonly certificates: CertificatesService,
  ) {}

  /** Detalle de lección con youtubeId y progreso del usuario */
  async findLesson(lessonId: string, userId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        quiz: {
          include: {
            questions: {
              orderBy: { order: 'asc' },
              include: {
                answers: {
                  select: {
                    id: true,
                    text: true,
                    // isCorrect excluido deliberadamente
                  },
                },
              },
            },
          },
        },
        progress: {
          where: { userId },
          take: 1,
        },
      },
    });

    if (!lesson) throw new NotFoundException('Lección no encontrada');

    const { progress, ...lessonData } = lesson;

    return {
      ...lessonData,
      progress: progress[0] ?? null,
    };
  }

  /** Últimas N lecciones completadas por el usuario, con contexto de módulo y curso */
  async recentLessons(userId: string, take = 5) {
    const entries = await this.prisma.userProgress.findMany({
      where: { userId, completed: true },
      orderBy: { completedAt: 'desc' },
      take,
      include: {
        lesson: {
          include: {
            module: {
              include: {
                course: { select: { id: true, title: true } },
              },
            },
          },
        },
      },
    });

    return entries.map((e) => ({
      lessonId: e.lessonId,
      lessonTitle: e.lesson.title,
      lessonType: e.lesson.type,
      moduleTitle: e.lesson.module.title,
      courseId: e.lesson.module.course.id,
      courseTitle: e.lesson.module.course.title,
      completedAt: e.completedAt,
    }));
  }

  async completeLesson(lessonId: string, userId: string) {
    const result = await this.prisma.userProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      update: { completed: true, completedAt: new Date() },
      create: { userId, lessonId, completed: true, completedAt: new Date() },
    });

    // El temario clásico ya no alimenta ningún reto de ejercicio, pero sigue siendo actividad: la llamada mantiene vivas las rachas diaria y semanal.
    void this.challenges.checkAndAward(userId);

    // Verificar y emitir certificados de completado en segundo plano
    void this.certificates.checkAndIssueLessonCertificates(userId, lessonId);

    return result;
  }
}
