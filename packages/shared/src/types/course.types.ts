export interface SchoolYear {
  id: string;
  name: string;   // "3eso"
  label: string;  // "3º ESO"
}

export enum LessonType {
  VIDEO = 'VIDEO',
  QUIZ = 'QUIZ',
  EXERCISE = 'EXERCISE',
  MATCH = 'MATCH',
  SORT = 'SORT',
  FILL_BLANK = 'FILL_BLANK',
}

// ─── Tipos de contenido para lecciones interactivas ─────────────────────────

export interface MatchPair {
  left: string;
  right: string;
}

export interface MatchContent {
  pairs: MatchPair[];   // 3-6 pares
}

export interface SortItem {
  text: string;
  correctOrder: number;   // 0-based
}

export interface SortContent {
  prompt: string;           // instrucción "Ordena de menor a mayor..."
  items: SortItem[];        // 4-8 elementos
}

export interface FillBlankContent {
  template: string;         // "El {{triple}} mide {{6,75}} metros"
  distractors: string[];    // palabras incorrectas adicionales para el banco
}

export interface Course {
  id: string;
  title: string;
  description?: string | null;
  coverUrl?: string | null;
  published: boolean;
  createdAt: Date;
  schoolYearId?: string | null;
  schoolYear?: SchoolYear | null;
  subject?: string | null;
  modules?: Module[];
}

export interface Module {
  id: string;
  title: string;
  order: number;
  courseId: string;
  lessons?: Lesson[];
}

export interface Lesson {
  id: string;
  title: string;
  type: LessonType;
  order: number;
  moduleId: string;
  youtubeId?: string | null;
  content?: MatchContent | SortContent | FillBlankContent | null;
}

// ─── Tipos admin (con isCorrect expuesto — solo para contexto admin) ──────────

import { QuestionType } from './quiz.types';

export interface AdminAnswer {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface AdminQuestion {
  id: string;
  text: string;
  type: QuestionType;
  order: number;
  answers: AdminAnswer[];
}

export interface AdminQuiz {
  id: string;
  lessonId: string;
  questions: AdminQuestion[];
}

export interface AdminLesson extends Lesson {
  quiz?: AdminQuiz | null;
}

export interface AdminModule extends Module {
  lessons: AdminLesson[];
}

export interface AdminCourseDetail extends Course {
  modules: AdminModule[];
}

/** Progreso de un usuario en un curso */
export interface CourseProgress {
  courseId: string;
  totalLessons: number;
  completedLessons: number;
  percentageComplete: number;
  completedLessonIds: string[];
}

export interface UserProgress {
  id: string;
  userId: string;
  lessonId: string;
  completed: boolean;
  completedAt?: Date | null;
}
