import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { CertificateType } from '@prisma/client';

export class IssueCertificateDto {
  @IsString()
  userId: string;

  @IsString()
  @IsOptional()
  courseId?: string;

  @IsString()
  @IsOptional()
  moduleId?: string;

  @IsEnum(CertificateType)
  type: CertificateType;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  examScore?: number;
}
