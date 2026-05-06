import api from '../lib/axios';
import type { ExamBankInfo, ExamAttemptStarted, ExamAttemptResult } from '@vkbacademy/shared';

export interface StartExamPayload {
  courseId?: string;
  moduleId?: string;
  numQuestions?: number;
  timeLimit?: number;
  onlyOnce?: boolean;
}

export interface SubmitExamPayload {
  answers: {
    questionId: string;
    /** Para SINGLE/TRUE_FALSE: array de 1 elemento. Para MULTIPLE: varios. */
    answerIds: string[];
  }[];
}

export interface ExamAttemptHistoryItem {
  attemptId: string;
  score: number | null;
  numQuestions: number;
  timeLimit: number | null;
  onlyOnce: boolean;
  startedAt: string;
  submittedAt: string | null;
}

export interface AdminExamQuestion {
  id: string;
  text: string;
  type: 'SINGLE' | 'MULTIPLE' | 'TRUE_FALSE';
  order: number;
  courseId: string | null;
  moduleId: string | null;
  answers: { id: string; text: string; isCorrect: boolean }[];
}

export interface AdminExamAttempt {
  id: string;
  userId: string;
  courseId: string | null;
  moduleId: string | null;
  numQuestions: number;
  score: number | null;
  startedAt: string;
  submittedAt: string | null;
  user: { id: string; name: string; email: string };
}

export interface AvailableExamCourse {
  courseId: string;
  title: string;
  schoolYear: string | null;
  questionCount: number;
  lastAttempt: { score: number; submittedAt: string } | null;
}

export interface AvailableExamModule {
  moduleId: string;
  title: string;
  courseId: string;
  courseTitle: string;
  questionCount: number;
  lastAttempt: { score: number; submittedAt: string } | null;
}

export interface AvailableExams {
  courses: AvailableExamCourse[];
  modules: AvailableExamModule[];
}

// ─── Exámenes generados por IA (alumno) ──────────────────────────────────────

export interface AiExamBankSummary {
  id: string;
  title: string;
  topic: string;
  numQuestions: 5 | 10;
  timeLimit: number | null;
  onlyOnce: boolean;
  createdAt: string;
  course: { id: string; title: string };
  module: { id: string; title: string } | null;
  questionCount: number;
  attemptCount: number;
  submittedAttemptCount: number;
}

export interface AiExamBankDetail {
  id: string;
  title: string;
  topic: string;
  numQuestions: 5 | 10;
  timeLimit: number | null;
  onlyOnce: boolean;
  createdAt: string;
  course: { id: string; title: string };
  module: { id: string; title: string } | null;
  attemptCount: number;
  questions: {
    id: string;
    text: string;
    type: 'SINGLE' | 'MULTIPLE' | 'TRUE_FALSE';
    order: number;
    answers: { id: string; text: string; order: number }[];
  }[];
}

export interface GenerateAiExamPayload {
  courseId: string;
  moduleId?: string;
  topic: string;
  numQuestions: 5 | 10;
  timeLimit?: number; // segundos
  onlyOnce?: boolean;
}

export const examsApi = {
  getAvailable: () => api.get<AvailableExams>('/exams/available').then((r) => r.data),

  getBankInfo: (params: { courseId?: string; moduleId?: string }) =>
    api.get<ExamBankInfo>('/exams/info', { params }).then((r) => r.data),

  startExam: (payload: StartExamPayload) =>
    api.post<ExamAttemptStarted>('/exams/start', payload).then((r) => r.data),

  submitExam: (attemptId: string, payload: SubmitExamPayload) =>
    api.post<ExamAttemptResult>(`/exams/${attemptId}/submit`, payload).then((r) => r.data),

  getHistory: (params: { courseId?: string; moduleId?: string }) =>
    api.get<ExamAttemptHistoryItem[]>('/exams/history', { params }).then((r) => r.data),

  // ── IA ──
  generateAiExam: (payload: GenerateAiExamPayload) =>
    api.post<AiExamBankDetail>('/exams/ai/generate', payload).then((r) => r.data),

  listMyAiBanks: () => api.get<AiExamBankSummary[]>('/exams/ai/my-banks').then((r) => r.data),

  getAiBank: (bankId: string) =>
    api.get<AiExamBankDetail>(`/exams/ai/${bankId}`).then((r) => r.data),

  deleteAiBank: (bankId: string) =>
    api.delete<{ ok: true }>(`/exams/ai/${bankId}`).then((r) => r.data),

  startAiAttempt: (bankId: string) =>
    api.post<ExamAttemptStarted>(`/exams/ai/${bankId}/start`).then((r) => r.data),
};
