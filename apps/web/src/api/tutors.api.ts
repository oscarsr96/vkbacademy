import api from '../lib/axios';

export interface StudentSummary {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  totalPoints: number;
  currentStreak: number;
  schoolYear?: { id: string; name: string; label: string } | null;
}

export interface EnrolledCourse {
  id: string;
  title: string;
  schoolYear?: { id: string; name: string; label: string } | null;
}

export interface CourseProgress {
  id: string;
  title: string;
  schoolYear?: { id: string; name: string; label: string } | null;
  totalLessons: number;
  completedLessons: number;
  progressPct: number;
  modules: Array<{
    id: string;
    title: string;
    totalLessons: number;
    completedLessons: number;
  }>;
}

export interface ActivityDay {
  date: string;
  lessons: number;
  quizzes: number;
}

export interface StudentStats {
  student: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
    schoolYear?: { id: string; name: string; label: string } | null;
    totalPoints: number;
    currentStreak: number;
    longestStreak: number;
    createdAt: string;
  };
  period: { from: string | null; to: string | null };
  lessons: {
    completedInPeriod: number;
    completedAllTime: number;
    activeDays: number;
  };
  quizzes: {
    attempts: number;
    avgScore: number | null;
    bestScore: number | null;
  };
  exams: {
    attempts: number;
    avgScore: number | null;
    bestScore: number | null;
    passed: number;
  };
  certificates: {
    total: number;
    byType: Record<string, number>;
  };
  sessions: {
    confirmed: number;
    totalHours: number;
  };
  courses: CourseProgress[];
  activity: ActivityDay[];
}

export const tutorsApi = {
  getMyStudents: () =>
    api.get<StudentSummary[]>('/tutors/my-students').then((r) => r.data),

  getStudentCourses: (studentId: string) =>
    api.get<EnrolledCourse[]>(`/tutors/my-students/${studentId}/courses`).then((r) => r.data),

  getStudentStats: (studentId: string, from?: string, to?: string) =>
    api
      .get<StudentStats>(`/tutors/my-students/${studentId}/stats`, {
        params: { ...(from ? { from } : {}), ...(to ? { to } : {}) },
      })
      .then((r) => r.data),
};
