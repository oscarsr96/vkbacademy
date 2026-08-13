import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { Role } from '@vkbacademy/shared';
import { useChallengeSummary, useMyChallenges } from '../hooks/useChallenges';
import { useRecentLessons } from '../hooks/useCourses';
import { useMyCertificates } from '../hooks/useCertificates';
import { usePageZone } from '../hooks/usePageZone';
import Icon from '../components/ui/Icon';
import StatTile from '../components/ui/StatTile';
import ProgressBar from '../components/ui/ProgressBar';

const ROLE_LABELS: Record<string, string> = {
  [Role.STUDENT]: 'Estudiante',
  [Role.ADMIN]: 'Administrador',
};

const ROLE_DESCRIPTION: Record<string, string> = {
  [Role.STUDENT]: 'Practica con teoría y ejercicios bajo demanda.',
  [Role.ADMIN]: 'Administra usuarios, cursos y visualiza las métricas globales de la plataforma.',
};

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const isStudent = user?.role === Role.STUDENT;
  const { data: summary } = useChallengeSummary();
  usePageZone('dark');

  if (!user) return null;

  const quickActions =
    user.role === Role.STUDENT
      ? [
          {
            icon: 'brain',
            label: 'Estudiar',
            desc: 'Crea un curso con teoría, ejercicios y examen',
            to: '/study',
          },
          {
            icon: 'trophy',
            label: 'Retos',
            desc: 'Suma puntos y canjéalos por premios',
            to: '/challenges',
          },
        ]
      : [
          { icon: 'book', label: 'Cursos', desc: 'Gestiona todos los cursos', to: '/courses' },
          { icon: 'users', label: 'Usuarios', desc: 'Gestiona roles y accesos', to: '/admin' },
          { icon: 'chart', label: 'Métricas', desc: 'Estadísticas de la plataforma', to: '/admin' },
        ];

  const mainContent = (
    <>
      {/* Banner de cuenta pendiente — solo STUDENT sin nivel asignado */}
      {isStudent && !user.schoolYearId && (
        <div style={S.pendingBanner}>
          Tu cuenta está pendiente de configuración. Un administrador asignará tu nivel en breve.
        </div>
      )}

      {/* Hero de estadio con saludo */}
      <div className="page-hero court-lines sweep-light animate-in">
        <div style={S.heroInner}>
          <div style={S.avatar}>{user.name.charAt(0).toUpperCase()}</div>
          <div style={S.heroText}>
            <h1 className="hero-title">¡Hola, {user.name.split(' ')[0]}!</h1>
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

      {/* Marcador de gamificación — solo para STUDENT */}
      {isStudent && (
        <div style={S.statsGrid}>
          <StatTile
            icon="trophy"
            value={summary?.totalPoints ?? 0}
            label="Puntos totales"
            suffix="pts"
          />
          <StatTile
            icon="flame"
            value={summary?.currentStreak ?? 0}
            label="Racha (semanas)"
            pulse={(summary?.currentStreak ?? 0) > 0}
            delay={80}
          />
        </div>
      )}

      {/* Accesos rápidos */}
      <section>
        <h2 className="section-label" style={S.sectionTitle}>
          Accesos rápidos
        </h2>
        <div style={S.grid}>
          {quickActions.map(({ icon, label, desc, to }, i) => (
            <div
              key={label}
              className="vkb-card"
              style={{ ...S.quickCard, animationDelay: `${i * 70}ms` }}
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
              <span style={S.cardIcon}>
                <Icon name={icon} size={24} />
              </span>
              <p style={S.cardLabel}>{label}</p>
              <p style={S.cardDesc}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tu cuenta */}
      <section>
        <h2 className="section-label" style={S.sectionTitle}>
          Tu cuenta
        </h2>
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

  // El alumno tiene rail lateral en desktop; el resto de roles ocupa una sola columna
  if (isStudent) {
    return (
      <div className="dash-grid">
        {/* dentro del grid, el ancho lo gobierna la columna, no el maxWidth */}
        <div style={{ ...S.page, maxWidth: 'none' }}>{mainContent}</div>
        <StudentRail onNavigate={navigate} />
      </div>
    );
  }

  return <div style={S.page}>{mainContent}</div>;
}

// ─── Rail lateral del alumno: continuar, retos en marcha, trofeos ──────────────

function StudentRail({ onNavigate }: { onNavigate: (to: string) => void }) {
  const { data: recentLessons } = useRecentLessons();
  const { data: challengesData } = useMyChallenges();
  const { data: certs } = useMyCertificates();

  // Continuar donde lo dejaste: primera lección reciente sin completar
  const nextLesson = (recentLessons ?? []).find((l) => l.completedAt === null) ?? null;

  // Retos en marcha: los 3 más cerca de completarse
  const activeChallenges = (challengesData?.challenges ?? [])
    .filter((c) => !c.completed && c.target > 0)
    .sort((a, b) => b.progress / b.target - a.progress / a.target)
    .slice(0, 3);

  // Últimos trofeos
  const latestCerts = (certs ?? [])
    .slice()
    .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime())
    .slice(0, 2);

  const isEmpty = !nextLesson && activeChallenges.length === 0 && latestCerts.length === 0;

  return (
    <aside style={S.rail}>
      {nextLesson && (
        <RailCard icon="play" label="Continúa donde lo dejaste" delay={100}>
          <p style={S.railCourse}>{nextLesson.courseTitle}</p>
          <p style={S.railTitle}>{nextLesson.lessonTitle}</p>
          <p style={S.railMeta}>{nextLesson.moduleTitle}</p>
          <button
            className="btn btn-primary btn-full"
            style={{ marginTop: 12, padding: '9px 16px', fontSize: '0.85rem' }}
            onClick={() =>
              onNavigate(`/courses/${nextLesson.courseId}/lessons/${nextLesson.lessonId}`)
            }
          >
            <Icon name="play" size={14} />
            Seguir entrenando
          </button>
        </RailCard>
      )}

      {activeChallenges.length > 0 && (
        <RailCard icon="target" label="Retos en marcha" delay={180}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {activeChallenges.map((c) => (
              <div key={c.id}>
                <div style={S.railChallengeRow}>
                  <span style={S.railChallengeTitle}>{c.title}</span>
                  <span style={S.railChallengeCount}>
                    {c.progress}/{c.target}
                  </span>
                </div>
                <ProgressBar
                  value={c.progress}
                  max={c.target}
                  variant="amber"
                  height={6}
                  label={`Progreso del reto ${c.title}`}
                />
              </div>
            ))}
          </div>
          <button
            className="btn btn-dark btn-full"
            style={S.railGhostBtn}
            onClick={() => onNavigate('/challenges')}
          >
            Ver todos los retos
          </button>
        </RailCard>
      )}

      {latestCerts.length > 0 && (
        <RailCard icon="trophy" label="Últimos trofeos" delay={340}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {latestCerts.map((cert) => (
              <div key={cert.id} style={S.railTrophyRow}>
                <span style={S.railTrophyIcon}>
                  <Icon name="award" size={16} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <p style={S.railChallengeTitle}>{cert.scopeTitle}</p>
                  <p style={S.railMeta}>
                    {new Date(cert.issuedAt).toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <button
            className="btn btn-dark btn-full"
            style={S.railGhostBtn}
            onClick={() => onNavigate('/certificates')}
          >
            Sala de trofeos
          </button>
        </RailCard>
      )}

      {isEmpty && (
        <RailCard icon="basketball" label="Tu primera canasta" delay={100}>
          <p style={S.railTitle}>Empieza a entrenar</p>
          <p style={S.railMeta}>
            Completa tu primera lección para sumar puntos, encender la racha y desbloquear retos.
          </p>
          <button
            className="btn btn-primary btn-full"
            style={{ marginTop: 12, padding: '9px 16px', fontSize: '0.85rem' }}
            onClick={() => onNavigate('/subjects')}
          >
            Elegir asignatura
          </button>
        </RailCard>
      )}
    </aside>
  );
}

function RailCard({
  icon,
  label,
  delay = 0,
  children,
}: {
  icon: string;
  label: string;
  delay?: number;
  children: React.ReactNode;
}) {
  return (
    <section
      className="panel-glass"
      style={{
        padding: '18px 20px',
        animation: `riseIn 0.5s cubic-bezier(0.18, 0.72, 0.24, 1.12) ${delay}ms both`,
      }}
    >
      <h3 style={S.railLabel}>
        <span style={S.railLabelIcon}>
          <Icon name={icon} size={14} />
        </span>
        {label}
      </h3>
      {children}
    </section>
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
    color: 'var(--brand-contrast)',
    fontWeight: 800,
    fontSize: '1.6rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    letterSpacing: '-0.02em',
  },
  heroText: { flex: 1, position: 'relative', zIndex: 1 },

  // Pending banner
  pendingBanner: {
    background: 'var(--brand-soft)',
    border: '1.5px solid var(--brand-glow)',
    borderRadius: 'var(--radius-md)',
    padding: '14px 20px',
    fontSize: '0.875rem',
    color: 'var(--brand-light)',
    fontWeight: 500,
  },

  // Marcador
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 16,
  },

  // Section
  sectionTitle: { marginBottom: 14 },

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
    animation: 'riseIn 0.5s cubic-bezier(0.18, 0.72, 0.24, 1.12) both',
  },
  cardIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 52,
    height: 52,
    borderRadius: 14,
    background: 'var(--brand-soft)',
    color: 'var(--brand-light)',
    marginBottom: 4,
  },
  cardLabel: { fontWeight: 700, fontSize: '0.9375rem', color: 'var(--color-text)', margin: 0 },
  cardDesc: { fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: 0 },

  // Rail lateral del alumno
  rail: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 18,
    position: 'sticky' as const,
    top: 0,
  },
  railLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    margin: '0 0 12px',
    fontSize: '0.72rem',
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    color: 'var(--color-text-muted)',
  },
  railLabelIcon: {
    display: 'inline-flex',
    color: 'var(--brand-light)',
  },
  railCourse: {
    margin: 0,
    fontSize: '0.72rem',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    color: 'var(--brand-light)',
  },
  railTitle: {
    margin: '4px 0 0',
    fontWeight: 700,
    fontSize: '0.95rem',
    color: 'var(--color-text)',
    lineHeight: 1.3,
  },
  railMeta: {
    margin: '3px 0 0',
    fontSize: '0.8rem',
    color: 'var(--color-text-muted)',
  },
  railChallengeRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 6,
  },
  railChallengeTitle: {
    margin: 0,
    fontSize: '0.85rem',
    fontWeight: 600,
    color: 'var(--color-text)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  railChallengeCount: {
    fontSize: '0.75rem',
    fontWeight: 700,
    color: 'var(--amber-led)',
    fontVariantNumeric: 'tabular-nums',
    flexShrink: 0,
  },
  railGhostBtn: {
    marginTop: 14,
    padding: '8px 14px',
    fontSize: '0.8rem',
  },
  railTrophyRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  railTrophyIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderRadius: 9,
    background: 'rgba(255, 210, 77, 0.12)',
    color: 'var(--amber-led)',
    flexShrink: 0,
  },
};
