import { IsString, MaxLength, MinLength } from 'class-validator';

// Respuesta cruda del alumno: la corrección es siempre server-side, el
// cliente nunca manda el veredicto (ver StudyPlansService.submitExerciseAttempt).
export class SubmitExerciseAttemptDto {
  @IsString()
  @MinLength(1, { message: 'La respuesta no puede estar vacía' })
  @MaxLength(2000, { message: 'La respuesta es demasiado larga' })
  answer: string;
}
