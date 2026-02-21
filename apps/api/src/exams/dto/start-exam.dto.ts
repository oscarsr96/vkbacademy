import { IsString, IsOptional, IsInt, Min, Max, IsBoolean } from 'class-validator';

export class StartExamDto {
  @IsString()
  @IsOptional()
  courseId?: string;

  @IsString()
  @IsOptional()
  moduleId?: string;

  @IsInt()
  @Min(1)
  @Max(50)
  numQuestions: number = 10;

  @IsInt()
  @Min(30)
  @Max(10800)
  @IsOptional()
  timeLimit?: number;

  @IsBoolean()
  @IsOptional()
  onlyOnce?: boolean;
}
