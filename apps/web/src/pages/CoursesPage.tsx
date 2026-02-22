import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCourses, useSchoolYears } from '../hooks/useCourses';
import { useAuthStore } from '../store/auth.store';
import { Role } from '@vkbacademy/shared';
import type { Course } from '@vkbacademy/shared';

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

const ORANGE  = '#ea580c';
const NAVY    = '#0d1b2a';   // azul marino del hero (igual que la referencia)

// Gradiente por nivel educativo (para thumbnails sin coverUrl)
const LEVEL_GRADIENT: Record<string, string> = {
  '1eso':  'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
  '2eso':  'linear-gradient(135deg, #5b21b6 0%, #7c3aed 100%)',
  '3eso':  'linear-gradient(135deg, #065f46 0%, #059669 100%)',
  '4eso':  'linear-gradient(135deg, #0e7490 0%, #0891b2 100%)',
  '1bach': 'linear-gradient(135deg, #92400e 0%, #d97706 100%)',
  '2bach': 'linear-gradient(135deg, #881337 0%, #e11d48 100%)',
};
const DEFAULT_GRADIENT = 'linear-gradient(135deg, #1e293b 0%, #334155 100%)';

// ─── Estilos ───────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  page: { display: 'flex', flexDirection: 'column', minHeight: '100%' },

  // Hero
  hero: {
    padding: '2.75rem 2.5rem 2.25rem',
    background: NAVY,
    borderBottom: 'none',
  },
  heroTitle: {
    fontSize: '2.5rem',
    fontWeight: 900,
    letterSpacing: '-0.03em',
    color: '#ffffff',
    textTransform: 'uppercase',
    lineHeight: 1,
    marginBottom: '0.5rem',
  },
  heroSub: {
    fontSize: '0.9rem',
    color: 'rgba(255,255,255,0.55)',
    marginBottom: '1.75rem',
    maxWidth: 560,
  },
  searchRow: {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    maxWidth: 680,
  },
  searchWrap: {
    flex: 1,
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: 14,
    fontSize: '1rem',
    color: 'rgba(255,255,255,0.5)',
    pointerEvents: 'none',
  },
  searchInput: {
    width: '100%',
    height: 46,
    padding: '0 1rem 0 2.5rem',
    borderRadius: 10,
    border: '1.5px solid rgba(255,255,255,0.15)',
    fontSize: '0.9rem',
    background: 'rgba(255,255,255,0.10)',
    color: '#ffffff',
    outline: 'none',
    boxSizing: 'border-box',
  },

  // Filtros
  filtersBar: {
    padding: '0.875rem 2.5rem',
    background: '#fff',
    borderBottom: '1px solid #e2e8f0',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 10,
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
    color: '#94a3b8',
    width: 80,
    flexShrink: 0,
  },
  chip: {
    padding: '6px 18px',
    borderRadius: 999,
    fontSize: '0.8rem',
    fontWeight: 700,
    cursor: 'pointer',
    border: 'none',
    transition: 'background 0.15s, color 0.15s, transform 0.1s',
    letterSpacing: '0.01em',
  },

  // Grid
  gridSection: {
    padding: '2rem 2.5rem',
    flex: 1,
    background: '#f8fafc',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: '1.25rem',
  },

  // Tarjeta
  card: {
    background: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    cursor: 'pointer',
    border: '1px solid #e2e8f0',
    transition: 'transform 0.15s, box-shadow 0.15s',
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
  thumbIcon: {
    fontSize: '2.5rem',
    opacity: 0.45,
    userSelect: 'none',
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
    padding: '0.875rem 1rem 1rem',
  },
  cardSubject: {
    display: 'inline-block',
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
    color: ORANGE,
    background: 'rgba(234,88,12,0.09)',
    borderRadius: 6,
    padding: '2px 8px',
    marginBottom: '0.4rem',
  },
  cardTitle: {
    fontSize: '0.95rem',
    fontWeight: 700,
    color: '#0f172a',
    marginBottom: '0.35rem',
    lineHeight: 1.35,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  } as React.CSSProperties,
  cardDesc: {
    fontSize: '0.8rem',
    color: '#64748b',
    lineHeight: 1.5,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  } as React.CSSProperties,

  // Skeleton
  skeletonCard: {
    background: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    border: '1px solid #e2e8f0',
  },
  skeletonThumb: {
    aspectRatio: '16/9',
    background: '#e2e8f0',
  },
  skeletonLine: {
    background: '#e2e8f0',
    borderRadius: 6,
  },

  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem 0',
    gap: 12,
    color: '#94a3b8',
  },
  error: { color: '#dc2626', padding: '1rem 2.5rem' },
};

// ─── Skeleton card ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div style={S.skeletonCard}>
      <div style={S.skeletonThumb} />
      <div style={{ padding: '0.875rem 1rem 1rem' }}>
        <div style={{ ...S.skeletonLine, height: 16, width: '80%', marginBottom: 8 }} />
        <div style={{ ...S.skeletonLine, height: 12, width: '100%', marginBottom: 6 }} />
        <div style={{ ...S.skeletonLine, height: 12, width: '65%' }} />
      </div>
    </div>
  );
}

// ─── Tarjeta de curso ──────────────────────────────────────────────────────────

function CourseCard({ course, onClick }: { course: Course; onClick: () => void }) {
  const gradient = LEVEL_GRADIENT[course.schoolYear?.name ?? ''] ?? DEFAULT_GRADIENT;

  return (
    <div
      style={S.card}
      onClick={onClick}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = 'translateY(-3px)';
        el.style.boxShadow = '0 8px 24px rgba(0,0,0,0.10)';
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = 'none';
        el.style.boxShadow = 'none';
      }}
    >
      {/* Thumbnail */}
      <div style={{ ...S.thumb, background: gradient }}>
        {course.coverUrl ? (
          <img src={course.coverUrl} alt={course.title} style={S.thumbImg} />
        ) : (
          <span style={S.thumbIcon}>🏀</span>
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
        {course.description && (
          <div style={S.cardDesc}>{course.description}</div>
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

  return (
    <div style={S.page}>
      {/* Hero */}
      <div style={S.hero}>
        <div style={S.heroTitle}>Catálogo de Cursos</div>
        <div style={S.heroSub}>
          Tu biblioteca de formación técnica y táctica de baloncesto
        </div>
        <div style={S.searchRow}>
          <div style={S.searchWrap}>
            <span style={S.searchIcon}>🔍</span>
            <input
              style={S.searchInput}
              type="text"
              placeholder="Busca un curso, módulo o temática..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Barra de filtros: asignatura + nivel */}
      <div style={S.filtersBar}>

        {/* Fila 1: Asignaturas */}
        {allSubjects.length > 0 && (
          <div style={S.filtersRow}>
            <span style={S.filterLabel}>Asignatura</span>
            <button
              style={{ ...S.chip, background: activeSubject === null ? ORANGE : '#f1f5f9', color: activeSubject === null ? '#fff' : '#475569' }}
              onClick={() => setActiveSubject(null)}
            >
              Todas
            </button>
            {allSubjects.map((subj) => (
              <button
                key={subj}
                style={{
                  ...S.chip,
                  background: activeSubject === subj ? ORANGE : '#f1f5f9',
                  color: activeSubject === subj ? '#fff' : '#1e293b',
                }}
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
            <span style={S.filterLabel}>Nivel</span>
            <button
              style={{ ...S.chip, background: activeYear === null ? ORANGE : '#f1f5f9', color: activeYear === null ? '#fff' : '#475569' }}
              onClick={() => setActiveYear(null)}
            >
              Todos
            </button>
            {schoolYears.map((sy) => (
              <button
                key={sy.id}
                style={{ ...S.chip, background: activeYear === sy.id ? ORANGE : '#f1f5f9', color: activeYear === sy.id ? '#fff' : '#475569' }}
                onClick={() => setActiveYear(activeYear === sy.id ? null : sy.id)}
              >
                {sy.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid */}
      <div style={S.gridSection}>
        {isLoading ? (
          <div style={S.grid}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={S.empty}>
            <span style={{ fontSize: 48 }}>📚</span>
            <p style={{ fontWeight: 600, color: '#475569' }}>
              {search
                ? 'No se encontraron cursos con esa búsqueda.'
                : isStudentWithoutLevel
                  ? 'Cuando un administrador asigne tu nivel educativo, aquí aparecerán tus cursos.'
                  : 'No hay cursos disponibles todavía.'}
            </p>
          </div>
        ) : (
          <div style={S.grid}>
            {filtered.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                onClick={() => navigate(`/courses/${course.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
