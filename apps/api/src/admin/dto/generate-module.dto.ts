import { IsString, IsNotEmpty } from 'class-validator';

export class GenerateModuleDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}
