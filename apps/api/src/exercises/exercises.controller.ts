import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ExercisesService } from './exercises.service';
import { EvaluateExerciseDto } from './dto/evaluate-exercise.dto';

@Controller('exercises')
@UseGuards(JwtAuthGuard)
export class ExercisesController {
  constructor(private readonly exercises: ExercisesService) {}

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
