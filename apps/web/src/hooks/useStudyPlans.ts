import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { studyPlansApi } from '../api/study-plans.api';
import type { CreateStudyPlanRequest } from '@vkbacademy/shared';

export function useMyStudyPlans() {
  return useQuery({ queryKey: ['study-plans', 'mine'], queryFn: () => studyPlansApi.listMine() });
}

export function useStudyPlan(id: string) {
  return useQuery({
    queryKey: ['study-plans', id],
    queryFn: () => studyPlansApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateStudyPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateStudyPlanRequest) => studyPlansApi.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['study-plans', 'mine'] }),
  });
}

export function useDeleteStudyPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => studyPlansApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['study-plans', 'mine'] }),
  });
}

export function useRegenerateTopicTheory(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (topicId: string) => studyPlansApi.regenerateTopicTheory(id, topicId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['study-plans', id] }),
  });
}

export function useRegeneratePlanExercises(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (count?: number) => studyPlansApi.regenerateExercises(id, { count }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['study-plans', id] }),
  });
}

export function useRegeneratePlanExam(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => studyPlansApi.regenerateExam(id, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['study-plans', id] }),
  });
}
