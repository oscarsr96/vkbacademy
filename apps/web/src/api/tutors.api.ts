import api from '../lib/axios';

export interface StudentSummary {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  schoolYear?: { id: string; name: string; label: string } | null;
}

export interface EnrolledCourse {
  id: string;
  title: string;
  schoolYear?: { id: string; name: string; label: string } | null;
}

export const tutorsApi = {
  getMyStudents: () =>
    api.get<StudentSummary[]>('/tutors/my-students').then((r) => r.data),

  getStudentCourses: (studentId: string) =>
    api.get<EnrolledCourse[]>(`/tutors/my-students/${studentId}/courses`).then((r) => r.data),
};
