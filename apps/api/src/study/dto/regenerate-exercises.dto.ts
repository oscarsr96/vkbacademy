import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class RegenerateExercisesDto {
  @IsInt()
  @Min(1, { message: 'Mínimo 1 ejercicio' })
  @Max(20, { message: 'Máximo 20 ejercicios' })
  @IsOptional()
  count?: number;
}
