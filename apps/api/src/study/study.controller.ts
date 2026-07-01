import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StudyService } from './study.service';
import { CreateStudyUnitDto } from './dto/create-study-unit.dto';
import { RegenerateExercisesDto } from './dto/regenerate-exercises.dto';
import { RegenerateExamDto } from './dto/regenerate-exam.dto';

@Controller('study')
@UseGuards(JwtAuthGuard)
export class StudyController {
  constructor(private readonly study: StudyService) {}

  /** Crea una unidad de estudio generando las 3 secciones a partir de un tema. */
  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateStudyUnitDto) {
    return this.study.create(user.id, dto);
  }

  /** Lista las unidades de estudio del alumno. */
  @Get('mine')
  listMine(@CurrentUser() user: User) {
    return this.study.listMine(user.id);
  }

  /** Detalle completo de una unidad (solo el dueño). */
  @Get(':id')
  getById(@CurrentUser() user: User, @Param('id') id: string) {
    return this.study.getById(user.id, id);
  }

  /** Borra una unidad (cascade a teoría/examen). */
  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: User, @Param('id') id: string) {
    await this.study.deleteById(user.id, id);
  }

  /** Regenera la sección de teoría. */
  @Post(':id/theory')
  regenTheory(@CurrentUser() user: User, @Param('id') id: string) {
    return this.study.regenerateTheory(user.id, id);
  }

  /** Regenera los ejercicios (acepta count opcional). */
  @Post(':id/exercises')
  regenExercises(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: RegenerateExercisesDto,
  ) {
    return this.study.regenerateExercises(user.id, id, dto);
  }

  /** Regenera el examen (acepta numQuestions/timeLimit/onlyOnce opcionales). */
  @Post(':id/exam')
  regenExam(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: RegenerateExamDto) {
    return this.study.regenerateExam(user.id, id, dto);
  }
}
