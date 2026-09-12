export interface TutorMessageDto {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  courseId?: string | null;
  lessonId?: string | null;
  /** El mensaje llevaba foto. */
  hasImage: boolean;
  createdAt: string;
  /** Solo en cliente y solo en la respuesta recién recibida (#141). */
  practice?: TutorPracticeSuggestion;
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

/**
 * Propuesta de practicar un tema en Estudiar, que llega en el evento `done`
 * del stream cuando la conversación toca un tema de los planes del alumno.
 * No se persiste: solo la ven los mensajes vivos.
 */
export interface TutorPracticeSuggestion {
  title: string;
  courseId: string;
  courseTitle: string;
  moduleId: string | null;
}
