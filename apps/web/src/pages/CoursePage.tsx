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

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '2rem', maxWidth: 800, margin: '0 auto' },
  back: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--color-text-muted)', fontSize: '0.875rem', padding: 0, marginBottom: '1.25rem',
  },
  heading: { fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.5rem' },
  badge: {
    display: 'inline-block',
    fontSize: '0.75rem',
    fontWeight: 600,
    padding: '2px 10px',
    borderRadius: 999,
    background: 'var(--color-border)',
    color: 'var(--color-text-muted)',
    marginBottom: '0.5rem',
  },
  desc: { color: 'var(--color-text-muted)', marginBottom: '1.25rem', lineHeight: 1.6 },
  progressRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: '2rem' },
  progressBar: { flex: 1, height: 8, background: 'var(--color-border)', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', background: 'var(--color-primary)', borderRadius: 4, transition: 'width 0.3s' },
  progressLabel: { fontSize: '0.875rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' },
  moduleTitle: {
    fontSize: '1rem', fontWeight: 600, color: 'var(--color-text)',
    padding: '0.75rem 0', borderBottom: '1px solid var(--color-border)', marginBottom: '0.25rem',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  examBtn: {
    background: 'none', border: '1px solid var(--color-border)', cursor: 'pointer',
    color: 'var(--color-text-muted)', fontSize: '0.8rem', padding: '2px 8px', borderRadius: 6,
    fontWeight: 600,
  },
  examCourseBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid var(--color-primary)',
    background: 'none', cursor: 'pointer', color: 'var(--color-primary)',
    fontWeight: 600, fontSize: '0.875rem', marginBottom: '1.5rem',
  },
  lessonRow: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '0.6rem 0.5rem', borderRadius: 8, cursor: 'pointer',
    color: 'var(--color-text)', fontSize: '0.9rem',
  },
  lessonIcon: { fontSize: '1rem', width: 20, textAlign: 'center' },
  lessonTitle: { flex: 1 },
  checkmark: { color: 'var(--color-primary)', fontWeight: 700 },
  error: { color: 'var(--color-error)', padding: '1rem' },
  skeleton: { background: 'var(--color-border)', borderRadius: 8 },
  certBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '0.875rem 1.25rem',
    borderRadius: 10,
    background: '#f0fdf4',
    border: '1px solid #86efac',
    marginBottom: '1.5rem',
  },
  certBannerText: { fontWeight: 600, color: '#16a34a', fontSize: '0.95rem' },
  certBannerBtn: {
    padding: '0.4rem 0.875rem',
    borderRadius: 8,
    border: 'none',
    background: '#16a34a',
    color: '#fff',
    fontWeight: 600,
    fontSize: '0.8rem',
    cursor: 'pointer',
    flexShrink: 0,
  },
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

  if (isError) return <div style={styles.error}>Error al cargar el curso.</div>;

  if (isLoading || !course) {
    return (
      <div style={styles.page}>
        <div style={{ ...styles.skeleton, height: 32, width: '60%', marginBottom: 12 }} />
        <div style={{ ...styles.skeleton, height: 16, width: '80%', marginBottom: 24 }} />
        <div style={{ ...styles.skeleton, height: 8, width: '100%', marginBottom: 32 }} />
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ ...styles.skeleton, height: 44, marginBottom: 8 }} />
        ))}
      </div>
    );
  }

  const percentage = progressData?.percentageComplete ?? 0;

  return (
    <div style={styles.page}>
      <button style={styles.back} onClick={() => navigate('/courses')}>
        ← Volver a cursos
      </button>

      {course.schoolYear && (
        <div style={styles.badge}>{course.schoolYear.label}</div>
      )}
      <h1 style={styles.heading}>{course.title}</h1>
      {course.description && <p style={styles.desc}>{course.description}</p>}

      <div style={styles.progressRow}>
        <div style={styles.progressBar}>
          <div style={{ ...styles.progressFill, width: `${percentage}%` }} />
        </div>
        <span style={styles.progressLabel}>{percentage}% completado</span>
      </div>

      {/* Banner de certificado cuando el curso está 100% completado */}
      {percentage === 100 && courseCert && (
        <div style={styles.certBanner}>
          <span style={styles.certBannerText}>
            📜 ¡Certificado de curso disponible!
          </span>
          <button
            style={styles.certBannerBtn}
            onClick={() => downloadCertificatePdf(courseCert)}
          >
            ⬇️ Descargar PDF
          </button>
        </div>
      )}

      {percentage === 100 && !courseCert && (
        <div style={{ ...styles.certBanner, background: '#fefce8', border: '1px solid #fde047' }}>
          <span style={{ ...styles.certBannerText, color: '#854d0e' }}>
            🏆 ¡Curso completado al 100%! El certificado se generará en breve.
          </span>
          <button
            style={{ ...styles.certBannerBtn, background: '#ca8a04' }}
            onClick={() => navigate('/certificates')}
          >
            Ver certificados
          </button>
        </div>
      )}

      {courseExamInfo && courseExamInfo.questionCount > 0 && (
        <button
          style={styles.examCourseBtn}
          onClick={() => navigate(`/exam?courseId=${courseId}`)}
        >
          🎓 Examen del curso
          <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>
            ({courseExamInfo.questionCount} preguntas)
          </span>
        </button>
      )}

      {course.modules?.length ? (
        course.modules.map((module) => (
          <div key={module.id} style={{ marginBottom: '1.5rem' }}>
            <ModuleRow
              module={module}
              courseId={courseId!}
              completedSet={completedSet}
              navigate={navigate}
            />
          </div>
        ))
      ) : (
        <p style={{ color: 'var(--color-text-muted)' }}>Este curso aún no tiene lecciones.</p>
      )}
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

  return (
    <>
      <div style={styles.moduleTitle}>
        <span>{module.title}</span>
        {moduleExamInfo && moduleExamInfo.questionCount > 0 && (
          <button
            style={styles.examBtn}
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/exam?moduleId=${module.id}`);
            }}
          >
            🎓 Examinarse
          </button>
        )}
      </div>
      {module.lessons?.map((lesson) => {
        const completed = completedSet.has(lesson.id);
        return (
          <div
            key={lesson.id}
            style={styles.lessonRow}
            onClick={() => navigate(`/courses/${courseId}/lessons/${lesson.id}`)}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = 'var(--color-border)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = 'transparent';
            }}
          >
            <span style={styles.lessonIcon}>
              {LESSON_ICONS[lesson.type as LessonType] ?? '📄'}
            </span>
            <span style={styles.lessonTitle}>{lesson.title}</span>
            {completed && <span style={styles.checkmark}>✓</span>}
          </div>
        );
      })}
    </>
  );
}
