import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi, type AdminCoursesParams, type UpdateCoursePayload, type GenerateCoursePayload, type CreateCoursePayload } from '../api/admin.api';

export function useAdminCourses(page: number, filters?: Omit<AdminCoursesParams, 'page'>) {
  return useQuery({
    queryKey: ['admin', 'courses', page, filters],
    queryFn: () => adminApi.listCourses({ page, limit: 10, ...filters }),
  });
}

export function useCreateCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCoursePayload) => adminApi.createCourse(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'courses'] });
    },
  });
}

export function useGenerateCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: GenerateCoursePayload) => adminApi.generateCourse(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'courses'] });
    },
  });
}

export function useDeleteCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteCourse(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'courses'] });
    },
  });
}

export function useUpdateCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateCoursePayload }) =>
      adminApi.updateCourse(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'courses'] });
    },
  });
}

export function useSchoolYears() {
  return useQuery({
    queryKey: ['school-years'],
    queryFn: () => adminApi.listSchoolYears(),
    staleTime: Infinity, // los niveles no cambian durante la sesión
  });
}
