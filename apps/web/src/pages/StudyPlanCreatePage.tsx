import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { StudyDifficulty, StudyPlanTopicInput } from '@vkbacademy/shared';
import { useCourses, useCourse, useSubjects } from '../hooks/useCourses';
import { useCreateStudyPlan } from '../hooks/useStudyPlans';
import { getApiErrorMessage } from '../utils/errorMessage';
import PageHeader from '../components/ui/PageHeader';
import Icon from '../components/ui/Icon';

const DIFFICULTIES: { value: StudyDifficulty; label: string }[] = [
  { value: 'EASY', label: 'Fácil' },
  { value: 'MEDIUM', label: 'Media' },
  { value: 'HARD', label: 'Difícil' },
];

const MAX_TOPICS = 6;

// Tema ya elegido para el plan (oficial u propio), con etiqueta lista para mostrar en el chip.
interface SelectedTopic {
  key: string;
  kind: 'OFFICIAL' | 'CUSTOM';
  moduleId?: string;
  title: string;
  subject?: string;
  label: string;
}

export default function StudyPlanCreatePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const { data: coursesData } = useCourses(1);
  const courses = coursesData?.data ?? [];

  const [courseId, setCourseId] = useState(searchParams.get('courseId') ?? '');
  const { data: courseDetail } = useCourse(courseId);
  const { data: subjects } = useSubjects();

  const [selectedTopics, setSelectedTopics] = useState<SelectedTopic[]>([]);
  const [customTitle, setCustomTitle] = useState('');
  const [customSubject, setCustomSubject] = useState(''); // '' = asignatura base
  const [customError, setCustomError] = useState('');

  const [numExercises, setNumExercises] = useState(5);
  const [difficulty, setDifficulty] = useState<StudyDifficulty>('MEDIUM');
  const [numQuestions, setNumQuestions] = useState<5 | 10>(5);
  const [useTimer, setUseTimer] = useState(false);
  const [timerMins, setTimerMins] = useState(15);
  const [onlyOnce, setOnlyOnce] = useState(false);

  const create = useCreateStudyPlan();

  function handleCourseChange(id: string) {
    setCourseId(id);
    // El temario y los temas propios "de otra asignatura" dependen de la base: se limpian al cambiarla.
    setSelectedTopics([]);
    setCustomSubject('');
  }

  // Materias de otras asignaturas matriculadas (con subject propio, distintas de la base),
  // deduplicadas por nombre de materia normalizado.
  const otherSubjectOptions = useMemo(() => {
    if (!subjects) return [];
    const seen = new Map<string, string>();
    for (const c of subjects) {
      if (!c.isEnrolled || !c.subject || c.id === courseId) continue;
      const key = c.subject.trim().toLowerCase();
      if (!seen.has(key)) seen.set(key, c.subject.trim());
    }
    return [...seen.values()];
  }, [subjects, courseId]);

  const atMax = selectedTopics.length >= MAX_TOPICS;

  function toggleModule(module: { id: string; title: string; order: number }) {
    setSelectedTopics((prev) => {
      const exists = prev.some((t) => t.kind === 'OFFICIAL' && t.moduleId === module.id);
      if (exists) return prev.filter((t) => !(t.kind === 'OFFICIAL' && t.moduleId === module.id));
      if (prev.length >= MAX_TOPICS) return prev;
      return [
        ...prev,
        {
          key: `official-${module.id}`,
          kind: 'OFFICIAL',
          moduleId: module.id,
          title: module.title,
          label: `Tema ${module.order + 1} — ${module.title}`,
        },
      ];
    });
  }

  function addCustomTopic() {
    const title = customTitle.trim();
    if (title.length < 3 || atMax) return;
    // Guardia de duplicados en cliente (el 422 del backend queda como red de seguridad)
    const normalized = title.toLowerCase();
    if (selectedTopics.some((t) => t.title.trim().toLowerCase() === normalized)) {
      setCustomError('Ese tema ya está en el plan.');
      return;
    }
    const subject = customSubject || undefined;
    setSelectedTopics((prev) => [
      ...prev,
      {
        key: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        kind: 'CUSTOM',
        title,
        subject,
        label: subject ? `${title} (${subject})` : title,
      },
    ]);
    setCustomTitle('');
    setCustomSubject('');
    setCustomError('');
  }

  function removeTopic(key: string) {
    setSelectedTopics((prev) => prev.filter((t) => t.key !== key));
  }

  const needsMoreQuestions = numQuestions < selectedTopics.length;
  const needsMoreExercises = numExercises < selectedTopics.length;
  const canSubmit =
    !!courseId &&
    selectedTopics.length > 0 &&
    !needsMoreQuestions &&
    !needsMoreExercises &&
    !create.isPending;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    const topics: StudyPlanTopicInput[] = selectedTopics.map((t) =>
      t.kind === 'OFFICIAL'
        ? { moduleId: t.moduleId! }
        : t.subject
          ? { title: t.title, subject: t.subject }
          : { title: t.title },
    );
    create.mutate(
      {
        courseId,
        topics,
        numExercises,
        difficulty,
        numQuestions,
        timeLimit: useTimer ? Math.round(timerMins * 60) : undefined,
        onlyOnce,
      },
      { onSuccess: (plan) => navigate(`/study/plan/${plan.id}`) },
    );
  }

  const modules = courseDetail?.modules ?? [];

  return (
    <div style={s.page}>
      <PageHeader
        variant="light"
        title="Simulacro multi-tema"
        subtitle="Combina varios temas de tu temario (o temas propios) en un único examen, como en un examen real."
      />

      <form onSubmit={handleSubmit} className="dash-grid">
        {/* Columna principal: elección de temas */}
        <div style={s.col}>
          <div className="vkb-card" style={s.section}>
            <h3 style={s.sectionTitle}>
              <Icon name="shapes" size={16} color="var(--brand-deep)" />
              Asignatura base
            </h3>
            <div className="field">
              <label htmlFor="courseId">Asignatura</label>
              <select
                id="courseId"
                value={courseId}
                onChange={(e) => handleCourseChange(e.target.value)}
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
          </div>

          {courseId && (
            <div className="vkb-card" style={s.section}>
              <h3 style={s.sectionTitle}>
                <Icon name="book" size={16} color="var(--brand-deep)" />
                Temario oficial
              </h3>
              {!courseDetail && <p style={s.muted}>Cargando temario…</p>}
              {courseDetail && modules.length === 0 && (
                <p style={s.muted}>Esta asignatura aún no tiene módulos publicados.</p>
              )}
              {modules.length > 0 && (
                <ul style={s.checklist}>
                  {modules.map((m) => {
                    const isSelected = selectedTopics.some(
                      (t) => t.kind === 'OFFICIAL' && t.moduleId === m.id,
                    );
                    const disabled = !isSelected && atMax;
                    return (
                      <li key={m.id}>
                        <label style={{ ...s.checkboxRow, opacity: disabled ? 0.5 : 1 }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={disabled}
                            onChange={() => toggleModule(m)}
                          />
                          Tema {m.order + 1} — {m.title}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {courseId && (
            <div className="vkb-card" style={s.section}>
              <h3 style={s.sectionTitle}>
                <Icon name="zap" size={16} color="var(--brand-deep)" />
                Añadir tema propio
              </h3>
              <div className="field">
                <label htmlFor="customTitle">Tema</label>
                <input
                  id="customTitle"
                  type="text"
                  value={customTitle}
                  onChange={(e) => {
                    setCustomTitle(e.target.value);
                    setCustomError('');
                  }}
                  placeholder="Ej: verbos irregulares, la célula, ecuaciones de segundo grado..."
                  disabled={atMax}
                />
              </div>
              {otherSubjectOptions.length > 0 && (
                <div className="field">
                  <label htmlFor="customSubject">¿De qué asignatura es?</label>
                  <select
                    id="customSubject"
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                    disabled={atMax}
                  >
                    <option value="">Esta asignatura (base)</option>
                    {otherSubjectOptions.map((subj) => (
                      <option key={subj} value={subj}>
                        {subj}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <button
                type="button"
                className="btn btn-ghost"
                onClick={addCustomTopic}
                disabled={atMax || customTitle.trim().length < 3}
                style={{ alignSelf: 'flex-start' }}
              >
                <Icon name="zap" size={14} />
                Añadir
              </button>
              {customError && <p style={s.warn}>{customError}</p>}
              {atMax && <p style={s.warn}>Máximo {MAX_TOPICS} temas por plan.</p>}
            </div>
          )}

          {selectedTopics.length > 0 && (
            <div className="vkb-card" style={s.section}>
              <h3 style={s.sectionTitle}>
                Temas del plan
                <span style={s.counter}>
                  {selectedTopics.length} / {MAX_TOPICS}
                </span>
              </h3>
              <ul style={s.chipList}>
                {selectedTopics.map((t, i) => (
                  <li key={t.key} className="chip" style={s.topicChip}>
                    <span style={s.topicChipNum}>{i + 1}</span>
                    <span style={s.topicChipLabel}>{t.label}</span>
                    <span style={s.topicChipTag}>
                      {t.kind === 'OFFICIAL' ? 'Oficial' : 'Propio'}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeTopic(t.key)}
                      style={s.chipRemove}
                      aria-label={`Quitar ${t.label}`}
                    >
                      <Icon name="close" size={13} />
                    </button>
                  </li>
                ))}
              </ul>
              <p style={s.muted}>El examen tendrá al menos 1 pregunta de cada uno.</p>
            </div>
          )}
        </div>

        {/* Rail lateral: configuración de ejercicios/examen + envío */}
        <div style={s.col}>
          <div className="vkb-card" style={s.section}>
            <h3 style={s.sectionTitle}>
              <Icon name="target" size={16} color="var(--brand-deep)" />
              Ejercicios
            </h3>
            <div className="field">
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
            <div className="field">
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

          <div className="vkb-card" style={s.section}>
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

            {needsMoreQuestions && (
              <p style={s.warn}>
                Con {selectedTopics.length} temas necesitas al menos {selectedTopics.length}{' '}
                preguntas (1 por tema): elige 10 preguntas o quita algún tema.
              </p>
            )}
            {needsMoreExercises && (
              <p style={s.warn}>
                Con {selectedTopics.length} temas necesitas al menos {selectedTopics.length}{' '}
                ejercicios (1 por tema): sube el número de ejercicios o quita algún tema.
              </p>
            )}
            {selectedTopics.length === 0 && (
              <p style={s.warn}>Añade al menos 1 tema para poder crear el plan.</p>
            )}
          </div>

          {create.isError && (
            <div className="alert alert-error">
              {getApiErrorMessage(create.error, 'No se pudo crear el plan. Inténtalo de nuevo.')}
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={!canSubmit} style={s.submitBtn}>
            {create.isPending ? (
              <span className="spinner" />
            ) : (
              <>
                <Icon name="zap" size={16} />
                Crear plan de estudio
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '32px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  col: { display: 'flex', flexDirection: 'column', gap: 20 },
  section: { display: 'flex', flexDirection: 'column', gap: 12 },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    margin: 0,
    fontSize: '0.95rem',
    fontWeight: 700,
    color: 'var(--color-text)',
  },
  counter: {
    marginLeft: 'auto',
    fontSize: '0.75rem',
    fontWeight: 700,
    color: 'var(--brand-deep)',
    background: 'var(--brand-soft)',
    padding: '2px 10px',
    borderRadius: 999,
  },
  muted: { color: 'var(--color-text-muted)', fontSize: '0.875rem', margin: 0 },
  warn: { color: 'var(--color-error)', fontSize: '0.8125rem', margin: 0, lineHeight: 1.4 },
  checklist: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  checkboxRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: '0.9rem',
    color: 'var(--color-text)',
    cursor: 'pointer',
    padding: '4px 0',
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
  chipList: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  topicChip: { width: '100%', justifyContent: 'flex-start', cursor: 'default', padding: '8px 14px' },
  topicChipNum: {
    fontFamily: 'var(--font-display)',
    color: 'var(--brand-deep)',
    fontWeight: 700,
    flexShrink: 0,
  },
  topicChipLabel: { flex: 1, color: 'var(--color-text)', fontWeight: 600, textAlign: 'left' },
  topicChipTag: {
    fontSize: '0.7rem',
    fontWeight: 700,
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  chipRemove: {
    display: 'inline-flex',
    background: 'transparent',
    border: 'none',
    color: 'var(--color-text-muted)',
    cursor: 'pointer',
    padding: 2,
    flexShrink: 0,
  },
  submitBtn: { padding: '12px 24px', justifyContent: 'center' },
};
