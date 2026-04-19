import { IsString, MaxLength, MinLength } from 'class-validator';

export class EvaluateExerciseDto {
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  statement: string;

  @IsString()
  @MinLength(1, { message: 'La respuesta no puede estar vacía' })
  @MaxLength(2000)
  studentAnswer: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  solution: string;
}
