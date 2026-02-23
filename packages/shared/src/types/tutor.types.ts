export interface TutorMessageDto {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  courseId?: string | null;
  lessonId?: string | null;
  createdAt: string;
}

export interface TutorChatPayload {
  message: string;
  courseId?: string;
  lessonId?: string;
  courseName?: string;
  lessonName?: string;
  schoolYear?: string;
}
