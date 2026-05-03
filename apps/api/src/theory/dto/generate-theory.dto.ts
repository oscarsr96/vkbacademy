import { IsString, MaxLength, MinLength } from 'class-validator';

export class GenerateTheoryDto {
  @IsString()
  courseId: string;

  @IsString()
  @MinLength(3, { message: 'El tema debe tener al menos 3 caracteres' })
  @MaxLength(500, { message: 'El tema es demasiado largo' })
  topic: string;
}
