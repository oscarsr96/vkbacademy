import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class TutorChatDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message: string;

  @IsOptional()
  @IsString()
  courseId?: string;

  @IsOptional()
  @IsString()
  lessonId?: string;

  @IsOptional()
  @IsString()
  courseName?: string;

  @IsOptional()
  @IsString()
  lessonName?: string;

  @IsOptional()
  @IsString()
  schoolYear?: string; // "1º ESO", "3º ESO"...
}
