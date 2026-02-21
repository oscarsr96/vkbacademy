import { IsString, MinLength, IsEnum, IsOptional, IsObject } from 'class-validator';
import { LessonType } from '@prisma/client';

export class UpdateLessonDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  title?: string;

  @IsEnum(LessonType)
  @IsOptional()
  type?: LessonType;

  @IsString()
  @IsOptional()
  youtubeId?: string | null;

  @IsObject()
  @IsOptional()
  content?: object | null;
}
