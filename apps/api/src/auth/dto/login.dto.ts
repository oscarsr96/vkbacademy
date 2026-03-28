import { IsString } from 'class-validator';

export class LoginDto {
  @IsString({ message: 'Introduce tu email o nombre de usuario' })
  identifier: string;

  @IsString()
  password: string;
}
