import type { TheoryModuleWithLessons } from './theory.types';

// Ejercicio persistido en la unidad (misma forma que genera ExercisesService).
export type StudyExerciseType = 'SINGLE' | 'TRUE_FALSE' | 'OPEN';

export interface StudyExercise {
  statement: string;
  type: StudyExerciseType;
  options: string[];
  solution: string;
  explanation: string;
}

// Examen de la unidad (serializado SIN isCorrect, como getBank).
export interface StudyExamAnswer {
  id: string;
  text: string;
  order: number;
}

export interface StudyExamQuestion {
  id: string;
  text: string;
  type: 'SINGLE' | 'MULTIPLE' | 'TRUE_FALSE';
  order: number;
  answers: StudyExamAnswer[];
}

export interface StudyExam {
  id: string;
  title: string;
  topic: string;
  numQuestions: number;
  timeLimit: number | null;
  onlyOnce: boolean;
  attemptCount: number;
  questions: StudyExamQuestion[];
}

// Qué secciones se generaron con éxito.
export interface StudySections {
  theory: boolean;
  exercises: boolean;
  exam: boolean;
}

export interface StudyUnitSummary {
  id: string;
  topic: string;
  title: string;
  summary: string;
  createdAt: string;
  course: { id: string; title: string };
  sections: StudySections;
}

export interface StudyUnitDetail extends StudyUnitSummary {
  theory: TheoryModuleWithLessons | null;
  exercises: StudyExercise[] | null;
  exam: StudyExam | null;
}

// ── Requests ──
export interface CreateStudyUnitRequest {
  courseId: string;
  topic: string;
  numExercises: number;
  numQuestions: 5 | 10;
  timeLimit?: number; // segundos
  onlyOnce?: boolean;
}

export interface RegenerateExercisesRequest {
  count?: number;
}

export interface RegenerateExamRequest {
  numQuestions?: 5 | 10;
  timeLimit?: number;
  onlyOnce?: boolean;
}
