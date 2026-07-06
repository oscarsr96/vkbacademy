import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, StudyTopicSource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TheoryService } from '../theory/theory.service';
import { ExercisesService, GeneratedTopicExercise } from '../exercises/exercises.service';
import { AiExamsService } from '../exams/ai-exams.service';
import { CreateStudyPlanDto, StudyPlanTopicInputDto } from './dto/create-study-plan.dto';
import { RegenerateExercisesDto } from '../study/dto/regenerate-exercises.dto';
import { RegenerateExamDto } from '../study/dto/regenerate-exam.dto';

// Tema del payload ya resuelto contra matrículas y temario (regla de coherencia).
export interface ResolvedTopic {
  source: StudyTopicSource;
  moduleId: string | null;
  title: string;
  subject: string | null;
  contextCourseId: string;
}

/**
 * Plan de estudio multi-tema: combina N temas (oficiales del temario o libres)
 * en teoría POR TEMA (N decks) + ejercicios y examen COMBINADOS (1 llamada
 * cada uno), simulando exámenes reales. Flujo adicional al un-tema
 * (StudyService/StudyUnit), que no se toca. Personal (scoped por userId).
 */
@Injectable()
export class StudyPlansService {
  private readonly logger = new Logger(StudyPlansService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly theory: TheoryService,
    private readonly exercises: ExercisesService,
    private readonly aiExams: AiExamsService,
  ) {}

  // Normalización para comparar materias y detectar duplicados: minúsculas y sin acentos.
  private normalize(s: string): string {
    return s
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private async assertEnrolled(userId: string, courseId: string): Promise<void> {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException(`Curso "${courseId}" no encontrado`);
    const enrollment = await this.prisma.enrollment.findFirst({ where: { userId, courseId } });
    if (!enrollment) throw new ForbiddenException('No estás matriculado en este curso');
  }

  /**
   * Regla de coherencia (determinista, sin IA) — única fuente de verdad, se
   * ejecuta dentro del create. Para cada tema del payload, en orden:
   *  1. moduleId (OFFICIAL): válido si el alumno está matriculado en el curso
   *     del módulo (base u otro). contextCourseId = curso del módulo.
   *  2. title sin subject (CUSTOM in-subject): coherente por construcción,
   *     se atribuye a la asignatura base. contextCourseId = curso base.
   *  3. title con subject (CUSTOM fuera de asignatura): válido si y solo si el
   *     alumno está matriculado en ≥1 curso de esa materia (comparación
   *     normalizada). contextCourseId = primer curso matriculado de la materia.
   * Además: sin temas duplicados (mismo moduleId o mismo título normalizado).
   */
  async resolveAndAssertTopics(
    userId: string,
    baseCourseId: string,
    topics: StudyPlanTopicInputDto[],
  ): Promise<ResolvedTopic[]> {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      include: { course: { select: { id: true, subject: true } } },
    });
    const enrolledCourseIds = new Set(enrollments.map((e) => e.courseId));

    const resolved: ResolvedTopic[] = [];
    for (const input of topics) {
      const hasModule = typeof input.moduleId === 'string' && input.moduleId.length > 0;
      const hasTitle = typeof input.title === 'string' && input.title.trim().length > 0;
      if (hasModule === hasTitle) {
        throw new BadRequestException(
          'Cada tema debe llevar moduleId (tema oficial) o title (tema propio), pero no ambos',
        );
      }
      if (!hasTitle && input.subject) {
        throw new BadRequestException(
          'subject solo puede acompañar a un tema propio (title), no a un tema oficial',
        );
      }

      if (hasModule) {
        // 1. Tema oficial del temario
        const module = await this.prisma.module.findUnique({
          where: { id: input.moduleId },
          select: { id: true, title: true, courseId: true },
        });
        if (!module) {
          throw new NotFoundException(`Módulo "${input.moduleId}" no encontrado`);
        }
        if (!enrolledCourseIds.has(module.courseId)) {
          throw new ForbiddenException(
            `No estás matriculado en el curso al que pertenece el tema "${module.title}"`,
          );
        }
        resolved.push({
          source: StudyTopicSource.OFFICIAL,
          moduleId: module.id,
          title: module.title,
          subject: null,
          contextCourseId: module.courseId,
        });
      } else if (!input.subject) {
        // 2. Tema propio sin materia: se atribuye a la asignatura base
        resolved.push({
          source: StudyTopicSource.CUSTOM,
          moduleId: null,
          title: input.title!.trim(),
          subject: null,
          contextCourseId: baseCourseId,
        });
      } else {
        // 3. Tema propio de otra asignatura: exige matrícula en esa materia
        const wanted = this.normalize(input.subject);
        const match = enrollments.find(
          (e) => e.course.subject && this.normalize(e.course.subject) === wanted,
        );
        if (!match) {
          const subjects = [
            ...new Set(
              enrollments
                .map((e) => e.course.subject)
                .filter((s): s is string => !!s && s.trim().length > 0),
            ),
          ];
          throw new UnprocessableEntityException(
            `El tema "${input.title!.trim()}" está etiquetado como "${input.subject.trim()}", ` +
              `pero no estás matriculado en ninguna asignatura de esa materia. ` +
              `Materias válidas: ${subjects.join(', ') || '(ninguna)'}`,
          );
        }
        resolved.push({
          source: StudyTopicSource.CUSTOM,
          moduleId: null,
          title: input.title!.trim(),
          subject: input.subject.trim(),
          contextCourseId: match.courseId,
        });
      }
    }

    // Sin temas duplicados: mismo módulo o mismo título normalizado
    const seenModules = new Set<string>();
    const seenTitles = new Set<string>();
    for (const topic of resolved) {
      if (topic.moduleId) {
        if (seenModules.has(topic.moduleId)) {
          throw new UnprocessableEntityException(`Tema duplicado: "${topic.title}"`);
        }
        seenModules.add(topic.moduleId);
      }
      const normTitle = this.normalize(topic.title);
      if (seenTitles.has(normTitle)) {
        throw new UnprocessableEntityException(`Tema duplicado: "${topic.title}"`);
      }
      seenTitles.add(normTitle);
    }

    return resolved;
  }

  async create(userId: string, dto: CreateStudyPlanDto) {
    await this.assertEnrolled(userId, dto.courseId);

    if (dto.numQuestions < dto.topics.length) {
      throw new UnprocessableEntityException(
        `El examen debe tener al menos 1 pregunta por tema: con ${dto.topics.length} temas ` +
          `necesitas numQuestions ≥ ${dto.topics.length}`,
      );
    }

    const resolvedTopics = await this.resolveAndAssertTopics(userId, dto.courseId, dto.topics);

    // Plan "cáscara" + temas en una transacción (nested create)
    const plan = await this.prisma.studyPlan.create({
      data: {
        userId,
        courseId: dto.courseId,
        title: this.buildTitle(resolvedTopics),
        summary: '',
        difficulty: dto.difficulty,
        topics: {
          create: resolvedTopics.map((t, i) => ({
            order: i,
            source: t.source,
            moduleId: t.moduleId,
            title: t.title,
            subject: t.subject,
            contextCourseId: t.contextCourseId,
          })),
        },
      },
      include: { topics: { orderBy: { order: 'asc' } } },
    });

    // N teorías (una por tema, con su curso de contexto) + ejercicios y examen
    // combinados. allSettled: una sección que falle no tumba las demás.
    const topicTitles = plan.topics.map((t) => t.title);
    const [theoryResults, [exercisesRes], [examRes]] = await Promise.all([
      Promise.allSettled(
        plan.topics.map((t) =>
          this.theory.generate(userId, { courseId: t.contextCourseId, topic: t.title }),
        ),
      ),
      Promise.allSettled([
        this.exercises.generateForTopics(userId, {
          courseId: dto.courseId,
          topics: topicTitles,
          count: dto.numExercises,
          difficulty: dto.difficulty,
        }),
      ]),
      Promise.allSettled([
        this.aiExams.generateForTopics(userId, {
          courseId: dto.courseId,
          topics: topicTitles,
          numQuestions: dto.numQuestions,
          timeLimit: dto.timeLimit,
          onlyOnce: dto.onlyOnce,
          difficulty: dto.difficulty,
        }),
      ]),
    ]);

    const allFailed =
      theoryResults.every((r) => r.status === 'rejected') &&
      exercisesRes.status === 'rejected' &&
      examRes.status === 'rejected';
    if (allFailed) {
      this.logger.error('Todas las secciones fallaron al generar el plan de estudio');
      await this.prisma.studyPlan.delete({ where: { id: plan.id } });
      throw new InternalServerErrorException(
        'No se pudo generar ninguna sección. Inténtalo de nuevo en unos segundos.',
      );
    }

    // Enlace transaccional de lo logrado; lo fallido queda regenerable por sección.
    const ops: Prisma.PrismaPromise<unknown>[] = [];
    const data: Prisma.StudyPlanUpdateInput = {};
    const summaries: string[] = [];
    theoryResults.forEach((res, i) => {
      if (res.status === 'fulfilled') {
        ops.push(
          this.prisma.theoryModule.update({
            where: { id: res.value.id },
            data: { studyPlanTopicId: plan.topics[i].id },
          }) as unknown as Prisma.PrismaPromise<unknown>,
        );
        if (res.value.summary) summaries.push(res.value.summary);
      }
    });
    if (exercisesRes.status === 'fulfilled') {
      data.exercises = exercisesRes.value.exercises as unknown as Prisma.InputJsonValue;
    }
    if (examRes.status === 'fulfilled') {
      ops.push(
        this.prisma.aiExamBank.update({
          where: { id: examRes.value.id },
          data: { studyPlanId: plan.id },
        }) as unknown as Prisma.PrismaPromise<unknown>,
      );
    }
    data.summary = summaries.join(' · ').slice(0, 600);
    ops.push(
      this.prisma.studyPlan.update({
        where: { id: plan.id },
        data,
      }) as unknown as Prisma.PrismaPromise<unknown>,
    );
    try {
      await this.prisma.$transaction(ops);
    } catch (err) {
      // Si el enlace transaccional falla, no dejar un plan cáscara huérfano.
      await this.prisma.studyPlan.delete({ where: { id: plan.id } });
      throw err;
    }

    return this.getById(userId, plan.id);
  }

  private buildTitle(topics: { title: string }[]): string {
    return `Simulacro: ${topics.map((t) => t.title).join(' · ')}`.slice(0, 200);
  }

  async listMine(userId: string) {
    const plans = await this.prisma.studyPlan.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        course: { select: { id: true, title: true } },
        topics: {
          orderBy: { order: 'asc' },
          include: { theoryModule: { select: { id: true } } },
        },
        examBank: { select: { id: true } },
      },
    });
    return plans.map((p) => ({
      id: p.id,
      title: p.title,
      summary: p.summary,
      difficulty: p.difficulty,
      createdAt: p.createdAt.toISOString(),
      course: p.course,
      topics: p.topics.map((t) => this.serializeTopic(t)),
      sections: {
        theory: p.topics.length > 0 && p.topics.every((t) => !!t.theoryModule),
        exercises: Array.isArray(p.exercises) && (p.exercises as unknown[]).length > 0,
        exam: !!p.examBank,
      },
    }));
  }

  async getById(userId: string, id: string) {
    const plan = await this.prisma.studyPlan.findUnique({
      where: { id },
      include: {
        course: { select: { id: true, title: true } },
        topics: {
          orderBy: { order: 'asc' },
          include: { theoryModule: { select: { id: true } } },
        },
        examBank: { select: { id: true } },
      },
    });
    if (!plan) throw new NotFoundException('Plan de estudio no encontrado');
    if (plan.userId !== userId) throw new ForbiddenException('No tienes acceso a este plan');

    const topics = await Promise.all(
      plan.topics.map(async (t) => ({
        ...this.serializeTopic(t),
        theory: t.theoryModule ? await this.theory.getById(userId, t.theoryModule.id) : null,
      })),
    );
    // getBank serializa SIN isCorrect (mismo camino que StudyService.getById)
    const exam = plan.examBank ? await this.aiExams.getBank(userId, plan.examBank.id) : null;
    const exercises = Array.isArray(plan.exercises)
      ? (plan.exercises as unknown as GeneratedTopicExercise[])
      : null;

    return {
      id: plan.id,
      title: plan.title,
      summary: plan.summary,
      difficulty: plan.difficulty,
      createdAt: plan.createdAt.toISOString(),
      course: plan.course,
      topics,
      sections: {
        theory: topics.length > 0 && topics.every((t) => t.hasTheory),
        exercises: !!exercises && exercises.length > 0,
        exam: !!exam,
      },
      exercises,
      exam,
    };
  }

  async deleteById(userId: string, id: string): Promise<void> {
    const plan = await this.prisma.studyPlan.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });
    if (!plan) throw new NotFoundException('Plan de estudio no encontrado');
    if (plan.userId !== userId) throw new ForbiddenException('No tienes acceso a este plan');
    // Cascade: topics → decks de teoría; examBank vía studyPlanId
    await this.prisma.studyPlan.delete({ where: { id } });
  }

  // ── Regeneración por sección (para reintentar tras un fallo de IA) ──

  /** Regenera el deck de teoría de UN tema del plan. */
  async regenerateTopicTheory(userId: string, planId: string, topicId: string) {
    const plan = await this.requireOwnedPlan(userId, planId);
    const topic = plan.topics.find((t) => t.id === topicId);
    if (!topic) throw new NotFoundException('Tema no encontrado en este plan');

    if (topic.theoryModule) await this.theory.deleteById(userId, topic.theoryModule.id);
    const theory = await this.theory.generate(userId, {
      courseId: topic.contextCourseId,
      topic: topic.title,
    });
    await this.prisma.theoryModule.update({
      where: { id: theory.id },
      data: { studyPlanTopicId: topic.id },
    });
    return this.getById(userId, planId);
  }

  /** Regenera los ejercicios combinados del plan. */
  async regenerateExercises(userId: string, planId: string, dto: RegenerateExercisesDto) {
    const plan = await this.requireOwnedPlan(userId, planId);
    const prevCount = Array.isArray(plan.exercises) ? (plan.exercises as unknown[]).length : 0;
    const count = dto.count ?? (prevCount > 0 ? prevCount : 5);
    const res = await this.exercises.generateForTopics(userId, {
      courseId: plan.courseId,
      topics: plan.topics.map((t) => t.title),
      count,
      difficulty: plan.difficulty as 'EASY' | 'MEDIUM' | 'HARD',
    });
    await this.prisma.studyPlan.update({
      where: { id: plan.id },
      data: { exercises: res.exercises as unknown as Prisma.InputJsonValue },
    });
    return this.getById(userId, planId);
  }

  /** Regenera el examen combinado del plan. */
  async regenerateExam(userId: string, planId: string, dto: RegenerateExamDto) {
    const plan = await this.requireOwnedPlan(userId, planId);
    const numQuestions = dto.numQuestions ?? plan.examBank?.numQuestions ?? 5;
    if (numQuestions < plan.topics.length) {
      throw new UnprocessableEntityException(
        `El examen debe tener al menos 1 pregunta por tema: con ${plan.topics.length} temas ` +
          `necesitas numQuestions ≥ ${plan.topics.length}`,
      );
    }
    if (plan.examBank) await this.aiExams.deleteBank(userId, plan.examBank.id);
    const bank = await this.aiExams.generateForTopics(userId, {
      courseId: plan.courseId,
      topics: plan.topics.map((t) => t.title),
      numQuestions,
      timeLimit: dto.timeLimit ?? plan.examBank?.timeLimit ?? undefined,
      onlyOnce: dto.onlyOnce ?? plan.examBank?.onlyOnce,
      difficulty: plan.difficulty as 'EASY' | 'MEDIUM' | 'HARD',
    });
    await this.prisma.aiExamBank.update({
      where: { id: bank.id },
      data: { studyPlanId: plan.id },
    });
    return this.getById(userId, planId);
  }

  // ── Helpers ──

  private serializeTopic(topic: {
    id: string;
    order: number;
    source: StudyTopicSource;
    moduleId: string | null;
    title: string;
    subject: string | null;
    theoryModule: { id: string } | null;
  }) {
    return {
      id: topic.id,
      order: topic.order,
      source: topic.source,
      moduleId: topic.moduleId,
      title: topic.title,
      subject: topic.subject,
      hasTheory: !!topic.theoryModule,
    };
  }

  private async requireOwnedPlan(userId: string, id: string) {
    const plan = await this.prisma.studyPlan.findUnique({
      where: { id },
      include: {
        topics: {
          orderBy: { order: 'asc' },
          include: { theoryModule: { select: { id: true } } },
        },
        examBank: {
          select: { id: true, numQuestions: true, timeLimit: true, onlyOnce: true },
        },
      },
    });
    if (!plan) throw new NotFoundException('Plan de estudio no encontrado');
    if (plan.userId !== userId) throw new ForbiddenException('No tienes acceso a este plan');
    return plan;
  }
}
