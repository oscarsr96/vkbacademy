import { IsString, IsOptional, IsInt, Min, Max, IsNotEmpty } from 'class-validator';

export class GenerateExamQuestionsDto {
  @IsString()
  @IsOptional()
  courseId?: string;

  @IsString()
  @IsOptional()
  moduleId?: string;

  @IsString()
  @IsNotEmpty()
  topic: string;

  @IsInt()
  @Min(1)
  @Max(10)
  @IsOptional()
  count: number = 3;
}
