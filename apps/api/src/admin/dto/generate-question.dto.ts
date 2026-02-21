import { IsString, IsNotEmpty } from 'class-validator';

export class GenerateQuestionDto {
  @IsString()
  @IsNotEmpty()
  topic: string;
}
