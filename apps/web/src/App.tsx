import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth.store';
import { Role } from '@vkbacademy/shared';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import ProfilePage from './pages/ProfilePage';
import DashboardPage from './pages/DashboardPage';
import CoursesPage from './pages/CoursesPage';
import CoursePage from './pages/CoursePage';
import LessonPage from './pages/LessonPage';
import ChallengesPage from './pages/ChallengesPage';
import BookingsPage from './pages/BookingsPage';
import TutorStudentsPage from './pages/TutorStudentsPage';
import CertificatesPage from './pages/CertificatesPage';
import SubjectsPage from './pages/SubjectsPage';
import AcademyLandingPage from './pages/marketing/AcademyLandingPage';
import AppLayout from './layouts/AppLayout';
import PublicLayout from './layouts/PublicLayout';
import AboutPage from './pages/marketing/AboutPage';
import PricingPage from './pages/marketing/PricingPage';
import RootIndex from './components/RootIndex';
import BrandSync from './components/BrandSync';

// Rutas pesadas o de uso poco frecuente (panel admin, portal docente, estudio con IA) —
// carga diferida para reducir el bundle inicial que descarga un alumno normal.
const TeacherPortalPage = lazy(() => import('./pages/TeacherPortalPage'));
const ExamPage = lazy(() => import('./pages/ExamPage'));
const StudyPage = lazy(() => import('./pages/StudyPage'));
const StudyUnitPage = lazy(() => import('./pages/StudyUnitPage'));
const StudyPlanCreatePage = lazy(() => import('./pages/StudyPlanCreatePage'));
const StudyPlanPage = lazy(() => import('./pages/StudyPlanPage'));
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'));
const AdminCoursesPage = lazy(() => import('./pages/admin/AdminCoursesPage'));
const AdminCourseDetailPage = lazy(() => import('./pages/admin/AdminCourseDetailPage'));
const AdminBillingPage = lazy(() => import('./pages/admin/AdminBillingPage'));
const AdminChallengesPage = lazy(() => import('./pages/admin/AdminChallengesPage'));
const AdminRedemptionsPage = lazy(() => import('./pages/admin/AdminRedemptionsPage'));
const AdminExamBankPage = lazy(() => import('./pages/admin/AdminExamBankPage'));
const AdminAcademiesPage = lazy(() => import('./pages/admin/AdminAcademiesPage'));

// Fallback de carga mientras se descarga el chunk de una ruta diferida
function RouteLoadingFallback() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        color: 'var(--color-text-muted)',
        fontSize: '0.95rem',
      }}
    >
      Cargando...
    </div>
  );
}

// Guarda: redirige a /dashboard si ya está autenticado
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => !!s.accessToken);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

// Guarda: solo ADMIN o SUPER_ADMIN, si no redirige al inicio privado
function AdminRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== Role.ADMIN && user.role !== Role.SUPER_ADMIN)
    return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

// Guarda: redirige al dashboard si ya está autenticado (para /login y /register)
function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => !!s.accessToken);
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <>{children}</>;
}

export default function App() {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
    <BrandSync />
    <Routes>
      {/* ── Ruta raíz: si dominio de academia, renderiza sin PublicLayout ── */}
      <Route path="/" element={<RootIndex />} />

      {/* ── Rutas de marketing (públicas, con navbar + footer de VKB) ── */}
      <Route element={<PublicLayout />}>
        {/* /nosotros → página Sobre nosotros */}
        <Route path="/nosotros" element={<AboutPage />} />
        {/* /precios → página de precios */}
        <Route path="/precios" element={<PricingPage />} />
      </Route>

      {/* ── Landing por academia (sin layout compartido — tiene su propio navbar) ── */}
      <Route path="/a/:slug" element={<AcademyLandingPage />} />

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
      <Route
        path="/change-password"
        element={
          <PrivateRoute>
            <ChangePasswordPage />
          </PrivateRoute>
        }
      />

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

        {/* Asignaturas — auto-matriculación del alumno */}
        <Route path="subjects" element={<SubjectsPage />} />

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
        <Route path="exam" element={<ExamPage />} />

        {/* Estudiar — curso generado por IA (teoría + ejercicios + examen) */}
        <Route path="study" element={<StudyPage />} />
        <Route path="study/plan/new" element={<StudyPlanCreatePage />} />
        <Route path="study/plan/:id" element={<StudyPlanPage />} />
        <Route path="study/:id" element={<StudyUnitPage />} />

        {/* Fase 9 — Certificados */}
        <Route path="certificates" element={<CertificatesPage />} />

        {/* Perfil de usuario */}
        <Route path="profile" element={<ProfilePage />} />

        {/* Portal docente */}
        <Route path="teacher" element={<TeacherPortalPage />} />

        {/* Fase 6 — Panel de administración */}
        <Route
          path="admin"
          element={
            <AdminRoute>
              <AdminDashboardPage />
            </AdminRoute>
          }
        />
        <Route
          path="admin/users"
          element={
            <AdminRoute>
              <AdminUsersPage />
            </AdminRoute>
          }
        />
        <Route
          path="admin/courses"
          element={
            <AdminRoute>
              <AdminCoursesPage />
            </AdminRoute>
          }
        />
        <Route
          path="admin/courses/:courseId"
          element={
            <AdminRoute>
              <AdminCourseDetailPage />
            </AdminRoute>
          }
        />
        <Route
          path="admin/billing"
          element={
            <AdminRoute>
              <AdminBillingPage />
            </AdminRoute>
          }
        />
        <Route
          path="admin/challenges"
          element={
            <AdminRoute>
              <AdminChallengesPage />
            </AdminRoute>
          }
        />
        <Route
          path="admin/redemptions"
          element={
            <AdminRoute>
              <AdminRedemptionsPage />
            </AdminRoute>
          }
        />
        <Route
          path="admin/exam-banks"
          element={
            <AdminRoute>
              <AdminExamBankPage />
            </AdminRoute>
          }
        />
        <Route
          path="admin/academies"
          element={
            <AdminRoute>
              <AdminAcademiesPage />
            </AdminRoute>
          }
        />
      </Route>

      {/* Fallback — cualquier ruta desconocida va al inicio */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}
