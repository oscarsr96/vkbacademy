import { IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @IsString({ message: 'Introduce tu email o nombre de usuario' })
  @MaxLength(254)
  identifier: string;

  @IsString()
  @MaxLength(128)
  password: string;
}
