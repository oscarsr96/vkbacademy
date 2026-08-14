import { IsString, IsEnum, IsInt, IsOptional, Min, MinLength } from 'class-validator';
import { ChallengeCadence, ChallengeType } from '@prisma/client';

export class UpdateChallengeDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(5)
  description?: string;

  @IsOptional()
  @IsEnum(ChallengeType)
  type?: ChallengeType;

  @IsOptional()
  @IsInt()
  @Min(1)
  target?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  points?: number;

  @IsOptional()
  @IsString()
  badgeIcon?: string;

  @IsOptional()
  @IsString()
  badgeColor?: string;

  @IsOptional()
  @IsEnum(ChallengeCadence)
  cadence?: ChallengeCadence;
}
