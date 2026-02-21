import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { coursesApi } from '../api/courses.api';
import type { QuizAnswerSubmission } from '@vkbacademy/shared';

export function useCourses(page = 1, schoolYearId?: string) {
  return useQuery({
    queryKey: ['courses', 'list', page, schoolYearId ?? null],
    queryFn: () => coursesApi.list({ page, limit: 100, schoolYearId }),
  });
}

export function useSchoolYears() {
  return useQuery({
    queryKey: ['school-years'],
    queryFn: () => coursesApi.getSchoolYears(),
    staleTime: 10 * 60 * 1000, // los niveles no cambian frecuentemente
  });
}

export function useCourse(id: string) {
  return useQuery({
    queryKey: ['courses', id],
    queryFn: () => coursesApi.get(id),
    enabled: !!id,
  });
}

export function useCourseProgress(id: string) {
  return useQuery({
    queryKey: ['courses', id, 'progress'],
    queryFn: () => coursesApi.getProgress(id),
    enabled: !!id,
  });
}

export function useLesson(id: string) {
  return useQuery({
    queryKey: ['lessons', id],
    queryFn: () => coursesApi.getLesson(id),
    enabled: !!id,
  });
}

export function useCompleteLesson(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (lessonId: string) => coursesApi.completeLesson(lessonId),
    onSuccess: (_data, lessonId) => {
      void queryClient.invalidateQueries({ queryKey: ['courses', courseId, 'progress'] });
      void queryClient.invalidateQueries({ queryKey: ['lessons', lessonId] });
      void queryClient.invalidateQueries({ queryKey: ['challenges', 'summary'] });
      void queryClient.invalidateQueries({ queryKey: ['challenges', 'my-progress'] });
      // Invalidar certificados por si se emitió uno al completar el módulo/curso
      void queryClient.invalidateQueries({ queryKey: ['certificates', 'my'] });
    },
  });
}

export function useSubmitQuiz(quizId: string, lessonId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (answers: QuizAnswerSubmission[]) =>
      coursesApi.submitQuiz(quizId, answers),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['lessons', lessonId] });
      void queryClient.invalidateQueries({ queryKey: ['quizzes', quizId, 'attempts'] });
      void queryClient.invalidateQueries({ queryKey: ['challenges', 'summary'] });
      void queryClient.invalidateQueries({ queryKey: ['challenges', 'my-progress'] });
    },
  });
}

export function useQuizAttempts(quizId: string) {
  return useQuery({
    queryKey: ['quizzes', quizId, 'attempts'],
    queryFn: () => coursesApi.getQuizAttempts(quizId),
    enabled: !!quizId,
  });
}

export function useRecentLessons() {
  return useQuery({
    queryKey: ['lessons', 'recent'],
    queryFn: () => coursesApi.getRecentLessons(),
  });
}

export function useStudentCourseProgress(courseId: string | null | undefined, studentId: string | null | undefined) {
  return useQuery({
    queryKey: ['courses', courseId, 'student-progress', studentId],
    queryFn: () => coursesApi.getStudentProgress(courseId!, studentId!),
    enabled: !!courseId && !!studentId,
  });
}
