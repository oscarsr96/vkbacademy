import { Injectable, NotFoundException } from '@nestjs/common';
import { ChallengeType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitQuizDto } from './dto/submit-quiz.dto';
import { ChallengesService } from '../challenges/challenges.service';

@Injectable()
export class QuizzesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly challenges: ChallengesService,
  ) {}

  /** Quiz sin isCorrect — seguro para enviar al cliente */
  async findOne(id: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          include: {
            answers: {
              select: {
                id: true,
                text: true,
                // isCorrect: EXCLUIDO deliberadamente
              },
            },
          },
        },
      },
    });

    if (!quiz) throw new NotFoundException('Quiz no encontrado');
    return quiz;
  }

  async submit(quizId: string, dto: SubmitQuizDto, userId: string) {
    // Cargamos el quiz CON isCorrect para hacer la corrección en servidor
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: {
          include: { answers: true },
        },
      },
    });

    if (!quiz) throw new NotFoundException('Quiz no encontrado');

    let correctCount = 0;
    const corrections = dto.answers.map(({ questionId, answerId }) => {
      const question = quiz.questions.find((q) => q.id === questionId);
      const selectedAnswer = question?.answers.find((a) => a.id === answerId);
      const correctAnswer = question?.answers.find((a) => a.isCorrect);

      const isCorrect = selectedAnswer?.isCorrect ?? false;
      if (isCorrect) correctCount++;

      return {
        questionId,
        selectedAnswerId: answerId,
        isCorrect,
        correctAnswerId: correctAnswer?.id ?? '',
      };
    });

    const score =
      quiz.questions.length > 0
        ? Math.round((correctCount / quiz.questions.length) * 100 * 10) / 10
        : 0;

    // Guardar intento
    await this.prisma.quizAttempt.create({
      data: {
        userId,
        quizId,
        score,
        answers: dto.answers as unknown as Prisma.InputJsonValue,
      },
    });

    // Disparar evaluación de retos en segundo plano (sin bloquear la respuesta)
    void this.challenges.checkAndAward(userId, ChallengeType.QUIZ_SCORE);

    return {
      score,
      correctCount,
      totalCount: quiz.questions.length,
      corrections,
    };
  }

  async getAttempts(quizId: string, userId: string) {
    return this.prisma.quizAttempt.findMany({
      where: { quizId, userId },
      orderBy: { completedAt: 'desc' },
      select: {
        id: true,
        score: true,
        completedAt: true,
      },
    });
  }

  /** Detalle de un intento con correcciones — solo accesible por el dueño del intento */
  async getAttemptDetail(quizId: string, attemptId: string, userId: string) {
    const attempt = await this.prisma.quizAttempt.findFirst({
      where: { id: attemptId, quizId, userId },
    });
    if (!attempt) throw new NotFoundException('Intento no encontrado');

    // Cargamos quiz con isCorrect para reconstruir correcciones
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: { questions: { include: { answers: true } } },
    });
    if (!quiz) throw new NotFoundException('Quiz no encontrado');

    const storedAnswers = attempt.answers as { questionId: string; answerId: string }[];

    const corrections = storedAnswers.map(({ questionId, answerId }) => {
      const question = quiz.questions.find((q) => q.id === questionId);
      const selectedAnswer = question?.answers.find((a) => a.id === answerId);
      const correctAnswer = question?.answers.find((a) => a.isCorrect);
      return {
        questionText: question?.text ?? '',
        selectedAnswerText: selectedAnswer?.text ?? '—',
        isCorrect: selectedAnswer?.isCorrect ?? false,
        correctAnswerText: correctAnswer?.text ?? '—',
      };
    });

    return {
      id: attempt.id,
      score: attempt.score,
      completedAt: attempt.completedAt,
      corrections,
    };
  }
}
