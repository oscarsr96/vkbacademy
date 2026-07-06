import type { TheoryModuleWithLessons } from './theory.types';

// Dificultad de la unidad de estudio. Gobierna la generación de ejercicios y examen.
export type StudyDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

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
  /// Tema del plan multi-tema al que pertenece la pregunta. Null/ausente en bancos un-tema.
  topicLabel?: string | null;
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
  difficulty: StudyDifficulty; // aplica a ejercicios y examen
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

// ── Plan de estudio multi-tema (StudyPlan) ──
// Combina N temas (oficiales del temario o libres) en teoría por tema +
// ejercicios y examen combinados. Flujo adicional al un-tema (StudyUnit).

export type StudyTopicSource = 'OFFICIAL' | 'CUSTOM';

// Tema del payload de creación: moduleId (oficial) XOR title (libre).
// subject solo acompaña a title cuando el tema es de otra asignatura matriculada.
export interface StudyPlanTopicInput {
  moduleId?: string;
  title?: string;
  subject?: string;
}

export interface CreateStudyPlanRequest {
  courseId: string; // asignatura base
  topics: StudyPlanTopicInput[]; // 1..6
  numExercises: number; // 1..20
  difficulty: StudyDifficulty; // aplica a ejercicios y examen
  numQuestions: 5 | 10; // debe ser >= topics.length (≥1 pregunta por tema)
  timeLimit?: number; // segundos
  onlyOnce?: boolean;
}

// Ejercicio combinado: igual que StudyExercise pero etiquetado con su tema.
export interface StudyPlanExercise extends StudyExercise {
  topicLabel: string;
}

export interface StudyPlanTopicSummary {
  id: string;
  order: number;
  source: StudyTopicSource;
  moduleId: string | null;
  title: string;
  subject: string | null;
  hasTheory: boolean; // false = deck fallido/pendiente → regenerable por tema
}

export interface StudyPlanSummary {
  id: string;
  title: string;
  summary: string;
  difficulty: StudyDifficulty;
  createdAt: string;
  course: { id: string; title: string };
  topics: StudyPlanTopicSummary[];
  // sections.theory = true solo si TODOS los temas tienen su deck generado
  sections: StudySections;
}

export interface StudyPlanTopicDetail extends StudyPlanTopicSummary {
  theory: TheoryModuleWithLessons | null;
}

export interface StudyPlanDetail extends Omit<StudyPlanSummary, 'topics'> {
  topics: StudyPlanTopicDetail[];
  exercises: StudyPlanExercise[] | null;
  exam: StudyExam | null;
}
