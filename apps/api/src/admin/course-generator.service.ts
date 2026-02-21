import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';


// ─── Estructuras generadas por Claude ────────────────────────────────────────

interface GeneratedAnswer {
  text: string;
  isCorrect: boolean;
}

interface GeneratedQuestion {
  text: string;
  type: 'SINGLE' | 'TRUE_FALSE';
  order: number;
  answers: GeneratedAnswer[];
}

// Contenido para lección de tipo MATCH (emparejar)
interface GeneratedMatchContent {
  pairs: { left: string; right: string }[];
}

// Contenido para lección de tipo SORT (ordenar)
interface GeneratedSortContent {
  prompt: string;
  items: { text: string; correctOrder: number }[];
}

// Contenido para lección de tipo FILL_BLANK (rellenar huecos)
interface GeneratedFillBlankContent {
  template: string;
  distractors: string[];
}

interface GeneratedLesson {
  title: string;
  type: 'VIDEO' | 'QUIZ' | 'MATCH' | 'SORT' | 'FILL_BLANK';
  order: number;
  quiz?: { questions: GeneratedQuestion[] };
  content?: GeneratedMatchContent | GeneratedSortContent | GeneratedFillBlankContent;
}

interface GeneratedModule {
  title: string;
  order: number;
  lessons: GeneratedLesson[];
}

interface GeneratedCourse {
  title: string;
  description: string;
  modules: GeneratedModule[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Construye el bloque de datos para crear una lección en un `lessons.create[]` anidado
 * (no incluye moduleId, que Prisma infiere del contexto del módulo padre).
 */
function buildNestedLessonData(lesson: GeneratedLesson) {
  return {
    title: lesson.title,
    type: lesson.type,
    order: lesson.order,
    ...(lesson.content ? { content: lesson.content as unknown as Prisma.InputJsonValue } : {}),
    ...(lesson.type === 'QUIZ' && lesson.quiz
      ? {
          quiz: {
            create: {
              questions: {
                create: lesson.quiz.questions.map((q) => ({
                  text: q.text,
                  type: q.type,
                  order: q.order,
                  answers: {
                    create: q.answers.map((a) => ({
                      text: a.text,
                      isCorrect: a.isCorrect,
                    })),
                  },
                })),
              },
            },
          },
        }
      : {}),
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class CourseGeneratorService {
  private readonly logger = new Logger(CourseGeneratorService.name);
  private readonly anthropic: Anthropic;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.anthropic = new Anthropic({
      apiKey: this.config.get<string>('ANTHROPIC_API_KEY'),
    });
  }

  async generateAndCreate(name: string, schoolYearId: string) {
    const schoolYear = await this.prisma.schoolYear.findUnique({
      where: { id: schoolYearId },
    });

    if (!schoolYear) {
      throw new NotFoundException(`Nivel educativo con id "${schoolYearId}" no encontrado`);
    }

    const courseData = await this.callClaude(name, schoolYear.label);

    const course = await this.prisma.course.create({
      data: {
        title: courseData.title,
        description: courseData.description,
        published: false,
        schoolYearId,
        modules: {
          create: courseData.modules.map((mod) => ({
            title: mod.title,
            order: mod.order,
            lessons: {
              create: mod.lessons.map((lesson) => buildNestedLessonData(lesson)),
            },
          })),
        },
      },
      include: {
        schoolYear: true,
        modules: {
          include: {
            lessons: {
              include: {
                quiz: {
                  include: { questions: { include: { answers: true } } },
                },
              },
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    return course;
  }

  async generateAndCreateModule(courseId: string, name: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        schoolYear: true,
        modules: { orderBy: { order: 'asc' } },
      },
    });

    if (!course) {
      throw new NotFoundException(`Curso con id "${courseId}" no encontrado`);
    }

    const moduleData = await this.callClaudeForModule(name, {
      courseTitle: course.title,
      courseDescription: course.description ?? '',
      schoolYearLabel: course.schoolYear?.label ?? '',
      existingModuleTitles: course.modules.map((m) => m.title),
    });

    const nextOrder =
      course.modules.length > 0
        ? Math.max(...course.modules.map((m) => m.order)) + 1
        : 1;

    return this.prisma.$transaction(async (tx) => {
      const module = await tx.module.create({
        data: {
          title: moduleData.title,
          order: nextOrder,
          courseId,
          lessons: {
            create: moduleData.lessons.map((lesson) => buildNestedLessonData(lesson)),
          },
        },
        include: {
          lessons: {
            include: {
              quiz: { include: { questions: { include: { answers: true } } } },
            },
            orderBy: { order: 'asc' },
          },
        },
      });
      return module;
    });
  }

  async generateAndCreateLesson(moduleId: string, topic: string) {
    const module = await this.prisma.module.findUnique({
      where: { id: moduleId },
      include: {
        course: { include: { schoolYear: true } },
        lessons: { orderBy: { order: 'asc' } },
      },
    });

    if (!module) {
      throw new NotFoundException(`Módulo con id "${moduleId}" no encontrado`);
    }

    const lessonData = await this.callClaudeForLesson(topic, {
      courseTitle: module.course.title,
      courseDescription: module.course.description ?? '',
      schoolYearLabel: module.course.schoolYear?.label ?? '',
      moduleTitle: module.title,
      existingLessonTitles: module.lessons.map((l) => l.title),
    });

    const nextOrder =
      module.lessons.length > 0
        ? Math.max(...module.lessons.map((l) => l.order)) + 1
        : 1;

    return this.prisma.$transaction(async (tx) => {
      const lesson = await tx.lesson.create({
        data: {
          title: lessonData.title,
          type: lessonData.type,
          order: nextOrder,
          moduleId,
          ...(lessonData.content ? { content: lessonData.content as unknown as Prisma.InputJsonValue } : {}),
          ...(lessonData.type === 'QUIZ' && lessonData.quiz
            ? {
                quiz: {
                  create: {
                    questions: {
                      create: lessonData.quiz.questions.map((q) => ({
                        text: q.text,
                        type: q.type,
                        order: q.order,
                        answers: {
                          create: q.answers.map((a) => ({
                            text: a.text,
                            isCorrect: a.isCorrect,
                          })),
                        },
                      })),
                    },
                  },
                },
              }
            : {}),
        },
        include: {
          quiz: { include: { questions: { include: { answers: true } } } },
        },
      });
      return lesson;
    });
  }

  async generateAndCreateQuestion(quizId: string, topic: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: { orderBy: { order: 'asc' } },
        lesson: {
          include: {
            module: {
              include: {
                course: { include: { schoolYear: true } },
              },
            },
          },
        },
      },
    });

    if (!quiz) {
      throw new NotFoundException(`Quiz con id "${quizId}" no encontrado`);
    }

    const { lesson } = quiz;
    const { module } = lesson;
    const { course } = module;

    const questionData = await this.callClaudeForQuestion(topic, {
      courseTitle: course.title,
      schoolYearLabel: course.schoolYear?.label ?? '',
      moduleTitle: module.title,
      lessonTitle: lesson.title,
      existingQuestions: quiz.questions.map((q) => q.text),
    });

    const nextOrder =
      quiz.questions.length > 0
        ? Math.max(...quiz.questions.map((q) => q.order)) + 1
        : 1;

    return this.prisma.$transaction(async (tx) => {
      const question = await tx.question.create({
        data: { text: questionData.text, type: questionData.type, quizId, order: nextOrder },
      });
      await tx.answer.createMany({
        data: questionData.answers.map((a) => ({
          text: a.text,
          isCorrect: a.isCorrect,
          questionId: question.id,
        })),
      });
      return tx.question.findUnique({
        where: { id: question.id },
        include: { answers: true },
      });
    });
  }

  // ─── Generación de preguntas de examen ────────────────────────────────────

  async generateExamQuestions(
    topic: string,
    count: number,
    scope: { courseId?: string; moduleId?: string },
  ) {
    if (!scope.courseId && !scope.moduleId) {
      throw new Error('Debes especificar courseId o moduleId');
    }

    // Cargar contexto del curso/módulo para enriquecer el prompt
    let context: { courseTitle: string; schoolYearLabel: string; moduleTitle?: string } = {
      courseTitle: '',
      schoolYearLabel: '',
    };

    if (scope.moduleId) {
      const module = await this.prisma.module.findUnique({
        where: { id: scope.moduleId },
        include: { course: { include: { schoolYear: true } } },
      });
      if (module) {
        context = {
          courseTitle: module.course.title,
          schoolYearLabel: module.course.schoolYear?.label ?? '',
          moduleTitle: module.title,
        };
      }
    } else if (scope.courseId) {
      const course = await this.prisma.course.findUnique({
        where: { id: scope.courseId },
        include: { schoolYear: true },
      });
      if (course) {
        context = {
          courseTitle: course.title,
          schoolYearLabel: course.schoolYear?.label ?? '',
        };
      }
    }

    const generated = await this.callClaudeForExamQuestions(topic, count, context);

    // Crear preguntas en paralelo
    const prisma = this.prisma;
    const created = await Promise.all(
      generated.map(async (q, i) => {
        return prisma.$transaction(async (tx) => {
          const question = await tx.examQuestion.create({
            data: {
              text: q.text,
              type: q.type,
              order: i + 1,
              courseId: scope.courseId ?? null,
              moduleId: scope.moduleId ?? null,
            },
          });
          await tx.examAnswer.createMany({
            data: q.answers.map((a) => ({
              text: a.text,
              isCorrect: a.isCorrect,
              questionId: question.id,
            })),
          });
          return tx.examQuestion.findUnique({
            where: { id: question.id },
            include: { answers: true },
          });
        });
      }),
    );

    return created;
  }

  // ─── Prompts privados ──────────────────────────────────────────────────────

  private async callClaudeForQuestion(
    topic: string,
    context: {
      courseTitle: string;
      schoolYearLabel: string;
      moduleTitle: string;
      lessonTitle: string;
      existingQuestions: string[];
    },
  ): Promise<GeneratedQuestion> {
    const { courseTitle, schoolYearLabel, moduleTitle, lessonTitle, existingQuestions } = context;

    const existingList =
      existingQuestions.length > 0
        ? `Preguntas ya existentes en este quiz (no repitas ni uses enunciados similares):\n${existingQuestions.map((t, i) => `  ${i + 1}. ${t}`).join('\n')}`
        : 'Esta será la primera pregunta del quiz.';

    const prompt = `Genera un JSON de pregunta de quiz educativo en español.

Curso: "${courseTitle}"
Nivel educativo: "${schoolYearLabel}" (sistema educativo español)
Módulo: "${moduleTitle}"
Lección/Quiz: "${lessonTitle}"
Tema de la pregunta: "${topic}"

${existingList}

Devuelve ÚNICAMENTE un objeto JSON con esta estructura exacta (sin markdown, sin explicaciones):
{
  "text": "enunciado de la pregunta",
  "type": "SINGLE",
  "order": 1,
  "answers": [
    { "text": "opción A", "isCorrect": true },
    { "text": "opción B", "isCorrect": false },
    { "text": "opción C", "isCorrect": false }
  ]
}

Reglas:
- Elige el tipo más adecuado para el tema: "SINGLE" (una respuesta correcta) o "TRUE_FALSE" (verdadero/falso)
- Para SINGLE: entre 3 y 4 opciones, exactamente 1 correcta
- Para TRUE_FALSE: exactamente 2 opciones ("Verdadero" y "Falso"), 1 correcta
- El enunciado debe ser claro, preciso y adecuado para ${schoolYearLabel} en España
- Contenido curricular real relacionado con el tema "${topic}"
- Solo devuelve JSON puro, sin markdown ni texto adicional`;

    this.logger.log(
      `Llamando a Claude para generar pregunta: "${topic}" en quiz de "${lessonTitle}"`,
    );

    const message = await this.anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = message.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new InternalServerErrorException('Claude no devolvió contenido de texto');
    }

    try {
      const raw = textContent.text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
      const parsed = JSON.parse(raw) as GeneratedQuestion;
      this.logger.log(`Pregunta generada correctamente: "${parsed.text}"`);
      return parsed;
    } catch {
      this.logger.error('Error al parsear JSON de Claude (pregunta):', textContent.text);
      throw new InternalServerErrorException(
        'El agente IA devolvió un formato inválido. Inténtalo de nuevo.',
      );
    }
  }

  private async callClaudeForLesson(
    topic: string,
    context: {
      courseTitle: string;
      courseDescription: string;
      schoolYearLabel: string;
      moduleTitle: string;
      existingLessonTitles: string[];
    },
  ): Promise<Omit<GeneratedLesson, 'order'>> {
    const { courseTitle, courseDescription, schoolYearLabel, moduleTitle, existingLessonTitles } =
      context;

    const existingList =
      existingLessonTitles.length > 0
        ? `Lecciones ya existentes en este módulo (no repitas contenido):\n${existingLessonTitles.map((t, i) => `  ${i + 1}. ${t}`).join('\n')}`
        : 'Esta será la primera lección del módulo.';

    const prompt = `Genera un JSON de lección educativa en español.

Curso: "${courseTitle}"
${courseDescription ? `Descripción del curso: "${courseDescription}"` : ''}
Nivel educativo: "${schoolYearLabel}" (sistema educativo español)
Módulo: "${moduleTitle}"
Tema de la lección: "${topic}"

${existingList}

Tipos de lección disponibles y cuándo usarlos:
- VIDEO: explicación teórica, introduce conceptos nuevos
- QUIZ: evaluación con preguntas de opción múltiple
- MATCH: emparejar términos con definiciones o conceptos relacionados (4-6 pares)
- SORT: ordenar elementos en la secuencia correcta (4-6 items)
- FILL_BLANK: completar frases con las palabras correctas (usa {{palabra}} para los huecos)

Devuelve ÚNICAMENTE un objeto JSON con una de estas estructuras (sin markdown, sin explicaciones):

Para VIDEO:
{ "title": "título de la lección", "type": "VIDEO" }

Para QUIZ:
{
  "title": "título del quiz",
  "type": "QUIZ",
  "quiz": {
    "questions": [
      {
        "text": "pregunta",
        "type": "SINGLE",
        "order": 1,
        "answers": [
          { "text": "opción A", "isCorrect": true },
          { "text": "opción B", "isCorrect": false },
          { "text": "opción C", "isCorrect": false }
        ]
      }
    ]
  }
}

Para MATCH:
{
  "title": "Empareja cada concepto con su definición",
  "type": "MATCH",
  "content": {
    "pairs": [
      { "left": "término 1", "right": "definición 1" },
      { "left": "término 2", "right": "definición 2" },
      { "left": "término 3", "right": "definición 3" },
      { "left": "término 4", "right": "definición 4" }
    ]
  }
}

Para SORT:
{
  "title": "Ordena los pasos del proceso",
  "type": "SORT",
  "content": {
    "prompt": "Ordena los siguientes elementos de menor a mayor / en orden cronológico / ...",
    "items": [
      { "text": "primer elemento (en orden correcto)", "correctOrder": 0 },
      { "text": "segundo elemento", "correctOrder": 1 },
      { "text": "tercer elemento", "correctOrder": 2 },
      { "text": "cuarto elemento", "correctOrder": 3 }
    ]
  }
}

Para FILL_BLANK:
{
  "title": "Completa las frases sobre el tema",
  "type": "FILL_BLANK",
  "content": {
    "template": "La {{fotosíntesis}} es el proceso por el que las plantas producen {{glucosa}} usando la luz solar.",
    "distractors": ["respiración", "proteínas", "agua", "minerales"]
  }
}

Reglas:
- Elige el tipo que mejor encaje con el tema "${topic}" y lo que ya existe en el módulo
- Si hay muchos vídeos, prefiere un tipo de actividad interactiva o quiz
- MATCH: usa términos/conceptos reales del currículo
- SORT: el campo "correctOrder" debe ser 0-based (0, 1, 2...) en el orden correcto definitivo
- FILL_BLANK: los {{huecos}} deben ser palabras clave del tema; incluye 2-4 distractores creíbles
- Para QUIZ: entre 2 y 5 preguntas; tipos "SINGLE" o "TRUE_FALSE"
- Contenido curricular real y adecuado para ${schoolYearLabel} en España
- Solo devuelve JSON puro, sin markdown ni texto adicional`;

    this.logger.log(
      `Llamando a Claude para generar lección: "${topic}" en módulo "${moduleTitle}"`,
    );

    const message = await this.anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = message.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new InternalServerErrorException('Claude no devolvió contenido de texto');
    }

    try {
      const raw = textContent.text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
      const parsed = JSON.parse(raw) as Omit<GeneratedLesson, 'order'>;
      this.logger.log(`Lección generada correctamente: "${parsed.title}" (${parsed.type})`);
      return parsed;
    } catch {
      this.logger.error('Error al parsear JSON de Claude (lección):', textContent.text);
      throw new InternalServerErrorException(
        'El agente IA devolvió un formato inválido. Inténtalo de nuevo.',
      );
    }
  }

  private async callClaudeForModule(
    name: string,
    context: {
      courseTitle: string;
      courseDescription: string;
      schoolYearLabel: string;
      existingModuleTitles: string[];
    },
  ): Promise<Omit<GeneratedModule, 'order'>> {
    const { courseTitle, courseDescription, schoolYearLabel, existingModuleTitles } = context;

    const existingList =
      existingModuleTitles.length > 0
        ? `Módulos ya existentes en el curso (no repitas contenido):\n${existingModuleTitles.map((t, i) => `  ${i + 1}. ${t}`).join('\n')}`
        : 'Este será el primer módulo del curso.';

    const prompt = `Genera un JSON de módulo educativo en español.

Curso: "${courseTitle}"
${courseDescription ? `Descripción: "${courseDescription}"` : ''}
Nivel educativo: "${schoolYearLabel}" (sistema educativo español)
Tema del módulo: "${name}"

${existingList}

Tipos de lección disponibles:
- VIDEO: explicación teórica del concepto
- QUIZ: preguntas de opción múltiple para evaluar
- MATCH: emparejar términos con definiciones (4-6 pares)
- SORT: ordenar elementos en secuencia correcta (4-6 items)
- FILL_BLANK: completar frases con palabras clave

Devuelve ÚNICAMENTE un objeto JSON con esta estructura exacta (sin markdown, sin explicaciones):
{
  "title": "título del módulo",
  "lessons": [
    {
      "title": "Introducción a ${name}",
      "type": "VIDEO",
      "order": 1
    },
    {
      "title": "Empareja los conceptos de ${name}",
      "type": "MATCH",
      "order": 2,
      "content": {
        "pairs": [
          { "left": "término 1", "right": "definición 1" },
          { "left": "término 2", "right": "definición 2" },
          { "left": "término 3", "right": "definición 3" },
          { "left": "término 4", "right": "definición 4" }
        ]
      }
    },
    {
      "title": "Test de ${name}",
      "type": "QUIZ",
      "order": 3,
      "quiz": {
        "questions": [
          {
            "text": "pregunta",
            "type": "SINGLE",
            "order": 1,
            "answers": [
              { "text": "opción A", "isCorrect": true },
              { "text": "opción B", "isCorrect": false },
              { "text": "opción C", "isCorrect": false }
            ]
          }
        ]
      }
    }
  ]
}

Reglas:
- 3-5 lecciones en el módulo: al menos 1 VIDEO y 1 QUIZ; el resto puede ser MATCH, SORT o FILL_BLANK
- Incluye al menos 1 actividad interactiva (MATCH, SORT o FILL_BLANK) cuando encaje con el tema
- MATCH: pares de términos/definiciones/ejemplos reales del tema "${name}"
- SORT: "correctOrder" debe ser 0-based en el orden final correcto (0, 1, 2...)
- FILL_BLANK: usa {{palabra}} para huecos; incluye 2-4 distractors plausibles
- QUIZ: 2-4 preguntas, tipos "SINGLE" o "TRUE_FALSE"
- Contenido curricular real y adecuado para ${schoolYearLabel} en España
- El contenido debe ser coherente con el curso "${courseTitle}" y no repetir los módulos existentes
- Solo devuelve JSON puro, sin markdown ni texto adicional`;

    this.logger.log(`Llamando a Claude para generar módulo: "${name}" en curso "${courseTitle}"`);

    const message = await this.anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = message.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new InternalServerErrorException('Claude no devolvió contenido de texto');
    }

    try {
      const raw = textContent.text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
      const parsed = JSON.parse(raw) as Omit<GeneratedModule, 'order'>;
      this.logger.log(`Módulo generado correctamente: "${parsed.title}"`);
      return parsed;
    } catch {
      this.logger.error('Error al parsear JSON de Claude (módulo):', textContent.text);
      throw new InternalServerErrorException(
        'El agente IA devolvió un formato inválido. Inténtalo de nuevo.',
      );
    }
  }

  private async callClaudeForExamQuestions(
    topic: string,
    count: number,
    context: { courseTitle: string; schoolYearLabel: string; moduleTitle?: string },
  ): Promise<GeneratedQuestion[]> {
    const { courseTitle, schoolYearLabel, moduleTitle } = context;

    const contextLines = [
      courseTitle ? `Curso: "${courseTitle}"` : '',
      schoolYearLabel ? `Nivel educativo: "${schoolYearLabel}" (sistema educativo español)` : '',
      moduleTitle ? `Módulo: "${moduleTitle}"` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const prompt = `Genera un JSON array de ${count} preguntas de examen en español sobre el tema "${topic}".

${contextLines ? `Contexto:\n${contextLines}\n` : ''}
Devuelve ÚNICAMENTE un array JSON con esta estructura (sin markdown, sin explicaciones):
[
  {
    "text": "enunciado de la pregunta",
    "type": "SINGLE",
    "order": 1,
    "answers": [
      { "text": "opción A", "isCorrect": true },
      { "text": "opción B", "isCorrect": false },
      { "text": "opción C", "isCorrect": false }
    ]
  }
]

Reglas:
- Mezcla tipos: "SINGLE" (una respuesta correcta, 3-4 opciones) y "TRUE_FALSE" (exactamente 2 opciones "Verdadero"/"Falso")
- Cada pregunta debe ser independiente y evaluar un aspecto diferente del tema
${schoolYearLabel ? `- Adecúa el nivel de dificultad y vocabulario a "${schoolYearLabel}" en España` : ''}
${moduleTitle ? `- Las preguntas deben ser coherentes con el contenido del módulo "${moduleTitle}"` : ''}
- Contenido curricular real relacionado con "${topic}"
- Solo devuelve JSON puro, sin markdown ni texto adicional`;

    this.logger.log(`Llamando a Claude para generar ${count} preguntas de examen sobre "${topic}" (${courseTitle || 'sin curso'}, ${moduleTitle || 'sin módulo'})`);

    const message = await this.anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = message.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new InternalServerErrorException('Claude no devolvió contenido de texto');
    }

    try {
      const raw = textContent.text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
      const parsed = JSON.parse(raw) as GeneratedQuestion[];
      this.logger.log(`${parsed.length} preguntas de examen generadas correctamente`);
      return parsed;
    } catch {
      this.logger.error('Error al parsear JSON de Claude (preguntas de examen):', textContent.text);
      throw new InternalServerErrorException(
        'El agente IA devolvió un formato inválido. Inténtalo de nuevo.',
      );
    }
  }

  private async callClaude(name: string, schoolYearLabel: string): Promise<GeneratedCourse> {
    const prompt = `Genera un JSON de curso escolar en español.
Nombre del curso: "${name}"
Nivel educativo: "${schoolYearLabel}" (sistema educativo español)

Tipos de lección disponibles:
- VIDEO: explicación teórica del concepto
- QUIZ: preguntas de opción múltiple para evaluar
- MATCH: emparejar términos con definiciones (4-6 pares)
- SORT: ordenar elementos en secuencia correcta (4-6 items, "correctOrder" es 0-based)
- FILL_BLANK: completar frases con palabras clave (usa {{palabra}} para los huecos, incluye "distractors")

Devuelve ÚNICAMENTE un objeto JSON con esta estructura exacta (sin markdown, sin explicaciones):
{
  "title": "título completo del curso",
  "description": "descripción breve del curso (2-3 frases)",
  "modules": [
    {
      "title": "título del módulo",
      "order": 1,
      "lessons": [
        {
          "title": "Introducción al tema",
          "type": "VIDEO",
          "order": 1
        },
        {
          "title": "Empareja los conceptos",
          "type": "MATCH",
          "order": 2,
          "content": {
            "pairs": [
              { "left": "término 1", "right": "definición 1" },
              { "left": "término 2", "right": "definición 2" },
              { "left": "término 3", "right": "definición 3" },
              { "left": "término 4", "right": "definición 4" }
            ]
          }
        },
        {
          "title": "Ordena el proceso",
          "type": "SORT",
          "order": 3,
          "content": {
            "prompt": "Ordena los siguientes pasos en orden correcto",
            "items": [
              { "text": "paso 1", "correctOrder": 0 },
              { "text": "paso 2", "correctOrder": 1 },
              { "text": "paso 3", "correctOrder": 2 },
              { "text": "paso 4", "correctOrder": 3 }
            ]
          }
        },
        {
          "title": "Completa las frases",
          "type": "FILL_BLANK",
          "order": 4,
          "content": {
            "template": "La {{palabra1}} es el proceso por el que {{palabra2}} ocurre.",
            "distractors": ["distractor1", "distractor2"]
          }
        },
        {
          "title": "Test del módulo",
          "type": "QUIZ",
          "order": 5,
          "quiz": {
            "questions": [
              {
                "text": "pregunta",
                "type": "SINGLE",
                "order": 1,
                "answers": [
                  { "text": "opción A", "isCorrect": true },
                  { "text": "opción B", "isCorrect": false },
                  { "text": "opción C", "isCorrect": false }
                ]
              }
            ]
          }
        }
      ]
    }
  ]
}

Reglas:
- 3-5 módulos temáticos relevantes para la materia
- Cada módulo: 3-5 lecciones con al menos 1 VIDEO, 1 QUIZ y 1 actividad interactiva (MATCH, SORT o FILL_BLANK)
- Elige el tipo interactivo más adecuado al contenido de cada lección
- MATCH: 4-6 pares de términos/conceptos/ejemplos reales
- SORT: "correctOrder" 0-based en orden final correcto; 4-6 items relevantes
- FILL_BLANK: {{palabra}} para palabras clave; 2-4 distractors creíbles del mismo campo semántico
- QUIZ: 2-4 preguntas, tipos "SINGLE" o "TRUE_FALSE"
- Contenido curricular real y adecuado para ${schoolYearLabel} en España
- Solo devuelve JSON puro, sin markdown ni texto adicional`;

    this.logger.log(`Llamando a Claude para generar curso: "${name}" (${schoolYearLabel})`);

    const message = await this.anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 6000,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = message.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new InternalServerErrorException('Claude no devolvió contenido de texto');
    }

    try {
      const raw = textContent.text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
      const parsed = JSON.parse(raw) as GeneratedCourse;
      this.logger.log(`Curso generado correctamente: "${parsed.title}"`);
      return parsed;
    } catch {
      this.logger.error('Error al parsear JSON de Claude:', textContent.text);
      throw new InternalServerErrorException(
        'El agente IA devolvió un formato inválido. Inténtalo de nuevo.',
      );
    }
  }
}
