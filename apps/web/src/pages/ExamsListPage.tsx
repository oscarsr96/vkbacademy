import { useNavigate } from 'react-router-dom';
import { useAvailableExams } from '../hooks/useExams';

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '2rem', maxWidth: 800, margin: '0 auto' },
  heading: { fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.25rem' },
  subheading: { color: 'var(--color-text-muted)', marginBottom: '2rem', fontSize: '0.95rem' },
  sectionTitle: { fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.75rem', marginTop: '2rem' },
  card: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
    borderRadius: 10, padding: '1rem 1.25rem', marginBottom: '0.75rem',
    gap: 16,
  },
  cardInfo: { flex: 1, minWidth: 0 },
  cardTitle: { fontWeight: 600, color: 'var(--color-text)', marginBottom: '0.2rem', fontSize: '0.95rem' },
  cardMeta: { fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'flex', gap: 12, flexWrap: 'wrap' as const },
  badge: {
    display: 'inline-block', padding: '1px 8px', borderRadius: 999,
    background: 'var(--color-border)', fontSize: '0.75rem', fontWeight: 600,
    color: 'var(--color-text-muted)',
  },
  btn: {
    padding: '0.45rem 1rem', borderRadius: 8, border: 'none', cursor: 'pointer',
    background: 'var(--color-primary)', color: '#fff', fontWeight: 600,
    fontSize: '0.875rem', whiteSpace: 'nowrap' as const, flexShrink: 0,
  },
  empty: {
    textAlign: 'center' as const, padding: '3rem 1rem',
    color: 'var(--color-text-muted)', fontSize: '0.95rem',
  },
  skeleton: { background: 'var(--color-border)', borderRadius: 10, height: 72, marginBottom: 12 },
};

function scoreBadgeStyle(score: number): React.CSSProperties {
  return {
    display: 'inline-block', padding: '1px 8px', borderRadius: 999,
    background: score >= 50 ? 'rgba(99,102,241,0.15)' : 'rgba(239,68,68,0.12)',
    fontSize: '0.75rem', fontWeight: 700,
    color: score >= 50 ? 'var(--color-primary)' : 'var(--color-error)',
  };
}

export default function ExamsListPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useAvailableExams();

  const hasCourses = (data?.courses?.length ?? 0) > 0;
  const hasModules = (data?.modules?.length ?? 0) > 0;
  const isEmpty = !hasCourses && !hasModules;

  return (
    <div style={styles.page}>
      <h1 style={styles.heading}>🎓 Exámenes</h1>
      <p style={styles.subheading}>Pon a prueba tus conocimientos con los exámenes disponibles.</p>

      {isLoading && (
        <>
          {[1, 2, 3].map((i) => <div key={i} style={styles.skeleton} />)}
        </>
      )}

      {!isLoading && isEmpty && (
        <div style={styles.empty}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📭</div>
          <div>No hay exámenes disponibles todavía.</div>
          <div style={{ marginTop: '0.4rem', fontSize: '0.85rem' }}>
            Cuando el administrador añada preguntas a un banco, aparecerán aquí.
          </div>
        </div>
      )}

      {!isLoading && hasCourses && (
        <>
          <div style={styles.sectionTitle}>Por curso</div>
          {data!.courses.map((c) => (
            <div key={c.courseId} style={styles.card}>
              <div style={styles.cardInfo}>
                <div style={styles.cardTitle}>{c.title}</div>
                <div style={styles.cardMeta}>
                  {c.schoolYear && <span style={styles.badge}>{c.schoolYear}</span>}
                  <span>{c.questionCount} preguntas disponibles</span>
                  {c.lastAttempt && (
                    <span style={scoreBadgeStyle(c.lastAttempt.score)}>
                      Último: {c.lastAttempt.score.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
              <button
                style={styles.btn}
                onClick={() => navigate(`/exam?courseId=${c.courseId}`)}
              >
                {c.lastAttempt ? 'Repetir' : 'Empezar'}
              </button>
            </div>
          ))}
        </>
      )}

      {!isLoading && hasModules && (
        <>
          <div style={styles.sectionTitle}>Por módulo</div>
          {data!.modules.map((m) => (
            <div key={m.moduleId} style={styles.card}>
              <div style={styles.cardInfo}>
                <div style={styles.cardTitle}>{m.title}</div>
                <div style={styles.cardMeta}>
                  <span style={styles.badge}>{m.courseTitle}</span>
                  <span>{m.questionCount} preguntas disponibles</span>
                  {m.lastAttempt && (
                    <span style={scoreBadgeStyle(m.lastAttempt.score)}>
                      Último: {m.lastAttempt.score.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
              <button
                style={styles.btn}
                onClick={() => navigate(`/exam?moduleId=${m.moduleId}`)}
              >
                {m.lastAttempt ? 'Repetir' : 'Empezar'}
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
