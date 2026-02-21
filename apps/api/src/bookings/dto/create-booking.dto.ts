import { IsString, IsDateString, IsOptional, IsEnum } from 'class-validator';
import { BookingMode } from '@prisma/client';

export class CreateBookingDto {
  @IsString()
  studentId: string;

  @IsString()
  teacherId: string;

  @IsDateString()
  startAt: string;

  @IsDateString()
  endAt: string;

  @IsEnum(BookingMode)
  @IsOptional()
  mode?: BookingMode;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  courseId?: string;
}
