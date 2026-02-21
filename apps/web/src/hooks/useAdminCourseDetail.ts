import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  adminApi,
  type CreateModulePayload,
  type UpdateModulePayload,
  type CreateLessonPayload,
  type UpdateLessonPayload,
  type CreateQuestionPayload,
} from '../api/admin.api';

const courseDetailKey = (courseId: string) => ['admin', 'course', courseId];
// Clave de la caché de estudiante — se invalida tras cualquier cambio en el admin
const studentCourseKey = (courseId: string) => ['courses', courseId];

function invalidateCourse(queryClient: ReturnType<typeof useQueryClient>, courseId: string) {
  void queryClient.invalidateQueries({ queryKey: courseDetailKey(courseId) });
  void queryClient.invalidateQueries({ queryKey: studentCourseKey(courseId) });
}

export function useAdminCourseDetail(courseId: string) {
  return useQuery({
    queryKey: courseDetailKey(courseId),
    queryFn: () => adminApi.getCourseDetail(courseId),
    enabled: !!courseId,
  });
}

export function useGenerateModule(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => adminApi.generateModule(courseId, name),
    onSuccess: () => invalidateCourse(queryClient, courseId),
  });
}

export function useCreateModule(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateModulePayload) => adminApi.createModule(courseId, payload),
    onSuccess: () => invalidateCourse(queryClient, courseId),
  });
}

export function useUpdateModule(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ moduleId, payload }: { moduleId: string; payload: UpdateModulePayload }) =>
      adminApi.updateModule(moduleId, payload),
    onSuccess: () => invalidateCourse(queryClient, courseId),
  });
}

export function useDeleteModule(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (moduleId: string) => adminApi.deleteModule(moduleId),
    onSuccess: () => invalidateCourse(queryClient, courseId),
  });
}

export function useGenerateLesson(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ moduleId, topic }: { moduleId: string; topic: string }) =>
      adminApi.generateLesson(moduleId, topic),
    onSuccess: () => invalidateCourse(queryClient, courseId),
  });
}

export function useCreateLesson(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ moduleId, payload }: { moduleId: string; payload: CreateLessonPayload }) =>
      adminApi.createLesson(moduleId, payload),
    onSuccess: () => invalidateCourse(queryClient, courseId),
  });
}

export function useUpdateLesson(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ lessonId, payload }: { lessonId: string; payload: UpdateLessonPayload }) =>
      adminApi.updateLesson(lessonId, payload),
    onSuccess: (_data, variables) => {
      invalidateCourse(queryClient, courseId);
      // Invalida también el detalle de la lección (youtubeId, content…)
      void queryClient.invalidateQueries({ queryKey: ['lessons', variables.lessonId] });
    },
  });
}

export function useDeleteLesson(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (lessonId: string) => adminApi.deleteLesson(lessonId),
    onSuccess: () => invalidateCourse(queryClient, courseId),
  });
}

export function useInitQuiz(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (lessonId: string) => adminApi.initQuiz(lessonId),
    onSuccess: () => invalidateCourse(queryClient, courseId),
  });
}

export function useGenerateQuestion(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ quizId, topic }: { quizId: string; topic: string }) =>
      adminApi.generateQuestion(quizId, topic),
    onSuccess: () => invalidateCourse(queryClient, courseId),
  });
}

export function useCreateQuestion(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ quizId, payload }: { quizId: string; payload: CreateQuestionPayload }) =>
      adminApi.createQuestion(quizId, payload),
    onSuccess: () => invalidateCourse(queryClient, courseId),
  });
}

export function useUpdateQuestion(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ questionId, payload }: { questionId: string; payload: CreateQuestionPayload }) =>
      adminApi.updateQuestion(questionId, payload),
    onSuccess: () => invalidateCourse(queryClient, courseId),
  });
}

export function useDeleteQuestion(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (questionId: string) => adminApi.deleteQuestion(questionId),
    onSuccess: () => invalidateCourse(queryClient, courseId),
  });
}

