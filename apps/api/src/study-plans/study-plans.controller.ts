import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StudyPlansService } from './study-plans.service';
import { CreateStudyPlanDto } from './dto/create-study-plan.dto';
import { RegenerateExercisesDto } from '../study/dto/regenerate-exercises.dto';
import { RegenerateExamDto } from '../study/dto/regenerate-exam.dto';

@Controller('study-plans')
@UseGuards(JwtAuthGuard)
export class StudyPlansController {
  constructor(private readonly studyPlans: StudyPlansService) {}

  // Creación completa = N teorías + ejercicios + examen (hasta 8 llamadas IA),
  // lo más caro de toda la app: límite estricto de 5/hora por usuario.
  /** Crea un plan multi-tema generando teoría por tema + ejercicios y examen combinados. */
  @Post()
  @Throttle({ default: { ttl: 3600000, limit: 5 } })
  create(@CurrentUser() user: User, @Body() dto: CreateStudyPlanDto) {
    return this.studyPlans.create(user.id, dto);
  }

  /** Lista los planes multi-tema del alumno. */
  @Get('mine')
  listMine(@CurrentUser() user: User) {
    return this.studyPlans.listMine(user.id);
  }

  /** Detalle completo de un plan (solo el dueño; examen sin isCorrect). */
  @Get(':id')
  getById(@CurrentUser() user: User, @Param('id') id: string) {
    return this.studyPlans.getById(user.id, id);
  }

  /** Borra un plan (cascade a temas, teorías y examen). */
  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: User, @Param('id') id: string) {
    await this.studyPlans.deleteById(user.id, id);
  }

  // Regeneraciones = 1 llamada IA por sección: límite más laxo de 30/hora.
  /** Regenera el deck de teoría de UN tema del plan. */
  @Post(':id/topics/:topicId/theory')
  @Throttle({ default: { ttl: 3600000, limit: 30 } })
  regenTopicTheory(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('topicId') topicId: string,
  ) {
    return this.studyPlans.regenerateTopicTheory(user.id, id, topicId);
  }

  /** Regenera los ejercicios combinados (acepta count opcional). */
  @Post(':id/exercises')
  @Throttle({ default: { ttl: 3600000, limit: 30 } })
  regenExercises(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: RegenerateExercisesDto,
  ) {
    return this.studyPlans.regenerateExercises(user.id, id, dto);
  }

  /** Regenera el examen combinado (acepta numQuestions/timeLimit/onlyOnce opcionales). */
  @Post(':id/exam')
  @Throttle({ default: { ttl: 3600000, limit: 30 } })
  regenExam(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: RegenerateExamDto) {
    return this.studyPlans.regenerateExam(user.id, id, dto);
  }
}
