import {
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

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
  /** Email del padre o la madre. Solo dato de contacto: no crea cuenta. */
  @IsEmail({}, { message: 'Email inválido' })
  guardianEmail: string;

  @IsOptional()
  @IsString()
  academySlug?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Debes registrar al menos un alumno' })
  @ValidateNested({ each: true })
  @Type(() => NewStudentDto)
  students: NewStudentDto[];
}
