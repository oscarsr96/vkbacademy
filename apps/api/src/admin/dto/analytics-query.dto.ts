import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class AnalyticsQueryDto {
  @IsDateString()
  @IsOptional()
  from?: string;

  @IsDateString()
  @IsOptional()
  to?: string;

  @IsEnum(['day', 'week', 'month'])
  @IsOptional()
  granularity?: 'day' | 'week' | 'month';

  @IsString()
  @IsOptional()
  courseId?: string;

  @IsString()
  @IsOptional()
  schoolYearId?: string;
}
