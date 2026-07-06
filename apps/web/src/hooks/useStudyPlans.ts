import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { studyPlansApi } from '../api/study-plans.api';
import type {
  CreateStudyPlanRequest,
  GenerateStudyPlanExamRequest,
  RegenerateStudyPlanExercisesRequest,
} from '@vkbacademy/shared';

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
    mutationFn: (payload?: RegenerateStudyPlanExercisesRequest) =>
      studyPlansApi.regenerateExercises(id, payload ?? {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['study-plans', id] }),
  });
}

/** Genera (lazy) el examen de un nivel del plan; el detalle se refresca al terminar. */
export function useGeneratePlanExam(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: GenerateStudyPlanExamRequest) =>
      studyPlansApi.generateExam(id, payload),
    onSuccess: (detail) => {
      qc.setQueryData(['study-plans', id], detail);
      void qc.invalidateQueries({ queryKey: ['study-plans', 'mine'] });
    },
  });
}

export function useRenameStudyPlan(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (title: string) => studyPlansApi.rename(id, { title }),
    onSuccess: (detail) => {
      qc.setQueryData(['study-plans', id], detail);
      void qc.invalidateQueries({ queryKey: ['study-plans', 'mine'] });
    },
  });
}
