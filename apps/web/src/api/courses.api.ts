import api from '../lib/axios';
import type {
  Course,
  CourseProgress,
  Lesson,
  UserProgress,
  PublicQuiz,
  QuizAnswerSubmission,
  QuizSubmitResult,
  QuizAttempt,
  QuizAttemptDetail,
  PaginatedResponse,
  SchoolYear,
} from '@vkbacademy/shared';

export interface LessonDetail extends Lesson {
  quiz?: PublicQuiz | null;
  progress?: UserProgress | null;
}

export interface StudentCourseProgress {
  courseId: string;
  courseTitle: string;
  totalLessons: number;
  completedLessons: number;
  percentageComplete: number;
  modules: {
    id: string;
    title: string;
    order: number;
    totalLessons: number;
    completedLessons: number;
  }[];
}

export interface RecentLesson {
  lessonId: string;
  lessonTitle: string;
  lessonType: string;
  moduleTitle: string;
  courseId: string;
  courseTitle: string;
  completedAt: string | null;
}

export const coursesApi = {
  list: (params?: { page?: number; limit?: number; schoolYearId?: string }) =>
    api
      .get<PaginatedResponse<Course>>('/courses', { params })
      .then((r) => r.data),

  get: (id: string) =>
    api.get<Course>(`/courses/${id}`).then((r) => r.data),

  getProgress: (id: string) =>
    api.get<CourseProgress>(`/courses/${id}/progress`).then((r) => r.data),

  getLesson: (id: string) =>
    api.get<LessonDetail>(`/lessons/${id}`).then((r) => r.data),

  completeLesson: (id: string) =>
    api.post<UserProgress>(`/lessons/${id}/complete`).then((r) => r.data),

  getQuiz: (id: string) =>
    api.get<PublicQuiz>(`/quizzes/${id}`).then((r) => r.data),

  submitQuiz: (id: string, answers: QuizAnswerSubmission[]) =>
    api
      .post<QuizSubmitResult>(`/quizzes/${id}/submit`, { answers })
      .then((r) => r.data),

  getQuizAttempts: (id: string) =>
    api.get<QuizAttempt[]>(`/quizzes/${id}/attempts`).then((r) => r.data),

  getAttemptDetail: (quizId: string, attemptId: string) =>
    api
      .get<QuizAttemptDetail>(`/quizzes/${quizId}/attempts/${attemptId}`)
      .then((r) => r.data),

  getRecentLessons: () =>
    api.get<RecentLesson[]>('/lessons/recent').then((r) => r.data),

  getStudentProgress: (courseId: string, studentId: string) =>
    api
      .get<StudentCourseProgress>(`/courses/${courseId}/student-progress/${studentId}`)
      .then((r) => r.data),

  getSchoolYears: () =>
    api.get<SchoolYear[]>('/school-years').then((r) => r.data),
};
