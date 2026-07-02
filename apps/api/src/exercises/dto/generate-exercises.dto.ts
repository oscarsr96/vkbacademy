import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class GenerateExercisesDto {
  @IsString()
  courseId: string;

  @IsString()
  @MinLength(3, { message: 'El tema debe tener al menos 3 caracteres' })
  @MaxLength(500, { message: 'El tema es demasiado largo' })
  topic: string;

  @IsInt()
  @Min(1)
  @Max(20)
  count: number;

  /// Dificultad del contenido a generar. Opcional (por defecto MEDIUM en el servicio).
  @IsIn(['EASY', 'MEDIUM', 'HARD'])
  @IsOptional()
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
}
