import {
  IsArray,
  IsEmail,
  IsString,
  MaxLength,
  MinLength,
  ArrayMaxSize,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

/** Tope de alumnos por solicitud: el endpoint es público y cada alumno cuesta un bcrypt. */
export const MAX_STUDENTS_PER_REQUEST = 10;

export class NewStudentDto {
  @IsString()
  @MinLength(2, { message: 'El nombre del alumno debe tener al menos 2 caracteres' })
  @MaxLength(100)
  name: string;

  @IsString({ message: 'Debes indicar el curso del alumno' })
  @MinLength(1, { message: 'Debes indicar el curso del alumno' })
  schoolYearId: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(72, { message: 'La contraseña es demasiado larga' })
  password: string;
}

export class RegisterStudentsDto {
  /**
   * Email del padre o la madre. Solo dato de contacto: no crea cuenta.
   * Se normaliza porque es la única clave que relaciona a los hermanos de una
   * familia: sin trim/lowercase, "Padre@Example.com" sería otra familia.
   */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Email inválido' })
  guardianEmail: string;

  /** Obligatorio: sin academia el alumno no sería visible para ningún admin. */
  @IsString({ message: 'Debes indicar la academia' })
  @MinLength(1, { message: 'Debes indicar la academia' })
  academySlug: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Debes registrar al menos un alumno' })
  @ArrayMaxSize(MAX_STUDENTS_PER_REQUEST, {
    message: `Puedes registrar como máximo ${MAX_STUDENTS_PER_REQUEST} alumnos por solicitud`,
  })
  @ValidateNested({ each: true })
  @Type(() => NewStudentDto)
  students: NewStudentDto[];
}
