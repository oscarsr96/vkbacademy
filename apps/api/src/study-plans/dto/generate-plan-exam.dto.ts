import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export type StudyPlanExamLevel = 'BASIC' | 'MEDIUM' | 'HARD';

/**
 * Genera (lazy) el examen de un nivel del plan: combinado de todos los temas
 * (sin topicId) o de un tema concreto. numQuestions/difficulty son overrides
 * opcionales del preset del nivel.
 */
export class GeneratePlanExamDto {
  @IsIn(['BASIC', 'MEDIUM', 'HARD'], { message: 'level debe ser BASIC, MEDIUM o HARD' })
  level: StudyPlanExamLevel;

  @IsOptional()
  @IsString()
  topicId?: string;

  @IsOptional()
  @IsInt()
  @Min(3, { message: 'Mínimo 3 preguntas' })
  @Max(20, { message: 'Máximo 20 preguntas' })
  numQuestions?: number;

  @IsOptional()
  @IsIn(['EASY', 'MEDIUM', 'HARD'], { message: 'difficulty debe ser EASY, MEDIUM o HARD' })
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
}
