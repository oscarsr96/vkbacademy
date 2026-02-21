import { IsString, MinLength, IsEnum } from 'class-validator';
import { LessonType } from '@prisma/client';

export class CreateLessonDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsEnum(LessonType)
  type: LessonType;
}
