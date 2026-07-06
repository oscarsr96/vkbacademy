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
import { splitAcrossTopics } from '../ai/topic-distribution';
import { GenerateExercisesDto } from './dto/generate-exercises.dto';
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

// Ejercicio del flujo multi-tema (StudyPlan): etiquetado con su tema.
export interface GeneratedTopicExercise extends GeneratedExercise {
  topicLabel: string;
}

export interface GenerateTopicExercisesResult {
  exercises: GeneratedTopicExercise[];
}

export interface GenerateExercisesForTopicsParams {
  courseId: string;
  topics: string[];
  count: number;
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
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
 * en un curso. Los ejercicios NO se persisten en BD — son efímeros, solo
 * para que el alumno practique en el momento.
 *
 * El alumno introduce un tema (ej: "propiedades de logaritmos") y un
 * número (1-20) y la IA devuelve esa cantidad de ejercicios mezclando
 * tipos: SINGLE choice, TRUE_FALSE y OPEN (respuesta abierta con
 * explicación de la solución).
 */
@Injectable()
export class ExercisesService {
  private readonly logger = new Logger(ExercisesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiProviderService,
  ) {}

  async generate(userId: string, dto: GenerateExercisesDto): Promise<GenerateExercisesResult> {
    const course = await this.prisma.course.findUnique({
      where: { id: dto.courseId },
      include: { schoolYear: true },
    });

    if (!course) {
      throw new NotFoundException(`Curso "${dto.courseId}" no encontrado`);
    }

    const enrollment = await this.prisma.enrollment.findFirst({
      where: { userId, courseId: dto.courseId },
    });

    if (!enrollment) {
      throw new ForbiddenException('No estás matriculado en este curso');
    }

    const prompt = this.buildPrompt(
      course.title,
      course.schoolYear?.label ?? '',
      dto.topic,
      dto.count,
      dto.difficulty ?? 'MEDIUM',
    );

    this.logger.log(
      `Generando ${dto.count} ejercicios sobre "${dto.topic}" para curso "${course.title}"`,
    );

    // ~150 tokens por ejercicio + overhead
    const maxTokens = Math.min(8000, 200 + dto.count * 250);

    // Reintento automático ante JSON inválido: ver `ai-json.ts`.
    let parsed: unknown;
    try {
      parsed = await generateAiJson(this.ai, prompt, maxTokens, { attempts: 2, logger: this.logger });
    } catch (err) {
      this.logger.error('Error al parsear JSON de IA (ejercicios) tras reintentos:', err);
      throw new InternalServerErrorException(
        `El agente IA devolvió un formato inválido: ${err instanceof Error ? err.message : 'desconocido'}`,
      );
    }
    return this.validateExercisesResult(parsed);
  }

  /**
   * Variante multi-tema (flujo StudyPlan): una sola llamada IA que reparte
   * `count` ejercicios entre los temas (base floor(count/T), resto a los
   * primeros) y etiqueta cada uno con su `topicLabel` para agrupar en UI.
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

    const prompt = this.buildMultiTopicPrompt(
      course.title,
      course.schoolYear?.label ?? '',
      params.topics,
      params.count,
      params.difficulty ?? 'MEDIUM',
    );

    this.logger.log(
      `Generando ${params.count} ejercicios multi-tema (${params.topics.length} temas) para curso "${course.title}"`,
    );

    const maxTokens = Math.min(8000, 200 + params.count * 250);

    // Como en el examen multi-tema: el reparto por tema es frágil, así que la
    // validación semántica (etiquetas + cobertura) también reintenta, no solo el parseo.
    let result: GenerateTopicExercisesResult | null = null;
    let lastErr: unknown;
    for (let attempt = 1; attempt <= 2 && !result; attempt++) {
      try {
        const parsed = await generateAiJson(this.ai, prompt, maxTokens, {
          attempts: 1,
          logger: this.logger,
        });
        result = this.validateTopicExercisesResult(parsed, params.topics, params.count);
      } catch (err) {
        lastErr = err;
        this.logger.warn(
          `Ejercicios multi-tema inválidos (generación ${attempt}/2): ${err instanceof Error ? err.message : 'desconocido'}`,
        );
      }
    }
    if (!result) {
      this.logger.error('Error al generar ejercicios multi-tema tras reintentos:', lastErr);
      throw new InternalServerErrorException(
        `El agente IA devolvió un formato inválido: ${lastErr instanceof Error ? lastErr.message : 'desconocido'}`,
      );
    }
    return result;
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

  private validateTopicExercisesResult(
    parsed: unknown,
    topics: string[],
    count: number,
  ): GenerateTopicExercisesResult {
    const result = this.validateExercisesResult(parsed);
    const perTopicCount = new Map<string, number>(topics.map((t) => [t.trim(), 0]));
    for (const [idx, ex] of (result.exercises as GeneratedTopicExercise[]).entries()) {
      const label = typeof ex.topicLabel === 'string' ? ex.topicLabel.trim() : '';
      if (!perTopicCount.has(label)) {
        throw new InternalServerErrorException(
          `Ejercicio ${idx + 1}: topicLabel inválido "${ex.topicLabel ?? ''}" (debe ser uno de los temas pedidos)`,
        );
      }
      ex.topicLabel = label;
      perTopicCount.set(label, perTopicCount.get(label)! + 1);
    }

    // Cobertura: si hay ejercicios suficientes, ningún tema puede quedarse a cero
    // (misma regla que el examen multi-tema).
    if (count >= topics.length) {
      const uncovered = [...perTopicCount.entries()]
        .filter(([, n]) => n === 0)
        .map(([topic]) => topic);
      if (uncovered.length > 0) {
        throw new InternalServerErrorException(
          `Los ejercicios no cubren todos los temas: faltan ejercicios de ${uncovered.join(', ')}`,
        );
      }
    }
    return result as GenerateTopicExercisesResult;
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

El feedback debe ser pedagógico, directo y en segunda persona ("Has olvidado simplificar...", "Correcto: has aplicado bien..."). No reveles la solución completa.`;
  }

  private buildPrompt(
    courseTitle: string,
    schoolYearLabel: string,
    topic: string,
    count: number,
    difficulty: 'EASY' | 'MEDIUM' | 'HARD',
  ): string {
    return `Genera ${count} ejercicios de práctica en español sobre el tema "${topic}".

Curso: "${courseTitle}"
${schoolYearLabel ? `Nivel educativo: "${schoolYearLabel}" (sistema educativo español)` : ''}
Dificultad: ${DIFFICULTY_GUIDANCE[difficulty]}

Devuelve ÚNICAMENTE un objeto JSON con esta estructura exacta (sin markdown, sin explicaciones adicionales fuera del JSON):
{
  "exercises": [
    {
      "statement": "enunciado del ejercicio",
      "type": "SINGLE",
      "options": ["opción A", "opción B", "opción C"],
      "solution": "opción A",
      "explanation": "por qué la opción A es correcta"
    },
    {
      "statement": "enunciado",
      "type": "TRUE_FALSE",
      "options": ["Verdadero", "Falso"],
      "solution": "Verdadero",
      "explanation": "explicación de por qué es verdadero"
    },
    {
      "statement": "enunciado de un ejercicio abierto",
      "type": "OPEN",
      "options": [],
      "solution": "respuesta correcta o pasos resueltos",
      "explanation": "explicación detallada del razonamiento"
    }
  ]
}

Reglas:
- Mezcla los 3 tipos (SINGLE, TRUE_FALSE, OPEN) cuando sea apropiado para el tema
- SINGLE: 3-4 opciones, exactamente 1 correcta (la propiedad "solution" debe coincidir con una de las opciones)
- TRUE_FALSE: opciones siempre ["Verdadero", "Falso"], solución coincide
- OPEN: campo "options" vacío []; "solution" contiene la respuesta o pasos resueltos
- Los enunciados deben ser claros, precisos y adecuados al nivel ${schoolYearLabel || 'del curso'}
- Contenido curricular real relacionado con "${topic}"
- "explanation" debe ayudar al alumno a entender por qué la respuesta es correcta
- Solo devuelve JSON puro, sin markdown ni texto adicional`;
  }

  private buildMultiTopicPrompt(
    courseTitle: string,
    schoolYearLabel: string,
    topics: string[],
    count: number,
    difficulty: 'EASY' | 'MEDIUM' | 'HARD',
  ): string {
    const perTopic = splitAcrossTopics(count, topics.length);
    const repartoLines = topics
      .map((t, i) => `- "${t}": ${perTopic[i]} ejercicio${perTopic[i] === 1 ? '' : 's'}`)
      .join('\n');

    return `Genera ${count} ejercicios de práctica en español que combinen VARIOS temas, como en un examen real.

Curso: "${courseTitle}"
${schoolYearLabel ? `Nivel educativo: "${schoolYearLabel}" (sistema educativo español)` : ''}
Dificultad: ${DIFFICULTY_GUIDANCE[difficulty]}

⚠️ REPARTO POR TEMA — OBLIGATORIO, NO NEGOCIABLE:
${repartoLines}

Cada ejercicio lleva un campo "topicLabel" con el tema al que pertenece, copiado EXACTAMENTE de la lista anterior (mismas mayúsculas, tildes y espacios). Si un topicLabel no coincide con un tema de la lista, la respuesta será RECHAZADA.

Devuelve ÚNICAMENTE un objeto JSON con esta estructura exacta (sin markdown, sin explicaciones adicionales fuera del JSON):
{
  "exercises": [
    {
      "topicLabel": "${topics[0]}",
      "statement": "enunciado del ejercicio",
      "type": "SINGLE",
      "options": ["opción A", "opción B", "opción C"],
      "solution": "opción A",
      "explanation": "por qué la opción A es correcta"
    },
    {
      "topicLabel": "${topics[0]}",
      "statement": "enunciado",
      "type": "TRUE_FALSE",
      "options": ["Verdadero", "Falso"],
      "solution": "Verdadero",
      "explanation": "explicación de por qué es verdadero"
    },
    {
      "topicLabel": "${topics[topics.length - 1]}",
      "statement": "enunciado de un ejercicio abierto",
      "type": "OPEN",
      "options": [],
      "solution": "respuesta correcta o pasos resueltos",
      "explanation": "explicación detallada del razonamiento"
    }
  ]
}

Reglas:
- Respeta el reparto exacto de ejercicios por tema indicado arriba
- Agrupa los ejercicios por tema en el orden de la lista
- Mezcla los 3 tipos (SINGLE, TRUE_FALSE, OPEN) cuando sea apropiado para cada tema
- SINGLE: 3-4 opciones, exactamente 1 correcta (la propiedad "solution" debe coincidir con una de las opciones)
- TRUE_FALSE: opciones siempre ["Verdadero", "Falso"], solución coincide
- OPEN: campo "options" vacío []; "solution" contiene la respuesta o pasos resueltos
- Los enunciados deben ser claros, precisos y adecuados al nivel ${schoolYearLabel || 'del curso'}
- Contenido curricular real relacionado con cada tema
- "explanation" debe ayudar al alumno a entender por qué la respuesta es correcta
- Solo devuelve JSON puro, sin markdown ni texto adicional`;
  }
}
