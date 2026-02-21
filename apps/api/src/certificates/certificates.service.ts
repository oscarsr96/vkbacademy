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
  user: { id: string; name: string };
  course: { id: string; title: string } | null;
  module: {
    id: string;
    title: string;
    course: { id: string; title: string };
  } | null;
};

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
      scopeTitle: c.course?.title ?? c.module?.title ?? '',
      scopeId: c.courseId ?? c.moduleId ?? '',
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

  async checkAndIssueLessonCertificates(
    userId: string,
    lessonId: string,
  ): Promise<void> {
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
    const allLessonIds = lesson.module.course.modules.flatMap((m) =>
      m.lessons.map((l) => l.id),
    );

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
        await this.issueCertificate(
          userId,
          moduleId,
          'module',
          CertificateType.MODULE_COMPLETION,
        );
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
        await this.issueCertificate(
          userId,
          courseId,
          'course',
          CertificateType.COURSE_COMPLETION,
        );
      }
    }
  }

  // ─── Hook: entregar examen → emitir MODULE_EXAM / COURSE_EXAM ─────────────

  async issueExamCertificate(
    userId: string,
    attemptId: string,
    score: number,
  ): Promise<void> {
    if (score < 50) return;

    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      select: { courseId: true, moduleId: true },
    });

    if (!attempt) return;

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

    const scopeTitle = cert.course?.title ?? cert.module?.title ?? '';
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
        scopeId: cert.courseId ?? cert.moduleId ?? '',
        courseTitle,
      },
    };
  }

  // ─── Todos los certificados (admin) ──────────────────────────────────────

  async getAllCertificates() {
    const certs = await this.prisma.certificate.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        course: { select: { id: true, title: true } },
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

    return certs.map((c) => ({
      id: c.id,
      type: c.type,
      verifyCode: c.verifyCode,
      examScore: c.examScore,
      issuedAt: c.issuedAt.toISOString(),
      recipientName: c.user.name,
      recipientEmail: c.user.email,
      scopeTitle: c.course?.title ?? c.module?.title ?? '',
      courseTitle: c.module ? c.module.course.title : undefined,
    }));
  }
}
