import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth.store';
import { Role } from '@vkbacademy/shared';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ProfilePage from './pages/ProfilePage';
import TeacherPortalPage from './pages/TeacherPortalPage';
import DashboardPage from './pages/DashboardPage';
import CoursesPage from './pages/CoursesPage';
import CoursePage from './pages/CoursePage';
import LessonPage from './pages/LessonPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminCoursesPage from './pages/admin/AdminCoursesPage';
import AdminCourseDetailPage from './pages/admin/AdminCourseDetailPage';
import AdminBillingPage from './pages/admin/AdminBillingPage';
import AdminChallengesPage from './pages/admin/AdminChallengesPage';
import AdminRedemptionsPage from './pages/admin/AdminRedemptionsPage';
import ChallengesPage from './pages/ChallengesPage';
import BookingsPage from './pages/BookingsPage';
import TutorStudentsPage from './pages/TutorStudentsPage';
import ExamPage from './pages/ExamPage';
import ExamsListPage from './pages/ExamsListPage';
import AdminExamBankPage from './pages/admin/AdminExamBankPage';
import CertificatesPage from './pages/CertificatesPage';
import AppLayout from './layouts/AppLayout';
import PublicLayout from './layouts/PublicLayout';
import LandingPage from './pages/marketing/LandingPage';
import AboutPage from './pages/marketing/AboutPage';
import PricingPage from './pages/marketing/PricingPage';

// Guarda: redirige a /dashboard si ya está autenticado
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => !!s.accessToken);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

// Guarda: solo ADMIN, si no redirige al inicio privado
function AdminRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== Role.ADMIN) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

// Guarda: redirige al dashboard si ya está autenticado (para /login y /register)
function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => !!s.accessToken);
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <>{children}</>;
}

// Ruta raíz: landing pública si no autenticado, dashboard si autenticado
function RootIndex() {
  const isAuthenticated = useAuthStore((s) => !!s.accessToken);
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <LandingPage />;
}

export default function App() {
  return (
    <Routes>
      {/* ── Rutas de marketing (públicas, con navbar + footer) ── */}
      <Route element={<PublicLayout />}>
        {/* / → landing o dashboard según autenticación */}
        <Route path="/" element={<RootIndex />} />
        {/* /nosotros → página Sobre nosotros */}
        <Route path="/nosotros" element={<AboutPage />} />
        {/* /precios → página de precios */}
        <Route path="/precios" element={<PricingPage />} />
      </Route>

      {/* ── Rutas de autenticación (sin layout compartido) ── */}
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnlyRoute>
            <RegisterPage />
          </PublicOnlyRoute>
        }
      />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* ── Rutas privadas con sidebar (AppLayout) ── */}
      <Route
        element={
          <PrivateRoute>
            <AppLayout />
          </PrivateRoute>
        }
      >
        {/* Dashboard es la raíz privada */}
        <Route path="dashboard" element={<DashboardPage />} />

        {/* Fase 2 — Cursos */}
        <Route path="courses" element={<CoursesPage />} />
        <Route path="courses/:courseId" element={<CoursePage />} />
        <Route path="courses/:courseId/lessons/:lessonId" element={<LessonPage />} />

        {/* Fase 4 — Reservas */}
        <Route path="bookings" element={<BookingsPage />} />

        {/* Tutor */}
        <Route path="tutor/students" element={<TutorStudentsPage />} />

        {/* Fase 7 — Retos/Gamificación */}
        <Route path="challenges" element={<ChallengesPage />} />

        {/* Fase 8 — Exámenes */}
        <Route path="my-exams" element={<ExamsListPage />} />
        <Route path="exam" element={<ExamPage />} />

        {/* Fase 9 — Certificados */}
        <Route path="certificates" element={<CertificatesPage />} />

        {/* Perfil de usuario */}
        <Route path="profile" element={<ProfilePage />} />

        {/* Portal docente */}
        <Route path="teacher" element={<TeacherPortalPage />} />

        {/* Fase 6 — Panel de administración */}
        <Route path="admin" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
        <Route path="admin/users" element={<AdminRoute><AdminUsersPage /></AdminRoute>} />
        <Route path="admin/courses" element={<AdminRoute><AdminCoursesPage /></AdminRoute>} />
        <Route
          path="admin/courses/:courseId"
          element={<AdminRoute><AdminCourseDetailPage /></AdminRoute>}
        />
        <Route path="admin/billing" element={<AdminRoute><AdminBillingPage /></AdminRoute>} />
        <Route
          path="admin/challenges"
          element={<AdminRoute><AdminChallengesPage /></AdminRoute>}
        />
        <Route
          path="admin/redemptions"
          element={<AdminRoute><AdminRedemptionsPage /></AdminRoute>}
        />
        <Route
          path="admin/exam-banks"
          element={<AdminRoute><AdminExamBankPage /></AdminRoute>}
        />
      </Route>

      {/* Fallback — cualquier ruta desconocida va al inicio */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
