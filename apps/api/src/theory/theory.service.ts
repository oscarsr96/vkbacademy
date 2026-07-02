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
import { generateAiJson } from '../ai/ai-json';
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

    // Reintento automático ante JSON inválido: el fallback Haiku no garantiza
    // JSON bien formado y los errores de sintaxis son estocásticos (regenerar
    // casi siempre lo arregla). Ver `ai-json.ts`.
    let parsed: unknown;
    try {
      parsed = await generateAiJson(this.ai, prompt, 6000, { attempts: 2, logger: this.logger });
    } catch (err) {
      this.logger.error('Error al parsear JSON de IA (teoría) tras reintentos:', err);
      throw new InternalServerErrorException(
        `El agente IA devolvió un formato inválido: ${err instanceof Error ? err.message : 'desconocido'}`,
      );
    }
    const payload = this.validatePayload(parsed);

    // Estructura Winston deseada pero no bloqueante: si la IA no la respeta se
    // persiste igualmente (el deck degrada a slides normales) y queda traza.
    if (payload.lessons[0]?.kind !== TheoryLessonKind.INTRO) {
      this.logger.warn(`Temario sobre "${dto.topic}" sin promesa INTRO como primera lección`);
    }

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

  private validatePayload(parsed: unknown): GeneratedTheoryPayload {
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
    { "kind": "INTRO", "heading": "Qué vas a conseguir", "body": "la promesa (ver ESTRUCTURA)" },
    { "kind": "CONTENT", "heading": "título de la sección de desarrollo", "body": "desarrollo (ver ESTRUCTURA)" },
    { "kind": "EXAMPLE", "heading": "Ejemplos paso a paso", "body": "mínimo 3 ejemplos resueltos (ver ESTRUCTURA)" },
    { "kind": "VIDEO", "heading": "Vídeo recomendado", "ytQuery": "consulta optimizada para buscar el mejor vídeo en YouTube sobre este tema" },
    { "kind": "CONTENT", "heading": "Lo que te llevas", "body": "cierre espejo de la promesa (ver ESTRUCTURA)" }
  ]
}

ESTRUCTURA — metodología Winston de enseñanza, OBLIGATORIA:
- Entre 5 y 8 lecciones, en este orden: 1 INTRO "Qué vas a conseguir" (SIEMPRE la primera) + 1-3 CONTENT de desarrollo + 1 EXAMPLE + 1 VIDEO + 1 CONTENT "Lo que te llevas" (SIEMPRE la última).

- INTRO "Qué vas a conseguir" — promesa de empoderamiento: qué sabrá HACER el alumno al final que no sabe ahora, y para qué le sirve. Formato: 1 frase corta que enganche + lista de 3-4 items con el formato exacto "- **Sabrás** [habilidad concreta]: te servirá para [uso real: el examen, el deporte o la vida diaria]". Sin definiciones todavía, sin índice.

- CONTENT de desarrollo — en CADA lección de este tipo:
  - Abre situando al alumno (puntuación verbal): "Ya tienes [lo anterior]. Ahora, bloque N: [lo que viene]." (1 frase).
  - Cycling: el concepto central explicado 3 veces seguidas de forma distinta: (1) definición precisa, (2) analogía cotidiana o deportiva, (3) mini-ejemplo con números o caso concreto.
  - Fencing: exactamente 1 callout \`> 🚧 **Esto SÍ / esto NO:** [concepto] ES [definición corta]. NO lo confundas con [concepto parecido]: [diferencia en 1 frase].\`
  - Exactamente 1 callout ❓ con una pregunta que el alumno pueda intentar responder antes de seguir.
  - Párrafos CORTOS (máximo ~40 palabras) separados por línea en blanco: cada párrafo se convierte en un fragmento de diapositiva.

- EXAMPLE "Ejemplos paso a paso" — MÍNIMO 3 ejemplos resueltos, de dificultad creciente. CADA ejemplo con esta estructura markdown EXACTA:
### 💪 Ejemplo N: [título corto]
**Enunciado:** [planteamiento concreto]
1. [primer paso: qué se hace y por qué, en 1-2 frases]
2. [segundo paso]
3. [tercer paso]
(mínimo 3 pasos por ejemplo; añade más si el problema lo pide)
**Resultado:** [solución final]
**Por qué funciona:** [1-2 frases conectando el procedimiento con la teoría]

- CONTENT "Lo que te llevas" — cierre de contribuciones, espejo de la promesa inicial: lista de 3-4 items "- **Ya sabes** [la misma habilidad prometida al inicio]" + 1 frase final que empuje al siguiente paso (practicar con ejercicios o hacer el test). PROHIBIDO cerrar con "gracias", "espero que" o despedidas.

VOZ Y ESTILO (anti patrón-IA) — escribe como un entrenador cercano en el vestuario, no como un manual:
- Tutea siempre y habla directo al alumno ("mira", "ojo con esto", "ahora te toca a ti").
- Varía el ritmo: frases cortas y punzantes mezcladas con alguna más larga. Nada de párrafos clónicos.
- PROHIBIDO el relleno típico de IA: "En resumen", "En conclusión", "Es importante destacar", "cabe mencionar", "juega un papel crucial/fundamental", "sumérgete", "el fascinante mundo de", "no es solo X, es Y".
- PROHIBIDO inflar la importancia del tema ("marca un antes y un después", "es clave para tu futuro").
- Nada de guiones largos (—) como puntuación: usa coma, paréntesis o dos puntos.
- Concreto siempre: números, objetos y situaciones reales de un adolescente (la paga, los entrenos, los videojuegos, las notas) antes que abstracciones.

Reglas de formato:
- INTRO/CONTENT/EXAMPLE: campo "body" obligatorio en markdown. NO incluir "ytQuery".
- VIDEO: campo "ytQuery" obligatorio. NO incluir "body".
- El markdown puede usar **negritas**, *cursivas*, listas con guiones, encabezados con ##.
- Para fórmulas matemáticas USA SIEMPRE LaTeX: inline con $...$ (ej. $\\log_a b = c$) y bloques con $$...$$ para derivaciones o ecuaciones destacadas. NO escribas fórmulas en texto plano (NUNCA "log_a b = c"; SIEMPRE "$\\log_a b = c$").
- **DIDÁCTICA — callouts pedagógicos** intercalados en el body, con blockquote markdown, emoji al inicio y etiqueta en negrita:
  - \`> 💡 **Tip:** consejo práctico que ayude a recordar o aplicar el concepto.\`
  - \`> 🧠 **Recuerda:** dato/fórmula/regla clave que el alumno debe memorizar.\`
  - \`> ⚠️ **Cuidado:** error común a evitar o trampa habitual del tema.\`
  - \`> ❓ **Pregunta:** pregunta retórica para que el alumno se pare a pensar antes de seguir.\`
  - \`> 🚧 **Esto SÍ / esto NO:** delimitación del concepto frente a otro parecido.\`
  Mete entre 2 y 4 callouts en CADA lección INTRO/CONTENT/EXAMPLE (los 🚧 y ❓ obligatorios de cada CONTENT cuentan). Cada callout en su propio párrafo (separado por línea en blanco). NO los pongas todos juntos al final — repártelos donde encajen pedagógicamente.
- Contenido curricular real y riguroso, adaptado al nivel ${schoolYearLabel || 'del curso'}.
- "ytQuery" debe ser una búsqueda específica y descriptiva (ej. "demostración propiedades logaritmos bachillerato").
- Solo devuelve JSON puro, sin markdown alrededor del JSON.`;
  }
}
