import { IsString, MaxLength, MinLength } from 'class-validator';

export class ForgotPasswordDto {
  // Email o nombre de usuario, como en el login: los alumnos autorregistrados
  // no tienen email y solo pueden identificarse por su usuario.
  @IsString({ message: 'Escribe tu email o tu nombre de usuario' })
  @MinLength(1, { message: 'Escribe tu email o tu nombre de usuario' })
  @MaxLength(255)
  identifier: string;
}
