import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { studyApi } from '../api/study.api';
import type { CreateStudyUnitRequest } from '@vkbacademy/shared';

export function useMyStudyUnits() {
  return useQuery({ queryKey: ['study', 'mine'], queryFn: () => studyApi.listMine() });
}

export function useStudyUnit(id: string) {
  return useQuery({
    queryKey: ['study', id],
    queryFn: () => studyApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateStudyUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateStudyUnitRequest) => studyApi.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['study', 'mine'] }),
  });
}

export function useDeleteStudyUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => studyApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['study', 'mine'] }),
  });
}

export function useRegenerateTheory(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => studyApi.regenerateTheory(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['study', id] }),
  });
}

export function useRegenerateExercises(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (count?: number) => studyApi.regenerateExercises(id, { count }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['study', id] }),
  });
}

export function useRegenerateExam(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => studyApi.regenerateExam(id, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['study', id] }),
  });
}
