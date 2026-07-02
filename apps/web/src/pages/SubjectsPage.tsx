import { useSubjects, useEnrollSelf, useUnenrollSelf } from '../hooks/useCourses';
import type { SubjectCourse } from '../api/courses.api';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';

const SUBJECT_ICONS: Record<string, string> = {
  Matemáticas: '📐',
  'Física y Química': '⚗️',
  Inglés: '🇬🇧',
};

function iconFor(subject: string | null): string {
  if (!subject) return '📚';
  return SUBJECT_ICONS[subject] ?? '📚';
}

function SubjectCard({ course, index }: { course: SubjectCourse; index: number }) {
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
      className="vkb-card numbered-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: '20px 22px',
        position: 'relative',
        animation: `riseIn 0.5s cubic-bezier(0.18, 0.72, 0.24, 1.12) ${index * 60}ms both`,
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
      <PageHeader
        variant="light"
        title="Asignaturas"
        subtitle="Matricúlate en las asignaturas que quieras seguir. Puedes darte de alta o de baja en cualquier momento."
      />

      {isLoading && (
        <p style={{ color: 'var(--color-text-muted)', marginTop: 24 }}>Cargando asignaturas…</p>
      )}

      {isError && (
        <p style={{ color: '#dc2626', marginTop: 24 }}>
          No se pudieron cargar las asignaturas. Inténtalo de nuevo.
        </p>
      )}

      {!isLoading && !isError && subjects && subjects.length === 0 && (
        <EmptyState
          icon="book"
          title="No hay asignaturas disponibles"
          message="El administrador aún no ha publicado ninguna asignatura."
        />
      )}

      {subjects && subjects.length > 0 && (
        <div
          className="numbered-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 18,
            marginTop: 24,
          }}
        >
          {subjects.map((c, i) => (
            <SubjectCard key={c.id} course={c} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
