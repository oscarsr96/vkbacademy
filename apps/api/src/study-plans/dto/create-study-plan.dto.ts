import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

/**
 * Tema del plan: moduleId (tema oficial del temario) XOR title (tema propio).
 * `@ValidateIf` exige al menos uno de los dos; la exclusión mutua estricta
 * (no ambos a la vez) se comprueba en el service.
 */
export class StudyPlanTopicInputDto {
  @ValidateIf((o: StudyPlanTopicInputDto) => !o.title)
  @IsString({ message: 'Cada tema necesita moduleId (tema oficial) o title (tema propio)' })
  moduleId?: string;

  @ValidateIf((o: StudyPlanTopicInputDto) => !o.moduleId)
  @IsString({ message: 'Cada tema necesita moduleId (tema oficial) o title (tema propio)' })
  @MinLength(3, { message: 'El tema debe tener al menos 3 caracteres' })
  @MaxLength(200, { message: 'El tema es demasiado largo (máx. 200 caracteres)' })
  title?: string;

  // Materia declarada cuando el tema propio es de otra asignatura matriculada.
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'La materia es demasiado larga (máx. 100 caracteres)' })
  subject?: string;
}

export class CreateStudyPlanDto {
  @IsString()
  courseId: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Elige al menos 1 tema' })
  @ArrayMaxSize(6, { message: 'Máximo 6 temas por plan' })
  @ValidateNested({ each: true })
  @Type(() => StudyPlanTopicInputDto)
  topics: StudyPlanTopicInputDto[];

  @IsInt()
  @Min(1, { message: 'Mínimo 1 ejercicio' })
  @Max(20, { message: 'Máximo 20 ejercicios' })
  numExercises: number;

  @IsIn(['EASY', 'MEDIUM', 'HARD'], { message: 'difficulty debe ser EASY, MEDIUM o HARD' })
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';

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
