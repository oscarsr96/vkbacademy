import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { QuizzesService } from './quizzes.service';
import { SubmitQuizDto } from './dto/submit-quiz.dto';
import { User } from '@prisma/client';

@Controller('quizzes')
@UseGuards(JwtAuthGuard)
export class QuizzesController {
  constructor(private readonly quizzesService: QuizzesService) {}

  /** Devuelve preguntas SIN isCorrect en las respuestas */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.quizzesService.findOne(id);
  }

  /** Envía respuestas y devuelve score + correcciones */
  @Post(':id/submit')
  submit(@Param('id') id: string, @Body() dto: SubmitQuizDto, @CurrentUser() user: User) {
    return this.quizzesService.submit(id, dto, user.id);
  }

  /** Historial de intentos del usuario autenticado */
  @Get(':id/attempts')
  getAttempts(@Param('id') id: string, @CurrentUser() user: User) {
    return this.quizzesService.getAttempts(id, user.id);
  }

  /** Detalle de un intento (correcciones) — solo accesible por el dueño */
  @Get(':quizId/attempts/:attemptId')
  getAttemptDetail(
    @Param('quizId') quizId: string,
    @Param('attemptId') attemptId: string,
    @CurrentUser() user: User,
  ) {
    return this.quizzesService.getAttemptDetail(quizId, attemptId, user.id);
  }
}
