import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ExercisesService } from './exercises.service';
import { GenerateExercisesDto } from './dto/generate-exercises.dto';
import { EvaluateExerciseDto } from './dto/evaluate-exercise.dto';

@Controller('exercises')
@UseGuards(JwtAuthGuard)
export class ExercisesController {
  constructor(private readonly exercises: ExercisesService) {}

  /**
   * Genera ejercicios de práctica para un alumno matriculado en un curso.
   * No persiste nada en BD — los ejercicios son efímeros.
   */
  // Generación y evaluación = 1 llamada IA cada una: límite de 30/hora por usuario.
  @Post('generate')
  @Throttle({ default: { ttl: 3600000, limit: 30 } })
  generate(@CurrentUser() user: User, @Body() dto: GenerateExercisesDto) {
    return this.exercises.generate(user.id, dto);
  }

  /**
   * Evalúa la respuesta abierta de un alumno contra la solución de referencia
   * usando la IA. Devuelve veredicto (correct/partial/incorrect) + feedback.
   */
  @Post('evaluate')
  @Throttle({ default: { ttl: 3600000, limit: 30 } })
  evaluate(@Body() dto: EvaluateExerciseDto) {
    return this.exercises.evaluate(dto);
  }
}
