import { IsIn, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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
}
