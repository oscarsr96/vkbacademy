import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth.store';
import { Role } from '@vkbacademy/shared';
import { useChallengeSummary } from '../hooks/useChallenges';
import { tutorsApi, type StudentSummary } from '../api/tutors.api';

const ORANGE = '#ea580c';

const ROLE_LABELS: Record<string, string> = {
  [Role.STUDENT]: 'Estudiante',
  [Role.TUTOR]: 'Tutor',
  [Role.TEACHER]: 'Profesor',
  [Role.ADMIN]: 'Administrador',
};

const ROLE_DESCRIPTION: Record<string, string> = {
  [Role.STUDENT]: 'Practica con teoría y ejercicios bajo demanda, y reserva clases particulares.',
  [Role.TUTOR]: 'Consulta el progreso de tus alumnos y gestiona sus reservas de clases.',
  [Role.TEACHER]: 'Gestiona tus cursos, sube contenido y consulta las reservas de tus alumnos.',
  [Role.ADMIN]: 'Administra usuarios, cursos y visualiza las métricas globales de la plataforma.',
};

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const isStudent = user?.role === Role.STUDENT;
  const isTutor = user?.role === Role.TUTOR;
  const { data: summary } = useChallengeSummary();

  if (!user) return null;

  const quickActions =
    user.role === Role.STUDENT
      ? [
          {
            emoji: '🧠',
            label: 'Estudiar',
            desc: 'Crea un curso con teoría, ejercicios y examen',
            to: '/study',
          },
        ]
      : user.role === Role.TEACHER
        ? [
            { emoji: '📚', label: 'Mis cursos', desc: 'Gestiona tu contenido', to: '/courses' },
            { emoji: '📅', label: 'Mis reservas', desc: 'Consulta tus clases', to: '/bookings' },
          ]
        : [
            { emoji: '📚', label: 'Cursos', desc: 'Gestiona todos los cursos', to: '/courses' },
            { emoji: '👥', label: 'Usuarios', desc: 'Gestiona roles y accesos', to: '/admin' },
            { emoji: '📊', label: 'Métricas', desc: 'Estadísticas de la plataforma', to: '/admin' },
          ];

  const mainContent = (
    <>
      {/* Banner de cuenta pendiente — solo STUDENT sin nivel asignado */}
      {isStudent && !user.schoolYearId && (
        <div style={S.pendingBanner}>
          ⚠️ Tu cuenta está pendiente de configuración. Un administrador asignará tu nivel en breve.
        </div>
      )}

      {/* Hero oscuro con saludo */}
      <div className="page-hero animate-in">
        <div style={S.heroInner}>
          {/* Avatar */}
          <div style={S.avatar}>{user.name.charAt(0).toUpperCase()}</div>
          <div style={S.heroText}>
            <h1 className="hero-title">¡Hola, {user.name.split(' ')[0]}! 👋</h1>
            <p className="hero-subtitle" style={{ marginTop: 6 }}>
              <span
                className={`role-badge ${user.role}`}
                style={{ marginRight: 8, verticalAlign: 'middle' }}
              >
                {ROLE_LABELS[user.role]}
              </span>
              {ROLE_DESCRIPTION[user.role]}
            </p>
          </div>
        </div>
      </div>

      {/* Stats de gamificación — solo para STUDENT */}
      {isStudent && (
        <div style={S.statsGrid}>
          <div className="stat-card" style={S.statCardInner}>
            <span style={S.statEmoji}>🏆</span>
            <p style={S.statValue}>{summary?.totalPoints ?? '—'}</p>
            <p style={S.statLabel}>Puntos totales</p>
          </div>
          <div className="stat-card" style={S.statCardInner}>
            <span style={S.statEmoji}>🔥</span>
            <p style={S.statValue}>{summary?.currentStreak ?? '—'}</p>
            <p style={S.statLabel}>Racha (semanas)</p>
          </div>
        </div>
      )}

      {/* Métricas de los alumnos — solo para TUTOR */}
      {isTutor && <TutorStudentsOverview onOpenStudents={() => navigate('/tutor/students')} />}

      {/* Accesos rápidos — todos los roles salvo TUTOR */}
      {!isTutor && (
        <section>
          <h2 style={S.sectionTitle}>Accesos rápidos</h2>
          <div style={S.grid}>
            {quickActions.map(({ emoji, label, desc, to }) => (
              <div
                key={label}
                className="vkb-card"
                style={S.quickCard}
                role="button"
                tabIndex={0}
                onClick={() => navigate(to)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(to);
                  }
                }}
              >
                <span style={S.cardEmoji}>{emoji}</span>
                <p style={S.cardLabel}>{label}</p>
                <p style={S.cardDesc}>{desc}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tu cuenta */}
      <section>
        <h2 style={S.sectionTitle}>Tu cuenta</h2>
        <div className="vkb-card" style={{ padding: '0 24px' }}>
          <Row label="Nombre" value={user.name} />
          <Row label="Email" value={user.email ?? '—'} />
          <Row label="Rol" value={ROLE_LABELS[user.role]} />
          {user.role === Role.STUDENT && (
            <Row label="Nivel" value={user.schoolYear?.label ?? '—'} />
          )}
        </div>
      </section>
    </>
  );

  return <div style={S.page}>{mainContent}</div>;
}

// ─── Tutor: resumen de métricas de sus alumnos ──────────────────────────────────

function TutorStudentsOverview({ onOpenStudents }: { onOpenStudents: () => void }) {
  const { data: students, isLoading } = useQuery({
    queryKey: ['tutor', 'my-students'],
    queryFn: tutorsApi.getMyStudents,
  });

  return (
    <section>
      <h2 style={S.sectionTitle}>Mis alumnos</h2>
      {isLoading ? (
        <div className="vkb-card" style={S.tutorEmpty}>
          Cargando alumnos…
        </div>
      ) : !students || students.length === 0 ? (
        <div className="vkb-card" style={S.tutorEmpty}>
          Aún no tienes alumnos asignados.
        </div>
      ) : (
        <div style={S.studentGrid}>
          {students.map((student) => (
            <StudentMetricCard key={student.id} student={student} onClick={onOpenStudents} />
          ))}
        </div>
      )}
    </section>
  );
}

function StudentMetricCard({ student, onClick }: { student: StudentSummary; onClick: () => void }) {
  // Reutiliza la misma queryKey que TutorStudentsPage (period "Todo" → from/to undefined),
  // de modo que abrir el detalle del alumno sea un acierto de caché instantáneo.
  const { data: stats } = useQuery({
    queryKey: ['tutor', 'stats', student.id, undefined, undefined],
    queryFn: () => tutorsApi.getStudentStats(student.id),
  });

  const lessons = stats ? String(stats.lessons.completedAllTime) : '—';
  const examAvg = stats?.exams.avgScore != null ? `${stats.exams.avgScore}%` : '—';

  return (
    <div
      className="vkb-card"
      style={S.studentCard}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div style={S.studentCardHead}>
        <div style={S.studentAvatar}>{student.name.charAt(0).toUpperCase()}</div>
        <div style={{ minWidth: 0 }}>
          <p style={S.studentName}>{student.name}</p>
          <p style={S.studentLevel}>{student.schoolYear?.label ?? 'Sin nivel'}</p>
        </div>
      </div>

      <div style={S.miniKpiGrid}>
        <MiniKpi icon="⭐" label="Puntos" value={String(student.totalPoints)} />
        <MiniKpi icon="🔥" label="Racha" value={`${student.currentStreak} sem`} />
        <MiniKpi icon="📚" label="Lecciones" value={lessons} />
        <MiniKpi icon="📝" label="Nota media" value={examAvg} />
      </div>

      <span style={S.studentLink}>Ver detalle →</span>
    </div>
  );
}

function MiniKpi({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={S.miniKpi}>
      <span style={S.miniKpiIcon}>{icon}</span>
      <span style={S.miniKpiValue}>{value}</span>
      <span style={S.miniKpiLabel}>{label}</span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '14px 0',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>{label}</span>
      <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text)' }}>
        {value}
      </span>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { display: 'flex', flexDirection: 'column', gap: 32, maxWidth: 820 },

  // Hero interior
  heroInner: {
    display: 'flex',
    alignItems: 'center',
    gap: 20,
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: '50%',
    background: 'var(--gradient-orange)',
    boxShadow: 'var(--shadow-orange)',
    color: '#fff',
    fontWeight: 800,
    fontSize: '1.6rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    letterSpacing: '-0.02em',
  },
  heroText: { flex: 1 },

  // Pending banner
  pendingBanner: {
    background: 'rgba(234,88,12,0.08)',
    border: '1.5px solid rgba(234,88,12,0.35)',
    borderRadius: 'var(--radius-md)',
    padding: '14px 20px',
    fontSize: '0.875rem',
    color: '#c94e00',
    fontWeight: 500,
  },

  // Stats grid
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 16,
  },
  statCardInner: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 4,
    textAlign: 'center' as const,
  },
  statEmoji: { fontSize: 30, lineHeight: 1, marginBottom: 2 },
  statValue: {
    fontSize: '1.625rem',
    fontWeight: 800,
    color: 'var(--color-text)',
    margin: 0,
    letterSpacing: '-0.02em',
  },
  statLabel: {
    fontSize: '0.75rem',
    color: 'var(--color-text-muted)',
    margin: 0,
    fontWeight: 500,
  },

  // Section
  sectionTitle: {
    fontSize: '0.8125rem',
    fontWeight: 700,
    letterSpacing: '0.07em',
    textTransform: 'uppercase' as const,
    color: 'var(--color-text-muted)',
    marginBottom: 14,
  },

  // Quick action cards
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: 16,
  },
  quickCard: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    textAlign: 'center' as const,
    gap: 8,
    cursor: 'pointer',
    padding: 28,
  },
  cardEmoji: { fontSize: '2.5rem', lineHeight: 1, marginBottom: 4 },
  cardLabel: { fontWeight: 700, fontSize: '0.9375rem', color: 'var(--color-text)', margin: 0 },
  cardDesc: { fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: 0 },

  // Tutor — resumen de alumnos
  tutorEmpty: {
    padding: '20px 24px',
    fontSize: '0.875rem',
    color: 'var(--color-text-muted)',
  },
  studentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 18,
  },
  studentCard: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 20,
    cursor: 'pointer',
    padding: 28,
  },
  studentCardHead: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  studentAvatar: {
    width: 52,
    height: 52,
    borderRadius: '50%',
    background: 'var(--gradient-orange)',
    color: '#fff',
    fontWeight: 800,
    fontSize: '1.3rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  studentName: {
    margin: 0,
    fontWeight: 700,
    fontSize: '1.0625rem',
    color: 'var(--color-text)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  studentLevel: {
    margin: '3px 0 0',
    fontSize: '0.85rem',
    color: 'var(--color-text-muted)',
  },
  miniKpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 12,
  },
  miniKpi: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-start',
    gap: 3,
    background: 'var(--color-surface-muted, rgba(15,23,42,0.03))',
    borderRadius: 'var(--radius-sm, 8px)',
    padding: '12px 14px',
  },
  miniKpiIcon: { fontSize: '1.1rem', lineHeight: 1 },
  miniKpiValue: {
    fontWeight: 800,
    fontSize: '1.25rem',
    color: 'var(--color-text)',
    letterSpacing: '-0.01em',
  },
  miniKpiLabel: { fontSize: '0.75rem', color: 'var(--color-text-muted)' },
  studentLink: {
    fontSize: '0.875rem',
    fontWeight: 700,
    color: ORANGE,
  },
};
