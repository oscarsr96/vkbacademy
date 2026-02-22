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
        <div style={styles.pendingBanner}>
          ⚠️ Tu cuenta está pendiente de configuración. Un administrador asignará tu nivel en breve.
        </div>
      )}

      {/* Stats de gamificación — solo para STUDENT */}
      {isStudent && summary && (
        <section>
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <span style={styles.statEmoji}>🏆</span>
              <p style={styles.statValue}>{summary.totalPoints}</p>
              <p style={styles.statLabel}>Puntos</p>
            </div>
            <div style={styles.statCard}>
              <span style={styles.statEmoji}>🔥</span>
              <p style={styles.statValue}>{summary.currentStreak}</p>
              <p style={styles.statLabel}>Racha (semanas)</p>
            </div>
            <div style={styles.statCard}>
              <span style={styles.statEmoji}>✅</span>
              <p style={styles.statValue}>{summary.completedCount}</p>
              <p style={styles.statLabel}>Lecciones completadas</p>
            </div>
          </div>
        </section>
      )}

      {/* Bienvenida */}
      <div style={styles.welcome}>
        <div style={styles.welcomeAvatar}>
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 style={styles.welcomeTitle}>Hola, {user.name.split(' ')[0]} 👋</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <span className={`role-badge ${user.role}`}>{ROLE_LABELS[user.role]}</span>
            <span style={styles.welcomeDesc}>{ROLE_DESCRIPTION[user.role]}</span>
          </div>
        </div>
      </div>

      {/* Accesos rápidos */}
      <section>
        <h2 style={styles.sectionTitle}>Accesos rápidos</h2>
        <div style={styles.grid}>
          {quickActions.map(({ emoji, label, desc, to }) => (
            <div key={label} style={styles.card} onClick={() => navigate(to)}>
              <span style={styles.cardEmoji}>{emoji}</span>
              <div>
                <p style={styles.cardLabel}>{label}</p>
                <p style={styles.cardDesc}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Tu cuenta */}
      <section style={styles.accountSection}>
        <h2 style={styles.sectionTitle}>Tu cuenta</h2>
        <div style={styles.infoCard}>
          <Row label="Nombre" value={user.name} />
          <Row label="Email" value={user.email} />
          <Row label="Rol" value={ROLE_LABELS[user.role]} />
          {user.role === Role.STUDENT && (
            <Row label="Curso" value={user.schoolYear?.label ?? '—'} />
          )}
        </div>
      </section>
    </>
  );

  return (
    <div style={isStudent ? styles.layout : styles.page}>
      <div style={isStudent ? styles.main : undefined}>
        {mainContent}
      </div>

      {/* Sidebar de lecciones recientes — solo para STUDENT */}
      {isStudent && (
        <aside style={styles.sidebar}>
          <h2 style={styles.sectionTitle}>Últimas lecciones</h2>
          {recentLessons.length === 0 ? (
            <p style={styles.emptyMsg}>Aún no has completado ninguna lección.</p>
          ) : (
            <div style={styles.recentList}>
              {recentLessons.map((item) => (
                <div
                  key={item.lessonId}
                  style={styles.recentCard}
                  onClick={() => navigate(`/courses/${item.courseId}`)}
                >
                  <span style={styles.recentTypeIcon}>
                    {item.lessonType === LessonType.VIDEO ? '🎬' : item.lessonType === LessonType.QUIZ ? '📝' : '💪'}
                  </span>
                  <div style={styles.recentInfo}>
                    <p style={styles.recentTitle}>{item.lessonTitle}</p>
                    <p style={styles.recentMeta}>{item.courseTitle}</p>
                    {item.completedAt && (
                      <p style={styles.recentDate}>
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
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--color-border)' }}>
      <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>{label}</span>
      <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>{value}</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  // Layout de dos columnas (student) vs columna única (otros roles)
  layout: {
    display: 'grid',
    gridTemplateColumns: '1fr 280px',
    gap: 32,
    alignItems: 'start',
  },
  page: { display: 'flex', flexDirection: 'column', gap: 36, maxWidth: 800 },
  main: { display: 'flex', flexDirection: 'column', gap: 36 },

  // Sidebar
  sidebar: { display: 'flex', flexDirection: 'column', gap: 0 },
  recentList: { display: 'flex', flexDirection: 'column', gap: 8 },
  recentCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: '12px 16px',
    background: 'var(--color-surface)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-sm)',
    cursor: 'pointer',
    border: '1.5px solid transparent',
    transition: 'border-color 0.15s',
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
  },
  recentMeta: {
    fontSize: '0.78rem',
    color: 'var(--color-text-muted)',
    marginTop: 2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  recentDate: {
    fontSize: '0.72rem',
    color: 'var(--color-primary)',
    marginTop: 3,
    fontWeight: 600,
  },
  emptyMsg: {
    fontSize: '0.875rem',
    color: 'var(--color-text-muted)',
    padding: '16px 0',
  },
  welcome: {
    display: 'flex',
    alignItems: 'center',
    gap: 20,
    background: 'var(--color-surface)',
    borderRadius: 'var(--radius-md)',
    padding: 28,
    boxShadow: 'var(--shadow-sm)',
  },
  welcomeAvatar: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    background: 'var(--color-primary)',
    color: '#fff',
    fontWeight: 700,
    fontSize: '1.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  welcomeTitle: { fontSize: '1.5rem', fontWeight: 700 },
  welcomeDesc: { fontSize: '0.875rem', color: 'var(--color-text-muted)' },
  sectionTitle: { fontSize: '1rem', fontWeight: 700, marginBottom: 14, color: 'var(--color-text-muted)' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 },
  card: {
    background: 'var(--color-surface)',
    borderRadius: 'var(--radius-md)',
    padding: 24,
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    cursor: 'pointer',
    border: '1.5px solid transparent',
    transition: 'border-color 0.15s',
  },
  cardEmoji: { fontSize: 32 },
  cardLabel: { fontWeight: 600, fontSize: '0.9375rem' },
  cardDesc: { fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 2 },
  pendingBanner: {
    background: '#fff7ed',
    border: '1.5px solid #fb923c',
    borderRadius: 'var(--radius-md)',
    padding: '14px 20px',
    fontSize: '0.875rem',
    color: '#9a3412',
    fontWeight: 500,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 16,
  },
  statCard: {
    background: 'var(--color-surface)',
    borderRadius: 'var(--radius-md)',
    padding: '20px 16px',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 6,
    textAlign: 'center' as const,
  },
  statEmoji: { fontSize: 28 },
  statValue: { fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 },
  statLabel: { fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0, fontWeight: 500 },
  accountSection: {},
  infoCard: {
    background: 'var(--color-surface)',
    borderRadius: 'var(--radius-md)',
    padding: '0 24px',
    boxShadow: 'var(--shadow-sm)',
  },
};
