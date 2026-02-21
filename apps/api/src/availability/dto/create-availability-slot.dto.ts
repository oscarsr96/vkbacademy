import { IsInt, Min, Max, IsString, Matches } from 'class-validator';

export class CreateAvailabilitySlotDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number; // 0=Dom … 6=Sáb

  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  startTime: string; // "09:00"

  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  endTime: string; // "10:00"
}
