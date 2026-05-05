import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class GenerateAiExamDto {
  @IsString()
  courseId: string;

  @IsString()
  @IsOptional()
  moduleId?: string;

  @IsString()
  @MinLength(3, { message: 'El tema debe tener al menos 3 caracteres' })
  @MaxLength(500, { message: 'El tema es demasiado largo' })
  topic: string;

  /// Solo se aceptan 5 o 10 preguntas — fija el alcance del examen.
  @IsInt()
  @IsIn([5, 10], { message: 'numQuestions debe ser 5 o 10' })
  numQuestions: 5 | 10;

  /// Límite de tiempo en segundos (60–10800). Omitir = sin límite.
  @IsInt()
  @Min(60, { message: 'El tiempo mínimo es 60 segundos' })
  @Max(10800, { message: 'El tiempo máximo es 10800 segundos (3 h)' })
  @IsOptional()
  timeLimit?: number;

  /// Si true, solo se permite un intento entregado por banco.
  @IsBoolean()
  @IsOptional()
  onlyOnce?: boolean;
}
