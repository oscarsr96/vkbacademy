import { useNavigate, useParams } from 'react-router-dom';
import { useCourse, useCourseProgress } from '../hooks/useCourses';
import { useExamBankInfo } from '../hooks/useExams';
import { useMyCertificates } from '../hooks/useCertificates';
import { downloadCertificatePdf } from '../utils/certificatePdf';
import type { LessonType } from '@vkbacademy/shared';

const LESSON_ICONS: Record<LessonType, string> = {
  VIDEO: '🎬',
  QUIZ: '📝',
  EXERCISE: '💪',
  MATCH: '🔗',
  SORT: '↕️',
  FILL_BLANK: '✏️',
};

const S: Record<string, React.CSSProperties> = {
  page: { display: 'flex', flexDirection: 'column', gap: 0 },

  // Breadcrumb
  breadcrumb: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
    fontSize: '0.8rem',
    color: 'rgba(255,255,255,0.45)',
  },
  breadcrumbLink: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'rgba(255,255,255,0.55)',
    fontSize: '0.8rem',
    padding: 0,
    fontFamily: 'inherit',
    transition: 'color 0.15s',
  },
  breadcrumbCurrent: {
    color: 'rgba(255,255,255,0.85)',
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    maxWidth: 260,
  },

  // Hero sub-info
  heroMeta: {
    display: 'flex',
    gap: 16,
    marginTop: 14,
    flexWrap: 'wrap' as const,
    alignItems: 'center',
  },
  heroMetaItem: {
    fontSize: '0.85rem',
    color: 'rgba(255,255,255,0.60)',
    display: 'flex',
    alignItems: 'center',
    gap: 5,
  },

  // Progreso en el hero
  heroProgress: {
    marginTop: 20,
    maxWidth: 480,
  },
  heroProgressRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  heroProgressLabel: {
    fontSize: '0.8rem',
    color: 'rgba(255,255,255,0.65)',
    fontWeight: 600,
  },
  heroProgressPct: {
    fontSize: '0.8rem',
    color: '#f97316',
    fontWeight: 700,
  },

  // Contenido principal
  content: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 20,
    marginTop: 4,
  },

  // Banners de certificado
  certBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '14px 20px',
    borderRadius: 'var(--radius-md)',
    background: '#f0fdf4',
    border: '1.5px solid #86efac',
  },
  certBannerText: { fontWeight: 600, color: '#16a34a', fontSize: '0.95rem', margin: 0 },
  certBannerBtn: {
    padding: '6px 14px',
    borderRadius: 8,
    border: 'none',
    background: '#16a34a',
    color: '#fff',
    fontWeight: 700,
    fontSize: '0.8rem',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'filter 0.15s',
  },

  // Botón de examen del curso
  examCourseBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
  },

  // Módulos
  moduleCard: {
    background: 'var(--color-surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1.5px solid var(--color-border)',
    boxShadow: 'var(--shadow-card)',
    overflow: 'hidden',
  },
  moduleHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 20px',
    background: 'rgba(8,14,26,0.03)',
    borderBottom: '1px solid var(--color-border)',
  },
  moduleTitle: {
    fontWeight: 700,
    fontSize: '0.9375rem',
    color: 'var(--color-text)',
    margin: 0,
  },
  moduleExamBtn: {
    background: 'none',
    border: '1.5px solid rgba(234,88,12,0.35)',
    cursor: 'pointer',
    color: 'var(--color-primary)',
    fontSize: '0.8rem',
    padding: '4px 12px',
    borderRadius: 8,
    fontWeight: 700,
    fontFamily: 'inherit',
    transition: 'background 0.15s, border-color 0.15s',
  },
  lessonRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 20px',
    cursor: 'pointer',
    borderBottom: '1px solid var(--color-border)',
    transition: 'background 0.15s',
    color: 'var(--color-text)',
    fontSize: '0.9rem',
  },
  lessonIcon: { fontSize: '1rem', width: 22, textAlign: 'center' as const, flexShrink: 0 },
  lessonTitle: { flex: 1, fontWeight: 500 },
  checkmark: {
    color: 'var(--color-primary)',
    fontWeight: 800,
    fontSize: '1rem',
    flexShrink: 0,
  },

  error: { color: 'var(--color-error)', padding: '1rem' },
  skeleton: { background: 'var(--color-border)', borderRadius: 8 },
  emptyModules: { color: 'var(--color-text-muted)', fontStyle: 'italic' },
};

export default function CoursePage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();

  const { data: course, isLoading, isError } = useCourse(courseId ?? '');
  const { data: progressData } = useCourseProgress(courseId ?? '');
  const { data: courseExamInfo } = useExamBankInfo(courseId, undefined);
  const { data: certificates } = useMyCertificates();

  // Certificado de curso completado (si existe)
  const courseCert = certificates?.find(
    (c) => c.scopeId === courseId && c.type === 'COURSE_COMPLETION',
  );

  // Construir set de lecciones completadas a partir de los IDs devueltos por el backend
  const completedSet = new Set<string>(progressData?.completedLessonIds ?? []);

  if (isError) return <div style={S.error}>Error al cargar el curso.</div>;

  if (isLoading || !course) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ ...S.skeleton, height: 200, borderRadius: 'var(--radius-xl)', marginBottom: 8 }} />
        <div style={{ ...S.skeleton, height: 8, width: '100%', marginBottom: 8 }} />
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ ...S.skeleton, height: 56, borderRadius: 'var(--radius-lg)' }} />
        ))}
      </div>
    );
  }

  const percentage = progressData?.percentageComplete ?? 0;
  const totalLessons = course.modules?.reduce((acc, m) => acc + (m.lessons?.length ?? 0), 0) ?? 0;

  return (
    <div style={S.page}>
      {/* Hero oscuro con breadcrumb, título y progreso */}
      <div className="page-hero animate-in" style={{ marginBottom: 24 }}>
        {/* Breadcrumb */}
        <div style={S.breadcrumb}>
          <button
            style={S.breadcrumbLink}
            onClick={() => navigate('/courses')}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#f97316'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.55)'; }}
          >
            Cursos
          </button>
          <span>/</span>
          <span style={S.breadcrumbCurrent}>{course.title}</span>
        </div>

        {/* Título */}
        <h1 className="hero-title">{course.title}</h1>

        {/* Meta */}
        <div style={S.heroMeta}>
          {course.schoolYear && (
            <span style={S.heroMetaItem}>
              🎓 {course.schoolYear.label}
            </span>
          )}
          <span style={S.heroMetaItem}>
            📦 {course.modules?.length ?? 0} módulos
          </span>
          <span style={S.heroMetaItem}>
            📄 {totalLessons} lecciones
          </span>
        </div>

        {/* Barra de progreso */}
        {progressData !== undefined && (
          <div style={S.heroProgress}>
            <div style={S.heroProgressRow}>
              <span style={S.heroProgressLabel}>Progreso del curso</span>
              <span style={S.heroProgressPct}>{percentage}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${percentage}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Contenido */}
      <div style={S.content}>
        {/* Banner de certificado cuando el curso está 100% completado */}
        {percentage === 100 && courseCert && (
          <div style={S.certBanner}>
            <p style={S.certBannerText}>
              📜 ¡Certificado de curso disponible!
            </p>
            <button
              style={S.certBannerBtn}
              onClick={() => downloadCertificatePdf(courseCert)}
            >
              ⬇️ Descargar PDF
            </button>
          </div>
        )}

        {percentage === 100 && !courseCert && (
          <div style={{ ...S.certBanner, background: '#fefce8', border: '1.5px solid #fde047' }}>
            <p style={{ ...S.certBannerText, color: '#854d0e' }}>
              🏆 ¡Curso completado al 100%! El certificado se generará en breve.
            </p>
            <button
              style={{ ...S.certBannerBtn, background: '#ca8a04' }}
              onClick={() => navigate('/certificates')}
            >
              Ver certificados
            </button>
          </div>
        )}

        {/* Botón de examen del curso */}
        {courseExamInfo && courseExamInfo.questionCount > 0 && (
          <div style={S.examCourseBtn}>
            <button
              className="btn btn-primary"
              onClick={() => navigate(`/exam?courseId=${courseId}`)}
            >
              🎓 Examen del curso
              <span style={{ fontWeight: 400, opacity: 0.8, fontSize: '0.8rem' }}>
                ({courseExamInfo.questionCount} preguntas)
              </span>
            </button>
          </div>
        )}

        {/* Módulos */}
        {course.modules?.length ? (
          course.modules.map((module) => (
            <ModuleRow
              key={module.id}
              module={module}
              courseId={courseId!}
              completedSet={completedSet}
              navigate={navigate}
            />
          ))
        ) : (
          <p style={S.emptyModules}>Este curso aún no tiene lecciones.</p>
        )}
      </div>
    </div>
  );
}

// ─── Fila de módulo con botón de examen ───────────────────────────────────────

function ModuleRow({
  module,
  courseId,
  completedSet,
  navigate,
}: {
  module: { id: string; title: string; lessons?: { id: string; type: string; title: string }[] };
  courseId: string;
  completedSet: Set<string>;
  navigate: (path: string) => void;
}) {
  const { data: moduleExamInfo } = useExamBankInfo(undefined, module.id);
  const lessons = module.lessons ?? [];
  const completedCount = lessons.filter((l) => completedSet.has(l.id)).length;

  return (
    <div style={S.moduleCard}>
      {/* Cabecera del módulo */}
      <div style={S.moduleHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={S.moduleTitle}>{module.title}</span>
          {lessons.length > 0 && (
            <span style={{
              fontSize: '0.72rem',
              color: 'var(--color-text-muted)',
              background: 'var(--color-bg)',
              padding: '2px 8px',
              borderRadius: 999,
              fontWeight: 600,
            }}>
              {completedCount}/{lessons.length}
            </span>
          )}
        </div>
        {moduleExamInfo && moduleExamInfo.questionCount > 0 && (
          <button
            style={S.moduleExamBtn}
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/exam?moduleId=${module.id}`);
            }}
            onMouseEnter={(e) => {
              const btn = e.currentTarget as HTMLButtonElement;
              btn.style.background = 'rgba(234,88,12,0.08)';
              btn.style.borderColor = 'rgba(234,88,12,0.6)';
            }}
            onMouseLeave={(e) => {
              const btn = e.currentTarget as HTMLButtonElement;
              btn.style.background = 'none';
              btn.style.borderColor = 'rgba(234,88,12,0.35)';
            }}
          >
            🎓 Examinarse
          </button>
        )}
      </div>

      {/* Lecciones */}
      {lessons.map((lesson, idx) => {
        const completed = completedSet.has(lesson.id);
        const isLast = idx === lessons.length - 1;
        return (
          <div
            key={lesson.id}
            style={{
              ...S.lessonRow,
              borderBottom: isLast ? 'none' : '1px solid var(--color-border)',
            }}
            onClick={() => navigate(`/courses/${courseId}/lessons/${lesson.id}`)}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = 'rgba(234,88,12,0.04)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = 'transparent';
            }}
          >
            <span style={S.lessonIcon}>
              {LESSON_ICONS[lesson.type as LessonType] ?? '📄'}
            </span>
            <span style={{
              ...S.lessonTitle,
              color: completed ? 'var(--color-text-muted)' : 'var(--color-text)',
              textDecoration: completed ? 'none' : 'none',
            }}>
              {lesson.title}
            </span>
            {completed && (
              <span style={S.checkmark}>✓</span>
            )}
          </div>
        );
      })}

      {lessons.length === 0 && (
        <div style={{ padding: '16px 20px', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
          Este módulo aún no tiene lecciones.
        </div>
      )}
    </div>
  );
}
