import { useMyCertificates } from '../hooks/useCertificates';
import { downloadCertificatePdf } from '../utils/certificatePdf';
import { usePageZone } from '../hooks/usePageZone';
import Icon from '../components/ui/Icon';
import ScoreValue from '../components/ui/ScoreValue';
import EmptyState from '../components/ui/EmptyState';
import type { Certificate, CertificateType } from '@vkbacademy/shared';

// ─── Metadatos por tipo ───────────────────────────────────────────────────────

const TYPE_LABELS: Record<
  CertificateType,
  { label: string; icon: string; badgeBg: string; badgeColor: string }
> = {
  MODULE_COMPLETION: {
    label: 'Módulo completado',
    icon: 'award',
    badgeBg: 'rgba(99,102,241,0.12)',
    badgeColor: '#6366f1',
  },
  COURSE_COMPLETION: {
    label: 'Curso completado',
    icon: 'trophy',
    badgeBg: 'rgba(245,145,30,0.12)',
    badgeColor: '#e07b06',
  },
  MODULE_EXAM: {
    label: 'Examen de módulo',
    icon: 'check',
    badgeBg: 'rgba(59,130,246,0.12)',
    badgeColor: '#3b82f6',
  },
  COURSE_EXAM: {
    label: 'Examen de curso',
    icon: 'graduation',
    badgeBg: 'rgba(16,185,129,0.12)',
    badgeColor: '#10b981',
  },
};

// ─── Tarjeta de certificado (diploma sobre la sala oscura) ────────────────────

function CertificateCard({ cert, index }: { cert: Certificate; index: number }) {
  const meta = TYPE_LABELS[cert.type];

  return (
    <div
      style={{
        background: 'rgba(255,252,235,0.96)',
        border: '1.5px solid rgba(245,158,11,0.4)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 12,
        boxShadow: '0 8px 32px rgba(255, 210, 77, 0.12), 0 4px 20px rgba(0,0,0,0.3)',
        transition: 'box-shadow 0.25s, transform 0.25s',
        position: 'relative' as const,
        overflow: 'hidden',
        animation: `riseIn 0.5s cubic-bezier(0.18, 0.72, 0.24, 1.12) ${index * 60}ms both`,
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
        <span style={{ color: meta.badgeColor, display: 'inline-flex' }}>
          <Icon name={meta.icon} size={26} />
        </span>
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
        <div
          style={{
            fontSize: '0.82rem',
            color: '#6b7280',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Icon name="book" size={14} />
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
      <div
        style={{
          fontSize: '0.8rem',
          color: '#6b7280',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <Icon name="calendar" size={14} />
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
        <Icon name="download" size={15} />
        Descargar PDF
      </button>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function CertificatesPage() {
  const { data: certs, isLoading, isError } = useMyCertificates();
  usePageZone('dark');

  if (isLoading) {
    return (
      <div style={{ maxWidth: 840, margin: '0 auto' }}>
        <div className="page-hero court-lines sweep-light animate-in">
          <h1 className="hero-title">Mis Certificados</h1>
          <p className="hero-subtitle">Cargando certificados...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div style={{ maxWidth: 840, margin: '0 auto' }}>
        <div className="page-hero court-lines sweep-light animate-in">
          <h1 className="hero-title">Mis Certificados</h1>
          <p style={{ color: 'rgba(252,165,165,0.9)', marginTop: 8 }}>
            Error al cargar los certificados.
          </p>
        </div>
      </div>
    );
  }

  const total = certs?.length ?? 0;

  return (
    <div style={{ maxWidth: 840, margin: '0 auto' }}>
      {/* Hero — sala de trofeos */}
      <div className="page-hero court-lines sweep-light animate-in">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
          <span style={{ color: 'var(--amber-led)', display: 'inline-flex' }}>
            <Icon name="trophy" size={38} strokeWidth={1.6} />
          </span>
          {total > 0 && (
            <div
              className="panel-glass"
              style={{
                padding: '8px 18px',
                display: 'inline-flex',
                gap: 8,
                alignItems: 'baseline',
                border: '1px solid rgba(255, 210, 77, 0.25)',
              }}
            >
              <ScoreValue value={total} size="1.5rem" />
              <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>
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
        <div className="panel-glass">
          <EmptyState
            icon="trophy"
            title="Aún no tienes certificados"
            message="Completa módulos o cursos enteros y aprueba exámenes para obtener tus primeros diplomas."
          />
        </div>
      )}

      {/* Certificados agrupados por curso */}
      {certs && certs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 28 }}>
          {groupCertificatesByCourse(certs).map((group) => (
            <CourseGroup key={group.key} title={group.title} count={group.certs.length}>
              {group.certs.map((cert, i) => (
                <CertificateCard key={cert.id} cert={cert} index={i} />
              ))}
            </CourseGroup>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Agrupador por curso ──────────────────────────────────────────────────────

interface CertificateGroup {
  key: string;
  title: string;
  certs: Certificate[];
}

function groupCertificatesByCourse(certs: Certificate[]): CertificateGroup[] {
  const groups = new Map<string, CertificateGroup>();

  for (const cert of certs) {
    // Para módulos, courseTitle es el padre; para curso, scopeTitle ES el curso.
    const isCourseScope = cert.type === 'COURSE_COMPLETION' || cert.type === 'COURSE_EXAM';
    const title = isCourseScope ? cert.scopeTitle : (cert.courseTitle ?? cert.scopeTitle);
    const key = cert.courseId ?? title;

    let group = groups.get(key);
    if (!group) {
      group = { key, title, certs: [] };
      groups.set(key, group);
    }
    group.certs.push(cert);
  }

  return Array.from(groups.values());
}

function CourseGroup({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 14,
        }}
      >
        <span style={{ color: 'var(--brand-light)', display: 'inline-flex' }}>
          <Icon name="book" size={18} />
        </span>
        <h2
          style={{
            margin: 0,
            fontSize: '1.05rem',
            fontWeight: 800,
            color: 'var(--color-text)',
          }}
        >
          {title}
        </h2>
        <span
          style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            padding: '2px 10px',
            borderRadius: 999,
            background: 'var(--brand-soft)',
            color: 'var(--brand-light)',
            border: '1px solid var(--brand-soft)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase' as const,
          }}
        >
          {count} {count === 1 ? 'certificado' : 'certificados'}
        </span>
        <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
      </header>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: '18px',
        }}
      >
        {children}
      </div>
    </section>
  );
}
