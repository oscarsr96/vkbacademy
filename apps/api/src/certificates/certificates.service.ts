import { Injectable, NotFoundException } from '@nestjs/common';
import { CertificateType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { Certificate as CertificateDto } from '@vkbacademy/shared';

// Tipo interno de Certificate con sus relaciones
type CertificateWithIncludes = {
  id: string;
  type: CertificateType;
  verifyCode: string;
  examScore: number | null;
  issuedAt: Date;
  userId: string;
  courseId: string | null;
  moduleId: string | null;
  studyPlanId: string | null;
  user: { id: string; name: string };
  course: { id: string; title: string } | null;
  studyPlan: { id: string; title: string; courseId: string } | null;
  module: {
    id: string;
    title: string;
    course: { id: string; title: string };
  } | null;
};

/** Niveles de examen de un curso de estudio; hay que aprobar los tres. */
const STUDY_EXAM_LEVELS = ['BASIC', 'MEDIUM', 'HARD'] as const;

/** Mismo umbral que muestra la pestaña de Examen al alumno. */
const STUDY_EXAM_PASS_SCORE = 50;

@Injectable()
export class CertificatesService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Mapeo interno a DTO público ──────────────────────────────────────────

  private mapCertificate(c: CertificateWithIncludes): CertificateDto {
    return {
      id: c.id,
      type: c.type,
      verifyCode: c.verifyCode,
      examScore: c.examScore,
      issuedAt: c.issuedAt.toISOString(),
      recipientName: c.user.name,
      // En STUDY_EXAM lo que se acredita es el curso de estudio del alumno:
      // su título es el de sus temas, no el de la asignatura base.
      scopeTitle: c.studyPlan?.title ?? c.course?.title ?? c.module?.title ?? '',
      scopeId: c.studyPlanId ?? c.courseId ?? c.moduleId ?? '',
      courseId: c.studyPlan?.courseId ?? c.courseId ?? c.module?.course.id ?? undefined,
      courseTitle: c.module ? c.module.course.title : undefined,
    };
  }

  // ─── Emitir certificado (idempotente) ─────────────────────────────────────

  private async issueCertificate(
    userId: string,
    scopeId: string,
    scopeType: 'course' | 'module',
    type: CertificateType,
    examScore?: number,
  ): Promise<void> {
    // Verificar idempotencia: no duplicar si ya existe ese combo
    const where =
      scopeType === 'course'
        ? { userId, courseId: scopeId, type }
        : { userId, moduleId: scopeId, type };

    const existing = await this.prisma.certificate.findFirst({ where });
    if (existing) return;

    await this.prisma.certificate.create({
      data: {
        userId,
        courseId: scopeType === 'course' ? scopeId : null,
        moduleId: scopeType === 'module' ? scopeId : null,
        type,
        examScore: examScore ?? null,
      },
    });
  }

  // ─── Hook: completar lección → emitir MODULE_COMPLETION / COURSE_COMPLETION

  async checkAndIssueLessonCertificates(userId: string, lessonId: string): Promise<void> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: {
        moduleId: true,
        module: {
          select: {
            id: true,
            courseId: true,
            lessons: { select: { id: true } },
            course: {
              select: {
                id: true,
                modules: {
                  select: { lessons: { select: { id: true } } },
                },
              },
            },
          },
        },
      },
    });

    if (!lesson) return;

    const moduleId = lesson.module.id;
    const courseId = lesson.module.courseId;
    const moduleLessonIds = lesson.module.lessons.map((l) => l.id);
    const allLessonIds = lesson.module.course.modules.flatMap((m) => m.lessons.map((l) => l.id));

    // Comprobar si el módulo está completo
    if (moduleLessonIds.length > 0) {
      const completedInModule = await this.prisma.userProgress.count({
        where: {
          userId,
          lessonId: { in: moduleLessonIds },
          completed: true,
        },
      });
      if (completedInModule === moduleLessonIds.length) {
        await this.issueCertificate(userId, moduleId, 'module', CertificateType.MODULE_COMPLETION);
      }
    }

    // Comprobar si el curso completo está terminado
    if (allLessonIds.length > 0) {
      const completedInCourse = await this.prisma.userProgress.count({
        where: {
          userId,
          lessonId: { in: allLessonIds },
          completed: true,
        },
      });
      if (completedInCourse === allLessonIds.length) {
        await this.issueCertificate(userId, courseId, 'course', CertificateType.COURSE_COMPLETION);
      }
    }
  }

  // ─── Hook: entregar examen → emitir MODULE_EXAM / COURSE_EXAM ─────────────

  async issueExamCertificate(userId: string, attemptId: string, score: number): Promise<void> {
    if (score < 50) return;

    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      select: { courseId: true, moduleId: true, aiExamBankId: true },
    });

    if (!attempt) return;

    // Examen de un curso de estudio (generado por IA). No emite el certificado
    // oficial del club, sino el suyo propio, y solo con los tres niveles
    // aprobados: ver issueStudyPlanCertificate.
    if (attempt.aiExamBankId) {
      await this.issueStudyPlanCertificate(userId, attempt.aiExamBankId);
      return;
    }

    if (attempt.courseId) {
      await this.issueCertificate(
        userId,
        attempt.courseId,
        'course',
        CertificateType.COURSE_EXAM,
        score,
      );
    } else if (attempt.moduleId) {
      await this.issueCertificate(
        userId,
        attempt.moduleId,
        'module',
        CertificateType.MODULE_EXAM,
        score,
      );
    }
  }

  /**
   * Certificado de un curso de estudio: se emite al aprobar SUS TRES NIVELES.
   *
   * Hasta ahora los exámenes generados por IA no emitían nada, con el criterio
   * de que solo certificaba lo curado por el club. Pero el flujo oficial
   * (cursos y módulos con banco de preguntas de admin) ya no tiene entrada en
   * la app del alumno, así que en la práctica ningún alumno podía obtener un
   * certificado: la pantalla de Certificados, la de admin y la verificación
   * pública estaban condenadas a estar vacías.
   *
   * Se exige aprobar básico, medio y difícil porque es la meta que la propia
   * pestaña de Examen ya le plantea al alumno ("Apruébalo en 3 niveles"). Con
   * un solo examen aprobado el certificado no diría gran cosa.
   *
   * La nota que se guarda es la media de la mejor de cada nivel.
   */
  private async issueStudyPlanCertificate(userId: string, aiExamBankId: string): Promise<void> {
    const bank = await this.prisma.aiExamBank.findUnique({
      where: { id: aiExamBankId },
      select: { studyPlanId: true },
    });
    // Bancos sueltos (un tema, sin plan) o legacy: no hay curso que certificar
    if (!bank?.studyPlanId) return;

    const existing = await this.prisma.certificate.findFirst({
      where: { userId, studyPlanId: bank.studyPlanId, type: CertificateType.STUDY_EXAM },
    });
    if (existing) return;

    // Mejor nota por nivel, mirando solo los exámenes de ESTE curso de estudio
    const attempts = await this.prisma.examAttempt.findMany({
      where: {
        userId,
        score: { not: null },
        aiExamBank: { studyPlanId: bank.studyPlanId, level: { not: null } },
      },
      select: { score: true, aiExamBank: { select: { level: true } } },
    });

    const mejorPorNivel = new Map<string, number>();
    for (const a of attempts) {
      const level = a.aiExamBank?.level;
      if (!level || a.score === null) continue;
      mejorPorNivel.set(level, Math.max(mejorPorNivel.get(level) ?? 0, a.score));
    }

    const aprobados = STUDY_EXAM_LEVELS.filter(
      (level) => (mejorPorNivel.get(level) ?? 0) >= STUDY_EXAM_PASS_SCORE,
    );
    if (aprobados.length < STUDY_EXAM_LEVELS.length) return;

    const media =
      aprobados.reduce((sum, level) => sum + (mejorPorNivel.get(level) ?? 0), 0) / aprobados.length;

    await this.prisma.certificate.create({
      data: {
        userId,
        studyPlanId: bank.studyPlanId,
        type: CertificateType.STUDY_EXAM,
        examScore: Math.round(media * 10) / 10,
      },
    });
  }

  // ─── Emisión manual (admin) ───────────────────────────────────────────────

  async issueManual(params: {
    userId: string;
    courseId?: string;
    moduleId?: string;
    type: CertificateType;
    examScore?: number;
  }): Promise<CertificateDto> {
    const scopeType = params.courseId ? 'course' : 'module';
    const scopeId = (params.courseId ?? params.moduleId)!;

    // Crear directamente sin verificar idempotencia (el admin puede emitir múltiples)
    const cert = await this.prisma.certificate.create({
      data: {
        userId: params.userId,
        courseId: params.courseId ?? null,
        moduleId: params.moduleId ?? null,
        type: params.type,
        examScore: params.examScore ?? null,
      },
      include: {
        user: { select: { id: true, name: true } },
        course: { select: { id: true, title: true } },
        studyPlan: { select: { id: true, title: true, courseId: true } },
        module: {
          select: {
            id: true,
            title: true,
            course: { select: { id: true, title: true } },
          },
        },
      },
    });

    // Silenciar advertencia de TypeScript sobre scopeType no usada
    void scopeType;
    void scopeId;

    return this.mapCertificate(cert as CertificateWithIncludes);
  }

  // ─── Mis certificados ─────────────────────────────────────────────────────

  async getMyCertificates(userId: string): Promise<CertificateDto[]> {
    const certs = await this.prisma.certificate.findMany({
      where: { userId },
      include: {
        user: { select: { id: true, name: true } },
        course: { select: { id: true, title: true } },
        studyPlan: { select: { id: true, title: true, courseId: true } },
        module: {
          select: {
            id: true,
            title: true,
            course: { select: { id: true, title: true } },
          },
        },
      },
      orderBy: { issuedAt: 'desc' },
    });

    return certs.map((c) => this.mapCertificate(c as CertificateWithIncludes));
  }

  // ─── Un certificado por ID ────────────────────────────────────────────────

  async getOne(id: string, userId: string): Promise<CertificateDto> {
    const cert = await this.prisma.certificate.findFirst({
      where: { id, userId },
      include: {
        user: { select: { id: true, name: true } },
        course: { select: { id: true, title: true } },
        studyPlan: { select: { id: true, title: true, courseId: true } },
        module: {
          select: {
            id: true,
            title: true,
            course: { select: { id: true, title: true } },
          },
        },
      },
    });

    if (!cert) throw new NotFoundException('Certificado no encontrado');
    return this.mapCertificate(cert as CertificateWithIncludes);
  }

  // ─── Verificación pública por código ─────────────────────────────────────

  async verify(code: string) {
    const cert = await this.prisma.certificate.findUnique({
      where: { verifyCode: code },
      include: {
        user: { select: { id: true, name: true } },
        course: { select: { id: true, title: true } },
        studyPlan: { select: { id: true, title: true, courseId: true } },
        module: {
          select: {
            id: true,
            title: true,
            course: { select: { id: true, title: true } },
          },
        },
      },
    });

    if (!cert) return { valid: false };

    const scopeTitle = cert.studyPlan?.title ?? cert.course?.title ?? cert.module?.title ?? '';
    const courseTitle = cert.module ? cert.module.course.title : undefined;

    return {
      valid: true,
      certificate: {
        id: cert.id,
        type: cert.type,
        verifyCode: cert.verifyCode,
        examScore: cert.examScore,
        issuedAt: cert.issuedAt.toISOString(),
        scopeTitle,
        scopeId: cert.studyPlanId ?? cert.courseId ?? cert.moduleId ?? '',
        courseId: cert.studyPlan?.courseId ?? cert.courseId ?? cert.module?.course.id ?? undefined,
        courseTitle,
      },
    };
  }

  // ─── Todos los certificados (admin) ──────────────────────────────────────

  async getAllCertificates(params?: { page?: number; limit?: number }) {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 10;
    const skip = (page - 1) * limit;

    const [certs, total, byTypeRaw] = await Promise.all([
      this.prisma.certificate.findMany({
        skip,
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true } },
          course: { select: { id: true, title: true } },
          studyPlan: { select: { id: true, title: true, courseId: true } },
          module: {
            select: {
              id: true,
              title: true,
              course: { select: { id: true, title: true } },
            },
          },
        },
        orderBy: { issuedAt: 'desc' },
      }),
      this.prisma.certificate.count(),
      this.prisma.certificate.groupBy({ by: ['type'], _count: { _all: true } }),
    ]);

    const byType = Object.fromEntries(
      byTypeRaw.map((row) => [row.type, row._count._all]),
    ) as Record<CertificateType, number>;

    return {
      data: certs.map((c) => ({
        id: c.id,
        type: c.type,
        verifyCode: c.verifyCode,
        examScore: c.examScore,
        issuedAt: c.issuedAt.toISOString(),
        recipientName: c.user.name,
        recipientEmail: c.user.email,
        scopeTitle: c.studyPlan?.title ?? c.course?.title ?? c.module?.title ?? '',
        courseTitle: c.module ? c.module.course.title : undefined,
      })),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      stats: { byType },
    };
  }
}
