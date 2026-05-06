import { ArrayNotEmpty, IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class AnswerDto {
  @IsString()
  questionId: string;

  /**
   * IDs de respuestas seleccionadas. Para SINGLE / TRUE_FALSE será un array de
   * un solo elemento; para MULTIPLE puede tener varios. Se acepta `answerId`
   * (legacy) por compatibilidad: se normaliza a `answerIds = [answerId]`.
   */
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @IsOptional()
  answerIds?: string[];

  @IsString()
  @IsOptional()
  answerId?: string;
}

export class SubmitExamDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers: AnswerDto[];
}
