import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsArray,
  IsInt,
  Min,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LessonType } from '@prisma/client';

// ── Respuestas de quiz / examen ──────────────────────────────────────────────

export class ImportAnswerDto {
  @IsString() @IsNotEmpty()
  text: string;

  @IsBoolean()
  isCorrect: boolean;
}

// ── Preguntas de quiz (dentro de una lección QUIZ) ───────────────────────────

export class ImportQuizQuestionDto {
  @IsString() @IsNotEmpty()
  text: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportAnswerDto)
  answers: ImportAnswerDto[];
}

export class ImportQuizDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportQuizQuestionDto)
  questions: ImportQuizQuestionDto[];
}

// ── Preguntas del banco de examen (por módulo) ───────────────────────────────

export class ImportExamQuestionDto {
  @IsString() @IsNotEmpty()
  text: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportAnswerDto)
  answers: ImportAnswerDto[];
}

// ── Lección ──────────────────────────────────────────────────────────────────

export class ImportLessonDto {
  @IsString() @IsNotEmpty()
  title: string;

  @IsEnum(LessonType)
  type: LessonType;

  @IsInt() @Min(1)
  order: number;

  @IsOptional() @IsString()
  youtubeId?: string;

  // Contenido para MATCH, SORT, FILL_BLANK (objeto libre)
  @IsOptional() @IsObject()
  content?: Record<string, unknown>;

  // Solo si type === QUIZ
  @IsOptional()
  @ValidateNested()
  @Type(() => ImportQuizDto)
  quiz?: ImportQuizDto;
}

// ── Módulo ───────────────────────────────────────────────────────────────────

export class ImportModuleDto {
  @IsString() @IsNotEmpty()
  title: string;

  @IsInt() @Min(1)
  order: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportLessonDto)
  lessons: ImportLessonDto[];

  // Banco de preguntas de examen del módulo (opcional)
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportExamQuestionDto)
  examQuestions?: ImportExamQuestionDto[];
}

// ── Curso raíz ───────────────────────────────────────────────────────────────

export class ImportCourseDto {
  @IsString() @IsNotEmpty()
  name: string;

  // Nombre del nivel: "1eso", "2eso", etc.
  @IsString() @IsNotEmpty()
  schoolYear: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportModuleDto)
  modules: ImportModuleDto[];

  // Banco de preguntas de examen a nivel de curso (opcional)
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportExamQuestionDto)
  examQuestions?: ImportExamQuestionDto[];
}
