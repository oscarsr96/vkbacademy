import api from '../lib/axios';
import type { User } from '@vkbacademy/shared';

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface LoginPayload {
  identifier: string;
  password: string;
}

export interface NewStudentPayload {
  name: string;
  schoolYearId: string;
  password: string;
}

export interface RegisterStudentsPayload {
  guardianEmail: string;
  academySlug: string;
  /** Consentimiento explícito para el resumen semanal a la familia. */
  guardianDigestConsent: boolean;
  students: NewStudentPayload[];
}

export interface RegisteredStudent {
  name: string;
  username: string;
  schoolYear: string | null;
}

export const authApi = {
  login: (payload: LoginPayload) =>
    api.post<AuthResponse>('/auth/login', payload).then((r) => r.data),

  registerStudents: (payload: RegisterStudentsPayload) =>
    api
      .post<{ students: RegisteredStudent[] }>('/auth/register-students', payload)
      .then((r) => r.data),

  logout: (refreshToken: string) => api.post('/auth/logout', { refreshToken }).then((r) => r.data),

  getMe: () => api.get<User>('/users/me').then((r) => r.data),

  forgotPassword: (email: string) =>
    api.post<{ message: string }>('/auth/forgot-password', { email }).then((r) => r.data),

  resetPassword: (token: string, password: string) =>
    api.post<{ message: string }>('/auth/reset-password', { token, password }).then((r) => r.data),
};
