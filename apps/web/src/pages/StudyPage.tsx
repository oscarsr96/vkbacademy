import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { StudyExercisesPerTopic, StudyPlanTopicInput } from '@vkbacademy/shared';
import { useCourses, useCourse, useSubjects } from '../hooks/useCourses';
import { useMyStudyPlans, useCreateStudyPlan, useDeleteStudyPlan } from '../hooks/useStudyPlans';
import { getApiErrorMessage } from '../utils/errorMessage';
import PageHeader from '../components/ui/PageHeader';
import Icon from '../components/ui/Icon';
import EmptyState from '../components/ui/EmptyState';

const MAX_TOPICS = 6;

// Reparto de ejercicios por tema (pedido del producto: 2 fáciles, 2 medios, 1 difícil).
const DEFAULT_PER_TOPIC: StudyExercisesPerTopic = { easy: 2, medium: 2, hard: 1 };

const SPLIT_FIELDS: { key: keyof StudyExercisesPerTopic; label: string }[] = [
  { key: 'easy', label: 'Fáciles' },
  { key: 'medium', label: 'Medios' },
  { key: 'hard', label: 'Difíciles' },
];

// Tema ya elegido para el curso (oficial u propio), con etiqueta lista para mostrar en el chip.
interface SelectedTopic {
  key: string;
  kind: 'OFFICIAL' | 'CUSTOM';
  moduleId?: string;
  title: string;
  subject?: string;
  label: string;
}

export default function StudyPage() {
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

  const [perTopic, setPerTopic] = useState<StudyExercisesPerTopic>(DEFAULT_PER_TOPIC);
  const perTopicTotal = perTopic.easy + perTopic.medium + perTopic.hard;

  const create = useCreateStudyPlan();

  const { data: plans, isLoading: plansLoading } = useMyStudyPlans();
  const removePlan = useDeleteStudyPlan();

  function setSplit(key: keyof StudyExercisesPerTopic, value: number) {
    setPerTopic((prev) => ({ ...prev, [key]: Math.max(0, Math.min(10, value)) }));
  }

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

  // displayNum = posición en el temario ordenado (el campo `order` de BD no es
  // fiable como numeral: hay cursos 0-based y 1-based).
  function toggleModule(module: { id: string; title: string }, displayNum: number) {
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
          label: `Tema ${displayNum} — ${module.title}`,
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
      setCustomError('Ese tema ya está en el curso.');
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

  const splitInvalid = perTopicTotal < 1 || perTopicTotal > 10;
  const canSubmit = !!courseId && selectedTopics.length > 0 && !splitInvalid && !create.isPending;

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
      { courseId, topics, exercisesPerTopic: perTopic },
      { onSuccess: (plan) => navigate(`/study/plan/${plan.id}`) },
    );
  }

  const modules = courseDetail?.modules ?? [];

  return (
    <div style={s.page}>
      <PageHeader
        variant="light"
        title="Estudiar"
        subtitle="Elige uno o varios temas de tus asignaturas y se creará un curso con teoría, ejercicios y examen, todo generado para ti."
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
            <p style={s.muted}>
              Con un solo tema ya puedes crear tu curso; combina varios si quieres prepararte un
              examen más completo.
            </p>
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
                  {modules.map((m, i) => {
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
                            onChange={() => toggleModule(m, i + 1)}
                          />
                          Tema {i + 1} — {m.title}
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
              {atMax && <p style={s.warn}>Máximo {MAX_TOPICS} temas por curso.</p>}
            </div>
          )}

          {selectedTopics.length > 0 && (
            <div className="vkb-card" style={s.section}>
              <h3 style={s.sectionTitle}>
                Temas del curso
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
              <p style={s.muted}>Cada tema tendrá su propio bloque de teoría y de ejercicios.</p>
            </div>
          )}
        </div>

        {/* Rail lateral: configuración de ejercicios + envío */}
        <div style={s.col}>
          <div className="vkb-card" style={s.section}>
            <h3 style={s.sectionTitle}>
              <Icon name="target" size={16} color="var(--brand-deep)" />
              Ejercicios por tema
            </h3>
            {SPLIT_FIELDS.map((f) => (
              <div className="field" key={f.key} style={s.splitRow}>
                <label htmlFor={`split-${f.key}`} style={s.splitLabel}>
                  {f.label}
                </label>
                <input
                  id={`split-${f.key}`}
                  type="number"
                  min={0}
                  max={10}
                  value={perTopic[f.key]}
                  onChange={(e) => setSplit(f.key, Number(e.target.value) || 0)}
                  style={s.splitInput}
                />
              </div>
            ))}
            <p style={s.muted}>
              {perTopicTotal} por tema
              {selectedTopics.length > 1 &&
                ` · ${selectedTopics.length} temas × ${perTopicTotal} = ${
                  selectedTopics.length * perTopicTotal
                } ejercicios`}
            </p>
            {splitInvalid && (
              <p style={s.warn}>El reparto debe sumar entre 1 y 10 ejercicios por tema.</p>
            )}
          </div>

          <div className="vkb-card" style={s.section}>
            <h3 style={s.sectionTitle}>
              <Icon name="graduation" size={16} color="var(--brand-deep)" />
              Exámenes
            </h3>
            <p style={s.muted}>
              Los exámenes se generan después, en la pestaña Examen del curso: niveles básico,
              medio y difícil, de todos los temas juntos o de cada tema por separado. El reto es
              aprobar los 3 niveles.
            </p>
            {selectedTopics.length === 0 && (
              <p style={s.warn}>Añade al menos 1 tema para poder crear el curso.</p>
            )}
          </div>

          {create.isError && (
            <div className="alert alert-error">
              {getApiErrorMessage(create.error, 'No se pudo crear el curso. Inténtalo de nuevo.')}
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={!canSubmit} style={s.submitBtn}>
            {create.isPending ? (
              <span className="spinner" />
            ) : (
              <>
                <Icon name="zap" size={16} />
                Crear curso de estudio
              </>
            )}
          </button>
        </div>
      </form>

      {/* Lista única de cursos de estudio (a ancho completo, bajo el formulario) */}
      <section style={s.results}>
        <h2 className="section-label">Mis cursos de estudio</h2>
        {removePlan.isError && (
          <div className="alert alert-error" style={{ marginTop: 14 }}>
            {getApiErrorMessage(removePlan.error, 'No se pudo borrar el curso. Inténtalo de nuevo.')}
          </div>
        )}
        {plansLoading && <p style={s.muted}>Cargando…</p>}
        {!plansLoading && (plans?.length ?? 0) === 0 && (
          <EmptyState
            icon="brain"
            title="Aún no has creado ningún curso"
            message="Elige arriba uno o varios temas para empezar."
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
                  aria-label="Borrar curso"
                >
                  <Icon name="close" size={16} />
                </button>
                <Link to={`/study/plan/${p.id}`} style={s.itemLink}>
                  <strong style={s.itemTitle}>{p.title}</strong>
                  <span style={s.itemMeta}>
                    {p.course.title} · {p.topics.length} {p.topics.length === 1 ? 'tema' : 'temas'}
                  </span>
                  <span style={s.planSections}>
                    <span style={p.sections.theory ? s.sectionOk : s.sectionMissing}>Apuntes</span>
                    <span style={p.sections.exercises ? s.sectionOk : s.sectionMissing}>
                      Ejercicios
                    </span>
                    {/* El examen se genera lazy por niveles: sin generar no es un fallo */}
                    <span style={p.sections.exam ? s.sectionOk : s.sectionPending}>Examen</span>
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
  splitRow: { display: 'flex', alignItems: 'center', gap: 12, flexDirection: 'row' },
  splitLabel: { flex: 1, margin: 0 },
  splitInput: { width: 90 },
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
  // Examen aún sin generar (es lazy por niveles): pendiente, no fallo.
  sectionPending: {
    fontSize: '0.68rem',
    fontWeight: 700,
    color: 'var(--color-text-muted)',
    background: 'rgba(0,0,0,0.05)',
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
