import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ChallengeType, Prisma, StudyTopicSource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TheoryService } from '../theory/theory.service';
import {
  EvaluationVerdict,
  ExercisesService,
  GeneratedTopicExercise,
  normalizeForMatch,
} from '../exercises/exercises.service';
import { AiExamsService } from '../exams/ai-exams.service';
import { ChallengesService } from '../challenges/challenges.service';
import {
  CreateStudyPlanDto,
  ExercisesPerTopicDto,
  StudyPlanTopicInputDto,
} from './dto/create-study-plan.dto';
import { GeneratePlanExamDto, StudyPlanExamLevel } from './dto/generate-plan-exam.dto';
import { RenameStudyPlanDto } from './dto/rename-study-plan.dto';
import { RegeneratePlanExercisesDto } from './dto/regenerate-plan-exercises.dto';
import { SubmitExerciseAttemptDto } from './dto/submit-exercise-attempt.dto';

// Presets de los niveles de examen del plan; numQuestions/difficulty son
// overridables por el alumno al generar.
const EXAM_LEVEL_PRESETS: Record<
  StudyPlanExamLevel,
  { numQuestions: number; difficulty: 'EASY' | 'MEDIUM' | 'HARD' }
> = {
  BASIC: { numQuestions: 5, difficulty: 'EASY' },
  MEDIUM: { numQuestions: 8, difficulty: 'MEDIUM' },
  HARD: { numQuestions: 10, difficulty: 'HARD' },
};

// Tema del payload ya resuelto contra las asignaturas y el temario (regla de coherencia).
export interface ResolvedTopic {
  source: StudyTopicSource;
  moduleId: string | null;
  title: string;
  subject: string | null;
  contextCourseId: string;
}

/**
 * Curso de estudio (StudyPlan): combina 1..N temas (oficiales del temario o
 * libres) en teoría POR TEMA (N decks) + ejercicios POR TEMA con reparto de
 * dificultad. Los exámenes se generan LAZY por nivel (básico/medio/difícil),
 * combinados o por tema, desde la pestaña Examen. Es el flujo único de
 * estudio. Personal (scoped por userId).
 */
@Injectable()
export class StudyPlansService {
  private readonly logger = new Logger(StudyPlansService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly theory: TheoryService,
    private readonly exercises: ExercisesService,
    private readonly aiExams: AiExamsService,
    private readonly challenges: ChallengesService,
  ) {}

  // Normalización para comparar materias y detectar duplicados: minúsculas y sin acentos.
  private normalize(s: string): string {
    return s
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  /**
   * Curso que hace de contexto del plan.
   *
   * Si el alumno elige uno del catálogo, ese. Si escribe una asignatura que no
   * existe, se le crea (o reutiliza) un curso "cáscara": despublicado, sin
   * módulos y marcado con `studentCreated`. Solo aporta título y nivel a los
   * prompts de teoría y ejercicios.
   *
   * Se hace así en vez de permitir planes sin curso porque `courseId` es FK
   * obligatoria en StudyPlan, StudyPlanTopic.contextCourseId y TheoryModule:
   * volverlas opcionales obligaba a tocar cuatro modelos y tres servicios de
   * generación para un cambio que el alumno no nota.
   *
   * La cáscara se comparte entre alumnos del mismo nivel (misma materia
   * normalizada + mismo curso escolar) para no llenar el catálogo de gemelos.
   */
  private async resolveBaseCourse(userId: string, dto: CreateStudyPlanDto): Promise<string> {
    if (dto.courseId && dto.subject) {
      throw new BadRequestException(
        'Elige una asignatura del listado o escribe la tuya, pero no las dos',
      );
    }

    if (dto.courseId) {
      await this.assertCourseExists(dto.courseId);
      return dto.courseId;
    }

    const subject = dto.subject?.trim();
    if (!subject) {
      throw new BadRequestException('Elige una asignatura del listado o escribe la tuya');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { schoolYearId: true },
    });

    const existing = await this.prisma.course.findFirst({
      where: {
        studentCreated: true,
        schoolYearId: user?.schoolYearId ?? null,
        subject: { equals: subject, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (existing) return existing.id;

    const created = await this.prisma.course.create({
      data: {
        title: subject,
        subject,
        description: 'Asignatura creada por un alumno desde Estudiar.',
        published: false,
        studentCreated: true,
        schoolYearId: user?.schoolYearId ?? null,
      },
      select: { id: true },
    });
    return created.id;
  }

  private async assertCourseExists(courseId: string): Promise<void> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    });
    if (!course) throw new NotFoundException(`Curso "${courseId}" no encontrado`);
  }

  /**
   * Regla de coherencia (determinista, sin IA) — única fuente de verdad, se
   * ejecuta dentro del create. No exige matrícula: el alumno puede estudiar
   * cualquier asignatura publicada. Para cada tema del payload, en orden:
   *  1. moduleId (OFFICIAL): válido si el módulo existe. contextCourseId =
   *     curso del módulo.
   *  2. title sin subject (CUSTOM in-subject): coherente por construcción,
   *     se atribuye a la asignatura base. contextCourseId = curso base.
   *  3. title con subject (CUSTOM fuera de asignatura): válido si y solo si
   *     existe ≥1 asignatura publicada de esa materia (comparación
   *     normalizada). contextCourseId = primera asignatura de esa materia.
   * Además: sin temas duplicados (mismo moduleId o mismo título normalizado).
   */
  async resolveAndAssertTopics(
    baseCourseId: string,
    topics: StudyPlanTopicInputDto[],
  ): Promise<ResolvedTopic[]> {
    // Materias disponibles para etiquetar temas propios: todas las publicadas.
    const availableCourses = await this.prisma.course.findMany({
      where: { published: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, subject: true },
    });

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
        // 3. Tema propio de otra asignatura: exige que la materia exista
        const wanted = this.normalize(input.subject);
        const match = availableCourses.find(
          (c) => c.subject && this.normalize(c.subject) === wanted,
        );
        if (!match) {
          const subjects = [
            ...new Set(
              availableCourses
                .map((c) => c.subject)
                .filter((s): s is string => !!s && s.trim().length > 0),
            ),
          ];
          throw new UnprocessableEntityException(
            `El tema "${input.title!.trim()}" está etiquetado como "${input.subject.trim()}", ` +
              `pero no hay ninguna asignatura de esa materia. ` +
              `Materias válidas: ${subjects.join(', ') || '(ninguna)'}`,
          );
        }
        resolved.push({
          source: StudyTopicSource.CUSTOM,
          moduleId: null,
          title: input.title!.trim(),
          subject: input.subject.trim(),
          contextCourseId: match.id,
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

  /** Suma del reparto por tema, validada fuera del DTO para mensaje claro. */
  private assertPerTopicTotal(perTopic: ExercisesPerTopicDto): void {
    const total = perTopic.easy + perTopic.medium + perTopic.hard;
    if (total < 1 || total > 10) {
      throw new UnprocessableEntityException(
        'El reparto de ejercicios por tema debe sumar entre 1 y 10',
      );
    }
  }

  async create(userId: string, dto: CreateStudyPlanDto) {
    const baseCourseId = await this.resolveBaseCourse(userId, dto);
    this.assertPerTopicTotal(dto.exercisesPerTopic);

    const resolvedTopics = await this.resolveAndAssertTopics(baseCourseId, dto.topics);

    // Plan "cáscara" + temas en una transacción (nested create)
    const plan = await this.prisma.studyPlan.create({
      data: {
        userId,
        courseId: baseCourseId,
        title: this.buildTitle(resolvedTopics),
        summary: '',
        exercisesConfig: {
          easy: dto.exercisesPerTopic.easy,
          medium: dto.exercisesPerTopic.medium,
          hard: dto.exercisesPerTopic.hard,
        },
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

    // N teorías (una por tema, con su curso de contexto) + ejercicios por tema.
    // Los exámenes NO se generan aquí: son lazy por nivel (generateExam).
    // allSettled: una sección que falle no tumba las demás.
    const topicTitles = plan.topics.map((t) => t.title);
    const [theoryResults, [exercisesRes]] = await Promise.all([
      Promise.allSettled(
        plan.topics.map((t) =>
          this.theory.generate(userId, { courseId: t.contextCourseId, topic: t.title }),
        ),
      ),
      Promise.allSettled([
        this.exercises.generateForTopics({
          userId,
          courseId: baseCourseId,
          topics: topicTitles,
          perTopic: dto.exercisesPerTopic,
        }),
      ]),
    ]);

    const allFailed =
      theoryResults.every((r) => r.status === 'rejected') && exercisesRes.status === 'rejected';
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
      // Si el enlace transaccional falla, no dejar huérfanos: ni el plan cáscara
      // ni los decks ya generados pero sin enlazar (quedarían sueltos en la
      // biblioteca del alumno, indistinguibles de los creados a mano).
      const generatedTheoryIds = theoryResults.flatMap((r) =>
        r.status === 'fulfilled' ? [r.value.id] : [],
      );
      await Promise.allSettled([
        ...generatedTheoryIds.map((theoryId) =>
          this.prisma.theoryModule.delete({ where: { id: theoryId } }),
        ),
        this.prisma.studyPlan.delete({ where: { id: plan.id } }),
      ]);
      throw err;
    }

    // Crear un plan es actividad: cuenta para las rachas además de los retos
    void this.challenges.checkAndAward(
      userId,
      ChallengeType.STUDY_PLAN_CREATED,
      ChallengeType.TOPICS_STUDIED,
      ChallengeType.SUBJECT_VARIETY,
    );

    return this.getById(userId, plan.id);
  }

  private buildTitle(topics: { title: string }[]): string {
    // Título por defecto del curso multi-tema; el alumno puede renombrarlo después.
    return topics
      .map((t) => t.title)
      .join(' · ')
      .slice(0, 200);
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
        examBanks: { select: { id: true } },
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
        exam: p.examBanks.length > 0,
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
        examBanks: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            title: true,
            level: true,
            studyPlanTopicId: true,
            numQuestions: true,
            timeLimit: true,
            onlyOnce: true,
          },
        },
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

    // Info de cada examen (sin preguntas: se cargan al hacerlo, vía /exam) con
    // intentos y mejor nota del alumno para pintar "aprobado" por nivel.
    const bankIds = plan.examBanks.map((b) => b.id);
    const attemptStats = bankIds.length
      ? await this.prisma.examAttempt.groupBy({
          by: ['aiExamBankId'],
          where: { aiExamBankId: { in: bankIds }, userId },
          _count: { _all: true },
          _max: { score: true },
        })
      : [];
    const statsByBank = new Map(attemptStats.map((s) => [s.aiExamBankId, s]));
    const exams = plan.examBanks.map((b) => ({
      id: b.id,
      title: b.title,
      level: (b.level as StudyPlanExamLevel | null) ?? null,
      topicId: b.studyPlanTopicId,
      numQuestions: b.numQuestions,
      timeLimit: b.timeLimit,
      onlyOnce: b.onlyOnce,
      attemptCount: statsByBank.get(b.id)?._count._all ?? 0,
      bestScore: statsByBank.get(b.id)?._max.score ?? null,
    }));

    const exercises = Array.isArray(plan.exercises)
      ? withExerciseIds(plan.exercises as unknown as GeneratedTopicExercise[], plan.id)
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
        exam: exams.length > 0,
      },
      exercises,
      exercisesConfig:
        (plan.exercisesConfig as { easy: number; medium: number; hard: number } | null) ?? null,
      exams,
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

    // Generar primero: si la IA falla, el deck anterior (si existía) queda intacto.
    const theory = await this.theory.generate(userId, {
      courseId: topic.contextCourseId,
      topic: topic.title,
    });
    if (topic.theoryModule) await this.theory.deleteById(userId, topic.theoryModule.id);
    await this.prisma.theoryModule.update({
      where: { id: theory.id },
      data: { studyPlanTopicId: topic.id },
    });
    return this.getById(userId, planId);
  }

  /** Regenera los ejercicios del plan (reparto por tema; override opcional). */
  async regenerateExercises(userId: string, planId: string, dto: RegeneratePlanExercisesDto) {
    const plan = await this.requireOwnedPlan(userId, planId);
    const stored =
      (plan.exercisesConfig as { easy?: number; medium?: number; hard?: number } | null) ?? null;
    const perTopic = {
      easy: dto.easy ?? stored?.easy ?? 2,
      medium: dto.medium ?? stored?.medium ?? 2,
      hard: dto.hard ?? stored?.hard ?? 1,
    };
    this.assertPerTopicTotal(perTopic as ExercisesPerTopicDto);

    // Generar primero: si la IA falla, los ejercicios anteriores quedan intactos.
    const res = await this.exercises.generateForTopics({
      userId,
      courseId: plan.courseId,
      topics: plan.topics.map((t) => t.title),
      perTopic,
    });
    await this.prisma.studyPlan.update({
      where: { id: plan.id },
      data: {
        exercises: res.exercises as unknown as Prisma.InputJsonValue,
        exercisesConfig: perTopic,
      },
    });
    return this.getById(userId, planId);
  }

  // ── Exámenes por nivel (generación lazy) ──

  /**
   * Genera el examen de un nivel del plan: combinado de todos los temas (sin
   * topicId) o de un tema concreto. Idempotente: si ya existe un banco para
   * ese (tema, nivel), lo devuelve sin llamar a la IA.
   */
  async generateExam(userId: string, planId: string, dto: GeneratePlanExamDto) {
    const plan = await this.requireOwnedPlan(userId, planId);

    let topicTitles = plan.topics.map((t) => t.title);
    let courseId = plan.courseId;
    let topicId: string | null = null;
    if (dto.topicId) {
      const topic = plan.topics.find((t) => t.id === dto.topicId);
      if (!topic) throw new NotFoundException('Tema no encontrado en este plan');
      topicId = topic.id;
      courseId = topic.contextCourseId;
      topicTitles = [topic.title];
    }

    const existing = plan.examBanks.find(
      (b) => b.level === dto.level && (b.studyPlanTopicId ?? null) === topicId,
    );
    if (existing) return this.getById(userId, planId);

    const preset = EXAM_LEVEL_PRESETS[dto.level];
    const numQuestions = dto.numQuestions ?? preset.numQuestions;
    if (numQuestions < topicTitles.length) {
      throw new UnprocessableEntityException(
        `El examen debe tener al menos 1 pregunta por tema: con ${topicTitles.length} temas ` +
          `necesitas numQuestions ≥ ${topicTitles.length}`,
      );
    }

    const bank = await this.aiExams.generateForTopics(userId, {
      courseId,
      topics: topicTitles,
      numQuestions,
      difficulty: dto.difficulty ?? preset.difficulty,
    });
    await this.prisma.aiExamBank.update({
      where: { id: bank.id },
      data: { studyPlanId: plan.id, studyPlanTopicId: topicId, level: dto.level },
    });
    return this.getById(userId, planId);
  }

  /** Renombra el curso multi-tema del alumno. */
  async rename(userId: string, planId: string, dto: RenameStudyPlanDto) {
    await this.requireOwnedPlan(userId, planId);
    await this.prisma.studyPlan.update({
      where: { id: planId },
      data: { title: dto.title.trim() },
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
        examBanks: {
          select: { id: true, level: true, studyPlanTopicId: true },
        },
      },
    });
    if (!plan) throw new NotFoundException('Plan de estudio no encontrado');
    if (plan.userId !== userId) throw new ForbiddenException('No tienes acceso a este plan');
    return plan;
  }

  /**
   * Registra el intento de un ejercicio del plan. La corrección es siempre
   * server-side: el cliente manda la respuesta, nunca el veredicto — si no,
   * los puntos se farmearían desde la consola del navegador.
   */
  async submitExerciseAttempt(
    userId: string,
    planId: string,
    exerciseId: string,
    dto: SubmitExerciseAttemptDto,
  ): Promise<{
    verdict: EvaluationVerdict;
    feedback?: string;
    solution: string;
    explanation: string;
  }> {
    const plan = await this.requireOwnedPlan(userId, planId);

    const exercises = withExerciseIds(
      Array.isArray(plan.exercises) ? (plan.exercises as unknown as GeneratedTopicExercise[]) : [],
      plan.id,
    );
    const exercise = exercises.find((e) => e.id === exerciseId);
    if (!exercise) {
      throw new NotFoundException('Ejercicio no encontrado en este plan');
    }

    let verdict: EvaluationVerdict;
    let feedback: string | undefined;

    if (exercise.type === 'OPEN') {
      const evaluation = await this.exercises.evaluate(userId, {
        statement: exercise.statement,
        studentAnswer: dto.answer,
        solution: exercise.solution,
      });
      verdict = evaluation.verdict;
      feedback = evaluation.feedback;
    } else {
      verdict =
        normalizeForMatch(dto.answer) === normalizeForMatch(exercise.solution)
          ? 'correct'
          : 'incorrect';
    }

    // Upsert en vez de findUnique + create: dos envíos simultáneos del mismo
    // ejercicio hacían que el segundo chocase con el unique (userId, exerciseId)
    // y saliera un 500 con el error crudo de Prisma.
    const isFirstAttempt = await this.recordAttempt(userId, plan.id, exerciseId, verdict, {
      topicLabel: exercise.topicLabel ?? '',
      difficulty: exercise.difficulty ?? 'MEDIUM',
    });

    if (isFirstAttempt) {
      // Solo los intentos nuevos mueven la racha; reintentar no la mueve.
      // Debe resolverse (await) antes de checkAndAward para que la racha esté fresca.
      await this.challenges.bumpCorrectStreak(userId, verdict === 'correct');
    }

    // No bloquear la respuesta HTTP por la evaluación de retos.
    void this.challenges.checkAndAward(
      userId,
      ChallengeType.EXERCISES_SOLVED,
      ChallengeType.HARD_EXERCISES_SOLVED,
      ChallengeType.EXERCISES_CORRECT_STREAK,
    );

    return { verdict, feedback, solution: exercise.solution, explanation: exercise.explanation };
  }

  /**
   * Guarda el intento (uno por ejercicio) y responde si lo ha CREADO.
   *
   * El id se genera aquí en vez de dejarlo a `@default(cuid())`: es la forma
   * fiable de distinguir creación de actualización sin una segunda consulta
   * —la fila devuelta lleva nuestro id solo si la ha insertado este upsert—,
   * y de eso depende llamar o no a `bumpCorrectStreak`.
   */
  private async recordAttempt(
    userId: string,
    studyPlanId: string,
    exerciseId: string,
    verdict: EvaluationVerdict,
    meta: { topicLabel: string; difficulty: string },
  ): Promise<boolean> {
    const newAttemptId = randomUUID();
    try {
      const attempt = await this.prisma.exerciseAttempt.upsert({
        where: { userId_exerciseId: { userId, exerciseId } },
        update: { verdict, answeredAt: new Date() },
        create: {
          id: newAttemptId,
          userId,
          studyPlanId,
          exerciseId,
          topicLabel: meta.topicLabel,
          difficulty: meta.difficulty,
          verdict,
        },
      });
      return attempt.id === newAttemptId;
    } catch (err) {
      // Carrera perdida contra un envío simultáneo del mismo ejercicio: la
      // fila ya existe, así que esto es un reintento, no un intento nuevo.
      // Nunca dejar escapar el error crudo de Prisma al cliente.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        await this.prisma.exerciseAttempt.updateMany({
          where: { userId, exerciseId },
          data: { verdict, answeredAt: new Date() },
        });
        return false;
      }
      this.logger.error(`No se pudo registrar el intento del ejercicio ${exerciseId}`, err);
      throw new InternalServerErrorException(
        'No se pudo registrar tu respuesta. Inténtalo de nuevo en unos segundos.',
      );
    }
  }
}

/**
 * Garantiza que todo ejercicio tenga `id`. Los planes creados antes de
 * Retos v2 lo llevan vacío: reciben un id derivado del plan y del índice,
 * estable mientras no se regenere el plan.
 *
 * El id DEBE incluir el planId: el unique de `ExerciseAttempt` es
 * (userId, exerciseId) sin studyPlanId, así que ids "legacy-N" repetidos
 * entre dos planes antiguos del mismo alumno colisionarían — el ejercicio N
 * del plan B se resolvería contra el intento del plan A (no contaría como
 * acierto nuevo, heredaría su dificultad y podría bajar EXERCISES_SOLVED).
 */
export function withExerciseIds(
  exercises: GeneratedTopicExercise[],
  planId: string,
): GeneratedTopicExercise[] {
  return exercises.map((e, i) => (e.id ? e : { ...e, id: `legacy-${planId}-${i}` }));
}
