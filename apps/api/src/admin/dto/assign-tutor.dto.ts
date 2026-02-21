import { IsString, IsOptional } from 'class-validator';

export class AssignTutorDto {
  @IsString()
  @IsOptional()
  tutorId?: string | null;
}
