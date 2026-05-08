import { useSubjects, useEnrollSelf, useUnenrollSelf } from '../hooks/useCourses';
import type { SubjectCourse } from '../api/courses.api';

const SUBJECT_ICONS: Record<string, string> = {
  Matemáticas: '📐',
  'Física y Química': '⚗️',
  Inglés: '🇬🇧',
};

function iconFor(subject: string | null): string {
  if (!subject) return '📚';
  return SUBJECT_ICONS[subject] ?? '📚';
}

function SubjectCard({ course }: { course: SubjectCourse }) {
  const enroll = useEnrollSelf();
  const unenroll = useUnenrollSelf();

  const isPending =
    (enroll.isPending && enroll.variables === course.id) ||
    (unenroll.isPending && unenroll.variables === course.id);

  function toggle() {
    if (course.isEnrolled) unenroll.mutate(course.id);
    else enroll.mutate(course.id);
  }

  return (
    <div
      className="vkb-card animate-in"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: '20px 22px',
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: '2.2rem', lineHeight: 1 }}>
          {iconFor(course.subject ?? course.title)}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 800,
              fontSize: '1.05rem',
              color: 'var(--color-text)',
              lineHeight: 1.25,
            }}
          >
            {course.title}
          </div>
          {course.schoolYear && (
            <div
              style={{
                fontSize: '0.78rem',
                color: 'var(--color-text-muted)',
                marginTop: 2,
              }}
            >
              {course.schoolYear.label}
            </div>
          )}
        </div>
        {course.isEnrolled && (
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: 999,
              background: 'rgba(22,163,74,0.10)',
              color: '#16a34a',
              border: '1px solid rgba(22,163,74,0.25)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            Matriculado
          </span>
        )}
      </div>

      {course.description && (
        <p
          style={{
            margin: 0,
            fontSize: '0.85rem',
            color: 'var(--color-text-muted)',
            lineHeight: 1.5,
          }}
        >
          {course.description}
        </p>
      )}

      <button
        type="button"
        className={course.isEnrolled ? 'btn btn-ghost' : 'btn btn-primary'}
        style={{ alignSelf: 'flex-start', padding: '9px 18px', fontSize: '0.85rem' }}
        onClick={toggle}
        disabled={isPending}
      >
        {isPending ? 'Guardando…' : course.isEnrolled ? 'Darme de baja' : 'Matricularme'}
      </button>
    </div>
  );
}

export default function SubjectsPage() {
  const { data: subjects, isLoading, isError } = useSubjects();

  return (
    <div style={{ maxWidth: 840, margin: '0 auto' }}>
      <div className="page-hero animate-in">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
          <span style={{ fontSize: '2.4rem' }}>📚</span>
        </div>
        <h1 className="hero-title">Asignaturas</h1>
        <p className="hero-subtitle">
          Matricúlate en las asignaturas que quieras seguir. Puedes darte de alta o de baja en
          cualquier momento.
        </p>
      </div>

      {isLoading && (
        <p style={{ color: 'var(--color-text-muted)', marginTop: 24 }}>Cargando asignaturas…</p>
      )}

      {isError && (
        <p style={{ color: '#dc2626', marginTop: 24 }}>
          No se pudieron cargar las asignaturas. Inténtalo de nuevo.
        </p>
      )}

      {!isLoading && !isError && subjects && subjects.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '56px 24px',
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-xl)',
            border: '1.5px solid var(--color-border)',
            marginTop: 24,
          }}
        >
          <div style={{ fontSize: '4rem', marginBottom: 16 }}>📚</div>
          <div
            style={{
              fontWeight: 700,
              fontSize: '1.05rem',
              color: 'var(--color-text)',
              marginBottom: 8,
            }}
          >
            No hay asignaturas disponibles
          </div>
          <div
            style={{
              fontSize: '0.9rem',
              color: 'var(--color-text-muted)',
              maxWidth: 380,
              margin: '0 auto',
              lineHeight: 1.6,
            }}
          >
            El administrador aún no ha publicado ninguna asignatura.
          </div>
        </div>
      )}

      {subjects && subjects.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 18,
            marginTop: 24,
          }}
        >
          {subjects.map((c) => (
            <SubjectCard key={c.id} course={c} />
          ))}
        </div>
      )}
    </div>
  );
}
