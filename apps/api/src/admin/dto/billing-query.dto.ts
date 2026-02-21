import { IsDateString, IsOptional } from 'class-validator';

export class BillingQueryDto {
  @IsDateString()
  @IsOptional()
  from?: string;

  @IsDateString()
  @IsOptional()
  to?: string;
}
