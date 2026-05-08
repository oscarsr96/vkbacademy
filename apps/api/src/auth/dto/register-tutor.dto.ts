import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsArray,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RegisterStudentDto {
  @IsString()
  @MinLength(2, { message: 'El nombre del alumno debe tener al menos 2 caracteres' })
  @MaxLength(100)
  name: string;

  @IsString({ message: 'Debes indicar el curso del alumno' })
  @MinLength(1, { message: 'Debes indicar el curso del alumno' })
  schoolYearId: string;
}

export class RegisterTutorDto {
  @IsString()
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(100)
  name: string;

  @IsEmail({}, { message: 'Email inválido' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(72, { message: 'La contraseña es demasiado larga' })
  password: string;

  @IsString()
  academySlug: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Debes registrar al menos un alumno' })
  @ValidateNested({ each: true })
  @Type(() => RegisterStudentDto)
  students: RegisterStudentDto[];
}
