import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { Role } from '@vkbacademy/shared';
import { useRecentLessons } from '../hooks/useCourses';
import { useChallengeSummary } from '../hooks/useChallenges';
import { LessonType } from '@vkbacademy/shared';

const ROLE_LABELS: Record<string, string> = {
  [Role.STUDENT]: 'Estudiante',
  [Role.TEACHER]: 'Profesor',
  [Role.ADMIN]: 'Administrador',
};

const ROLE_DESCRIPTION: Record<string, string> = {
  [Role.STUDENT]: 'Accede a tus cursos, completa tests y reserva clases con los profesores.',
  [Role.TEACHER]: 'Gestiona tus cursos, sube contenido y consulta las reservas de tus alumnos.',
  [Role.ADMIN]: 'Administra usuarios, cursos y visualiza las métricas globales de la plataforma.',
};

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const isStudent = user?.role === Role.STUDENT;
  const { data: recentLessons = [] } = useRecentLessons();
  const { data: summary } = useChallengeSummary();

  if (!user) return null;

  const quickActions =
    user.role === Role.STUDENT
      ? [
          { emoji: '📚', label: 'Mis cursos', desc: 'Continúa donde lo dejaste', to: '/courses' },
          { emoji: '📅', label: 'Reservar clase', desc: 'Elige horario con un profesor', to: '/bookings' },
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
          <div style={S.avatar}>
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div style={S.heroText}>
            <h1 className="hero-title">
              ¡Hola, {user.name.split(' ')[0]}! 👋
            </h1>
            <p className="hero-subtitle" style={{ marginTop: 6 }}>
              <span className={`role-badge ${user.role}`} style={{ marginRight: 8, verticalAlign: 'middle' }}>
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
          <div className="stat-card" style={S.statCardInner}>
            <span style={S.statEmoji}>✅</span>
            <p style={S.statValue}>{summary?.completedCount ?? '—'}</p>
            <p style={S.statLabel}>Lecciones completadas</p>
          </div>
        </div>
      )}

      {/* Accesos rápidos */}
      <section>
        <h2 style={S.sectionTitle}>Accesos rápidos</h2>
        <div style={S.grid}>
          {quickActions.map(({ emoji, label, desc, to }) => (
            <div
              key={label}
              className="vkb-card"
              style={S.quickCard}
              onClick={() => navigate(to)}
            >
              <span style={S.cardEmoji}>{emoji}</span>
              <p style={S.cardLabel}>{label}</p>
              <p style={S.cardDesc}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tu cuenta */}
      <section>
        <h2 style={S.sectionTitle}>Tu cuenta</h2>
        <div className="vkb-card" style={{ padding: '0 24px' }}>
          <Row label="Nombre" value={user.name} />
          <Row label="Email" value={user.email} />
          <Row label="Rol" value={ROLE_LABELS[user.role]} />
          {user.role === Role.STUDENT && (
            <Row label="Nivel" value={user.schoolYear?.label ?? '—'} />
          )}
        </div>
      </section>
    </>
  );

  return (
    <div style={isStudent ? S.layout : S.page}>
      <div style={isStudent ? S.main : undefined}>
        {mainContent}
      </div>

      {/* Sidebar de lecciones recientes — solo para STUDENT */}
      {isStudent && (
        <aside style={S.sidebar}>
          <h2 style={S.sectionTitle}>Últimas lecciones</h2>
          {recentLessons.length === 0 ? (
            <p style={S.emptyMsg}>Aún no has completado ninguna lección.</p>
          ) : (
            <div style={S.recentList}>
              {recentLessons.map((item) => (
                <div
                  key={item.lessonId}
                  className="vkb-card"
                  style={S.recentCard}
                  onClick={() => navigate(`/courses/${item.courseId}`)}
                >
                  <span style={S.recentTypeIcon}>
                    {item.lessonType === LessonType.VIDEO ? '🎬' : item.lessonType === LessonType.QUIZ ? '📝' : '💪'}
                  </span>
                  <div style={S.recentInfo}>
                    <p style={S.recentTitle}>{item.lessonTitle}</p>
                    <p style={S.recentMeta}>{item.courseTitle}</p>
                    {item.completedAt && (
                      <p style={S.recentDate}>
                        {new Date(item.completedAt).toLocaleDateString('es-ES', {
                          day: 'numeric', month: 'short',
                        })}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      padding: '14px 0',
      borderBottom: '1px solid var(--color-border)',
    }}>
      <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>{label}</span>
      <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text)' }}>{value}</span>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  // Layout de dos columnas (student) vs columna única (otros roles)
  layout: {
    display: 'grid',
    gridTemplateColumns: '1fr 280px',
    gap: 32,
    alignItems: 'start',
  },
  page: { display: 'flex', flexDirection: 'column', gap: 32, maxWidth: 820 },
  main: { display: 'flex', flexDirection: 'column', gap: 32 },

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
    gridTemplateColumns: 'repeat(3, 1fr)',
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

  // Sidebar
  sidebar: { display: 'flex', flexDirection: 'column', gap: 0 },
  recentList: { display: 'flex', flexDirection: 'column', gap: 10 },
  recentCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: '14px 16px',
    cursor: 'pointer',
  },
  recentTypeIcon: { fontSize: 22, flexShrink: 0, marginTop: 1 },
  recentInfo: { flex: 1, minWidth: 0 },
  recentTitle: {
    fontWeight: 600,
    fontSize: '0.875rem',
    color: 'var(--color-text)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    margin: 0,
  },
  recentMeta: {
    fontSize: '0.78rem',
    color: 'var(--color-text-muted)',
    marginTop: 2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    marginBottom: 0,
  },
  recentDate: {
    fontSize: '0.72rem',
    color: 'var(--color-primary)',
    marginTop: 4,
    fontWeight: 700,
    margin: 0,
  },
  emptyMsg: {
    fontSize: '0.875rem',
    color: 'var(--color-text-muted)',
    padding: '16px 0',
    margin: 0,
  },
};
