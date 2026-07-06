import { IsString, MaxLength, MinLength } from 'class-validator';

/** El alumno renombra su curso multi-tema. */
export class RenameStudyPlanDto {
  @IsString()
  @MinLength(3, { message: 'El título debe tener al menos 3 caracteres' })
  @MaxLength(200, { message: 'El título es demasiado largo (máx. 200 caracteres)' })
  title: string;
}
