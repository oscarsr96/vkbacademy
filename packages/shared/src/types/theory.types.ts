// Teoría bajo demanda — temarios generados por IA y persistidos
// en la biblioteca privada del alumno.

export type TheoryLessonKind = 'INTRO' | 'CONTENT' | 'EXAMPLE' | 'VIDEO';

export interface TheoryLesson {
  id: string;
  moduleId: string;
  order: number;
  kind: TheoryLessonKind;
  heading: string;
  body: string | null;
  youtubeId: string | null;
}

export interface TheoryModuleSummary {
  id: string;
  userId: string;
  courseId: string;
  topic: string;
  title: string;
  summary: string;
  createdAt: string;
}

export interface TheoryModuleWithLessons extends TheoryModuleSummary {
  lessons: TheoryLesson[];
}

export interface GenerateTheoryRequest {
  courseId: string;
  topic: string;
}
