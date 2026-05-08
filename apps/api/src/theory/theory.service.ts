import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ChallengeType,
  Prisma,
  TheoryLessonKind,
  type TheoryModule,
  type TheoryLesson,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiProviderService } from '../ai/ai-provider.service';
import { YoutubeService } from '../youtube/youtube.service';
import { ChallengesService } from '../challenges/challenges.service';
import { GenerateTheoryDto } from './dto/generate-theory.dto';

interface GeneratedTheoryLesson {
  kind: TheoryLessonKind;
  heading: string;
  body?: string;
  ytQuery?: string;
}

interface GeneratedTheoryPayload {
  title: string;
  summary: string;
  lessons: GeneratedTheoryLesson[];
}

export type TheoryModuleWithLessons = TheoryModule & { lessons: TheoryLesson[] };

const VALID_KINDS = new Set<TheoryLessonKind>([
  TheoryLessonKind.INTRO,
  TheoryLessonKind.CONTENT,
  TheoryLessonKind.EXAMPLE,
  TheoryLessonKind.VIDEO,
]);

/**
 * Genera módulos de teoría bajo demanda, persistidos en la biblioteca
 * privada del alumno (scoped por userId). Cada módulo contiene varias
 * lecciones (introducción, desarrollo, ejemplos, vídeo de YouTube).
 */
@Injectable()
export class TheoryService {
  private readonly logger = new Logger(TheoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiProviderService,
    private readonly youtube: YoutubeService,
    private readonly challenges: ChallengesService,
  ) {}

  async generate(userId: string, dto: GenerateTheoryDto): Promise<TheoryModuleWithLessons> {
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

    const schoolYearLabel = course.schoolYear?.label ?? '';
    const prompt = this.buildPrompt(course.title, schoolYearLabel, dto.topic);

    this.logger.log(`Generando temario sobre "${dto.topic}" para curso "${course.title}"`);

    const text = await this.ai.generate(prompt, 4000);
    const payload = this.parseAi(text);

    // Resolver vídeo de YouTube para lecciones VIDEO. Para cada VIDEO pedimos
    // hasta 5 candidatos (ordenados por engagement+whitelist) y los guardamos
    // todos para que el alumno pueda elegir; el primero es el que se embebe
    // por defecto (y se persiste también en youtubeId por compat).
    const lessonsWithVideo = await Promise.all(
      payload.lessons.map(async (lesson) => {
        if (lesson.kind !== TheoryLessonKind.VIDEO) {
          return { ...lesson, youtubeId: null, videoCandidates: null };
        }
        const query = lesson.ytQuery ?? `${dto.topic} ${course.title}`;
        const candidates = await this.youtube.findCandidates(query, schoolYearLabel, { limit: 5 });
        return {
          ...lesson,
          youtubeId: candidates[0]?.youtubeId ?? null,
          videoCandidates: candidates.length > 0 ? candidates : null,
        };
      }),
    );

    const created = await this.prisma.theoryModule.create({
      data: {
        userId,
        courseId: dto.courseId,
        topic: dto.topic,
        title: payload.title,
        summary: payload.summary,
        lessons: {
          create: lessonsWithVideo.map((lesson, idx) => {
            const isVideo = lesson.kind === TheoryLessonKind.VIDEO;
            return {
              order: idx,
              kind: lesson.kind,
              heading: lesson.heading,
              body: isVideo ? null : (lesson.body ?? ''),
              youtubeId: isVideo ? lesson.youtubeId : null,
              videoCandidates:
                isVideo && lesson.videoCandidates
                  ? (lesson.videoCandidates as unknown as Prisma.InputJsonValue)
                  : Prisma.DbNull,
            };
          }),
        },
      },
      include: { lessons: { orderBy: { order: 'asc' } } },
    });

    // Disparar evaluación de retos en segundo plano (sin bloquear la respuesta)
    void this.challenges.checkAndAward(
      userId,
      ChallengeType.THEORY_COMPLETED,
      ChallengeType.TOTAL_HOURS_THEORY,
    );

    return created;
  }

  listMine(userId: string, courseId?: string): Promise<TheoryModule[]> {
    return this.prisma.theoryModule.findMany({
      where: { userId, ...(courseId ? { courseId } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(userId: string, id: string): Promise<TheoryModuleWithLessons> {
    const mod = await this.prisma.theoryModule.findUnique({
      where: { id },
      include: { lessons: { orderBy: { order: 'asc' } } },
    });
    if (!mod) {
      throw new NotFoundException(`Temario "${id}" no encontrado`);
    }
    if (mod.userId !== userId) {
      throw new ForbiddenException('No tienes acceso a este temario');
    }
    return mod;
  }

  async deleteById(userId: string, id: string): Promise<void> {
    const mod = await this.prisma.theoryModule.findUnique({ where: { id } });
    if (!mod) {
      throw new NotFoundException(`Temario "${id}" no encontrado`);
    }
    if (mod.userId !== userId) {
      throw new ForbiddenException('No tienes acceso a este temario');
    }
    await this.prisma.theoryModule.delete({ where: { id } });
  }

  private parseAi(text: string): GeneratedTheoryPayload {
    let parsed: unknown;
    try {
      const raw = text
        .trim()
        .replace(/^```json\n?/, '')
        .replace(/\n?```$/, '');
      parsed = JSON.parse(raw);
    } catch (err) {
      this.logger.error('Error al parsear JSON de IA (teoría):', text);
      throw new InternalServerErrorException(
        `El agente IA devolvió un formato inválido: ${err instanceof Error ? err.message : 'desconocido'}`,
      );
    }

    const obj = parsed as Partial<GeneratedTheoryPayload>;
    if (!obj.title || !obj.summary || !Array.isArray(obj.lessons) || obj.lessons.length === 0) {
      throw new InternalServerErrorException(
        'La respuesta de la IA no contiene title/summary/lessons válidos',
      );
    }

    for (const lesson of obj.lessons) {
      if (!VALID_KINDS.has(lesson.kind)) {
        throw new InternalServerErrorException(`Tipo de lección inválido: "${lesson.kind}"`);
      }
      if (typeof lesson.heading !== 'string' || lesson.heading.length === 0) {
        throw new InternalServerErrorException('Una lección no tiene heading');
      }
      if (lesson.kind !== TheoryLessonKind.VIDEO && !lesson.body) {
        throw new InternalServerErrorException(
          `La lección "${lesson.heading}" (${lesson.kind}) no tiene body`,
        );
      }
    }

    return obj as GeneratedTheoryPayload;
  }

  private buildPrompt(courseTitle: string, schoolYearLabel: string, topic: string): string {
    return `Genera un temario de teoría en español sobre "${topic}".

Curso: "${courseTitle}"
${schoolYearLabel ? `Nivel educativo: "${schoolYearLabel}" (sistema educativo español)` : ''}

Devuelve ÚNICAMENTE un objeto JSON con esta estructura exacta (sin markdown, sin texto adicional):
{
  "title": "título limpio del temario (no repitas el tema literal)",
  "summary": "resumen del temario en 1-2 frases",
  "lessons": [
    {
      "kind": "INTRO",
      "heading": "Introducción",
      "body": "explicación introductoria en markdown (2-3 párrafos)"
    },
    {
      "kind": "CONTENT",
      "heading": "título de la sección de desarrollo",
      "body": "explicación detallada en markdown (3-5 párrafos, puede usar listas y negritas)"
    },
    {
      "kind": "EXAMPLE",
      "heading": "Ejemplos",
      "body": "ejemplos resueltos en markdown (al menos 2 ejemplos con paso a paso)"
    },
    {
      "kind": "VIDEO",
      "heading": "Vídeo recomendado",
      "ytQuery": "consulta optimizada para buscar el mejor vídeo en YouTube sobre este tema"
    }
  ]
}

Reglas:
- Mínimo 3 lecciones, máximo 6.
- Estructura recomendada: 1 INTRO + 1-3 CONTENT + 1 EXAMPLE + 1 VIDEO (último).
- INTRO/CONTENT/EXAMPLE: campo "body" obligatorio en markdown. NO incluir "ytQuery".
- VIDEO: campo "ytQuery" obligatorio. NO incluir "body".
- El markdown puede usar **negritas**, *cursivas*, listas con guiones, encabezados con ##.
- Para fórmulas matemáticas USA SIEMPRE LaTeX: inline con $...$ (ej. $\\log_a b = c$) y bloques con $$...$$ para derivaciones o ecuaciones destacadas. NO escribas fórmulas en texto plano (NUNCA "log_a b = c"; SIEMPRE "$\\log_a b = c$").
- **DIDÁCTICA — incluye callouts pedagógicos** intercalados en el body para hacer la lectura más activa. Formato OBLIGATORIO con blockquote markdown, emoji al inicio, etiqueta en negrita:
  - \`> 💡 **Tip:** consejo práctico que ayude a recordar o aplicar el concepto.\`
  - \`> 🧠 **Recuerda:** dato/fórmula/regla clave que el alumno debe memorizar.\`
  - \`> ⚠️ **Cuidado:** error común a evitar o trampa habitual del tema.\`
  - \`> ❓ **Pregunta:** pregunta retórica para que el alumno se pare a pensar antes de seguir.\`
  Mete entre 2 y 4 callouts en CADA lección INTRO/CONTENT/EXAMPLE, mezclando tipos. Cada callout en su propio párrafo (separado por línea en blanco). NO los pongas todos juntos al final — repártelos donde encajen pedagógicamente.
- Contenido curricular real y riguroso, adaptado al nivel ${schoolYearLabel || 'del curso'}.
- "ytQuery" debe ser una búsqueda específica y descriptiva (ej. "demostración propiedades logaritmos bachillerato").
- Solo devuelve JSON puro, sin markdown alrededor del JSON.`;
  }
}
