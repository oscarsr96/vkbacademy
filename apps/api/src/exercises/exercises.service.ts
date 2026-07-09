import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiProviderService } from '../ai/ai-provider.service';
import { generateAiJson } from '../ai/ai-json';
import { EvaluateExerciseDto } from './dto/evaluate-exercise.dto';

export type ExerciseType = 'SINGLE' | 'TRUE_FALSE' | 'OPEN';

export interface GeneratedExercise {
  statement: string;
  type: ExerciseType;
  options: string[];
  solution: string;
  explanation: string;
}

export interface GenerateExercisesResult {
  exercises: GeneratedExercise[];
}

export type ExerciseDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

// Ejercicio del flujo multi-tema (StudyPlan): etiquetado con su tema y dificultad.
export interface GeneratedTopicExercise extends GeneratedExercise {
  topicLabel: string;
  difficulty: ExerciseDifficulty;
}

export interface GenerateTopicExercisesResult {
  exercises: GeneratedTopicExercise[];
}

// Reparto de ejercicios POR TEMA: cada tema recibe easy+medium+hard.
export interface ExerciseDifficultySplit {
  easy: number;
  medium: number;
  hard: number;
}

export interface GenerateExercisesForTopicsParams {
  courseId: string;
  topics: string[];
  perTopic: ExerciseDifficultySplit;
}

export type EvaluationVerdict = 'correct' | 'partial' | 'incorrect';

export interface EvaluationResult {
  verdict: EvaluationVerdict;
  feedback: string;
}

const VALID_VERDICTS: EvaluationVerdict[] = ['correct', 'partial', 'incorrect'];

// Guía de dificultad inyectada en el prompt de generación.
const DIFFICULTY_GUIDANCE: Record<'EASY' | 'MEDIUM' | 'HARD', string> = {
  EASY: 'Fácil: conceptos básicos y ejercicios directos de una sola idea.',
  MEDIUM: 'Media: aplicación de conceptos, con algún paso intermedio.',
  HARD: 'Difícil: razonamiento avanzado, varios pasos y casos menos evidentes.',
};

/**
 * Genera ejercicios de práctica bajo demanda para un alumno matriculado
 * en un curso (flujo StudyPlan): una llamada IA por tema con reparto de
 * dificultad. Los ejercicios los persiste el plan, no este servicio.
 * También evalúa las respuestas abiertas del alumno con la IA.
 */
@Injectable()
export class ExercisesService {
  private readonly logger = new Logger(ExercisesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiProviderService,
  ) {}

  /**
   * Una llamada IA POR TEMA, cada una con el reparto de dificultad pedido
   * (easy/medium/hard). El `topicLabel` se asigna localmente (no se confía a
   * la IA) y la validación exige el conteo exacto por dificultad; ante fallo
   * semántico se regenera ese tema (2x).
   */
  async generateForTopics(
    userId: string,
    params: GenerateExercisesForTopicsParams,
  ): Promise<GenerateTopicExercisesResult> {
    const course = await this.prisma.course.findUnique({
      where: { id: params.courseId },
      include: { schoolYear: true },
    });
    if (!course) {
      throw new NotFoundException(`Curso "${params.courseId}" no encontrado`);
    }

    const enrollment = await this.prisma.enrollment.findFirst({
      where: { userId, courseId: params.courseId },
    });
    if (!enrollment) {
      throw new ForbiddenException('No estás matriculado en este curso');
    }

    const total = params.perTopic.easy + params.perTopic.medium + params.perTopic.hard;
    this.logger.log(
      `Generando ${total} ejercicios por tema (${params.topics.length} temas, ` +
        `${params.perTopic.easy}F/${params.perTopic.medium}M/${params.perTopic.hard}D) para curso "${course.title}"`,
    );

    // Un tema que falle tumba la sección entera (regenerable), igual que antes.
    const perTopicResults = await Promise.all(
      params.topics.map((topic) =>
        this.generateSplitForTopic(
          course.title,
          course.schoolYear?.label ?? '',
          topic,
          params.perTopic,
        ),
      ),
    );

    return { exercises: perTopicResults.flat() };
  }

  /** Genera los ejercicios de UN tema con reparto exacto de dificultad (reintento semántico 2x). */
  private async generateSplitForTopic(
    courseTitle: string,
    schoolYearLabel: string,
    topic: string,
    split: ExerciseDifficultySplit,
  ): Promise<GeneratedTopicExercise[]> {
    const total = split.easy + split.medium + split.hard;
    const prompt = this.buildSplitPrompt(courseTitle, schoolYearLabel, topic, split);
    const maxTokens = Math.min(8000, 200 + total * 250);

    let lastErr: unknown;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const parsed = await generateAiJson(this.ai, prompt, maxTokens, {
          attempts: 1,
          logger: this.logger,
        });
        return this.validateSplitExercises(parsed, split).map((ex) => ({
          ...ex,
          topicLabel: topic,
        }));
      } catch (err) {
        lastErr = err;
        this.logger.warn(
          `Ejercicios de "${topic}" inválidos (generación ${attempt}/2): ${err instanceof Error ? err.message : 'desconocido'}`,
        );
      }
    }
    this.logger.error(`Error al generar ejercicios de "${topic}" tras reintentos:`, lastErr);
    throw new InternalServerErrorException(
      `El agente IA devolvió un formato inválido: ${lastErr instanceof Error ? lastErr.message : 'desconocido'}`,
    );
  }

  async evaluate(dto: EvaluateExerciseDto): Promise<EvaluationResult> {
    const prompt = this.buildEvaluationPrompt(dto);
    this.logger.log(
      `Evaluando respuesta abierta para enunciado: "${dto.statement.slice(0, 60)}..."`,
    );

    let parsed: unknown;
    try {
      parsed = await generateAiJson(this.ai, prompt, 400, { attempts: 2, logger: this.logger });
    } catch (err) {
      this.logger.error('Error al parsear JSON de IA (evaluación) tras reintentos:', err);
      throw new InternalServerErrorException(
        `El agente IA devolvió un formato inválido: ${err instanceof Error ? err.message : 'desconocido'}`,
      );
    }
    return this.validateEvaluationResult(parsed);
  }

  private validateExercisesResult(parsed: unknown): GenerateExercisesResult {
    if (!Array.isArray((parsed as GenerateExercisesResult).exercises)) {
      throw new InternalServerErrorException('La respuesta no contiene un array `exercises`');
    }
    return parsed as GenerateExercisesResult;
  }

  /** Valida el conteo exacto por dificultad del lote de UN tema y normaliza el campo. */
  private validateSplitExercises(
    parsed: unknown,
    split: ExerciseDifficultySplit,
  ): (GeneratedExercise & { difficulty: ExerciseDifficulty })[] {
    const result = this.validateExercisesResult(parsed);
    const exercises = result.exercises as (GeneratedExercise & { difficulty?: string })[];

    const counts: Record<ExerciseDifficulty, number> = { EASY: 0, MEDIUM: 0, HARD: 0 };
    for (const [idx, ex] of exercises.entries()) {
      const difficulty = (ex.difficulty ?? '').toUpperCase() as ExerciseDifficulty;
      if (!(difficulty in counts)) {
        throw new InternalServerErrorException(
          `Ejercicio ${idx + 1}: difficulty inválida "${ex.difficulty ?? ''}" (debe ser EASY, MEDIUM o HARD)`,
        );
      }
      ex.difficulty = difficulty;
      counts[difficulty]++;
    }

    const expected = { EASY: split.easy, MEDIUM: split.medium, HARD: split.hard };
    for (const level of Object.keys(expected) as ExerciseDifficulty[]) {
      if (counts[level] !== expected[level]) {
        throw new InternalServerErrorException(
          `Reparto de dificultad incumplido: se pidieron ${expected[level]} ejercicios ${level} y llegaron ${counts[level]}`,
        );
      }
    }
    return exercises as (GeneratedExercise & { difficulty: ExerciseDifficulty })[];
  }

  private validateEvaluationResult(parsed: unknown): EvaluationResult {
    const { verdict, feedback } = parsed as Partial<EvaluationResult>;
    if (!verdict || !VALID_VERDICTS.includes(verdict)) {
      throw new InternalServerErrorException(`Veredicto inválido: "${verdict}"`);
    }
    if (typeof feedback !== 'string' || feedback.length === 0) {
      throw new InternalServerErrorException('Feedback ausente o vacío');
    }
    return { verdict, feedback };
  }

  private buildEvaluationPrompt(dto: EvaluateExerciseDto): string {
    return `Evalúa la respuesta de un alumno a un ejercicio de respuesta abierta.

Enunciado: "${dto.statement}"
Respuesta del alumno: "${dto.studentAnswer}"
Solución de referencia: "${dto.solution}"

Devuelve ÚNICAMENTE un objeto JSON con esta estructura exacta (sin markdown, sin texto adicional):
{
  "verdict": "correct" | "partial" | "incorrect",
  "feedback": "explicación breve en español (máx. 2 frases) justificando el veredicto"
}

Criterios:
- "correct": la respuesta es equivalente a la solución (diferencias de forma, ortografía menor, orden o notación son aceptables).
- "partial": la respuesta contiene la idea clave pero le falta rigor, parte del desarrollo, o comete errores menores que no invalidan el núcleo.
- "incorrect": la respuesta es claramente errónea, vacía o no responde al enunciado.

El feedback debe ser pedagógico, directo y en segunda persona ("Has olvidado simplificar...", "Correcto: has aplicado bien..."). No reveles la solución completa.

Notación matemática: el enunciado y la solución pueden contener LaTeX delimitado por $...$ (ej. "$\\frac{1}{2}$"); interprétalo como fórmulas, no como texto literal. En el "feedback", escribe las expresiones matemáticas SIEMPRE en LaTeX inline $...$; como respondes JSON, escapa las barras invertidas con doble barra ("$\\\\frac{1}{2}$", nunca "$\\frac{1}{2}$").`;
  }

  private buildSplitPrompt(
    courseTitle: string,
    schoolYearLabel: string,
    topic: string,
    split: ExerciseDifficultySplit,
  ): string {
    const total = split.easy + split.medium + split.hard;
    const repartoLines = (
      [
        ['EASY', split.easy],
        ['MEDIUM', split.medium],
        ['HARD', split.hard],
      ] as const
    )
      .filter(([, n]) => n > 0)
      .map(
        ([level, n]) =>
          `- ${n} ejercicio${n === 1 ? '' : 's'} con "difficulty": "${level}" — ${DIFFICULTY_GUIDANCE[level]}`,
      )
      .join('\n');

    return `Genera ${total} ejercicios de práctica en español sobre el tema "${topic}".

Curso: "${courseTitle}"
${schoolYearLabel ? `Nivel educativo: "${schoolYearLabel}" (sistema educativo español)` : ''}

⚠️ REPARTO POR DIFICULTAD — OBLIGATORIO, NO NEGOCIABLE:
${repartoLines}

Cada ejercicio lleva un campo "difficulty" con su nivel exacto ("EASY", "MEDIUM" o "HARD"). Si el conteo por dificultad no coincide con el reparto anterior, la respuesta será RECHAZADA.

Devuelve ÚNICAMENTE un objeto JSON con esta estructura exacta (sin markdown, sin explicaciones adicionales fuera del JSON):
{
  "exercises": [
    {
      "difficulty": "EASY",
      "statement": "enunciado del ejercicio",
      "type": "SINGLE",
      "options": ["opción A", "opción B", "opción C"],
      "solution": "opción A",
      "explanation": "por qué la opción A es correcta"
    },
    {
      "difficulty": "MEDIUM",
      "statement": "enunciado",
      "type": "TRUE_FALSE",
      "options": ["Verdadero", "Falso"],
      "solution": "Verdadero",
      "explanation": "explicación de por qué es verdadero"
    },
    {
      "difficulty": "HARD",
      "statement": "enunciado de un ejercicio abierto",
      "type": "OPEN",
      "options": [],
      "solution": "respuesta correcta o pasos resueltos",
      "explanation": "explicación detallada del razonamiento"
    }
  ]
}

Reglas:
- Respeta el reparto exacto por dificultad indicado arriba y ordena de fácil a difícil
- Mezcla los 3 tipos (SINGLE, TRUE_FALSE, OPEN) cuando sea apropiado para el tema
- SINGLE: 3-4 opciones, exactamente 1 correcta (la propiedad "solution" debe coincidir con una de las opciones)
- TRUE_FALSE: opciones siempre ["Verdadero", "Falso"], solución coincide
- OPEN: campo "options" vacío []; "solution" contiene la respuesta o pasos resueltos
- Los enunciados deben ser claros, precisos y adecuados al nivel ${schoolYearLabel || 'del curso'}
- Contenido curricular real relacionado con "${topic}"
- "explanation" debe ayudar al alumno a entender por qué la respuesta es correcta
- Para expresiones matemáticas usa SIEMPRE LaTeX en "statement", "options", "solution" y "explanation": inline con $...$ (ej. "$x^2 - 5x + 6 = 0$") y bloques con $$...$$ solo si hace falta una ecuación destacada. NUNCA escribas fórmulas en texto plano. Como respondes JSON, cada barra invertida de LaTeX va escapada con doble barra: escribe "$\\\\frac{1}{2}$", nunca "$\\frac{1}{2}$"
- Solo devuelve JSON puro, sin markdown ni texto adicional`;
  }
}
