import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCourses } from '../hooks/useCourses';
import { useMyStudyUnits, useCreateStudyUnit, useDeleteStudyUnit } from '../hooks/useStudy';

export default function StudyPage() {
  const navigate = useNavigate();
  const { data: coursesData } = useCourses(1);
  const courses = coursesData?.data ?? [];

  const { data: units, isLoading: unitsLoading } = useMyStudyUnits();
  const create = useCreateStudyUnit();
  const remove = useDeleteStudyUnit();

  const [courseId, setCourseId] = useState('');
  const [topic, setTopic] = useState('');
  const [numExercises, setNumExercises] = useState(5);
  const [numQuestions, setNumQuestions] = useState<5 | 10>(5);
  const [useTimer, setUseTimer] = useState(false);
  const [timerMins, setTimerMins] = useState(15);
  const [onlyOnce, setOnlyOnce] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!courseId || topic.trim().length < 3) return;
    create.mutate(
      {
        courseId,
        topic: topic.trim(),
        numExercises,
        numQuestions,
        timeLimit: useTimer ? Math.round(timerMins * 60) : undefined,
        onlyOnce,
      },
      { onSuccess: (unit) => navigate(`/study/${unit.id}`) },
    );
  }

  const apiError = (
    create.error as { response?: { data?: { message?: string | string[] } } } | null
  )?.response?.data?.message;
  const apiErrorText = Array.isArray(apiError) ? apiError.join(' · ') : apiError;

  return (
    <div style={s.page}>
      <header style={s.header}>
        <h1 style={s.title}>🧠 Estudiar</h1>
        <p style={s.subtitle}>
          Escribe un tema de una de tus asignaturas y se creará un curso con teoría, ejercicios y un
          examen, todo generado para ti.
        </p>
      </header>

      <form onSubmit={handleSubmit} style={s.form}>
        <div style={s.row}>
          <div className="field" style={{ flex: 2 }}>
            <label htmlFor="courseId">Asignatura</label>
            <select
              id="courseId"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              required
            >
              <option value="">Selecciona una asignatura</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="numExercises">Nº de ejercicios</label>
            <input
              id="numExercises"
              type="number"
              min={1}
              max={20}
              value={numExercises}
              onChange={(e) =>
                setNumExercises(Math.max(1, Math.min(20, Number(e.target.value) || 1)))
              }
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="topic">¿Sobre qué tema quieres estudiar?</label>
          <textarea
            id="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Ej: propiedades de logaritmos, el Renacimiento, análisis sintáctico..."
            rows={3}
            style={s.textarea}
            required
          />
        </div>

        <div className="field">
          <label>Preguntas del examen</label>
          <div style={{ display: 'flex', gap: 10 }}>
            {([5, 10] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNumQuestions(n)}
                style={{ ...s.pill, ...(numQuestions === n ? s.pillActive : {}) }}
              >
                {n} preguntas
              </button>
            ))}
          </div>
        </div>

        <label style={s.toggle}>
          <input
            type="checkbox"
            checked={useTimer}
            onChange={(e) => setUseTimer(e.target.checked)}
          />
          <span>⏱ Límite de tiempo</span>
          {useTimer && (
            <input
              type="number"
              min={1}
              max={180}
              value={timerMins}
              onChange={(e) =>
                setTimerMins(Math.min(180, Math.max(1, Number(e.target.value) || 1)))
              }
              style={s.timerInput}
            />
          )}
          {useTimer && <span style={s.muted}>minutos</span>}
        </label>

        <label style={s.toggle}>
          <input
            type="checkbox"
            checked={onlyOnce}
            onChange={(e) => setOnlyOnce(e.target.checked)}
          />
          <span>🔒 Examen de un solo intento</span>
        </label>

        {apiErrorText && (
          <div style={s.errorBox}>
            <strong>!</strong> {apiErrorText}
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={create.isPending || !courseId || topic.trim().length < 3}
          style={{ alignSelf: 'flex-start', padding: '12px 24px' }}
        >
          {create.isPending ? '⏳ Generando tu curso…' : '✨ Crear curso de estudio'}
        </button>
      </form>

      <section style={s.results}>
        <h2 style={s.resultsTitle}>Mis cursos de estudio</h2>
        {unitsLoading && <p style={s.muted}>Cargando…</p>}
        {!unitsLoading && (units?.length ?? 0) === 0 && (
          <p style={s.muted}>
            Aún no has creado ningún curso. Escribe un tema arriba para empezar.
          </p>
        )}
        <ul style={s.list}>
          {(units ?? []).map((u) => (
            <li key={u.id} style={s.item}>
              <Link to={`/study/${u.id}`} style={s.itemLink}>
                <strong>{u.title}</strong>
                <span style={s.itemMeta}>
                  {u.course.title} · Tema: {u.topic}
                </span>
                <span style={s.itemDate}>
                  {new Date(u.createdAt).toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </Link>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`¿Borrar "${u.title}"?`)) remove.mutate(u.id);
                }}
                style={s.deleteBtn}
                aria-label="Borrar unidad"
              >
                🗑️
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 900,
    margin: '0 auto',
    padding: '32px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 32,
  },
  header: { display: 'flex', flexDirection: 'column', gap: 8 },
  title: { fontSize: '1.8rem', fontWeight: 800, margin: 0 },
  subtitle: { color: 'var(--color-text-muted)', fontSize: '0.95rem', lineHeight: 1.5, margin: 0 },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 14,
    padding: 24,
  },
  row: { display: 'flex', gap: 16, flexWrap: 'wrap' },
  textarea: {
    width: '100%',
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    color: 'var(--color-text)',
    padding: '10px 12px',
    fontSize: '0.95rem',
    fontFamily: 'inherit',
    resize: 'vertical',
  },
  pill: {
    flex: 1,
    padding: '10px 16px',
    borderRadius: 8,
    border: '1.5px solid var(--color-border)',
    background: 'var(--color-bg)',
    color: 'var(--color-text)',
    fontSize: '0.9rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  pillActive: {
    border: '2px solid var(--color-primary)',
    background: 'rgba(234,88,12,0.10)',
    color: 'var(--color-primary)',
  },
  toggle: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: '0.9rem',
    color: 'var(--color-text)',
  },
  timerInput: {
    width: 80,
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    color: 'var(--color-text)',
    padding: '6px 10px',
  },
  muted: { color: 'var(--color-text-muted)', fontSize: '0.9rem', margin: 0 },
  errorBox: {
    background: 'rgba(220,38,38,0.15)',
    borderLeft: '4px solid #dc2626',
    color: 'var(--color-error)',
    padding: '12px 14px',
    borderRadius: 8,
    fontSize: '0.875rem',
  },
  results: { display: 'flex', flexDirection: 'column', gap: 12 },
  resultsTitle: { fontSize: '1.2rem', fontWeight: 700, margin: 0 },
  list: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  item: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 12,
    display: 'flex',
    alignItems: 'stretch',
    gap: 8,
  },
  itemLink: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '14px 16px',
    color: 'var(--color-text)',
    textDecoration: 'none',
  },
  itemMeta: { fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: 1.4 },
  itemDate: { fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 },
  deleteBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--color-text-muted)',
    padding: '0 14px',
    cursor: 'pointer',
    fontSize: '1.1rem',
  },
};
