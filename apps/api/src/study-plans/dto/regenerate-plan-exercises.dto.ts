import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Regenera los ejercicios del plan. Sin campos, reutiliza el reparto guardado
 * (exercisesConfig); con campos, sobreescribe el reparto por tema.
 */
export class RegeneratePlanExercisesDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10, { message: 'Máximo 10 ejercicios fáciles por tema' })
  easy?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10, { message: 'Máximo 10 ejercicios medios por tema' })
  medium?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10, { message: 'Máximo 10 ejercicios difíciles por tema' })
  hard?: number;
}
