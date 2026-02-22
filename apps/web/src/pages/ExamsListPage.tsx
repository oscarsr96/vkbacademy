import { useNavigate } from 'react-router-dom';
import { useAvailableExams } from '../hooks/useExams';

// ─── Helper: color de score ───────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 70) return '#16a34a';
  if (score >= 50) return '#ea580c';
  return '#dc2626';
}

function scoreBg(score: number): string {
  if (score >= 70) return 'rgba(22,163,74,0.10)';
  if (score >= 50) return 'rgba(234,88,12,0.10)';
  return 'rgba(220,38,38,0.10)';
}

function scoreBorder(score: number): string {
  if (score >= 70) return 'rgba(22,163,74,0.25)';
  if (score >= 50) return 'rgba(234,88,12,0.25)';
  return 'rgba(220,38,38,0.25)';
}

// ─── Skeleton de carga ────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1.5px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px 24px',
        height: 96,
        animation: 'pulse-glow 1.5s ease-in-out infinite',
      }}
    />
  );
}

// ─── Card de examen ───────────────────────────────────────────────────────────

interface ExamCardProps {
  title: string;
  badge?: string;
  questionCount: number;
  lastAttempt?: { score: number; submittedAt?: string } | null;
  onStart: () => void;
}

function ExamCard({ title, badge, questionCount, lastAttempt, onStart }: ExamCardProps) {
  return (
    <div
      className="vkb-card animate-in"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '20px 24px',
        flexWrap: 'wrap' as const,
      }}
    >
      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Título */}
        <div style={{ fontWeight: 700, color: 'var(--color-text)', marginBottom: 8, fontSize: '1rem' }}>
          {title}
        </div>

        {/* Metadatos */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
          {badge && (
            <span
              style={{
                display: 'inline-block',
                padding: '2px 10px',
                borderRadius: 999,
                background: 'rgba(234,88,12,0.10)',
                color: 'var(--color-primary)',
                fontSize: '0.72rem',
                fontWeight: 700,
                border: '1px solid rgba(234,88,12,0.20)',
              }}
            >
              {badge}
            </span>
          )}

          <span
            style={{
              fontSize: '0.8rem',
              color: 'var(--color-text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span>📋</span>
            <span>{questionCount} preguntas</span>
          </span>

          {lastAttempt && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 10px',
                borderRadius: 999,
                background: scoreBg(lastAttempt.score),
                color: scoreColor(lastAttempt.score),
                fontSize: '0.75rem',
                fontWeight: 700,
                border: `1px solid ${scoreBorder(lastAttempt.score)}`,
              }}
            >
              Ultimo: {lastAttempt.score.toFixed(1)}%
            </span>
          )}
        </div>
      </div>

      {/* Boton */}
      <button
        className="btn btn-primary"
        style={{ padding: '9px 20px', fontSize: '0.875rem', flexShrink: 0 }}
        onClick={onStart}
      >
        {lastAttempt ? 'Repetir' : 'Empezar'}
      </button>
    </div>
  );
}

// ─── Separador de sección ─────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 14,
        marginTop: 28,
      }}
    >
      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)' }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ExamsListPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useAvailableExams();

  const hasCourses = (data?.courses?.length ?? 0) > 0;
  const hasModules = (data?.modules?.length ?? 0) > 0;
  const isEmpty = !hasCourses && !hasModules;

  const totalBanks = (data?.courses?.length ?? 0) + (data?.modules?.length ?? 0);

  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>

      {/* Hero */}
      <div className="page-hero animate-in">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
          <span style={{ fontSize: '2.4rem' }}>🎓</span>
          {!isLoading && totalBanks > 0 && (
            <div className="stat-card" style={{ padding: '8px 18px', display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <span
                style={{
                  fontSize: '1.4rem',
                  fontWeight: 900,
                  background: 'var(--gradient-orange)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                {totalBanks}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                {totalBanks === 1 ? 'banco disponible' : 'bancos disponibles'}
              </span>
            </div>
          )}
        </div>
        <h1 className="hero-title">Examenes Disponibles</h1>
        <p className="hero-subtitle">
          Pon a prueba tus conocimientos. Configura el numero de preguntas y el tiempo limite.
        </p>
      </div>

      {/* Skeletons de carga */}
      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 14 }}>
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Estado vacío */}
      {!isLoading && isEmpty && (
        <div
          style={{
            textAlign: 'center' as const,
            padding: '56px 24px',
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-xl)',
            border: '1.5px solid var(--color-border)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div style={{ fontSize: '4rem', marginBottom: 16 }}>📭</div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--color-text)', marginBottom: 8 }}>
            No hay examenes disponibles
          </div>
          <div style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', maxWidth: 380, margin: '0 auto', lineHeight: 1.6 }}>
            Cuando el administrador anada preguntas a un banco, aparecera aqui.
          </div>
        </div>
      )}

      {/* Examenes por curso */}
      {!isLoading && hasCourses && (
        <>
          <SectionLabel label="Por curso" />
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 14 }}>
            {data!.courses.map((c) => (
              <ExamCard
                key={c.courseId}
                title={c.title}
                badge={c.schoolYear ?? undefined}
                questionCount={c.questionCount}
                lastAttempt={c.lastAttempt ?? null}
                onStart={() => navigate(`/exam?courseId=${c.courseId}`)}
              />
            ))}
          </div>
        </>
      )}

      {/* Examenes por modulo */}
      {!isLoading && hasModules && (
        <>
          <SectionLabel label="Por modulo" />
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 14 }}>
            {data!.modules.map((m) => (
              <ExamCard
                key={m.moduleId}
                title={m.title}
                badge={m.courseTitle}
                questionCount={m.questionCount}
                lastAttempt={m.lastAttempt ?? null}
                onStart={() => navigate(`/exam?moduleId=${m.moduleId}`)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
