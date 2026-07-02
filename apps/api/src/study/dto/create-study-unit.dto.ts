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

export class CreateStudyUnitDto {
  @IsString()
  courseId: string;

  @IsString()
  @MinLength(3, { message: 'El tema debe tener al menos 3 caracteres' })
  @MaxLength(500, { message: 'El tema es demasiado largo' })
  topic: string;

  @IsInt()
  @Min(1, { message: 'Mínimo 1 ejercicio' })
  @Max(20, { message: 'Máximo 20 ejercicios' })
  numExercises: number;

  @IsInt()
  @IsIn([5, 10], { message: 'numQuestions debe ser 5 o 10' })
  numQuestions: 5 | 10;

  @IsInt()
  @Min(60, { message: 'El tiempo mínimo es 60 segundos' })
  @Max(10800, { message: 'El tiempo máximo es 10800 segundos (3 h)' })
  @IsOptional()
  timeLimit?: number;

  @IsBoolean()
  @IsOptional()
  onlyOnce?: boolean;
}
