import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { QuestionType } from '@prisma/client';
import { ImportExamQuestionsDto } from './dto/import-exam-questions.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExamQuestionDto, UpdateExamQuestionDto } from './dto/create-exam-question.dto';

@Injectable()
export class AdminExamsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Banco de preguntas de examen ─────────────────────────────────────────

  async getExamQuestions(courseId?: string, moduleId?: string) {
    const where = courseId ? { courseId } : moduleId ? { moduleId } : {};
    return this.prisma.examQuestion.findMany({
      where,
      include: { answers: true },
      orderBy: { order: 'asc' },
    });
  }

  async createExamQuestion(dto: CreateExamQuestionDto) {
    if (!dto.courseId && !dto.moduleId) {
      throw new BadRequestException('Debes especificar courseId o moduleId');
    }

    // Calcular el order siguiente
    const where = dto.courseId ? { courseId: dto.courseId } : { moduleId: dto.moduleId };
    const lastQuestion = await this.prisma.examQuestion.findFirst({
      where,
      orderBy: { order: 'desc' },
    });
    const order = (lastQuestion?.order ?? 0) + 1;

    return this.prisma.$transaction(async (tx) => {
      const question = await tx.examQuestion.create({
        data: {
          text: dto.text,
          type: dto.type,
          order,
          courseId: dto.courseId ?? null,
          moduleId: dto.moduleId ?? null,
        },
      });
      await tx.examAnswer.createMany({
        data: dto.answers.map((a) => ({
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
  }

  async updateExamQuestion(id: string, dto: UpdateExamQuestionDto) {
    const question = await this.prisma.examQuestion.findUnique({ where: { id } });
    if (!question) throw new NotFoundException('Pregunta de examen no encontrada');

    return this.prisma.$transaction(async (tx) => {
      // Reemplazar respuestas completamente
      await tx.examAnswer.deleteMany({ where: { questionId: id } });
      const updated = await tx.examQuestion.update({
        where: { id },
        data: { text: dto.text, type: dto.type },
      });
      await tx.examAnswer.createMany({
        data: dto.answers.map((a) => ({
          text: a.text,
          isCorrect: a.isCorrect,
          questionId: updated.id,
        })),
      });
      return tx.examQuestion.findUnique({
        where: { id },
        include: { answers: true },
      });
    });
  }

  async deleteExamQuestion(id: string) {
    const question = await this.prisma.examQuestion.findUnique({ where: { id } });
    if (!question) throw new NotFoundException('Pregunta de examen no encontrada');
    await this.prisma.examQuestion.delete({ where: { id } });
    return { message: 'Pregunta eliminada correctamente' };
  }

  async getExamAttempts(
    courseId?: string,
    moduleId?: string,
    params?: { page?: number; limit?: number },
  ) {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const skip = (page - 1) * limit;
    const where = courseId ? { courseId } : moduleId ? { moduleId } : {};

    const [items, total] = await Promise.all([
      this.prisma.examAttempt.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startedAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.examAttempt.count({ where }),
    ]);

    return { data: items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  // ─── Importación de batería de examen desde JSON ─────────────────────────

  async importExamQuestions(dto: ImportExamQuestionsDto) {
    if (!dto.courseId && !dto.moduleId) {
      throw new BadRequestException('Debes especificar courseId o moduleId');
    }

    // Calcular el order de partida (añadir tras las preguntas existentes)
    const where = dto.courseId ? { courseId: dto.courseId } : { moduleId: dto.moduleId };
    const lastQuestion = await this.prisma.examQuestion.findFirst({
      where,
      orderBy: { order: 'desc' },
    });
    let nextOrder = (lastQuestion?.order ?? 0) + 1;

    const created = await this.prisma.$transaction(async (tx) => {
      const results = [];
      for (const q of dto.questions) {
        const question = await tx.examQuestion.create({
          data: {
            text: q.text,
            type: q.type ?? QuestionType.SINGLE,
            order: nextOrder++,
            courseId: dto.courseId ?? null,
            moduleId: dto.moduleId ?? null,
          },
        });
        await tx.examAnswer.createMany({
          data: q.answers.map((a) => ({
            text: a.text,
            isCorrect: a.isCorrect,
            questionId: question.id,
          })),
        });
        results.push(question.id);
      }
      return results;
    });

    return {
      message: `${created.length} pregunta${created.length !== 1 ? 's' : ''} importada${created.length !== 1 ? 's' : ''} correctamente`,
      count: created.length,
    };
  }
}
