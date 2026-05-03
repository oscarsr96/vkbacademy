import api from '../lib/axios';
import type {
  GenerateTheoryRequest,
  TheoryModuleSummary,
  TheoryModuleWithLessons,
} from '@vkbacademy/shared';

export const theoryApi = {
  generate: (payload: GenerateTheoryRequest) =>
    api.post<TheoryModuleWithLessons>('/theory/generate', payload).then((r) => r.data),

  listMine: (courseId?: string) =>
    api
      .get<TheoryModuleSummary[]>('/theory/mine', {
        params: courseId ? { courseId } : undefined,
      })
      .then((r) => r.data),

  getById: (id: string) => api.get<TheoryModuleWithLessons>(`/theory/${id}`).then((r) => r.data),

  delete: (id: string) => api.delete<void>(`/theory/${id}`).then((r) => r.data),
};
