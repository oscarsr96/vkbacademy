import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
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

/**
 * Reparto de ejercicios POR TEMA: cada tema del plan recibe easy+medium+hard
 * ejercicios. La suma (1..10) se valida en el service.
 */
export class ExercisesPerTopicDto {
  @IsInt()
  @Min(0)
  @Max(10, { message: 'Máximo 10 ejercicios fáciles por tema' })
  easy: number;

  @IsInt()
  @Min(0)
  @Max(10, { message: 'Máximo 10 ejercicios medios por tema' })
  medium: number;

  @IsInt()
  @Min(0)
  @Max(10, { message: 'Máximo 10 ejercicios difíciles por tema' })
  hard: number;
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

  // Los exámenes ya no se generan al crear: se generan por nivel (lazy) desde
  // la pestaña Examen (POST /study-plans/:id/exams).
  @ValidateNested()
  @Type(() => ExercisesPerTopicDto)
  exercisesPerTopic: ExercisesPerTopicDto;
}
