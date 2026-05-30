import { IsString, MinLength, MaxLength } from 'class-validator';

export class AddStudentDto {
  @IsString()
  @MinLength(2, { message: 'El nombre del alumno debe tener al menos 2 caracteres' })
  @MaxLength(100)
  name: string;

  @IsString({ message: 'Debes indicar el curso del alumno' })
  @MinLength(1, { message: 'Debes indicar el curso del alumno' })
  schoolYearId: string;
}
