import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { StudyDifficulty } from '@vkbacademy/shared';
import { useCourses } from '../hooks/useCourses';
import { useMyStudyUnits, useCreateStudyUnit, useDeleteStudyUnit } from '../hooks/useStudy';
import { useMyStudyPlans, useDeleteStudyPlan } from '../hooks/useStudyPlans';
import { getApiErrorMessage } from '../utils/errorMessage';
import PageHeader from '../components/ui/PageHeader';
import Icon from '../components/ui/Icon';
import EmptyState from '../components/ui/EmptyState';

const DIFFICULTIES: { value: StudyDifficulty; label: string }[] = [
  { value: 'EASY', label: 'Fácil' },
  { value: 'MEDIUM', label: 'Media' },
  { value: 'HARD', label: 'Difícil' },
];

export default function StudyPage() {
  const navigate = useNavigate();
  const { data: coursesData } = useCourses(1);
  const courses = coursesData?.data ?? [];

  const { data: units, isLoading: unitsLoading } = useMyStudyUnits();
  const create = useCreateStudyUnit();
  const remove = useDeleteStudyUnit();

  const { data: plans, isLoading: plansLoading } = useMyStudyPlans();
  const removePlan = useDeleteStudyPlan();

  const [courseId, setCourseId] = useState('');
  const [topic, setTopic] = useState('');
  const [numExercises, setNumExercises] = useState(5);
  const [difficulty, setDifficulty] = useState<StudyDifficulty>('MEDIUM');
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
        difficulty,
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

  const removeError = (
    remove.error as { response?: { data?: { message?: string | string[] } } } | null
  )?.response?.data?.message;
  const removeErrorText = Array.isArray(removeError) ? removeError.join(' · ') : removeError;

  return (
    <div style={s.page}>
      <PageHeader
        variant="light"
        title="Estudiar"
        subtitle="Escribe un tema de una de tus asignaturas y se creará un curso con teoría, ejercicios y un examen, todo generado para ti."
      />

      <Link to="/study/plan/new" className="vkb-card" style={s.planCta}>
        <span style={s.planCtaIcon}>
          <Icon name="shapes" size={26} />
        </span>
        <span style={s.planCtaBody}>
          <strong style={s.planCtaTitle}>Simulacro multi-tema</strong>
          <span style={s.planCtaSubtitle}>
            Combina varios temas como en un examen real
          </span>
        </span>
        <Icon name="chevron-right" size={18} color="var(--brand-deep)" />
      </Link>

      <form onSubmit={handleSubmit} className="vkb-card" style={s.form}>
        {/* Asignatura + tema */}
        <div className="field">
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

        {/* Ejercicios */}
        <div style={s.section}>
          <h3 style={s.sectionTitle}>
            <Icon name="target" size={16} color="var(--brand-deep)" />
            Ejercicios
          </h3>
          <div style={s.row}>
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
            <div className="field" style={{ flex: 2 }}>
              <label>Dificultad</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => setDifficulty(d.value)}
                    className={`chip${difficulty === d.value ? ' active' : ''}`}
                    style={s.chipFlex}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Examen */}
        <div style={s.section}>
          <h3 style={s.sectionTitle}>
            <Icon name="graduation" size={16} color="var(--brand-deep)" />
            Examen
          </h3>
          <div className="field">
            <label>Preguntas del examen</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {([5, 10] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNumQuestions(n)}
                  className={`chip${numQuestions === n ? ' active' : ''}`}
                  style={s.chipFlex}
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
            <Icon name="clock" size={15} color="var(--color-text-muted)" />
            <span>Límite de tiempo</span>
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
            <Icon name="lock" size={15} color="var(--color-text-muted)" />
            <span>Examen de un solo intento</span>
          </label>
        </div>

        {apiErrorText && <div className="alert alert-error">{apiErrorText}</div>}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={create.isPending || !courseId || topic.trim().length < 3}
          style={{ alignSelf: 'flex-start', padding: '12px 24px' }}
        >
          {create.isPending ? (
            <span className="spinner" />
          ) : (
            <>
              <Icon name="zap" size={16} />
              Crear curso de estudio
            </>
          )}
        </button>
      </form>

      <section style={s.results}>
        <h2 className="section-label">Mis cursos de estudio</h2>
        {removeErrorText && (
          <div className="alert alert-error" style={{ marginTop: 14 }}>
            {removeErrorText}
          </div>
        )}
        {unitsLoading && <p style={s.muted}>Cargando…</p>}
        {!unitsLoading && (units?.length ?? 0) === 0 && (
          <EmptyState
            icon="brain"
            title="Aún no has creado ningún curso"
            message="Escribe un tema arriba para empezar."
          />
        )}
        {!unitsLoading && (units?.length ?? 0) > 0 && (
          <div className="numbered-grid" style={s.list}>
            {(units ?? []).map((u, i) => (
              <article
                key={u.id}
                className="vkb-card numbered-card"
                style={{
                  ...s.item,
                  animation: `riseIn 0.5s cubic-bezier(0.18, 0.72, 0.24, 1.12) ${i * 60}ms both`,
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`¿Borrar "${u.title}"?`)) remove.mutate(u.id);
                  }}
                  style={s.deleteBtn}
                  aria-label="Borrar unidad"
                >
                  <Icon name="close" size={16} />
                </button>
                <Link to={`/study/${u.id}`} style={s.itemLink}>
                  <strong style={s.itemTitle}>{u.title}</strong>
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
              </article>
            ))}
          </div>
        )}
      </section>

      <section style={s.results}>
        <h2 className="section-label">Mis simulacros multi-tema</h2>
        {removePlan.isError && (
          <div className="alert alert-error" style={{ marginTop: 14 }}>
            {getApiErrorMessage(removePlan.error, 'No se pudo borrar el plan. Inténtalo de nuevo.')}
          </div>
        )}
        {plansLoading && <p style={s.muted}>Cargando…</p>}
        {!plansLoading && (plans?.length ?? 0) === 0 && (
          <EmptyState
            icon="shapes"
            title="Aún no has creado ningún simulacro multi-tema"
            message="Pulsa arriba en «Simulacro multi-tema» para combinar varios temas."
          />
        )}
        {!plansLoading && (plans?.length ?? 0) > 0 && (
          <div className="numbered-grid" style={s.list}>
            {(plans ?? []).map((p, i) => (
              <article
                key={p.id}
                className="vkb-card numbered-card"
                style={{
                  ...s.item,
                  animation: `riseIn 0.5s cubic-bezier(0.18, 0.72, 0.24, 1.12) ${i * 60}ms both`,
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`¿Borrar "${p.title}"?`)) removePlan.mutate(p.id);
                  }}
                  style={s.deleteBtn}
                  aria-label="Borrar plan"
                >
                  <Icon name="close" size={16} />
                </button>
                <Link to={`/study/plan/${p.id}`} style={s.itemLink}>
                  <strong style={s.itemTitle}>{p.title}</strong>
                  <span style={s.itemMeta}>
                    {p.course.title} · {p.topics.length} temas
                  </span>
                  <span style={s.planSections}>
                    <span style={p.sections.theory ? s.sectionOk : s.sectionMissing}>Apuntes</span>
                    <span style={p.sections.exercises ? s.sectionOk : s.sectionMissing}>
                      Ejercicios
                    </span>
                    <span style={p.sections.exam ? s.sectionOk : s.sectionMissing}>Examen</span>
                  </span>
                  <span style={s.itemDate}>
                    {new Date(p.createdAt).toLocaleDateString('es-ES', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </Link>
              </article>
            ))}
          </div>
        )}
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
  planCta: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '18px 22px',
    textDecoration: 'none',
    cursor: 'pointer',
  },
  planCtaIcon: {
    flex: 'none',
    width: 52,
    height: 52,
    borderRadius: 14,
    display: 'grid',
    placeItems: 'center',
    color: 'var(--brand-deep)',
    background: 'var(--brand-soft)',
  },
  planCtaBody: { flex: 1, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 },
  planCtaTitle: { fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text)' },
  planCtaSubtitle: { fontSize: '0.875rem', color: 'var(--color-text-muted)' },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  row: { display: 'flex', gap: 16, flexWrap: 'wrap' },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: 16,
    border: '1px solid var(--color-border)',
    borderRadius: 10,
    background: 'var(--color-bg)',
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    margin: 0,
    fontSize: '0.95rem',
    fontWeight: 700,
    color: 'var(--color-text)',
  },
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
  chipFlex: { flex: 1 },
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
  results: { display: 'flex', flexDirection: 'column', gap: 16 },
  list: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 18,
  },
  item: {
    position: 'relative',
  },
  itemLink: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    paddingRight: 28,
    color: 'var(--color-text)',
    textDecoration: 'none',
  },
  itemTitle: { fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.3 },
  itemMeta: { fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: 1.4 },
  itemDate: { fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 },
  planSections: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  sectionOk: {
    fontSize: '0.68rem',
    fontWeight: 700,
    color: 'var(--brand-deep)',
    background: 'var(--brand-soft)',
    padding: '2px 8px',
    borderRadius: 999,
  },
  sectionMissing: {
    fontSize: '0.68rem',
    fontWeight: 700,
    color: 'var(--color-error)',
    background: 'rgba(220,38,38,0.08)',
    padding: '2px 8px',
    borderRadius: 999,
  },
  deleteBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    display: 'inline-flex',
    background: 'transparent',
    border: 'none',
    color: 'var(--color-text-muted)',
    padding: 4,
    borderRadius: 6,
    cursor: 'pointer',
  },
};
