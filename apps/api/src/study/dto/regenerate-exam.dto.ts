import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class RegenerateExamDto {
  @IsInt()
  @IsIn([5, 10], { message: 'numQuestions debe ser 5 o 10' })
  @IsOptional()
  numQuestions?: 5 | 10;

  @IsInt()
  @Min(60)
  @Max(10800)
  @IsOptional()
  timeLimit?: number;

  @IsBoolean()
  @IsOptional()
  onlyOnce?: boolean;
}
