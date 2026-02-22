import { useMyCertificates } from '../hooks/useCertificates';
import { downloadCertificatePdf } from '../utils/certificatePdf';
import type { Certificate, CertificateType } from '@vkbacademy/shared';

// ─── Metadatos por tipo ───────────────────────────────────────────────────────

const TYPE_LABELS: Record<CertificateType, { label: string; icon: string; badgeBg: string; badgeColor: string }> = {
  MODULE_COMPLETION: {
    label: 'Módulo completado',
    icon: '📜',
    badgeBg: 'rgba(99,102,241,0.12)',
    badgeColor: '#6366f1',
  },
  COURSE_COMPLETION: {
    label: 'Curso completado',
    icon: '🏆',
    badgeBg: 'rgba(234,88,12,0.12)',
    badgeColor: '#ea580c',
  },
  MODULE_EXAM: {
    label: 'Examen de módulo',
    icon: '📝',
    badgeBg: 'rgba(59,130,246,0.12)',
    badgeColor: '#3b82f6',
  },
  COURSE_EXAM: {
    label: 'Examen de curso',
    icon: '🎓',
    badgeBg: 'rgba(16,185,129,0.12)',
    badgeColor: '#10b981',
  },
};

// ─── Tarjeta de certificado ───────────────────────────────────────────────────

function CertificateCard({ cert }: { cert: Certificate }) {
  const meta = TYPE_LABELS[cert.type];

  return (
    <div
      className="animate-in"
      style={{
        background: 'rgba(255,252,235,0.92)',
        border: '1.5px solid rgba(245,158,11,0.35)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 12,
        boxShadow: '0 4px 20px rgba(245,158,11,0.12)',
        transition: 'box-shadow 0.25s, transform 0.25s',
        position: 'relative' as const,
        overflow: 'hidden',
      }}
    >
      {/* Franja decorativa superior dorada */}
      <div
        style={{
          position: 'absolute' as const,
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 50%, #f59e0b 100%)',
          borderRadius: '18px 18px 0 0',
        }}
      />

      {/* Cabecera: icono + badge de tipo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
        <span style={{ fontSize: '1.75rem', lineHeight: 1 }}>{meta.icon}</span>
        <span
          style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            padding: '3px 10px',
            borderRadius: 999,
            background: meta.badgeBg,
            color: meta.badgeColor,
            border: `1px solid ${meta.badgeColor}33`,
            letterSpacing: '0.04em',
            textTransform: 'uppercase' as const,
          }}
        >
          {meta.label}
        </span>
      </div>

      {/* Título del scope */}
      <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#1a1a2e', lineHeight: 1.3 }}>
        {cert.scopeTitle}
      </div>

      {/* Curso padre (si es módulo) */}
      {cert.courseTitle && (
        <div style={{ fontSize: '0.82rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: 5 }}>
          <span>📚</span>
          <span>{cert.courseTitle}</span>
        </div>
      )}

      {/* Puntuación del examen */}
      {cert.examScore !== null && cert.examScore !== undefined && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(16,163,74,0.10)',
            border: '1px solid rgba(16,163,74,0.25)',
            borderRadius: 8,
            padding: '5px 12px',
            width: 'fit-content',
          }}
        >
          <span style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 500 }}>Puntuación</span>
          <span style={{ fontWeight: 800, color: '#16a34a', fontSize: '1rem' }}>
            {cert.examScore.toFixed(1)}%
          </span>
        </div>
      )}

      {/* Fecha de emisión */}
      <div style={{ fontSize: '0.8rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: 5 }}>
        <span>📅</span>
        <span>
          Emitido el{' '}
          {new Date(cert.issuedAt).toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </span>
      </div>

      {/* Código de verificación */}
      <div
        style={{
          background: 'rgba(245,158,11,0.06)',
          border: '1px solid rgba(245,158,11,0.20)',
          borderRadius: 6,
          padding: '6px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span style={{ fontSize: '0.7rem', color: '#92400e', fontWeight: 600 }}>Código:</span>
        <code
          style={{
            fontFamily: 'monospace',
            fontSize: '0.68rem',
            color: '#78350f',
            wordBreak: 'break-all' as const,
            flex: 1,
          }}
        >
          {cert.verifyCode}
        </code>
      </div>

      {/* Botón de descarga */}
      <button
        className="btn btn-primary"
        style={{ alignSelf: 'flex-start', padding: '9px 18px', fontSize: '0.85rem', marginTop: 4 }}
        onClick={() => downloadCertificatePdf(cert)}
      >
        Descargar PDF
      </button>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function CertificatesPage() {
  const { data: certs, isLoading, isError } = useMyCertificates();

  if (isLoading) {
    return (
      <div style={{ maxWidth: 840, margin: '0 auto' }}>
        <div className="page-hero animate-in">
          <h1 className="hero-title">Mis Certificados</h1>
          <p className="hero-subtitle">Cargando certificados...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div style={{ maxWidth: 840, margin: '0 auto' }}>
        <div className="page-hero animate-in">
          <h1 className="hero-title">Mis Certificados</h1>
          <p style={{ color: 'rgba(252,165,165,0.9)', marginTop: 8 }}>Error al cargar los certificados.</p>
        </div>
      </div>
    );
  }

  const total = certs?.length ?? 0;

  return (
    <div style={{ maxWidth: 840, margin: '0 auto' }}>

      {/* Hero */}
      <div className="page-hero animate-in">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
          <span style={{ fontSize: '2.5rem' }}>📜</span>
          {total > 0 && (
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
                {total}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                {total === 1 ? 'certificado' : 'certificados'}
              </span>
            </div>
          )}
        </div>
        <h1 className="hero-title">Mis Certificados</h1>
        <p className="hero-subtitle">
          Descarga tus diplomas digitales o verifica su autenticidad con el código único.
        </p>
      </div>

      {/* Estado vacío */}
      {(!certs || certs.length === 0) && (
        <div
          style={{
            textAlign: 'center' as const,
            padding: '56px 24px',
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-xl)',
            border: '1.5px solid rgba(245,158,11,0.20)',
            boxShadow: '0 4px 20px rgba(245,158,11,0.06)',
          }}
        >
          <div style={{ fontSize: '4rem', marginBottom: 16 }}>📜</div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--color-text)', marginBottom: 8 }}>
            Aun no tienes certificados
          </div>
          <div style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', maxWidth: 400, margin: '0 auto', lineHeight: 1.6 }}>
            Completa modulos o cursos enteros y aprueba examenes para obtener tus primeros diplomas.
          </div>
        </div>
      )}

      {/* Grid de certificados */}
      {certs && certs.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '18px',
          }}
        >
          {certs.map((cert) => (
            <CertificateCard key={cert.id} cert={cert} />
          ))}
        </div>
      )}
    </div>
  );
}
