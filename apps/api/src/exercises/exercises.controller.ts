import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ExercisesService } from './exercises.service';
import { GenerateExercisesDto } from './dto/generate-exercises.dto';

@Controller('exercises')
@UseGuards(JwtAuthGuard)
export class ExercisesController {
  constructor(private readonly exercises: ExercisesService) {}

  /**
   * Genera ejercicios de práctica para un alumno matriculado en un curso.
   * No persiste nada en BD — los ejercicios son efímeros.
   */
  @Post('generate')
  generate(@CurrentUser() user: User, @Body() dto: GenerateExercisesDto) {
    return this.exercises.generate(user.id, dto);
  }
}
