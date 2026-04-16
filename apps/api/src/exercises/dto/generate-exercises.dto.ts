import { IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

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
}
