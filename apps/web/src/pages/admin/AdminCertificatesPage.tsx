import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi, type AdminCertificate, type AdminCertificateType } from '../../api/admin.api';

const TYPE_LABELS: Record<AdminCertificateType, string> = {
  MODULE_COMPLETION: 'Módulo completado',
  COURSE_COMPLETION: 'Curso completado',
  MODULE_EXAM: 'Examen de módulo',
  COURSE_EXAM: 'Examen de curso',
  STUDY_EXAM: 'Curso de estudio (IA)',
};

const TYPE_COLORS: Record<AdminCertificateType, string> = {
  MODULE_COMPLETION: '#13aff0',
  COURSE_COMPLETION: '#22c55e',
  MODULE_EXAM: '#f5911e',
  COURSE_EXAM: '#cb2027',
  STUDY_EXAM: '#f5911e',
};

const ALL_TYPES = Object.keys(TYPE_LABELS) as AdminCertificateType[];

export default function AdminCertificatesPage() {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<AdminCertificateType | ''>('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'certificates'],
    // Límite alto: la página filtra en cliente, como la de Canjes
    queryFn: () => adminApi.listCertificates({ limit: 1000 }),
  });

  const list = data?.data ?? [];
  const total = data?.total ?? 0;
  const byType = data?.stats.byType;

  const filtered = useMemo(
    () =>
      list.filter((c) => {
        const q = search.trim().toLowerCase();
        const matchesSearch =
          !q ||
          c.recipientName.toLowerCase().includes(q) ||
          (c.recipientEmail ?? '').toLowerCase().includes(q) ||
          c.scopeTitle.toLowerCase().includes(q) ||
          c.verifyCode.toLowerCase().includes(q);
        return matchesSearch && (!filterType || c.type === filterType);
      }),
    [list, search, filterType],
  );

  return (
    <div style={{ maxWidth: 1060, margin: '0 auto', padding: '2rem' }}>
      {/* Hero */}
      <div className="page-hero animate-in">
        <h1 className="hero-title">Certificados</h1>
        <p className="hero-subtitle">
          {total} certificado{total !== 1 ? 's' : ''} emitido{total !== 1 ? 's' : ''}
        </p>
      </div>

      {/* KPIs por tipo */}
      <div style={S.kpis}>
        {ALL_TYPES.map((type) => (
          <div className="stat-card" key={type}>
            <div style={{ ...S.kpiValue, color: TYPE_COLORS[type] }}>{byType?.[type] ?? 0}</div>
            <div style={S.kpiLabel}>{TYPE_LABELS[type]}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={S.filters}>
        <input
          style={S.input}
          placeholder="Buscar por alumno, curso o código..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          style={S.select}
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as AdminCertificateType | '')}
          aria-label="Filtrar por tipo"
        >
          <option value="">Todos los tipos</option>
          {ALL_TYPES.map((type) => (
            <option key={type} value={type}>
              {TYPE_LABELS[type]}
            </option>
          ))}
        </select>
        <span style={S.count}>
          {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {isLoading && <p style={S.muted}>Cargando certificados...</p>}
      {isError && <p style={S.error}>Error al cargar los certificados.</p>}

      {!isLoading && !isError && filtered.length === 0 && (
        <div className="vkb-card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>
            {total === 0
              ? 'Todavía no se ha emitido ningún certificado.'
              : 'Ningún certificado coincide con el filtro.'}
          </p>
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Alumno</th>
                <th>Certificado</th>
                <th>Tipo</th>
                <th>Nota</th>
                <th>Emitido</th>
                <th>Código</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((cert) => (
                <CertificateRow key={cert.id} cert={cert} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CertificateRow({ cert }: { cert: AdminCertificate }) {
  const issuedAt = new Date(cert.issuedAt).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <tr>
      <td>
        <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text)' }}>
          {cert.recipientName}
        </div>
        {cert.recipientEmail && <div style={S.sub}>{cert.recipientEmail}</div>}
      </td>
      <td>
        <div style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>{cert.scopeTitle}</div>
        {cert.courseTitle && <div style={S.sub}>Parte de: {cert.courseTitle}</div>}
      </td>
      <td>
        <span style={{ ...S.pill, color: TYPE_COLORS[cert.type], borderColor: TYPE_COLORS[cert.type] }}>
          {TYPE_LABELS[cert.type]}
        </span>
      </td>
      <td style={S.cell}>
        {cert.examScore !== null && cert.examScore !== undefined
          ? `${cert.examScore.toFixed(1)}%`
          : '—'}
      </td>
      <td style={S.cell}>{issuedAt}</td>
      <td style={{ ...S.cell, fontFamily: 'monospace', fontSize: '0.78rem' }}>{cert.verifyCode}</td>
    </tr>
  );
}

const S: Record<string, React.CSSProperties> = {
  kpis: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
    gap: '0.875rem',
    margin: '1.5rem 0 1.75rem',
  },
  kpiValue: { fontSize: '1.6rem', fontWeight: 800, lineHeight: 1, marginBottom: 4 },
  kpiLabel: { fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 },
  filters: { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 18 },
  input: {
    padding: '0.45rem 0.75rem',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    fontSize: '0.875rem',
    background: 'var(--color-bg)',
    color: 'var(--color-text)',
    minWidth: 260,
  },
  select: {
    padding: '0.45rem 0.75rem',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    fontSize: '0.875rem',
    background: 'var(--color-bg)',
    color: 'var(--color-text)',
  },
  count: { marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--color-text-muted)' },
  muted: { color: 'var(--color-text-muted)', padding: '2rem 0', textAlign: 'center' },
  error: { color: 'var(--color-error)', padding: '2rem 0', textAlign: 'center' },
  sub: { fontSize: '0.75rem', color: 'var(--color-text-muted)' },
  cell: { fontSize: '0.85rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' },
  pill: {
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: 999,
    border: '1px solid',
    fontSize: '0.72rem',
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
};
