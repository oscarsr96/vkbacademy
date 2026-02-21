import { IsString, IsNotEmpty } from 'class-validator';

export class GenerateCourseDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  schoolYearId: string;
}
