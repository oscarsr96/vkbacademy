import { useMyCertificates } from '../hooks/useCertificates';
import { downloadCertificatePdf } from '../utils/certificatePdf';
import type { Certificate, CertificateType } from '@vkbacademy/shared';

const TYPE_LABELS: Record<CertificateType, { label: string; icon: string }> = {
  MODULE_COMPLETION: { label: 'Módulo completado', icon: '📜' },
  COURSE_COMPLETION: { label: 'Curso completado', icon: '🏆' },
  MODULE_EXAM:       { label: 'Examen de módulo', icon: '📝' },
  COURSE_EXAM:       { label: 'Examen de curso', icon: '🎓' },
};

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '2rem', maxWidth: 800, margin: '0 auto' },
  heading: { fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.5rem' },
  sub: { color: 'var(--color-text-muted)', marginBottom: '2rem', fontSize: '0.9rem' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' },
  card: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 12,
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  cardHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 },
  icon: { fontSize: '1.5rem' },
  typeBadge: {
    fontSize: '0.75rem',
    fontWeight: 600,
    padding: '2px 10px',
    borderRadius: 999,
    background: 'var(--color-primary)',
    color: '#fff',
  },
  scopeTitle: { fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)' },
  courseTitle: { fontSize: '0.8rem', color: 'var(--color-text-muted)' },
  score: { fontWeight: 700, color: 'var(--color-primary)', fontSize: '1rem' },
  meta: { fontSize: '0.8rem', color: 'var(--color-text-muted)' },
  verifyCode: {
    fontFamily: 'monospace',
    fontSize: '0.7rem',
    color: 'var(--color-text-muted)',
    background: 'var(--color-border)',
    padding: '2px 6px',
    borderRadius: 4,
    wordBreak: 'break-all' as const,
  },
  downloadBtn: {
    marginTop: 4,
    padding: '0.5rem 1rem',
    borderRadius: 8,
    border: '1px solid var(--color-primary)',
    background: 'none',
    cursor: 'pointer',
    color: 'var(--color-primary)',
    fontWeight: 600,
    fontSize: '0.875rem',
    alignSelf: 'flex-start',
  },
  empty: {
    textAlign: 'center' as const,
    color: 'var(--color-text-muted)',
    padding: '3rem',
    background: 'var(--color-surface)',
    borderRadius: 12,
    border: '1px solid var(--color-border)',
  },
};

function CertificateCard({ cert }: { cert: Certificate }) {
  const meta = TYPE_LABELS[cert.type];
  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <span style={styles.icon}>{meta.icon}</span>
        <span style={styles.typeBadge}>{meta.label}</span>
      </div>
      <div style={styles.scopeTitle}>{cert.scopeTitle}</div>
      {cert.courseTitle && (
        <div style={styles.courseTitle}>📚 {cert.courseTitle}</div>
      )}
      {cert.examScore !== null && cert.examScore !== undefined && (
        <div style={styles.score}>Puntuación: {cert.examScore.toFixed(1)}%</div>
      )}
      <div style={styles.meta}>
        Emitido el{' '}
        {new Date(cert.issuedAt).toLocaleDateString('es-ES', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
      </div>
      <div style={styles.verifyCode}>🔑 {cert.verifyCode}</div>
      <button style={styles.downloadBtn} onClick={() => downloadCertificatePdf(cert)}>
        ⬇️ Descargar PDF
      </button>
    </div>
  );
}

export default function CertificatesPage() {
  const { data: certs, isLoading, isError } = useMyCertificates();

  if (isLoading) {
    return (
      <div style={styles.page}>
        <h1 style={styles.heading}>📜 Mis Certificados</h1>
        <div style={{ color: 'var(--color-text-muted)' }}>Cargando certificados...</div>
      </div>
    );
  }

  if (isError) {
    return (
      <div style={styles.page}>
        <h1 style={styles.heading}>📜 Mis Certificados</h1>
        <div style={{ color: 'var(--color-error)' }}>Error al cargar los certificados.</div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.heading}>📜 Mis Certificados</h1>
      <p style={styles.sub}>
        Aquí están todos tus certificados digitales. Puedes descargarlos como PDF o verificarlos con el código único.
      </p>

      {!certs || certs.length === 0 ? (
        <div style={styles.empty}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🏅</div>
          <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Aún no tienes certificados</div>
          <div style={{ fontSize: '0.875rem' }}>
            Completa módulos o cursos y aprueba exámenes para obtener tus certificados.
          </div>
        </div>
      ) : (
        <div style={styles.grid}>
          {certs.map((cert) => (
            <CertificateCard key={cert.id} cert={cert} />
          ))}
        </div>
      )}
    </div>
  );
}
