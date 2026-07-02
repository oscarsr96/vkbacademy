import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { LessonType, Prisma, QuestionType, Role } from '@prisma/client';
import { ImportCourseDto } from './dto/import-course.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { CreateQuestionDto, UpdateQuestionDto } from './dto/create-question.dto';
import { YoutubeService } from '../youtube/youtube.service';
import type { YoutubeCandidate } from '../youtube/dto/youtube-candidate.dto';

@Injectable()
export class AdminContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly youtube: YoutubeService,
  ) {}

  async listCourses(params: {
    page: number;
    limit: number;
    schoolYearId?: string;
    search?: string;
  }) {
    const { page, limit, schoolYearId, search } = params;
    const skip = (page - 1) * limit;

    const where = {
      ...(schoolYearId ? { schoolYearId } : {}),
      ...(search ? { title: { contains: search, mode: 'insensitive' as const } } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.course.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          schoolYear: true,
          _count: { select: { modules: true } },
        },
      }),
      this.prisma.course.count({ where }),
    ]);

    // Alumnos accesibles por curso:
    // (1) alumnos cuyo schoolYearId coincide con el del curso
    // (2) + alumnos de OTRO nivel con matrícula explícita en el curso

    const courseIds = items.map((c) => c.id);

    const [studentsByLevel, crossEnrollments] = await Promise.all([
      // (1) conteo de alumnos STUDENT agrupados por schoolYear
      this.prisma.user.groupBy({
        by: ['schoolYearId'],
        where: { role: Role.STUDENT, schoolYearId: { not: null } },
        _count: { _all: true },
      }),
      // (2) matrículas explícitas con el schoolYear del alumno
      courseIds.length > 0
        ? this.prisma.enrollment.findMany({
            where: { courseId: { in: courseIds } },
            select: { courseId: true, user: { select: { schoolYearId: true } } },
          })
        : Promise.resolve([]),
    ]);

    const syStudentCount = new Map(studentsByLevel.map((r) => [r.schoolYearId!, r._count._all]));

    // Alumnos de otro nivel matriculados explícitamente en cada curso
    const courseSchoolYear = new Map(items.map((c) => [c.id, c.schoolYearId]));
    const crossLevelCount = new Map<string, number>();
    for (const e of crossEnrollments) {
      if (e.user.schoolYearId !== courseSchoolYear.get(e.courseId)) {
        crossLevelCount.set(e.courseId, (crossLevelCount.get(e.courseId) ?? 0) + 1);
      }
    }

    const enrichedItems = items.map((course) => ({
      ...course,
      studentCount:
        (syStudentCount.get(course.schoolYearId ?? '') ?? 0) +
        (crossLevelCount.get(course.id) ?? 0),
    }));

    return {
      data: enrichedItems,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async deleteCourse(id: string) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) {
      throw new NotFoundException(`Curso con id "${id}" no encontrado`);
    }
    await this.prisma.course.delete({ where: { id } });
    return { message: 'Curso eliminado correctamente' };
  }

  // ─── Detalle de curso con contenido completo ──────────────────────────────

  async getCourseDetail(courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        schoolYear: true,
        modules: {
          orderBy: { order: 'asc' },
          include: {
            lessons: {
              orderBy: { order: 'asc' },
              include: {
                quiz: {
                  include: {
                    questions: {
                      orderBy: { order: 'asc' },
                      include: {
                        answers: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!course) {
      throw new NotFoundException(`Curso con id "${courseId}" no encontrado`);
    }

    return course;
  }

  // ─── Módulos ──────────────────────────────────────────────────────────────

  async createModule(courseId: string, dto: CreateModuleDto) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
      throw new NotFoundException(`Curso con id "${courseId}" no encontrado`);
    }

    // Calcular el order siguiente
    const lastModule = await this.prisma.module.findFirst({
      where: { courseId },
      orderBy: { order: 'desc' },
    });
    const order = (lastModule?.order ?? 0) + 1;

    return this.prisma.module.create({
      data: { title: dto.title, courseId, order },
    });
  }

  async updateModule(moduleId: string, dto: UpdateModuleDto) {
    const module = await this.prisma.module.findUnique({ where: { id: moduleId } });
    if (!module) {
      throw new NotFoundException(`Módulo con id "${moduleId}" no encontrado`);
    }
    return this.prisma.module.update({
      where: { id: moduleId },
      data: { ...(dto.title !== undefined ? { title: dto.title } : {}) },
    });
  }

  async deleteModule(moduleId: string) {
    const module = await this.prisma.module.findUnique({ where: { id: moduleId } });
    if (!module) {
      throw new NotFoundException(`Módulo con id "${moduleId}" no encontrado`);
    }
    await this.prisma.module.delete({ where: { id: moduleId } });
    return { message: 'Módulo eliminado correctamente' };
  }

  // ─── Lecciones ────────────────────────────────────────────────────────────

  async createLesson(moduleId: string, dto: CreateLessonDto) {
    const module = await this.prisma.module.findUnique({ where: { id: moduleId } });
    if (!module) {
      throw new NotFoundException(`Módulo con id "${moduleId}" no encontrado`);
    }

    // Calcular el order siguiente
    const lastLesson = await this.prisma.lesson.findFirst({
      where: { moduleId },
      orderBy: { order: 'desc' },
    });
    const order = (lastLesson?.order ?? 0) + 1;

    // Si es QUIZ, crear la lección y el quiz en una transacción
    if (dto.type === LessonType.QUIZ) {
      return this.prisma.$transaction(async (tx) => {
        const lesson = await tx.lesson.create({
          data: { title: dto.title, type: dto.type, moduleId, order },
        });
        const quiz = await tx.quiz.create({
          data: { lessonId: lesson.id },
          include: { questions: { include: { answers: true } } },
        });
        return { ...lesson, quiz };
      });
    }

    return this.prisma.lesson.create({
      data: { title: dto.title, type: dto.type, moduleId, order },
      include: { quiz: { include: { questions: { include: { answers: true } } } } },
    });
  }

  async updateLesson(lessonId: string, dto: UpdateLessonDto) {
    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) {
      throw new NotFoundException(`Lección con id "${lessonId}" no encontrada`);
    }
    return this.prisma.lesson.update({
      where: { id: lessonId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.youtubeId !== undefined ? { youtubeId: dto.youtubeId } : {}),
        ...(dto.content !== undefined
          ? {
              content:
                dto.content === null ? Prisma.JsonNull : (dto.content as Prisma.InputJsonValue),
            }
          : {}),
      },
      include: { quiz: { include: { questions: { include: { answers: true } } } } },
    });
  }

  async deleteLesson(lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) {
      throw new NotFoundException(`Lección con id "${lessonId}" no encontrada`);
    }
    await this.prisma.lesson.delete({ where: { id: lessonId } });
    return { message: 'Lección eliminada correctamente' };
  }

  // ─── Quiz ─────────────────────────────────────────────────────────────────

  async initQuiz(lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) {
      throw new NotFoundException(`Lección con id "${lessonId}" no encontrada`);
    }

    // Upsert: devuelve el existente o crea uno nuevo
    return this.prisma.quiz.upsert({
      where: { lessonId },
      update: {},
      create: { lessonId },
      include: { questions: { include: { answers: true } } },
    });
  }

  // ─── Preguntas ────────────────────────────────────────────────────────────

  async createQuestion(quizId: string, dto: CreateQuestionDto) {
    const quiz = await this.prisma.quiz.findUnique({ where: { id: quizId } });
    if (!quiz) {
      throw new NotFoundException(`Quiz con id "${quizId}" no encontrado`);
    }

    // Calcular el order siguiente
    const lastQuestion = await this.prisma.question.findFirst({
      where: { quizId },
      orderBy: { order: 'desc' },
    });
    const order = (lastQuestion?.order ?? 0) + 1;

    return this.prisma.$transaction(async (tx) => {
      const question = await tx.question.create({
        data: { text: dto.text, type: dto.type, quizId, order },
      });
      await tx.answer.createMany({
        data: dto.answers.map((a) => ({
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

  async updateQuestion(questionId: string, dto: UpdateQuestionDto) {
    const question = await this.prisma.question.findUnique({ where: { id: questionId } });
    if (!question) {
      throw new NotFoundException(`Pregunta con id "${questionId}" no encontrada`);
    }

    return this.prisma.$transaction(async (tx) => {
      // Reemplazar respuestas completamente
      await tx.answer.deleteMany({ where: { questionId } });
      const updated = await tx.question.update({
        where: { id: questionId },
        data: { text: dto.text, type: dto.type },
      });
      await tx.answer.createMany({
        data: dto.answers.map((a) => ({
          text: a.text,
          isCorrect: a.isCorrect,
          questionId: updated.id,
        })),
      });
      return tx.question.findUnique({
        where: { id: questionId },
        include: { answers: true },
      });
    });
  }

  async deleteQuestion(questionId: string) {
    const question = await this.prisma.question.findUnique({ where: { id: questionId } });
    if (!question) {
      throw new NotFoundException(`Pregunta con id "${questionId}" no encontrada`);
    }
    await this.prisma.question.delete({ where: { id: questionId } });
    return { message: 'Pregunta eliminada correctamente' };
  }

  // ─── Importación de curso desde JSON ─────────────────────────────────────

  async importCourse(dto: ImportCourseDto) {
    // Resolver el schoolYear por nombre ("1eso", "2eso", etc.)
    const schoolYear = await this.prisma.schoolYear.findFirst({
      where: { name: dto.schoolYear },
    });
    if (!schoolYear) {
      throw new BadRequestException(
        `Nivel educativo "${dto.schoolYear}" no encontrado. Valores válidos: 1eso, 2eso, 3eso, 4eso, 1bach, 2bach`,
      );
    }

    // Crear todo en una transacción para garantizar atomicidad
    const course = await this.prisma.$transaction(async (tx) => {
      // 1. Crear el curso
      const newCourse = await tx.course.create({
        data: {
          title: dto.name,
          schoolYearId: schoolYear.id,
        },
      });

      // 2. Preguntas de examen a nivel de curso (si las hay)
      if (dto.examQuestions?.length) {
        await tx.examQuestion.createMany({
          data: dto.examQuestions.map((q, i) => ({
            courseId: newCourse.id,
            text: q.text,
            type: QuestionType.SINGLE,
            order: i + 1,
          })),
        });

        // Recuperar los IDs creados para asociarles las respuestas
        const createdExamQs = await tx.examQuestion.findMany({
          where: { courseId: newCourse.id },
          orderBy: { order: 'asc' },
        });

        // Todas las respuestas en un único createMany (en vez de uno por pregunta)
        const examAnswersData = dto.examQuestions.flatMap((q, i) =>
          q.answers.map((a) => ({
            questionId: createdExamQs[i].id,
            text: a.text,
            isCorrect: a.isCorrect,
          })),
        );
        if (examAnswersData.length > 0) {
          await tx.examAnswer.createMany({ data: examAnswersData });
        }
      }

      // 3. Módulos
      for (const modDto of dto.modules) {
        const newModule = await tx.module.create({
          data: {
            title: modDto.title,
            order: modDto.order,
            courseId: newCourse.id,
          },
        });

        // 3a. Preguntas de examen del módulo
        if (modDto.examQuestions?.length) {
          await tx.examQuestion.createMany({
            data: modDto.examQuestions.map((q, i) => ({
              moduleId: newModule.id,
              text: q.text,
              type: QuestionType.SINGLE,
              order: i + 1,
            })),
          });

          const createdModExamQs = await tx.examQuestion.findMany({
            where: { moduleId: newModule.id },
            orderBy: { order: 'asc' },
          });

          // Todas las respuestas en un único createMany (en vez de uno por pregunta)
          const modExamAnswersData = modDto.examQuestions.flatMap((q, i) =>
            q.answers.map((a) => ({
              questionId: createdModExamQs[i].id,
              text: a.text,
              isCorrect: a.isCorrect,
            })),
          );
          if (modExamAnswersData.length > 0) {
            await tx.examAnswer.createMany({ data: modExamAnswersData });
          }
        }

        // 3b. Lecciones
        for (const lesDto of modDto.lessons) {
          const newLesson = await tx.lesson.create({
            data: {
              title: lesDto.title,
              type: lesDto.type,
              order: lesDto.order,
              moduleId: newModule.id,
              youtubeId: lesDto.youtubeId ?? null,
              content: (lesDto.content as Prisma.InputJsonValue) ?? Prisma.JsonNull,
            },
          });

          // 3c. Quiz (solo si type === QUIZ y hay preguntas)
          if (lesDto.type === LessonType.QUIZ && lesDto.quiz?.questions?.length) {
            const newQuiz = await tx.quiz.create({
              data: { lessonId: newLesson.id },
            });

            // Todas las preguntas del quiz en un único createMany
            await tx.question.createMany({
              data: lesDto.quiz.questions.map((qDto, qi) => ({
                text: qDto.text,
                type: QuestionType.SINGLE,
                order: qi + 1,
                quizId: newQuiz.id,
              })),
            });

            // Recuperar los IDs creados para asociarles las respuestas
            const createdQuestions = await tx.question.findMany({
              where: { quizId: newQuiz.id },
              orderBy: { order: 'asc' },
            });

            // Todas las respuestas en un único createMany (en vez de uno por pregunta)
            const quizAnswersData = lesDto.quiz.questions.flatMap((qDto, qi) =>
              qDto.answers.map((a) => ({
                text: a.text,
                isCorrect: a.isCorrect,
                questionId: createdQuestions[qi].id,
              })),
            );
            if (quizAnswersData.length > 0) {
              await tx.answer.createMany({ data: quizAnswersData });
            }
          }
        }
      }

      // Devolver el curso con estructura completa
      return tx.course.findUnique({
        where: { id: newCourse.id },
        include: {
          schoolYear: true,
          _count: { select: { modules: true } },
        },
      });
    });

    return {
      message: `Curso "${dto.name}" importado correctamente`,
      course,
    };
  }

  /**
   * Devuelve los top candidatos de YouTube para una lección VIDEO.
   * El admin usa esto desde el modal de búsqueda manual.
   */
  async getYoutubeCandidates(lessonId: string, excludeIds: string[]): Promise<YoutubeCandidate[]> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        module: {
          include: { course: { include: { schoolYear: true } } },
        },
      },
    });

    if (!lesson) {
      throw new NotFoundException(`Lección "${lessonId}" no encontrada`);
    }

    if (lesson.type !== 'VIDEO') {
      throw new BadRequestException('Solo se puede buscar vídeo para lecciones de tipo VIDEO');
    }

    const schoolYearLabel = lesson.module.course.schoolYear?.label ?? '';
    return this.youtube.findCandidates(lesson.title, schoolYearLabel, {
      limit: 5,
      excludeIds,
    });
  }
}
