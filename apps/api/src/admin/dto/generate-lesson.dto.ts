import { IsString, IsNotEmpty } from 'class-validator';

export class GenerateLessonDto {
  @IsString()
  @IsNotEmpty()
  topic: string;
}
