import { IsOptional, IsString, MaxLength } from 'class-validator';

export class TutorChatDto {
  // Opcional porque el alumno puede mandar solo la foto. La regla "texto o
  // foto, al menos uno" vive en el servicio, que es quien ve las dos cosas.
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

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
