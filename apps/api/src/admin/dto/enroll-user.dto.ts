import { IsString } from 'class-validator';

export class EnrollUserDto {
  @IsString()
  courseId: string;
}
