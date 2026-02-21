import { IsString, IsEnum, IsInt, IsOptional, Min, MinLength } from 'class-validator';
import { ChallengeType } from '@prisma/client';

export class CreateChallengeDto {
  @IsString()
  @MinLength(2)
  title: string;

  @IsString()
  @MinLength(5)
  description: string;

  @IsEnum(ChallengeType)
  type: ChallengeType;

  @IsInt()
  @Min(1)
  target: number;

  @IsInt()
  @Min(1)
  points: number;

  @IsOptional()
  @IsString()
  badgeIcon?: string;

  @IsOptional()
  @IsString()
  badgeColor?: string;
}
