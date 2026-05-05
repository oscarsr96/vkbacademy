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
import { GenerateAiExamDto } from './dto/generate-ai-exam.dto';

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
}

interface AiExamPayload {
  title: string;
  questions: AiQuestionPayload[];
}

// ─── Snapshot que vive dentro de ExamAttempt.questionsSnapshot ──────────────

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

/**
 * Servicio de exámenes generados por IA por el propio alumno.
 *
 * El alumno elige curso, módulo (opcional), tema libre y nº de preguntas (5 o
 * 10). La IA produce un banco con preguntas tipo SINGLE/MULTIPLE/TRUE_FALSE
 * que se persiste scoped a `userId` (similar a TheoryModule). El alumno
 * puede repetir el banco las veces que quiera; cada toma crea un
 * `ExamAttempt` enlazado al banco vía `aiExamBankId`.
 */
@Injectable()
export class AiExamsService {
  private readonly logger = new Logger(AiExamsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiProviderService,
  ) {}

  // ─── Generar y persistir un nuevo banco ─────────────────────────────────

  async generate(userId: string, dto: GenerateAiExamDto) {
    const course = await this.prisma.course.findUnique({
      where: { id: dto.courseId },
      include: { schoolYear: true },
    });
    if (!course) throw new NotFoundException(`Curso "${dto.courseId}" no encontrado`);

    const enrollment = await this.prisma.enrollment.findFirst({
      where: { userId, courseId: dto.courseId },
    });
    if (!enrollment) throw new ForbiddenException('No estás matriculado en este curso');

    let moduleTitle: string | undefined;
    if (dto.moduleId) {
      const module = await this.prisma.module.findFirst({
        where: { id: dto.moduleId, courseId: dto.courseId },
        select: { id: true, title: true },
      });
      if (!module) {
        throw new NotFoundException(`Módulo "${dto.moduleId}" no encontrado en este curso`);
      }
      moduleTitle = module.title;
    }

    const prompt = this.buildPrompt(
      course.title,
      course.schoolYear?.label ?? '',
      moduleTitle,
      dto.topic,
      dto.numQuestions,
    );

    this.logger.log(
      `Generando examen IA: ${dto.numQuestions} preguntas sobre "${dto.topic}" (curso "${course.title}"${moduleTitle ? `, módulo "${moduleTitle}"` : ''})`,
    );

    const maxTokens = Math.min(8000, 600 + dto.numQuestions * 350);
    const text = await this.ai.generate(prompt, maxTokens);
    const payload = this.parseAndValidate(text, dto.numQuestions);

    // Persistir banco + preguntas + respuestas en una transacción
    const bank = await this.prisma.aiExamBank.create({
      data: {
        userId,
        courseId: dto.courseId,
        moduleId: dto.moduleId ?? null,
        topic: dto.topic,
        title: payload.title.trim().slice(0, 200) || dto.topic,
        numQuestions: dto.numQuestions,
        timeLimit: dto.timeLimit ?? null,
        onlyOnce: dto.onlyOnce ?? false,
        questions: {
          create: payload.questions.map((q, qIdx) => ({
            text: q.text,
            type: q.type as QuestionType,
            order: qIdx,
            explanation: q.explanation ?? null,
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

  private parseAndValidate(text: string, expectedCount: number): AiExamPayload {
    let parsed: unknown;
    try {
      const raw = text
        .trim()
        .replace(/^```json\n?/, '')
        .replace(/\n?```$/, '');
      parsed = JSON.parse(raw);
    } catch (err) {
      this.logger.error('Error al parsear JSON de IA (examen):', text);
      throw new InternalServerErrorException(
        `El agente IA devolvió un formato inválido: ${err instanceof Error ? err.message : 'desconocido'}`,
      );
    }

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

  private buildPrompt(
    courseTitle: string,
    schoolYearLabel: string,
    moduleTitle: string | undefined,
    topic: string,
    count: number,
  ): string {
    const dist = this.getTypeDistribution(count);
    return `Genera un examen en español sobre el tema "${topic}".

Curso: "${courseTitle}"
${schoolYearLabel ? `Nivel educativo: "${schoolYearLabel}" (sistema educativo español)` : ''}
${moduleTitle ? `Módulo: "${moduleTitle}"` : ''}
Número total de preguntas: ${count}

⚠️ DISTRIBUCIÓN POR TIPO — OBLIGATORIA, NO NEGOCIABLE:
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
- Respeta exactamente el reparto: ${dist.single} SINGLE + ${dist.multiple} MULTIPLE + ${dist.trueFalse} TRUE_FALSE.
- Mezcla los tipos en orden variado (no agrupar todas las SINGLE juntas).
- SINGLE: 3 o 4 opciones, exactamente 1 con isCorrect=true.
- MULTIPLE: 4 opciones, 2 o 3 con isCorrect=true. El enunciado debe dejar claro que hay varias correctas.
- TRUE_FALSE: exactamente 2 opciones ["Verdadero", "Falso"], solo una con isCorrect=true.
- Los enunciados deben ser claros, precisos y adecuados al nivel ${schoolYearLabel || 'del curso'}.
- Contenido curricular real relacionado con "${topic}".
- "explanation" pedagógica y breve (1-2 frases) — el alumno la verá tras corregir.
- Solo devuelve JSON puro, sin markdown ni texto adicional.`;
  }
}
