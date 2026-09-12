export interface TutorMessageDto {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  courseId?: string | null;
  lessonId?: string | null;
  /** El mensaje llevaba foto. La foto no se conserva. */
  hasImage: boolean;
  createdAt: string;
}

export interface TutorChatPayload {
  message?: string;
  courseId?: string;
  lessonId?: string;
  courseName?: string;
  lessonName?: string;
  schoolYear?: string;
}

/** Texto que "dice" el alumno cuando manda solo la foto, sin escribir nada. */
export const TUTOR_DEFAULT_IMAGE_PROMPT = '¿Me ayudas con este ejercicio?';
