import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsBoolean,
  IsArray,
  IsEnum,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { QuestionType } from '@vkbacademy/shared';

export class ImportExamAnswerDto {
  @IsString() @IsNotEmpty()
  text: string;

  @IsBoolean()
  isCorrect: boolean;
}

export class ImportExamQuestionItemDto {
  @IsString() @IsNotEmpty()
  text: string;

  // Si no se especifica, el service usa SINGLE por defecto
  @IsOptional()
  @IsEnum(QuestionType)
  type?: QuestionType;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportExamAnswerDto)
  answers: ImportExamAnswerDto[];
}

export class ImportExamQuestionsDto {
  // Exactamente uno de los dos debe estar presente (validado en el service)
  @IsOptional() @IsString()
  courseId?: string;

  @IsOptional() @IsString()
  moduleId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportExamQuestionItemDto)
  questions: ImportExamQuestionItemDto[];
}
