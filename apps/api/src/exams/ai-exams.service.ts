import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { QuestionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiProviderService } from '../ai/ai-provider.service';
import { generateAiJson } from '../ai/ai-json';
import { splitAcrossTopics } from '../ai/topic-distribution';

// ─── Tipos del payload IA ────────────────────────────────────────────────────

export type AiExamQuestionType = 'SINGLE' | 'MULTIPLE' | 'TRUE_FALSE';

interface AiAnswerPayload {
  text: string;
  isCorrect: boolean;
}

interface AiQuestionPayload {
  text: string;
  type: AiExamQuestionType;
  answers: AiAnswerPayload[];
  explanation?: string;
  // Solo en el flujo multi-tema (StudyPlan): tema al que pertenece la pregunta.
  topicLabel?: string;
}

interface AiExamPayload {
  title: string;
  questions: AiQuestionPayload[];
}

export interface GenerateAiExamForTopicsParams {
  courseId: string;
  topics: string[];
  numQuestions: number;
  timeLimit?: number;
  onlyOnce?: boolean;
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
}

// ─── Snapshot que vive dentro de ExamAttempt.questionsSnapshot ──────────────

interface QuestionSnapshot {
  id: string;
  text: string;
  type: string;
  // Tema de la pregunta en exámenes multi-tema; ausente en el resto.
  topicLabel?: string | null;
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

// Guía de dificultad inyectada en el prompt de generación del examen.
const DIFFICULTY_GUIDANCE: Record<'EASY' | 'MEDIUM' | 'HARD', string> = {
  EASY: 'Fácil: conceptos básicos y preguntas directas de una sola idea.',
  MEDIUM: 'Media: aplicación de conceptos, con algún paso intermedio.',
  HARD: 'Difícil: razonamiento avanzado, varios pasos y distractores plausibles.',
};

/**
 * Servicio de exámenes generados por IA por el propio alumno (flujo StudyPlan).
 *
 * La IA produce un banco con preguntas tipo SINGLE/MULTIPLE/TRUE_FALSE que se
 * persiste scoped a `userId` (similar a TheoryModule). El alumno puede repetir
 * el banco las veces que quiera; cada toma crea un `ExamAttempt` enlazado al
 * banco vía `aiExamBankId`.
 */
@Injectable()
export class AiExamsService {
  private readonly logger = new Logger(AiExamsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiProviderService,
  ) {}

  // ─── Generar y persistir un nuevo banco ─────────────────────────────────

  /**
   * Una sola llamada IA que reparte las
   * preguntas entre los temas (base floor(N/T), resto a los primeros)
   * manteniendo la distribución global de tipos, y etiqueta cada pregunta con
   * su `topicLabel`. La validación exige cobertura ≥1 pregunta por tema; si la
   * IA no la respeta, se regenera (hasta 2 generaciones en total).
   */
  async generateForTopics(userId: string, params: GenerateAiExamForTopicsParams) {
    const course = await this.prisma.course.findUnique({
      where: { id: params.courseId },
      include: { schoolYear: true },
    });
    if (!course) throw new NotFoundException(`Curso "${params.courseId}" no encontrado`);

    const enrollment = await this.prisma.enrollment.findFirst({
      where: { userId, courseId: params.courseId },
    });
    if (!enrollment) throw new ForbiddenException('No estás matriculado en este curso');

    const prompt = this.buildMultiTopicPrompt(
      course.title,
      course.schoolYear?.label ?? '',
      params.topics,
      params.numQuestions,
      params.difficulty ?? 'MEDIUM',
    );

    this.logger.log(
      `Generando examen IA multi-tema: ${params.numQuestions} preguntas sobre ${params.topics.length} temas (curso "${course.title}")`,
    );

    const maxTokens = Math.min(8000, 600 + params.numQuestions * 350);

    // El reparto por tema es más frágil que el examen un-tema, así que aquí la
    // validación semántica (cobertura/etiquetas) también reintenta, no solo el parseo.
    let payload: AiExamPayload | null = null;
    let lastErr: unknown;
    for (let attempt = 1; attempt <= 2 && !payload; attempt++) {
      try {
        const parsed = await generateAiJson(this.ai, prompt, maxTokens, {
          attempts: 1,
          logger: this.logger,
        });
        payload = this.validateTopicsPayload(parsed, params.numQuestions, params.topics);
      } catch (err) {
        lastErr = err;
        this.logger.warn(
          `Examen multi-tema inválido (generación ${attempt}/2): ${err instanceof Error ? err.message : 'desconocido'}`,
        );
      }
    }
    if (!payload) {
      this.logger.error('Error al generar examen multi-tema tras reintentos:', lastErr);
      throw new InternalServerErrorException(
        `El agente IA devolvió un formato inválido: ${lastErr instanceof Error ? lastErr.message : 'desconocido'}`,
      );
    }

    const joinedTopics = params.topics.join(' · ');
    const bank = await this.prisma.aiExamBank.create({
      data: {
        userId,
        courseId: params.courseId,
        moduleId: null,
        topic: joinedTopics.slice(0, 500),
        title: payload.title.trim().slice(0, 200) || joinedTopics.slice(0, 200),
        numQuestions: params.numQuestions,
        timeLimit: params.timeLimit ?? null,
        onlyOnce: params.onlyOnce ?? false,
        questions: {
          create: payload.questions.map((q, qIdx) => ({
            text: q.text,
            type: q.type as QuestionType,
            order: qIdx,
            explanation: q.explanation ?? null,
            topicLabel: q.topicLabel?.trim() ?? null,
            answers: {
              create: q.answers.map((a, aIdx) => ({
                text: a.text,
                isCorrect: a.isCorrect,
                order: aIdx,
              })),
            },
          })),
        },
      },
      include: this.bankInclude(),
    });

    return this.serializeBank(bank, { includeIsCorrect: false, attemptCount: 0 });
  }

  // ─── Listar bancos del alumno ───────────────────────────────────────────

  async listMyBanks(userId: string) {
    const banks = await this.prisma.aiExamBank.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        course: { select: { id: true, title: true } },
        module: { select: { id: true, title: true } },
        _count: { select: { attempts: true, questions: true } },
        // Cuenta de intentos entregados (para gating onlyOnce)
        attempts: {
          where: { submittedAt: { not: null } },
          select: { id: true },
        },
      },
    });

    return banks.map((b) => ({
      id: b.id,
      title: b.title,
      topic: b.topic,
      numQuestions: b.numQuestions,
      timeLimit: b.timeLimit,
      onlyOnce: b.onlyOnce,
      createdAt: b.createdAt.toISOString(),
      course: { id: b.course.id, title: b.course.title },
      module: b.module ? { id: b.module.id, title: b.module.title } : null,
      questionCount: b._count.questions,
      attemptCount: b._count.attempts,
      submittedAttemptCount: b.attempts.length,
    }));
  }

  // ─── Detalle de un banco (sin isCorrect) ───────────────────────────────

  async getBank(userId: string, bankId: string) {
    const bank = await this.prisma.aiExamBank.findUnique({
      where: { id: bankId },
      include: this.bankInclude(),
    });
    if (!bank) throw new NotFoundException('Banco no encontrado');
    if (bank.userId !== userId) throw new ForbiddenException('No autorizado');

    const attemptCount = await this.prisma.examAttempt.count({
      where: { aiExamBankId: bankId, userId },
    });

    return this.serializeBank(bank, { includeIsCorrect: false, attemptCount });
  }

  // ─── Eliminar un banco ─────────────────────────────────────────────────

  async deleteBank(userId: string, bankId: string) {
    const bank = await this.prisma.aiExamBank.findUnique({
      where: { id: bankId },
      select: { id: true, userId: true },
    });
    if (!bank) throw new NotFoundException('Banco no encontrado');
    if (bank.userId !== userId) throw new ForbiddenException('No autorizado');

    await this.prisma.aiExamBank.delete({ where: { id: bankId } });
    return { ok: true };
  }

  // ─── Iniciar un intento desde un banco ────────────────────────────────

  async startAttempt(userId: string, bankId: string) {
    const bank = await this.prisma.aiExamBank.findUnique({
      where: { id: bankId },
      include: this.bankInclude(),
    });
    if (!bank) throw new NotFoundException('Banco no encontrado');
    if (bank.userId !== userId) throw new ForbiddenException('No autorizado');

    // Si el banco es de "un solo intento", bloquear si ya hay uno entregado
    if (bank.onlyOnce) {
      const submittedCount = await this.prisma.examAttempt.count({
        where: { aiExamBankId: bankId, userId, submittedAt: { not: null } },
      });
      if (submittedCount > 0) {
        throw new ForbiddenException(
          'Este examen está marcado como "solo un intento" y ya lo has completado',
        );
      }
    }

    // Snapshot con respuestas barajadas dentro de cada pregunta
    const questionsSnapshot: QuestionSnapshot[] = bank.questions.map((q) => ({
      id: q.id,
      text: q.text,
      type: q.type,
      topicLabel: q.topicLabel ?? null,
      answers: shuffle(q.answers.map((a) => ({ id: a.id, text: a.text, isCorrect: a.isCorrect }))),
    }));

    const attempt = await this.prisma.examAttempt.create({
      data: {
        userId,
        courseId: bank.courseId,
        moduleId: bank.moduleId,
        aiExamBankId: bank.id,
        numQuestions: bank.numQuestions,
        timeLimit: bank.timeLimit,
        onlyOnce: bank.onlyOnce,
        questionsSnapshot: questionsSnapshot as object[],
        answers: [],
      },
    });

    return {
      attemptId: attempt.id,
      bankId: bank.id,
      title: bank.title,
      questions: questionsSnapshot.map((q) => ({
        id: q.id,
        text: q.text,
        type: q.type,
        answers: q.answers.map((a) => ({ id: a.id, text: a.text })),
      })),
      numQuestions: bank.numQuestions,
      timeLimit: bank.timeLimit,
      onlyOnce: bank.onlyOnce,
      startedAt: attempt.startedAt.toISOString(),
    };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  private bankInclude() {
    return {
      course: { select: { id: true, title: true } },
      module: { select: { id: true, title: true } },
      questions: {
        orderBy: { order: 'asc' as const },
        include: {
          answers: { orderBy: { order: 'asc' as const } },
        },
      },
    };
  }

  private serializeBank(
    bank: {
      id: string;
      title: string;
      topic: string;
      numQuestions: number;
      timeLimit: number | null;
      onlyOnce: boolean;
      createdAt: Date;
      course: { id: string; title: string };
      module: { id: string; title: string } | null;
      questions: {
        id: string;
        text: string;
        type: string;
        order: number;
        explanation: string | null;
        topicLabel: string | null;
        answers: { id: string; text: string; isCorrect: boolean; order: number }[];
      }[];
    },
    opts: { includeIsCorrect: boolean; attemptCount: number },
  ) {
    return {
      id: bank.id,
      title: bank.title,
      topic: bank.topic,
      numQuestions: bank.numQuestions,
      timeLimit: bank.timeLimit,
      onlyOnce: bank.onlyOnce,
      createdAt: bank.createdAt.toISOString(),
      course: bank.course,
      module: bank.module,
      attemptCount: opts.attemptCount,
      questions: bank.questions.map((q) => ({
        id: q.id,
        text: q.text,
        type: q.type,
        order: q.order,
        topicLabel: q.topicLabel,
        ...(opts.includeIsCorrect && { explanation: q.explanation }),
        answers: q.answers.map((a) => ({
          id: a.id,
          text: a.text,
          order: a.order,
          ...(opts.includeIsCorrect && { isCorrect: a.isCorrect }),
        })),
      })),
    };
  }

  private validatePayload(parsed: unknown, expectedCount: number): AiExamPayload {
    const p = parsed as Partial<AiExamPayload>;
    if (!p || typeof p.title !== 'string' || !Array.isArray(p.questions)) {
      throw new InternalServerErrorException(
        'La respuesta de la IA no tiene el formato esperado (faltan title o questions)',
      );
    }
    if (p.questions.length !== expectedCount) {
      throw new InternalServerErrorException(
        `La IA devolvió ${p.questions.length} preguntas (se esperaban ${expectedCount})`,
      );
    }

    const validTypes: AiExamQuestionType[] = ['SINGLE', 'MULTIPLE', 'TRUE_FALSE'];
    for (const [idx, q] of p.questions.entries()) {
      if (!q || typeof q.text !== 'string' || q.text.trim().length === 0) {
        throw new InternalServerErrorException(`Pregunta ${idx + 1}: texto inválido`);
      }
      if (!validTypes.includes(q.type)) {
        throw new InternalServerErrorException(`Pregunta ${idx + 1}: tipo inválido "${q.type}"`);
      }
      if (!Array.isArray(q.answers) || q.answers.length < 2) {
        throw new InternalServerErrorException(
          `Pregunta ${idx + 1}: necesita al menos 2 respuestas`,
        );
      }
      const correctCount = q.answers.filter((a) => a?.isCorrect === true).length;
      if (q.type === 'MULTIPLE') {
        if (correctCount < 2) {
          throw new InternalServerErrorException(
            `Pregunta ${idx + 1} (MULTIPLE): debe tener 2 o más respuestas correctas`,
          );
        }
      } else {
        if (correctCount !== 1) {
          throw new InternalServerErrorException(
            `Pregunta ${idx + 1} (${q.type}): debe tener exactamente 1 respuesta correcta`,
          );
        }
      }
      if (q.type === 'TRUE_FALSE' && q.answers.length !== 2) {
        throw new InternalServerErrorException(
          `Pregunta ${idx + 1} (TRUE_FALSE): debe tener exactamente 2 respuestas`,
        );
      }
      for (const [aIdx, a] of q.answers.entries()) {
        if (!a || typeof a.text !== 'string' || typeof a.isCorrect !== 'boolean') {
          throw new InternalServerErrorException(
            `Pregunta ${idx + 1}, respuesta ${aIdx + 1}: formato inválido`,
          );
        }
      }
    }

    // Variedad obligatoria cuando N >= 3: deben aparecer los 3 tipos.
    if (expectedCount >= 3) {
      const typesSeen = new Set(p.questions.map((q) => q.type));
      const missing = validTypes.filter((t) => !typesSeen.has(t));
      if (missing.length > 0) {
        throw new InternalServerErrorException(
          `La IA no respetó la variedad de tipos: faltan ${missing.join(', ')}. Vuelve a intentarlo.`,
        );
      }
    }

    return p as AiExamPayload;
  }

  /**
   * Validación del examen multi-tema: todo lo del examen normal + cada
   * pregunta lleva un topicLabel EXACTO de la lista y todo tema tiene ≥1
   * pregunta (cobertura obligatoria).
   */
  private validateTopicsPayload(
    parsed: unknown,
    expectedCount: number,
    topics: string[],
  ): AiExamPayload {
    const payload = this.validatePayload(parsed, expectedCount);

    const perTopicCount = new Map<string, number>(topics.map((t) => [t.trim(), 0]));
    for (const [idx, q] of payload.questions.entries()) {
      const label = typeof q.topicLabel === 'string' ? q.topicLabel.trim() : '';
      if (!perTopicCount.has(label)) {
        throw new InternalServerErrorException(
          `Pregunta ${idx + 1}: topicLabel inválido "${q.topicLabel ?? ''}" (debe ser uno de los temas pedidos)`,
        );
      }
      q.topicLabel = label;
      perTopicCount.set(label, perTopicCount.get(label)! + 1);
    }

    const uncovered = [...perTopicCount.entries()]
      .filter(([, count]) => count === 0)
      .map(([topic]) => topic);
    if (uncovered.length > 0) {
      throw new InternalServerErrorException(
        `El examen no cubre todos los temas: faltan preguntas de ${uncovered.join(', ')}`,
      );
    }

    return payload;
  }

  /**
   * Distribución obligatoria por tipo según número de preguntas.
   * Garantiza variedad sin sobrecargar el prompt.
   */
  private getTypeDistribution(count: number): {
    single: number;
    multiple: number;
    trueFalse: number;
  } {
    if (count === 5) return { single: 3, multiple: 1, trueFalse: 1 };
    if (count === 10) return { single: 5, multiple: 3, trueFalse: 2 };
    // Fallback genérico: ~60% SINGLE, ~25% MULTIPLE, resto TRUE_FALSE
    const single = Math.max(1, Math.round(count * 0.6));
    const multiple = Math.max(1, Math.round(count * 0.25));
    const trueFalse = Math.max(1, count - single - multiple);
    return { single, multiple, trueFalse };
  }

  private buildMultiTopicPrompt(
    courseTitle: string,
    schoolYearLabel: string,
    topics: string[],
    count: number,
    difficulty: 'EASY' | 'MEDIUM' | 'HARD',
  ): string {
    const dist = this.getTypeDistribution(count);
    const perTopic = splitAcrossTopics(count, topics.length);
    const repartoLines = topics
      .map((t, i) => `- "${t}": ${perTopic[i]} pregunta${perTopic[i] === 1 ? '' : 's'}`)
      .join('\n');

    return `Genera un examen en español que COMBINE varios temas, como un examen real de evaluación.

Curso: "${courseTitle}"
${schoolYearLabel ? `Nivel educativo: "${schoolYearLabel}" (sistema educativo español)` : ''}
Dificultad: ${DIFFICULTY_GUIDANCE[difficulty]}
Número total de preguntas: ${count}

⚠️ REPARTO POR TEMA — OBLIGATORIO, NO NEGOCIABLE:
${repartoLines}

Cada pregunta lleva un campo "topicLabel" con el tema al que pertenece, copiado EXACTAMENTE de la lista anterior (mismas mayúsculas, tildes y espacios). Si un topicLabel no coincide con un tema de la lista, o algún tema se queda sin preguntas, la respuesta será RECHAZADA.

⚠️ DISTRIBUCIÓN POR TIPO (sobre el total) — OBLIGATORIA, NO NEGOCIABLE:
- ${dist.single} preguntas de tipo "SINGLE" (una sola respuesta correcta entre 3-4 opciones)
- ${dist.multiple} preguntas de tipo "MULTIPLE" (varias respuestas correctas, entre 4 opciones)
- ${dist.trueFalse} preguntas de tipo "TRUE_FALSE" (verdadero/falso)

Si devuelves todas las preguntas del mismo tipo, la respuesta será RECHAZADA.
Si no respetas el reparto exacto, la respuesta será RECHAZADA.

Devuelve ÚNICAMENTE un objeto JSON con esta estructura exacta (sin markdown, sin explicaciones adicionales fuera del JSON):
{
  "title": "Título breve del examen (máx. 80 caracteres)",
  "questions": [
    {
      "topicLabel": "${topics[0]}",
      "text": "Enunciado claro de la pregunta",
      "type": "SINGLE",
      "answers": [
        { "text": "opción A", "isCorrect": true },
        { "text": "opción B", "isCorrect": false },
        { "text": "opción C", "isCorrect": false },
        { "text": "opción D", "isCorrect": false }
      ],
      "explanation": "Por qué la opción correcta es la correcta (1-2 frases pedagógicas)"
    },
    {
      "topicLabel": "${topics[0]}",
      "text": "Enunciado de pregunta de respuesta múltiple — usa fórmulas como 'selecciona TODAS las que apliquen' o '¿cuáles de las siguientes...?'",
      "type": "MULTIPLE",
      "answers": [
        { "text": "opción A", "isCorrect": true },
        { "text": "opción B", "isCorrect": true },
        { "text": "opción C", "isCorrect": false },
        { "text": "opción D", "isCorrect": false }
      ],
      "explanation": "Justificación pedagógica"
    },
    {
      "topicLabel": "${topics[topics.length - 1]}",
      "text": "Afirmación a juzgar como verdadera o falsa",
      "type": "TRUE_FALSE",
      "answers": [
        { "text": "Verdadero", "isCorrect": true },
        { "text": "Falso", "isCorrect": false }
      ],
      "explanation": "Por qué es verdadera (o falsa)"
    }
  ]
}

Reglas estrictas:
- Devuelve EXACTAMENTE ${count} preguntas — ni una más, ni una menos.
- Respeta exactamente el reparto por tema indicado arriba: cada tema con su número de preguntas.
- Respeta exactamente el reparto por tipo: ${dist.single} SINGLE + ${dist.multiple} MULTIPLE + ${dist.trueFalse} TRUE_FALSE (sobre el total, no por tema).
- Mezcla temas y tipos en orden variado (no agrupar todas las preguntas de un tema juntas).
- SINGLE: 3 o 4 opciones, exactamente 1 con isCorrect=true.
- MULTIPLE: 4 opciones, 2 o 3 con isCorrect=true. El enunciado debe dejar claro que hay varias correctas.
- TRUE_FALSE: exactamente 2 opciones ["Verdadero", "Falso"], solo una con isCorrect=true.
- Los enunciados deben ser claros, precisos y adecuados al nivel ${schoolYearLabel || 'del curso'}.
- Contenido curricular real relacionado con cada tema.
- "explanation" pedagógica y breve (1-2 frases) — el alumno la verá tras corregir.
- Solo devuelve JSON puro, sin markdown ni texto adicional.`;
  }
}
