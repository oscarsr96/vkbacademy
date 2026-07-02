import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCourses, useSchoolYears } from '../hooks/useCourses';
import { useAuthStore } from '../store/auth.store';
import { Role } from '@vkbacademy/shared';
import type { Course } from '@vkbacademy/shared';
import PageHeader from '../components/ui/PageHeader';
import Icon from '../components/ui/Icon';
import EmptyState from '../components/ui/EmptyState';

// Asignaturas predefinidas para baloncesto (mismo orden que la imagen de referencia)
const SUBJECTS = [
  'Ataque',
  'Defensa',
  'Tiro',
  'Pase',
  'Bote',
  'Rebote',
  'Táctica',
  'Preparación Física',
];

// ─── Constantes de color ───────────────────────────────────────────────────────

// Franja de color por nivel educativo (acento superior de la card)
const LEVEL_COLOR: Record<string, string> = {
  '1eso':  '#2563eb',
  '2eso':  '#7c3aed',
  '3eso':  '#059669',
  '4eso':  '#0891b2',
  '1bach': '#d97706',
  '2bach': '#e11d48',
};

// Gradiente para el thumbnail (fondo de la imagen)
const LEVEL_GRADIENT: Record<string, string> = {
  '1eso':  'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
  '2eso':  'linear-gradient(135deg, #5b21b6 0%, #7c3aed 100%)',
  '3eso':  'linear-gradient(135deg, #065f46 0%, #059669 100%)',
  '4eso':  'linear-gradient(135deg, #0e7490 0%, #0891b2 100%)',
  '1bach': 'linear-gradient(135deg, #92400e 0%, #d97706 100%)',
  '2bach': 'linear-gradient(135deg, #881337 0%, #e11d48 100%)',
};
const DEFAULT_GRADIENT = 'var(--gradient-orange)';

// ─── Estilos ───────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  page: { display: 'flex', flexDirection: 'column', gap: 0 },

  // Filtros
  filtersBar: {
    padding: '0.875rem 0',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 10,
    marginBottom: 24,
  },
  filtersRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 8,
    alignItems: 'center',
  },
  filterLabel: {
    fontSize: '0.72rem',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    color: 'var(--color-text-muted)',
    width: 80,
    flexShrink: 0,
  },

  // Grid
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: '1.25rem',
  },

  // Tarjeta
  card: {
    background: '#fff',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    cursor: 'pointer',
    border: '1.5px solid var(--color-border)',
    boxShadow: 'var(--shadow-card)',
    transition: 'transform 0.22s, box-shadow 0.22s, border-color 0.22s',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  levelStripe: {
    height: 6,
    width: '100%',
    flexShrink: 0,
  },
  thumb: {
    aspectRatio: '16/9',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  thumbBadge: {
    position: 'absolute',
    top: 9,
    right: 9,
    background: 'rgba(0,0,0,0.60)',
    color: '#fff',
    fontSize: '0.68rem',
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 6,
    backdropFilter: 'blur(4px)',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  cardBody: {
    padding: '1rem 1.125rem 1.125rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
    flex: 1,
  },
  cardSubject: {
    display: 'inline-block',
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
    color: 'var(--brand-deep)',
    background: 'var(--brand-soft)',
    borderRadius: 6,
    padding: '2px 8px',
    width: 'fit-content',
  },
  cardTitle: {
    fontSize: '0.95rem',
    fontWeight: 700,
    color: '#0f172a',
    lineHeight: 1.35,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    margin: 0,
  } as React.CSSProperties,
  cardMeta: {
    fontSize: '0.78rem',
    color: '#64748b',
    margin: 0,
  },

  // Skeleton
  skeletonCard: {
    background: '#fff',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    border: '1.5px solid var(--color-border)',
  },
  skeletonThumb: {
    aspectRatio: '16/9',
    background: '#e2e8f0',
  },
  skeletonLine: {
    background: '#e2e8f0',
    borderRadius: 6,
  },

  error: { color: '#dc2626', padding: '1rem 0' },
};

// ─── Skeleton card ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div style={S.skeletonCard}>
      <div style={S.skeletonThumb} />
      <div style={{ padding: '1rem 1.125rem' }}>
        <div style={{ ...S.skeletonLine, height: 16, width: '80%', marginBottom: 8 }} />
        <div style={{ ...S.skeletonLine, height: 12, width: '100%', marginBottom: 6 }} />
        <div style={{ ...S.skeletonLine, height: 12, width: '65%' }} />
      </div>
    </div>
  );
}

// ─── Tarjeta de curso ──────────────────────────────────────────────────────────

function CourseCard({
  course,
  index,
  onClick,
}: {
  course: Course;
  index: number;
  onClick: () => void;
}) {
  const gradient = LEVEL_GRADIENT[course.schoolYear?.name ?? ''] ?? DEFAULT_GRADIENT;
  const stripeColor = LEVEL_COLOR[course.schoolYear?.name ?? ''] ?? 'var(--brand)';

  return (
    <div
      style={{
        ...S.card,
        animation: `riseIn 0.5s cubic-bezier(0.18, 0.72, 0.24, 1.12) ${index * 60}ms both`,
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = 'translateY(-4px)';
        el.style.boxShadow = 'var(--shadow-card-hover)';
        el.style.borderColor = 'var(--brand-glow)';
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = 'none';
        el.style.boxShadow = 'var(--shadow-card)';
        el.style.borderColor = 'var(--color-border)';
      }}
    >
      {/* Franja de color por nivel */}
      <div style={{ ...S.levelStripe, background: stripeColor }} />

      {/* Thumbnail */}
      <div style={{ ...S.thumb, background: gradient }}>
        {course.coverUrl ? (
          <img src={course.coverUrl} alt={course.title} style={S.thumbImg} />
        ) : (
          <Icon name="basketball" size={44} color="#fff" strokeWidth={1.4} style={{ opacity: 0.45 }} />
        )}
        {course.schoolYear && (
          <span style={S.thumbBadge}>{course.schoolYear.label}</span>
        )}
      </div>

      {/* Info */}
      <div style={S.cardBody}>
        {course.subject && (
          <div style={S.cardSubject}>{course.subject}</div>
        )}
        <div style={S.cardTitle}>{course.title}</div>
        {course.schoolYear && (
          <p style={S.cardMeta}>{course.schoolYear.label}</p>
        )}
      </div>
    </div>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────────

export default function CoursesPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [activeYear, setActiveYear] = useState<string | null>(null);
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const { data, isLoading, isError } = useCourses(1, activeYear ?? undefined);
  const { data: schoolYears } = useSchoolYears();

  const isStudentWithoutLevel = user?.role === Role.STUDENT && !user.schoolYearId;

  // Asignaturas presentes en los cursos cargados:
  // primero las predefinidas (en orden), luego las personalizadas (alfabético)
  const allSubjects = useMemo(() => {
    if (!data?.data) return [];
    const inData = [...new Set(
      data.data.map((c) => c.subject).filter(Boolean) as string[],
    )];
    const predefined = SUBJECTS.filter((s) => inData.includes(s));
    const custom = inData.filter((s) => !SUBJECTS.includes(s)).sort();
    return [...predefined, ...custom];
  }, [data]);

  // Filtrado client-side por búsqueda y asignatura
  const filtered = useMemo(() => {
    if (!data?.data) return [];
    let list = data.data;
    if (activeSubject) list = list.filter((c) => c.subject === activeSubject);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(
      (c) => c.title.toLowerCase().includes(q) || (c.description ?? '').toLowerCase().includes(q),
    );
    return list;
  }, [data, search, activeSubject]);

  if (isError) {
    return <div style={S.error}>Error al cargar los cursos.</div>;
  }

  const totalCourses = filtered.length;

  return (
    <div style={S.page}>
      {/* Cabecera editorial light */}
      <PageHeader
        variant="light"
        title="Mis Cursos"
        subtitle={
          isLoading
            ? 'Cargando tu biblioteca...'
            : `${totalCourses} ${totalCourses === 1 ? 'curso disponible' : 'cursos disponibles'} · Tu biblioteca de formación técnica y táctica`
        }
      >
        {/* Buscador */}
        <div style={searchStyles.row}>
          <div style={searchStyles.wrap}>
            <span style={searchStyles.icon}>🔍</span>
            <input
              style={searchStyles.input}
              type="text"
              placeholder="Busca un curso, módulo o temática..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </PageHeader>

      {/* Barra de filtros */}
      <div style={S.filtersBar}>
        {/* Fila 1: Asignaturas */}
        {allSubjects.length > 0 && (
          <div style={S.filtersRow}>
            <span className="section-label" style={S.filterLabel}>Asignatura</span>
            <button
              className={`chip${activeSubject === null ? ' active' : ''}`}
              onClick={() => setActiveSubject(null)}
            >
              Todas
            </button>
            {allSubjects.map((subj) => (
              <button
                key={subj}
                className={`chip${activeSubject === subj ? ' active' : ''}`}
                onClick={() => setActiveSubject(activeSubject === subj ? null : subj)}
              >
                {subj}
              </button>
            ))}
          </div>
        )}

        {/* Fila 2: Nivel educativo */}
        {schoolYears && schoolYears.length > 0 && (
          <div style={S.filtersRow}>
            <span className="section-label" style={S.filterLabel}>Nivel</span>
            <button
              className={`chip${activeYear === null ? ' active' : ''}`}
              onClick={() => setActiveYear(null)}
            >
              Todos
            </button>
            {schoolYears.map((sy) => (
              <button
                key={sy.id}
                className={`chip${activeYear === sy.id ? ' active' : ''}`}
                onClick={() => setActiveYear(activeYear === sy.id ? null : sy.id)}
              >
                {sy.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div style={S.grid}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="book"
          title={
            search
              ? 'No se encontraron cursos con esa búsqueda.'
              : isStudentWithoutLevel
                ? 'Cuando un administrador asigne tu nivel educativo, aquí aparecerán tus cursos.'
                : 'No hay cursos disponibles todavía.'
          }
        />
      ) : (
        <div style={S.grid}>
          {filtered.map((course, i) => (
            <CourseCard
              key={course.id}
              course={course}
              index={i}
              onClick={() => navigate(`/courses/${course.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Estilos del buscador (dentro de la cabecera light)
const searchStyles: Record<string, React.CSSProperties> = {
  row: {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    maxWidth: 480,
    marginTop: 4,
  },
  wrap: {
    flex: 1,
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  icon: {
    position: 'absolute',
    left: 14,
    fontSize: '1rem',
    color: 'var(--color-text-muted)',
    pointerEvents: 'none',
  },
  input: {
    width: '100%',
    height: 46,
    padding: '0 1rem 0 2.6rem',
    borderRadius: 10,
    border: '1.5px solid var(--color-border)',
    fontSize: '0.9rem',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    outline: 'none',
    boxSizing: 'border-box',
  },
};
