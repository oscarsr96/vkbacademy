import api from '../lib/axios';
import type {
  StudyUnitSummary,
  StudyUnitDetail,
  CreateStudyUnitRequest,
  RegenerateExercisesRequest,
  RegenerateExamRequest,
} from '@vkbacademy/shared';

export const studyApi = {
  create: (payload: CreateStudyUnitRequest) =>
    api.post<StudyUnitDetail>('/study', payload).then((r) => r.data),

  listMine: () => api.get<StudyUnitSummary[]>('/study/mine').then((r) => r.data),

  getById: (id: string) => api.get<StudyUnitDetail>(`/study/${id}`).then((r) => r.data),

  delete: (id: string) => api.delete<void>(`/study/${id}`).then((r) => r.data),

  regenerateTheory: (id: string) =>
    api.post<StudyUnitDetail>(`/study/${id}/theory`).then((r) => r.data),

  regenerateExercises: (id: string, payload: RegenerateExercisesRequest) =>
    api.post<StudyUnitDetail>(`/study/${id}/exercises`, payload).then((r) => r.data),

  regenerateExam: (id: string, payload: RegenerateExamRequest) =>
    api.post<StudyUnitDetail>(`/study/${id}/exam`, payload).then((r) => r.data),
};
