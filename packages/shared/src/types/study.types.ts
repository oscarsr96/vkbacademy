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

// Reparto de ejercicios POR TEMA: cada tema del plan recibe easy+medium+hard.
export interface StudyExercisesPerTopic {
  easy: number;
  medium: number;
  hard: number;
}

export interface CreateStudyPlanRequest {
  courseId: string; // asignatura base
  topics: StudyPlanTopicInput[]; // 1..6
  exercisesPerTopic: StudyExercisesPerTopic; // suma 1..10 (por tema)
}

// Ejercicio del plan: etiquetado con su tema y su dificultad.
export interface StudyPlanExercise extends StudyExercise {
  topicLabel: string;
  difficulty?: StudyDifficulty; // ausente en ejercicios generados antes del reparto
}

// ── Exámenes por nivel del plan (generación lazy desde la pestaña Examen) ──

export type StudyPlanExamLevel = 'BASIC' | 'MEDIUM' | 'HARD';

export interface StudyPlanExamInfo {
  id: string;
  title: string;
  level: StudyPlanExamLevel | null; // null = banco anterior a los niveles
  topicId: string | null; // null = examen combinado de todos los temas
  numQuestions: number;
  timeLimit: number | null;
  onlyOnce: boolean;
  attemptCount: number;
  bestScore: number | null; // mejor nota del alumno (0-100); aprobado = ≥50
}

export interface GenerateStudyPlanExamRequest {
  level: StudyPlanExamLevel;
  topicId?: string; // presente = examen de ese tema; ausente = combinado
  numQuestions?: number; // override del preset del nivel (3..20)
  difficulty?: StudyDifficulty; // override del preset del nivel
}

export interface RenameStudyPlanRequest {
  title: string; // 3..200
}

export interface RegenerateStudyPlanExercisesRequest {
  easy?: number;
  medium?: number;
  hard?: number;
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
  /// Reparto por tema con el que se generaron los ejercicios (null en planes antiguos).
  exercisesConfig: StudyExercisesPerTopic | null;
  /// Exámenes generados (por nivel, combinados o por tema). Vacío hasta que el alumno genere el primero.
  exams: StudyPlanExamInfo[];
}
