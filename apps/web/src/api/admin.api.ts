import api from '../lib/axios';
import type {
  Course,
  Module,
  SchoolYear,
  PaginatedResponse,
  AdminCourseDetail,
  AdminLesson,
  AdminModule,
  AdminQuiz,
  AdminQuestion,
  MatchContent,
  SortContent,
  FillBlankContent,
} from '@vkbacademy/shared';
import { LessonType, QuestionType, Role } from '@vkbacademy/shared';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  avatarUrl?: string | null;
  createdAt: string;
  tutorId?: string | null;
  tutor?: { id: string; name: string } | null;
  _count: { students: number };
}

export interface AdminMetrics {
  users: { total: number; students: number; tutors: number; teachers: number };
  courses: { total: number; published: number };
  bookings: { total: number; confirmed: number; pending: number };
  enrollments: number;
  quizAttempts: number;
}

export interface AdminCoursesParams {
  page?: number;
  limit?: number;
  schoolYearId?: string;
  search?: string;
}

export interface UpdateCoursePayload {
  title?: string;
  description?: string;
  schoolYearId?: string | null;
  subject?: string;
  published?: boolean;
}

export interface GenerateCoursePayload {
  name: string;
  schoolYearId: string;
}

export interface CreateCoursePayload {
  title: string;
  description?: string;
  schoolYearId?: string;
  subject?: string;
}

export interface CreateModulePayload {
  title: string;
}

export interface UpdateModulePayload {
  title?: string;
}

export interface CreateLessonPayload {
  title: string;
  type: LessonType;
}

export interface UpdateLessonPayload {
  title?: string;
  type?: LessonType;
  youtubeId?: string | null;
  content?: MatchContent | SortContent | FillBlankContent | null;
}

export interface AnswerPayload {
  text: string;
  isCorrect: boolean;
}

export interface CreateQuestionPayload {
  text: string;
  type: QuestionType;
  answers: AnswerPayload[];
}

export interface CreateUserPayload {
  email: string;
  name: string;
  password: string;
  role: Role;
  schoolYearId?: string;
  tutorId?: string;
}

export interface UpdateUserPayload {
  name?: string;
  email?: string;
  schoolYearId?: string | null;
  password?: string;
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export interface AnalyticsQueryParams {
  from?: string;
  to?: string;
  granularity?: 'day' | 'week' | 'month';
  courseId?: string;
  schoolYearId?: string;
}

export interface AnalyticsKPIs {
  newUsers: number;
  newEnrollments: number;
  completedLessons: number;
  quizAttempts: number;
  avgQuizScore: number;
  newBookings: number;
  confirmedBookings: number;
  cancelledBookings: number;
}

export interface TimeSeriesPoint {
  date: string;
  completedLessons: number;
  quizAttempts: number;
  newBookings: number;
  newUsers: number;
}

export interface CourseActivity {
  courseId: string;
  title: string;
  schoolYear?: string;
  enrollments: number;
}

export interface StudentActivity {
  studentId: string;
  name: string;
  email: string;
  completedLessons: number;
  quizAttempts: number;
  avgScore: number;
}

export interface TeacherActivity {
  teacherId: string;
  name: string;
  email: string;
  confirmed: number;
  pending: number;
  cancelled: number;
  hoursTaught: number;
  online: number;
  inPerson: number;
}

export interface AtRiskStudent {
  studentId: string;
  name: string;
  email: string;
  daysSinceLastActivity: number | null;
}

export interface ScoreBucket {
  bucket: string;
  count: number;
}

export interface LowCompletionLesson {
  lessonId: string;
  title: string;
  moduleTitle: string;
  courseTitle: string;
  completedCount: number;
}

export interface BookingHeatmapCell {
  day: number;
  hour: number;
  count: number;
}

export interface AdminAnalytics {
  kpis: AnalyticsKPIs;
  timeSeries: TimeSeriesPoint[];
  topCourses: CourseActivity[];
  topStudents: StudentActivity[];
  bookings: {
    byStatus: { status: string; count: number }[];
    byMode: { mode: string; count: number }[];
  };
  teachers: {
    summary: {
      activeTeachers: number;
      totalHoursTaught: number;
      totalConfirmedSessions: number;
    };
    top: TeacherActivity[];
  };
  insights: {
    atRiskStudents: AtRiskStudent[];
    scoreDistribution: ScoreBucket[];
    lowCompletionLessons: LowCompletionLesson[];
    bookingHeatmap: BookingHeatmapCell[];
    avgBookingLeadDays: number;
  };
}

// ─── Billing ──────────────────────────────────────────────────────────────────

export interface BillingConfig {
  id: string;
  studentMonthlyPrice: number;
  classOnlineRatePerHour: number;
  classInPersonRatePerHour: number;
  clubCommissionRate: number;
  infrastructureMonthlyCost: number;
  s3MonthlyCost: number;
  anthropicMonthlyCost: number;
  updatedAt: string;
}

export interface BillingReport {
  period: { from: string; to: string; months: number };
  config: BillingConfig;
  revenue: {
    subscriptions: {
      activeStudents: number;
      monthlyPrice: number;
      months: number;
      total: number;
    };
    classes: {
      confirmedCount: number;
      onlineHours: number;
      inPersonHours: number;
      grossRevenue: number;
      commissionRate: number;
      commission: number;
    };
    total: number;
  };
  costs: {
    resend: { estimatedEmails: number; estimated: number; tier: 'free' | 'paid' };
    dailyCo: { participantMinutes: number; estimated: number; tier: 'free' | 'paid' };
    s3: { estimated: number };
    anthropic: { estimated: number };
    infrastructure: { estimated: number };
    total: number;
  };
  net: number;
  margin: number;
}

export interface BillingConfigPayload {
  studentMonthlyPrice?: number;
  classOnlineRatePerHour?: number;
  classInPersonRatePerHour?: number;
  clubCommissionRate?: number;
  infrastructureMonthlyCost?: number;
  s3MonthlyCost?: number;
  anthropicMonthlyCost?: number;
}

// ─── Certificados (Admin) ─────────────────────────────────────────────────────

export type AdminCertificateType =
  | 'MODULE_COMPLETION'
  | 'COURSE_COMPLETION'
  | 'MODULE_EXAM'
  | 'COURSE_EXAM';

export interface AdminCertificate {
  id: string;
  type: AdminCertificateType;
  verifyCode: string;
  examScore: number | null;
  issuedAt: string;
  recipientName: string;
  recipientEmail: string;
  scopeTitle: string;
  courseTitle?: string;
}

// ─── Redemptions (Admin) ─────────────────────────────────────────────────────

export interface AdminEnrollment {
  id: string;
  userId: string;
  courseId: string;
  createdAt: string;
  course: {
    id: string;
    title: string;
    schoolYear?: { id: string; name: string; label: string } | null;
  };
}

export interface AdminRedemption {
  id: string;
  userId: string;
  itemName: string;
  cost: number;
  redeemedAt: string;
  delivered: boolean;
  deliveredAt: string | null;
  user: { id: string; name: string; email: string; avatarUrl?: string | null };
}

// ─── Challenges (Admin) ───────────────────────────────────────────────────────

export type AdminChallengeType =
  | 'LESSON_COMPLETED'
  | 'MODULE_COMPLETED'
  | 'COURSE_COMPLETED'
  | 'QUIZ_SCORE'
  | 'BOOKING_ATTENDED'
  | 'STREAK_WEEKLY'
  | 'TOTAL_HOURS';

export interface AdminChallenge {
  id: string;
  title: string;
  description: string;
  type: AdminChallengeType;
  target: number;
  points: number;
  badgeIcon: string;
  badgeColor: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { userChallenges: number };
}

export interface CreateChallengePayload {
  title: string;
  description: string;
  type: AdminChallengeType;
  target: number;
  points: number;
  badgeIcon?: string;
  badgeColor?: string;
}

export interface UpdateChallengePayload {
  title?: string;
  description?: string;
  type?: AdminChallengeType;
  target?: number;
  points?: number;
  badgeIcon?: string;
  badgeColor?: string;
}

export const adminApi = {
  // ─── Usuarios ──────────────────────────────────────────────────────────────

  getUsers: () =>
    api.get<AdminUser[]>('/admin/users').then((r) => r.data),

  updateRole: (userId: string, role: Role) =>
    api.patch<AdminUser>(`/admin/users/${userId}/role`, { role }).then((r) => r.data),

  assignTutor: (studentId: string, tutorId: string | null) =>
    api.patch<AdminUser>(`/admin/users/${studentId}/tutor`, { tutorId }).then((r) => r.data),

  createUser: (payload: CreateUserPayload) =>
    api.post<AdminUser>('/admin/users', payload).then((r) => r.data),

  updateUser: (userId: string, payload: UpdateUserPayload) =>
    api.patch<AdminUser>(`/admin/users/${userId}`, payload).then((r) => r.data),

  deleteUser: (userId: string) =>
    api.delete<{ message: string }>(`/admin/users/${userId}`).then((r) => r.data),

  // ─── Matrículas manuales ────────────────────────────────────────────────────

  getEnrollments: (userId: string) =>
    api.get<AdminEnrollment[]>(`/admin/users/${userId}/enrollments`).then((r) => r.data),

  enroll: (userId: string, courseId: string) =>
    api.post<AdminEnrollment>(`/admin/users/${userId}/enrollments`, { courseId }).then((r) => r.data),

  unenroll: (userId: string, courseId: string) =>
    api.delete<{ message: string }>(`/admin/users/${userId}/enrollments/${courseId}`).then((r) => r.data),

  // ─── Métricas ──────────────────────────────────────────────────────────────

  getMetrics: () =>
    api.get<AdminMetrics>('/admin/metrics').then((r) => r.data),

  // ─── Cursos ────────────────────────────────────────────────────────────────

  listCourses: (params?: AdminCoursesParams) =>
    api
      .get<PaginatedResponse<Course>>('/admin/courses', { params })
      .then((r) => r.data),

  createCourse: (payload: CreateCoursePayload) =>
    api.post<Course>('/courses', payload).then((r) => r.data),

  generateCourse: (payload: GenerateCoursePayload) =>
    api.post<Course>('/admin/courses/generate', payload).then((r) => r.data),

  importCourse: (payload: unknown) =>
    api.post<{ message: string; course: Course }>('/admin/courses/import', payload).then((r) => r.data),

  deleteCourse: (id: string) =>
    api.delete<{ message: string }>(`/admin/courses/${id}`).then((r) => r.data),

  updateCourse: (id: string, payload: UpdateCoursePayload) =>
    api.patch<Course>(`/courses/${id}`, payload).then((r) => r.data),

  listSchoolYears: () =>
    api.get<SchoolYear[]>('/school-years').then((r) => r.data),

  // ─── Detalle de curso ──────────────────────────────────────────────────────

  getCourseDetail: (courseId: string) =>
    api.get<AdminCourseDetail>(`/admin/courses/${courseId}/detail`).then((r) => r.data),

  // ─── Módulos ───────────────────────────────────────────────────────────────

  generateModule: (courseId: string, name: string) =>
    api
      .post<AdminModule>(`/admin/courses/${courseId}/modules/generate`, { name })
      .then((r) => r.data),

  createModule: (courseId: string, payload: CreateModulePayload) =>
    api.post<Module>(`/admin/courses/${courseId}/modules`, payload).then((r) => r.data),

  updateModule: (moduleId: string, payload: UpdateModulePayload) =>
    api.patch<Module>(`/admin/modules/${moduleId}`, payload).then((r) => r.data),

  deleteModule: (moduleId: string) =>
    api.delete<{ message: string }>(`/admin/modules/${moduleId}`).then((r) => r.data),

  // ─── Lecciones ─────────────────────────────────────────────────────────────

  generateLesson: (moduleId: string, topic: string) =>
    api
      .post<AdminLesson>(`/admin/modules/${moduleId}/lessons/generate`, { topic })
      .then((r) => r.data),

  createLesson: (moduleId: string, payload: CreateLessonPayload) =>
    api.post<AdminLesson>(`/admin/modules/${moduleId}/lessons`, payload).then((r) => r.data),

  updateLesson: (lessonId: string, payload: UpdateLessonPayload) =>
    api.patch<AdminLesson>(`/admin/lessons/${lessonId}`, payload).then((r) => r.data),

  deleteLesson: (lessonId: string) =>
    api.delete<{ message: string }>(`/admin/lessons/${lessonId}`).then((r) => r.data),

  // ─── Quiz ──────────────────────────────────────────────────────────────────

  initQuiz: (lessonId: string) =>
    api.post<AdminQuiz>(`/admin/lessons/${lessonId}/quiz`).then((r) => r.data),

  // ─── Preguntas ─────────────────────────────────────────────────────────────

  generateQuestion: (quizId: string, topic: string) =>
    api
      .post<AdminQuestion>(`/admin/quizzes/${quizId}/questions/generate`, { topic })
      .then((r) => r.data),

  createQuestion: (quizId: string, payload: CreateQuestionPayload) =>
    api.post<AdminQuestion>(`/admin/quizzes/${quizId}/questions`, payload).then((r) => r.data),

  updateQuestion: (questionId: string, payload: CreateQuestionPayload) =>
    api.patch<AdminQuestion>(`/admin/questions/${questionId}`, payload).then((r) => r.data),

  deleteQuestion: (questionId: string) =>
    api.delete<{ message: string }>(`/admin/questions/${questionId}`).then((r) => r.data),

  // ─── Analytics ─────────────────────────────────────────────────────────────

  getAnalytics: (params?: AnalyticsQueryParams) =>
    api.get<AdminAnalytics>('/admin/analytics', { params }).then((r) => r.data),

  // ─── Facturación ───────────────────────────────────────────────────────────

  getBilling: (params?: { from?: string; to?: string }) =>
    api.get<BillingReport>('/admin/billing', { params }).then((r) => r.data),

  updateBillingConfig: (payload: BillingConfigPayload) =>
    api.patch<BillingConfig>('/admin/billing/config', payload).then((r) => r.data),

  // ─── Canjes ────────────────────────────────────────────────────────────────

  listRedemptions: () =>
    api.get<AdminRedemption[]>('/admin/redemptions').then((r) => r.data),

  markRedemptionDelivered: (id: string) =>
    api.patch<AdminRedemption>(`/admin/redemptions/${id}/deliver`).then((r) => r.data),

  // ─── Retos ─────────────────────────────────────────────────────────────────

  listChallenges: () =>
    api.get<AdminChallenge[]>('/admin/challenges').then((r) => r.data),

  createChallenge: (payload: CreateChallengePayload) =>
    api.post<AdminChallenge>('/admin/challenges', payload).then((r) => r.data),

  updateChallenge: (id: string, payload: UpdateChallengePayload) =>
    api.patch<AdminChallenge>(`/admin/challenges/${id}`, payload).then((r) => r.data),

  deleteChallenge: (id: string) =>
    api.delete<{ message: string }>(`/admin/challenges/${id}`).then((r) => r.data),

  toggleChallenge: (id: string) =>
    api.patch<AdminChallenge>(`/admin/challenges/${id}/toggle`).then((r) => r.data),

  // ─── Banco de preguntas de examen ───────────────────────────────────────────

  listExamQuestions: (params: { courseId?: string; moduleId?: string }) =>
    api
      .get<import('./exams.api').AdminExamQuestion[]>('/admin/exam-questions', { params })
      .then((r) => r.data),

  createExamQuestion: (payload: {
    courseId?: string;
    moduleId?: string;
    text: string;
    type: import('@vkbacademy/shared').QuestionType;
    answers: import('./admin.api').AnswerPayload[];
  }) =>
    api
      .post<import('./exams.api').AdminExamQuestion>('/admin/exam-questions', payload)
      .then((r) => r.data),

  generateExamQuestions: (payload: {
    courseId?: string;
    moduleId?: string;
    topic: string;
    count?: number;
  }) =>
    api
      .post<import('./exams.api').AdminExamQuestion[]>('/admin/exam-questions/generate', payload)
      .then((r) => r.data),

  updateExamQuestion: (
    id: string,
    payload: {
      text: string;
      type: import('@vkbacademy/shared').QuestionType;
      answers: import('./admin.api').AnswerPayload[];
    },
  ) =>
    api
      .patch<import('./exams.api').AdminExamQuestion>(`/admin/exam-questions/${id}`, payload)
      .then((r) => r.data),

  deleteExamQuestion: (id: string) =>
    api.delete<{ message: string }>(`/admin/exam-questions/${id}`).then((r) => r.data),

  listExamAttempts: (params: { courseId?: string; moduleId?: string }) =>
    api
      .get<import('./exams.api').AdminExamAttempt[]>('/admin/exam-attempts', { params })
      .then((r) => r.data),

  // ─── Certificados ──────────────────────────────────────────────────────────

  listCertificates: () =>
    api.get<AdminCertificate[]>('/admin/certificates').then((r) => r.data),

  issueCertificate: (payload: {
    userId: string;
    courseId?: string;
    moduleId?: string;
    type: AdminCertificateType;
  }) =>
    api.post<AdminCertificate>('/admin/certificates', payload).then((r) => r.data),
};

