export enum QuestionType {
  SINGLE = 'SINGLE',
  MULTIPLE = 'MULTIPLE',
  TRUE_FALSE = 'TRUE_FALSE',
}

/** Respuesta pública: SIN isCorrect */
export interface PublicAnswer {
  id: string;
  text: string;
}

/** Respuesta tras corrección: CON isCorrect */
export interface CorrectedAnswer extends PublicAnswer {
  isCorrect: boolean;
}

/** Pregunta pública: SIN isCorrect en answers */
export interface PublicQuestion {
  id: string;
  text: string;
  type: QuestionType;
  answers: PublicAnswer[];
}

/** Quiz público sin respuestas correctas */
export interface PublicQuiz {
  id: string;
  lessonId: string;
  questions: PublicQuestion[];
}

/** Respuesta del alumno a una pregunta */
export interface QuizAnswerSubmission {
  questionId: string;
  answerId: string;
}

/** Resultado de submit */
export interface QuizSubmitResult {
  score: number; // 0.0 - 100.0
  correctCount: number;
  totalCount: number;
  corrections: {
    questionId: string;
    selectedAnswerId: string;
    isCorrect: boolean;
    correctAnswerId: string;
  }[];
}

/** Intento guardado */
export interface QuizAttempt {
  id: string;
  userId: string;
  quizId: string;
  score: number;
  completedAt: Date;
}

/** Detalle de un intento con correcciones pregunta a pregunta */
export interface QuizAttemptDetail {
  id: string;
  score: number;
  completedAt: Date;
  corrections: {
    questionText: string;
    selectedAnswerText: string;
    isCorrect: boolean;
    correctAnswerText: string;
  }[];
}
