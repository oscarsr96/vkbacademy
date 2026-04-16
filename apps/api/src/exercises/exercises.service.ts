import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiProviderService } from '../ai/ai-provider.service';
import { GenerateExercisesDto } from './dto/generate-exercises.dto';

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
    );

    this.logger.log(
      `Generando ${dto.count} ejercicios sobre "${dto.topic}" para curso "${course.title}"`,
    );

    // ~150 tokens por ejercicio + overhead
    const maxTokens = Math.min(8000, 200 + dto.count * 250);
    const text = await this.ai.generate(prompt, maxTokens);

    try {
      const raw = text
        .trim()
        .replace(/^```json\n?/, '')
        .replace(/\n?```$/, '');
      const parsed = JSON.parse(raw) as GenerateExercisesResult;
      if (!Array.isArray(parsed.exercises)) {
        throw new Error('La respuesta no contiene un array `exercises`');
      }
      return parsed;
    } catch (err) {
      this.logger.error('Error al parsear JSON de IA (ejercicios):', text);
      throw new InternalServerErrorException(
        `El agente IA devolvió un formato inválido: ${err instanceof Error ? err.message : 'desconocido'}`,
      );
    }
  }

  private buildPrompt(
    courseTitle: string,
    schoolYearLabel: string,
    topic: string,
    count: number,
  ): string {
    return `Genera ${count} ejercicios de práctica en español sobre el tema "${topic}".

Curso: "${courseTitle}"
${schoolYearLabel ? `Nivel educativo: "${schoolYearLabel}" (sistema educativo español)` : ''}

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
}
