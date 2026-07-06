import api from '../lib/axios';
import type {
  StudyPlanSummary,
  StudyPlanDetail,
  CreateStudyPlanRequest,
  RegenerateExercisesRequest,
  RegenerateExamRequest,
} from '@vkbacademy/shared';

export const studyPlansApi = {
  create: (payload: CreateStudyPlanRequest) =>
    api.post<StudyPlanDetail>('/study-plans', payload).then((r) => r.data),

  listMine: () => api.get<StudyPlanSummary[]>('/study-plans/mine').then((r) => r.data),

  getById: (id: string) => api.get<StudyPlanDetail>(`/study-plans/${id}`).then((r) => r.data),

  delete: (id: string) => api.delete<void>(`/study-plans/${id}`).then((r) => r.data),

  regenerateTopicTheory: (id: string, topicId: string) =>
    api.post<StudyPlanDetail>(`/study-plans/${id}/topics/${topicId}/theory`).then((r) => r.data),

  regenerateExercises: (id: string, payload: RegenerateExercisesRequest) =>
    api.post<StudyPlanDetail>(`/study-plans/${id}/exercises`, payload).then((r) => r.data),

  regenerateExam: (id: string, payload: RegenerateExamRequest) =>
    api.post<StudyPlanDetail>(`/study-plans/${id}/exam`, payload).then((r) => r.data),
};
