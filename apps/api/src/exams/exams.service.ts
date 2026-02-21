import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CertificatesService } from '../certificates/certificates.service';
import { StartExamDto } from './dto/start-exam.dto';
import { SubmitExamDto } from './dto/submit-exam.dto';

// Snapshot de pregunta almacenado en ExamAttempt.questionsSnapshot
interface QuestionSnapshot {
  id: string;
  text: string;
  type: string;
  answers: { id: string; text: string; isCorrect: boolean }[];
}

// Fisher-Yates shuffle
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

@Injectable()
export class ExamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly certificates: CertificatesService,
  ) {}

  // ─── Info del banco de preguntas ──────────────────────────────────────────

  async getBankInfo(params: { courseId?: string; moduleId?: string }, userId: string) {
    const { courseId, moduleId } = params;
    if (!courseId && !moduleId) {
      throw new BadRequestException('Debes especificar courseId o moduleId');
    }

    const where = courseId ? { courseId } : { moduleId };

    const [questionCount, recentAttempts, scope] = await Promise.all([
      this.prisma.examQuestion.count({ where }),
      this.prisma.examAttempt.findMany({
        where: { userId, ...where, submittedAt: { not: null } },
        orderBy: { submittedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          score: true,
          numQuestions: true,
          submittedAt: true,
        },
      }),
      courseId
        ? this.prisma.course.findUnique({ where: { id: courseId }, select: { id: true, title: true } })
        : this.prisma.module.findUnique({ where: { id: moduleId }, select: { id: true, title: true } }),
    ]);

    if (!scope) {
      throw new NotFoundException('Curso o módulo no encontrado');
    }

    return {
      questionCount,
      scope: courseId ? 'course' : 'module',
      scopeId: scope.id,
      scopeTitle: scope.title,
      recentAttempts: recentAttempts.map((a) => ({
        attemptId: a.id,
        score: a.score!,
        numQuestions: a.numQuestions,
        submittedAt: a.submittedAt!.toISOString(),
      })),
    };
  }

  // ─── Iniciar examen ───────────────────────────────────────────────────────

  async startExam(userId: string, dto: StartExamDto) {
    const { courseId, moduleId, numQuestions, timeLimit, onlyOnce } = dto;

    if (!courseId && !moduleId) {
      throw new BadRequestException('Debes especificar courseId o moduleId');
    }
    if (courseId && moduleId) {
      throw new BadRequestException('No puedes especificar courseId y moduleId a la vez');
    }

    const where = courseId ? { courseId } : { moduleId };

    // Obtener todas las preguntas del banco con respuestas
    const allQuestions = await this.prisma.examQuestion.findMany({
      where,
      include: { answers: true },
      orderBy: { order: 'asc' },
    });

    if (allQuestions.length < numQuestions) {
      throw new BadRequestException(
        `El banco solo tiene ${allQuestions.length} preguntas. Solicita ${allQuestions.length} o menos.`,
      );
    }

    // Seleccionar preguntas al azar (Fisher-Yates)
    const selected = shuffle(allQuestions).slice(0, numQuestions);

    // Construir snapshot (incluye isCorrect para corrección server-side)
    const questionsSnapshot: QuestionSnapshot[] = selected.map((q) => ({
      id: q.id,
      text: q.text,
      type: q.type,
      answers: q.answers.map((a) => ({
        id: a.id,
        text: a.text,
        isCorrect: a.isCorrect,
      })),
    }));

    // Crear intento en BD
    const attempt = await this.prisma.examAttempt.create({
      data: {
        userId,
        courseId: courseId ?? null,
        moduleId: moduleId ?? null,
        numQuestions,
        timeLimit: timeLimit ?? null,
        onlyOnce: onlyOnce ?? false,
        questionsSnapshot: questionsSnapshot as object[],
        answers: [],
      },
    });

    // Retornar preguntas SIN isCorrect
    return {
      attemptId: attempt.id,
      questions: questionsSnapshot.map((q) => ({
        id: q.id,
        text: q.text,
        type: q.type,
        answers: q.answers.map((a) => ({ id: a.id, text: a.text })),
      })),
      numQuestions,
      timeLimit: timeLimit ?? null,
      onlyOnce: onlyOnce ?? false,
      startedAt: attempt.startedAt.toISOString(),
    };
  }

  // ─── Entregar examen ──────────────────────────────────────────────────────

  async submitExam(attemptId: string, userId: string, dto: SubmitExamDto) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
    });

    if (!attempt) throw new NotFoundException('Intento no encontrado');
    if (attempt.userId !== userId) throw new ForbiddenException('No autorizado');
    if (attempt.submittedAt) throw new BadRequestException('Este examen ya fue entregado');

    const snapshot = attempt.questionsSnapshot as unknown as QuestionSnapshot[];
    const answers = dto.answers;

    // Calcular correcciones
    let correctCount = 0;
    const corrections = snapshot.map((q) => {
      const userAnswer = answers.find((a) => a.questionId === q.id);
      const correctAnswer = q.answers.find((a) => a.isCorrect);
      const selectedAnswer = userAnswer
        ? q.answers.find((a) => a.id === userAnswer.answerId)
        : null;
      const isCorrect = !!userAnswer && userAnswer.answerId === correctAnswer?.id;
      if (isCorrect) correctCount++;
      return {
        questionId: q.id,
        questionText: q.text,
        selectedAnswerId: userAnswer?.answerId ?? null,
        selectedAnswerText: selectedAnswer?.text ?? null,
        correctAnswerId: correctAnswer?.id ?? '',
        correctAnswerText: correctAnswer?.text ?? '',
        isCorrect,
      };
    });

    const score = Math.round((correctCount / snapshot.length) * 100 * 10) / 10;
    const now = new Date();

    await this.prisma.examAttempt.update({
      where: { id: attemptId },
      data: {
        score,
        answers: answers as object[],
        submittedAt: now,
      },
    });

    // Emitir certificado de examen en segundo plano si el score supera el mínimo
    void this.certificates.issueExamCertificate(userId, attemptId, score);

    return {
      attemptId,
      score,
      numQuestions: snapshot.length,
      correctCount,
      submittedAt: now.toISOString(),
      corrections,
    };
  }

  // ─── Exámenes disponibles para el usuario ────────────────────────────────

  async getAvailable(userId: string) {
    // Obtener los cursos en los que el alumno está matriculado
    const enrollments = await this.prisma.enrollment.findMany({
      where: { userId },
      select: { courseId: true },
    });
    const courseIds = enrollments.map((e) => e.courseId);

    if (courseIds.length === 0) return { courses: [], modules: [] };

    // Bancos de curso con preguntas
    const courseQuestionCounts = await this.prisma.examQuestion.groupBy({
      by: ['courseId'],
      where: { courseId: { in: courseIds } },
      _count: { id: true },
    });

    // Bancos de módulo con preguntas (solo módulos de cursos matriculados)
    const moduleQuestionCounts = await this.prisma.examQuestion.groupBy({
      by: ['moduleId'],
      where: {
        moduleId: { not: null },
        module: { courseId: { in: courseIds } },
      },
      _count: { id: true },
    });

    // Cargar info de cursos con banco
    const coursesWithBank = courseQuestionCounts.filter((c) => c.courseId && c._count.id > 0);
    const modulesWithBank = moduleQuestionCounts.filter((m) => m.moduleId && m._count.id > 0);

    const [courseData, moduleData] = await Promise.all([
      coursesWithBank.length > 0
        ? this.prisma.course.findMany({
            where: { id: { in: coursesWithBank.map((c) => c.courseId!) } },
            select: {
              id: true,
              title: true,
              schoolYear: { select: { label: true } },
            },
          })
        : [],
      modulesWithBank.length > 0
        ? this.prisma.module.findMany({
            where: { id: { in: modulesWithBank.map((m) => m.moduleId!) } },
            select: {
              id: true,
              title: true,
              course: { select: { id: true, title: true } },
            },
          })
        : [],
    ]);

    // Últimos intentos del usuario por scope
    const [lastCourseAttempts, lastModuleAttempts] = await Promise.all([
      coursesWithBank.length > 0
        ? this.prisma.examAttempt.findMany({
            where: {
              userId,
              courseId: { in: coursesWithBank.map((c) => c.courseId!) },
              submittedAt: { not: null },
            },
            orderBy: { submittedAt: 'desc' },
            select: { courseId: true, score: true, submittedAt: true },
          })
        : [],
      modulesWithBank.length > 0
        ? this.prisma.examAttempt.findMany({
            where: {
              userId,
              moduleId: { in: modulesWithBank.map((m) => m.moduleId!) },
              submittedAt: { not: null },
            },
            orderBy: { submittedAt: 'desc' },
            select: { moduleId: true, score: true, submittedAt: true },
          })
        : [],
    ]);

    // Construir mapas de último intento
    const lastCourseAttemptMap = new Map<string, { score: number; submittedAt: Date }>();
    for (const a of lastCourseAttempts) {
      if (a.courseId && !lastCourseAttemptMap.has(a.courseId)) {
        lastCourseAttemptMap.set(a.courseId, { score: a.score!, submittedAt: a.submittedAt! });
      }
    }
    const lastModuleAttemptMap = new Map<string, { score: number; submittedAt: Date }>();
    for (const a of lastModuleAttempts) {
      if (a.moduleId && !lastModuleAttemptMap.has(a.moduleId)) {
        lastModuleAttemptMap.set(a.moduleId, { score: a.score!, submittedAt: a.submittedAt! });
      }
    }

    const courseCountMap = new Map(coursesWithBank.map((c) => [c.courseId!, c._count.id]));
    const moduleCountMap = new Map(modulesWithBank.map((m) => [m.moduleId!, m._count.id]));

    return {
      courses: (courseData as { id: string; title: string; schoolYear: { label: string } | null }[]).map((c) => {
        const last = lastCourseAttemptMap.get(c.id);
        return {
          courseId: c.id,
          title: c.title,
          schoolYear: c.schoolYear?.label ?? null,
          questionCount: courseCountMap.get(c.id) ?? 0,
          lastAttempt: last
            ? { score: last.score, submittedAt: last.submittedAt.toISOString() }
            : null,
        };
      }),
      modules: (moduleData as { id: string; title: string; course: { id: string; title: string } }[]).map((m) => {
        const last = lastModuleAttemptMap.get(m.id);
        return {
          moduleId: m.id,
          title: m.title,
          courseId: m.course.id,
          courseTitle: m.course.title,
          questionCount: moduleCountMap.get(m.id) ?? 0,
          lastAttempt: last
            ? { score: last.score, submittedAt: last.submittedAt.toISOString() }
            : null,
        };
      }),
    };
  }

  // ─── Historial de intentos ────────────────────────────────────────────────

  async getHistory(params: { courseId?: string; moduleId?: string }, userId: string) {
    if (!params.courseId && !params.moduleId) {
      throw new BadRequestException('Debes especificar courseId o moduleId');
    }

    const where = params.courseId ? { courseId: params.courseId } : { moduleId: params.moduleId };

    const attempts = await this.prisma.examAttempt.findMany({
      where: { userId, ...where },
      orderBy: { startedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        score: true,
        numQuestions: true,
        timeLimit: true,
        onlyOnce: true,
        startedAt: true,
        submittedAt: true,
      },
    });

    return attempts.map((a) => ({
      attemptId: a.id,
      score: a.score,
      numQuestions: a.numQuestions,
      timeLimit: a.timeLimit,
      onlyOnce: a.onlyOnce,
      startedAt: a.startedAt.toISOString(),
      submittedAt: a.submittedAt?.toISOString() ?? null,
    }));
  }
}
