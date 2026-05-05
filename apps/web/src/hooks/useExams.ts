import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { examsApi } from '../api/exams.api';
import type { StartExamPayload, SubmitExamPayload, GenerateAiExamPayload } from '../api/exams.api';

// ─── Hooks alumno ─────────────────────────────────────────────────────────────

export function useAvailableExams() {
  return useQuery({
    queryKey: ['exams-available'],
    queryFn: () => examsApi.getAvailable(),
  });
}

export function useExamBankInfo(courseId?: string, moduleId?: string) {
  const scopeId = courseId ?? moduleId;
  return useQuery({
    queryKey: ['exam-bank', courseId ? `course-${courseId}` : `module-${moduleId}`],
    queryFn: () => examsApi.getBankInfo({ courseId, moduleId }),
    enabled: !!scopeId,
  });
}

export function useExamHistory(courseId?: string, moduleId?: string) {
  const scopeId = courseId ?? moduleId;
  return useQuery({
    queryKey: ['exam-history', courseId ? `course-${courseId}` : `module-${moduleId}`],
    queryFn: () => examsApi.getHistory({ courseId, moduleId }),
    enabled: !!scopeId,
  });
}

export function useStartExam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: StartExamPayload) => examsApi.startExam(payload),
    onSuccess: (_data, variables) => {
      // Invalidar historial al iniciar examen
      const scope = variables.courseId
        ? `course-${variables.courseId}`
        : `module-${variables.moduleId}`;
      queryClient.invalidateQueries({ queryKey: ['exam-history', scope] });
    },
  });
}

export function useSubmitExam(attemptId: string, courseId?: string, moduleId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SubmitExamPayload) => examsApi.submitExam(attemptId, payload),
    onSuccess: () => {
      // Invalidar historial y bankInfo tras entregar
      const scope = courseId ? `course-${courseId}` : `module-${moduleId}`;
      queryClient.invalidateQueries({ queryKey: ['exam-history', scope] });
      queryClient.invalidateQueries({ queryKey: ['exam-bank', scope] });
      // Invalidar bancos IA para refrescar attemptCount
      queryClient.invalidateQueries({ queryKey: ['ai-exam-banks'] });
      // Invalidar certificados para que se recarguen tras el submit
      queryClient.invalidateQueries({ queryKey: ['certificates', 'my'] });
    },
  });
}

// ─── Hooks de exámenes generados por IA ─────────────────────────────────────

export function useMyAiExamBanks() {
  return useQuery({
    queryKey: ['ai-exam-banks'],
    queryFn: () => examsApi.listMyAiBanks(),
  });
}

export function useGenerateAiExam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: GenerateAiExamPayload) => examsApi.generateAiExam(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-exam-banks'] });
    },
  });
}

export function useDeleteAiExamBank() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bankId: string) => examsApi.deleteAiBank(bankId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-exam-banks'] });
    },
  });
}

export function useStartAiAttempt() {
  return useMutation({
    mutationFn: (bankId: string) => examsApi.startAiAttempt(bankId),
  });
}
