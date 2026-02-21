import { IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateBillingConfigDto {
  @IsNumber()
  @IsOptional()
  @Min(0)
  studentMonthlyPrice?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  classOnlineRatePerHour?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  classInPersonRatePerHour?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  clubCommissionRate?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  infrastructureMonthlyCost?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  s3MonthlyCost?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  anthropicMonthlyCost?: number;
}
