import { Fragment, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type {
  StudyPlanDetail,
  StudyPlanExamInfo,
  StudyPlanExamLevel,
  StudyPlanExercise,
  StudyPlanTopicDetail,
} from '@vkbacademy/shared';
import {
  useStudyPlan,
  useDeleteStudyPlan,
  useRegenerateTopicTheory,
  useRegeneratePlanExercises,
  useGeneratePlanExam,
  useRenameStudyPlan,
} from '../hooks/useStudyPlans';
import TheoryView from '../components/theory/TheoryView';
import ExercisePractice from '../components/exercises/ExercisePractice';
import { getApiErrorMessage } from '../utils/errorMessage';
import PageHeader from '../components/ui/PageHeader';
import Icon from '../components/ui/Icon';
import EmptyState from '../components/ui/EmptyState';

type Tab = 'theory' | 'exercises' | 'exam';

const STEPS: { key: Tab; label: string; icon: string; desc: string }[] = [
  { key: 'theory', label: 'Apuntes', icon: 'book', desc: 'Estudia cada tema del curso' },
  { key: 'exercises', label: 'Ejercicios', icon: 'target', desc: 'Practica tema a tema lo aprendido' },
  { key: 'exam', label: 'Examen', icon: 'graduation', desc: 'Apruébalo en 3 niveles: básico, medio y difícil' },
];

// Niveles del examen con su configuración por defecto (presets del backend).
const EXAM_LEVELS: { key: StudyPlanExamLevel; label: string; preset: string }[] = [
  { key: 'BASIC', label: 'Básico', preset: '5 preguntas · fáciles' },
  { key: 'MEDIUM', label: 'Medio', preset: '8 preguntas · medias' },
  { key: 'HARD', label: 'Difícil', preset: '10 preguntas · difíciles' },
];

const PASS_SCORE = 50;

// Mismo look&feel de itinerario que StudyUnitPage (no se toca ese fichero: copia local).
const STEPPER_CSS = `
  .unit-steps { display: flex; align-items: stretch; gap: 6px; margin-top: 10px; }
  .unit-step {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px 18px;
    background: var(--color-surface);
    border: 1.5px solid var(--color-border);
    border-radius: 14px;
    cursor: pointer;
    text-align: left;
    color: var(--color-text);
    font-family: inherit;
    transition: border-color 0.15s, transform 0.15s, box-shadow 0.15s;
  }
  .unit-step:hover { border-color: var(--brand); transform: translateY(-2px); }
  .unit-step.is-active {
    border-color: var(--brand);
    background: var(--brand-soft);
    box-shadow: 0 0 0 3px var(--brand-soft);
  }
  .unit-step-num {
    flex: none;
    width: 46px;
    height: 46px;
    border-radius: 12px;
    display: grid;
    place-items: center;
    font-family: var(--font-display);
    font-size: 1.6rem;
    line-height: 1;
    color: var(--brand-deep);
    background: var(--brand-soft);
    border: 1px solid var(--brand);
    transition: background 0.15s, color 0.15s;
  }
  .unit-step.is-active .unit-step-num { background: var(--brand); color: #fff; }
  .unit-step-body { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
  .unit-step-title { display: inline-flex; align-items: center; gap: 6px; font-weight: 800; font-size: 1rem; }
  .unit-step-desc { font-size: 0.8rem; color: var(--color-text-muted); line-height: 1.35; }
  .unit-step-arrow { align-self: center; color: var(--color-text-muted); flex: none; display: grid; place-items: center; }
  @media (max-width: 720px) {
    .unit-steps { flex-direction: column; }
    .unit-step-arrow { transform: rotate(90deg); }
  }
  .topic-deck-toggle {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    background: transparent;
    border: none;
    padding: 0;
    cursor: pointer;
    text-align: left;
    color: var(--color-text);
    font-family: inherit;
  }
`;

export default function StudyPlanPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = useStudyPlan(id);
  const remove = useDeleteStudyPlan();
  const rename = useRenameStudyPlan(id);
  const [tab, setTab] = useState<Tab>('theory');
  // null = no se está editando; string = borrador del título nuevo.
  const [titleDraft, setTitleDraft] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div style={s.page}>
        <p style={s.muted}>Cargando plan de estudio…</p>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div style={s.page}>
        <EmptyState
          icon="brain"
          title="No se encontró el plan de estudio"
          action={
            <Link to="/study" className="btn btn-ghost">
              <Icon name="chevron-left" size={14} />
              Volver a Estudiar
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div style={s.page}>
      <Link to="/study" style={s.backLink}>
        <Icon name="chevron-left" size={14} color="var(--brand-deep)" />
        Volver a Estudiar
      </Link>

      <span style={s.eyebrow}>
        {data.course.title} · {data.topics.length} temas
      </span>

      {titleDraft === null ? (
        <div style={s.titleRow}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <PageHeader variant="light" title={data.title} subtitle={data.summary} />
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            style={s.renameBtn}
            onClick={() => setTitleDraft(data.title)}
          >
            Renombrar
          </button>
        </div>
      ) : (
        <div style={s.renameRow}>
          <input
            type="text"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            maxLength={200}
            autoFocus
            aria-label="Nuevo nombre del curso"
            style={s.renameInput}
          />
          <button
            type="button"
            className="btn btn-primary"
            disabled={titleDraft.trim().length < 3 || rename.isPending}
            onClick={() =>
              rename.mutate(titleDraft.trim(), { onSuccess: () => setTitleDraft(null) })
            }
          >
            {rename.isPending ? <span className="spinner" /> : 'Guardar'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setTitleDraft(null)}>
            Cancelar
          </button>
        </div>
      )}
      {rename.isError && (
        <div className="alert alert-error">
          {getApiErrorMessage(rename.error, 'No se pudo renombrar el curso. Inténtalo de nuevo.')}
        </div>
      )}

      <style>{STEPPER_CSS}</style>
      <nav className="unit-steps" aria-label="Itinerario del plan de estudio">
        {STEPS.map((t, i) => (
          <Fragment key={t.key}>
            {i > 0 && (
              <span className="unit-step-arrow" aria-hidden="true">
                <Icon name="chevron-right" size={20} />
              </span>
            )}
            <button
              type="button"
              onClick={() => setTab(t.key)}
              className={`unit-step${tab === t.key ? ' is-active' : ''}`}
              aria-current={tab === t.key ? 'step' : undefined}
            >
              <span className="unit-step-num" aria-hidden="true">
                {i + 1}
              </span>
              <span className="unit-step-body">
                <span className="unit-step-title">
                  <Icon name={t.icon} size={16} />
                  {t.label}
                  {/* El examen se genera lazy por niveles: no generado no es un fallo */}
                  {t.key !== 'exam' && !data.sections[t.key] && (
                    <span style={s.tabWarn} title="Sección no generada">
                      !
                    </span>
                  )}
                </span>
                <span className="unit-step-desc">{t.desc}</span>
              </span>
            </button>
          </Fragment>
        ))}
      </nav>

      <div style={s.content}>
        {tab === 'theory' && <TheoryTab plan={data} />}
        {tab === 'exercises' && <ExercisesTab plan={data} />}
        {tab === 'exam' && (
          <ExamTab
            plan={data}
            onStart={(bankId) => navigate(`/exam?aiBankId=${bankId}&returnTo=/study/plan/${id}`)}
          />
        )}
      </div>

      <footer style={s.footer}>
        <button
          type="button"
          onClick={() => {
            if (window.confirm('¿Borrar este plan de estudio?')) {
              remove.mutate(id, { onSuccess: () => navigate('/study') });
            }
          }}
          disabled={remove.isPending}
          style={s.deleteBtn}
        >
          {remove.isPending ? (
            <span className="spinner" />
          ) : (
            <>
              <Icon name="close" size={14} />
              Borrar plan
            </>
          )}
        </button>
      </footer>
      {remove.isError && (
        <div className="alert alert-error">
          {getApiErrorMessage(remove.error, 'No se pudo borrar el plan. Inténtalo de nuevo.')}
        </div>
      )}
    </div>
  );
}

// Estado vacío + reintento de una sección, idéntico al de StudyUnitPage (no exportado desde allí: copia local).
function MissingSection({
  label,
  icon,
  onRetry,
  retrying,
  isError,
  error,
}: {
  label: string;
  icon: string;
  onRetry: () => void;
  retrying: boolean;
  isError?: boolean;
  error?: unknown;
}) {
  return (
    <div className="vkb-card">
      <EmptyState
        icon={icon}
        title={`No se pudo generar ${label}`}
        message={
          isError
            ? getApiErrorMessage(error, 'Error al regenerar. Inténtalo de nuevo.')
            : 'Puedes reintentarlo.'
        }
        action={
          <button type="button" className="btn btn-primary" onClick={onRetry} disabled={retrying}>
            {retrying ? (
              <span className="spinner" />
            ) : (
              <>
                <Icon name="zap" size={16} />
                Reintentar generación
              </>
            )}
          </button>
        }
      />
    </div>
  );
}

// ─── Apuntes: una tarjeta-deck por tema, colapsable ───────────────────────────

function TheoryTab({ plan }: { plan: StudyPlanDetail }) {
  const [expandedId, setExpandedId] = useState<string | null>(plan.topics[0]?.id ?? null);
  return (
    <div style={s.deckList}>
      {plan.topics.map((topic, i) => (
        <TopicTheoryDeck
          key={topic.id}
          planId={plan.id}
          topic={topic}
          courseTitle={plan.course.title}
          index={i}
          isOpen={expandedId === topic.id}
          onToggle={() => setExpandedId((cur) => (cur === topic.id ? null : topic.id))}
        />
      ))}
    </div>
  );
}

function TopicTheoryDeck({
  planId,
  topic,
  courseTitle,
  index,
  isOpen,
  onToggle,
}: {
  planId: string;
  topic: StudyPlanTopicDetail;
  courseTitle: string;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const regen = useRegenerateTopicTheory(planId);
  return (
    <div className="vkb-card" style={s.deckCard}>
      <button
        type="button"
        className="topic-deck-toggle"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <span style={s.deckNum}>{index + 1}</span>
        <span style={s.deckBody}>
          <span style={s.deckTitle}>{topic.title}</span>
          <span style={s.deckTag}>
            {topic.source === 'OFFICIAL' ? 'Oficial' : 'Propio'}
            {topic.subject ? ` · ${topic.subject}` : ''}
          </span>
        </span>
        <Icon
          name="chevron-right"
          size={18}
          style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}
        />
      </button>
      {isOpen && (
        <div style={s.deckContent}>
          {topic.hasTheory && topic.theory ? (
            <TheoryView module={topic.theory} courseTitle={courseTitle} />
          ) : (
            <MissingSection
              label={`la teoría de "${topic.title}"`}
              icon="book"
              onRetry={() => regen.mutate(topic.id)}
              retrying={regen.isPending}
              isError={regen.isError}
              error={regen.error}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Ejercicios: agrupados por tema, misma UX de resolución que StudyUnitPage ──

function groupExercisesByTopic(
  exercises: StudyPlanExercise[],
): { topicLabel: string; items: StudyPlanExercise[] }[] {
  const order: string[] = [];
  const map = new Map<string, StudyPlanExercise[]>();
  for (const ex of exercises) {
    if (!map.has(ex.topicLabel)) {
      map.set(ex.topicLabel, []);
      order.push(ex.topicLabel);
    }
    map.get(ex.topicLabel)!.push(ex);
  }
  return order.map((topicLabel) => ({ topicLabel, items: map.get(topicLabel)! }));
}

function ExercisesTab({ plan }: { plan: StudyPlanDetail }) {
  const regen = useRegeneratePlanExercises(plan.id);
  const groups = groupExercisesByTopic(plan.exercises ?? []);
  // Mismo patrón de bloques colapsables por tema que el tab de Apuntes.
  const [expandedLabel, setExpandedLabel] = useState<string | null>(
    groups[0]?.topicLabel ?? null,
  );
  if (!plan.exercises || plan.exercises.length === 0) {
    return (
      <MissingSection
        label="los ejercicios"
        icon="target"
        onRetry={() => regen.mutate(undefined)}
        retrying={regen.isPending}
        isError={regen.isError}
        error={regen.error}
      />
    );
  }
  return (
    <div style={s.deckList}>
      {groups.map((g, i) => {
        const isOpen = expandedLabel === g.topicLabel;
        return (
          <div key={g.topicLabel} className="vkb-card" style={s.deckCard}>
            <button
              type="button"
              className="topic-deck-toggle"
              onClick={() =>
                setExpandedLabel((cur) => (cur === g.topicLabel ? null : g.topicLabel))
              }
              aria-expanded={isOpen}
            >
              <span style={s.deckNum}>{i + 1}</span>
              <span style={s.deckBody}>
                <span style={s.deckTitle}>{g.topicLabel}</span>
                <span style={s.deckTag}>
                  {g.items.length} {g.items.length === 1 ? 'ejercicio' : 'ejercicios'}
                </span>
              </span>
              <Icon
                name="chevron-right"
                size={18}
                style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}
              />
            </button>
            {isOpen && (
              <div style={s.deckContent}>
                <ExercisePractice exercises={g.items} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Examen: 3 niveles (básico/medio/difícil) generados lazy, combinados o por tema ──

function ExamTab({ plan, onStart }: { plan: StudyPlanDetail; onStart: (bankId: string) => void }) {
  const gen = useGeneratePlanExam(plan.id);
  const [mode, setMode] = useState<'COMBINED' | 'PER_TOPIC'>('COMBINED');
  // Qué tarjeta está generando: `${topicId ?? 'all'}:${level}`.
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const exams = plan.exams ?? [];
  const legacyExams = exams.filter((e) => !e.level);
  const findExam = (topicId: string | null, level: StudyPlanExamLevel) =>
    exams.find((e) => e.level === level && e.topicId === topicId);

  function generate(topicId: string | null, level: StudyPlanExamLevel, numQuestions?: number) {
    const key = `${topicId ?? 'all'}:${level}`;
    setPendingKey(key);
    gen.mutate(
      { level, topicId: topicId ?? undefined, numQuestions },
      { onSettled: () => setPendingKey(null) },
    );
  }

  const combinedPassed = EXAM_LEVELS.filter((l) => {
    const exam = findExam(null, l.key);
    return exam?.bestScore != null && exam.bestScore >= PASS_SCORE;
  }).length;

  return (
    <div style={s.deckList}>
      <div className="vkb-card" style={s.examIntro}>
        <p style={s.examIntroText}>
          No te conformes con aprobar el nivel básico: el reto es aprobar <strong>los 3 niveles</strong>.
          {mode === 'COMBINED' && ` Llevas ${combinedPassed} de 3.`}
        </p>
        <div style={s.examModeRow} role="group" aria-label="Modo de examen">
          <button
            type="button"
            className={`chip${mode === 'COMBINED' ? ' active' : ''}`}
            onClick={() => setMode('COMBINED')}
          >
            Todos los temas juntos
          </button>
          <button
            type="button"
            className={`chip${mode === 'PER_TOPIC' ? ' active' : ''}`}
            onClick={() => setMode('PER_TOPIC')}
          >
            Un examen por tema
          </button>
        </div>
      </div>

      {gen.isError && (
        <div className="alert alert-error">
          {getApiErrorMessage(gen.error, 'No se pudo generar el examen. Inténtalo de nuevo.')}
        </div>
      )}

      {mode === 'COMBINED' ? (
        <div style={s.levelGrid}>
          {EXAM_LEVELS.map((l) => (
            <ExamLevelCard
              key={l.key}
              level={l}
              exam={findExam(null, l.key)}
              busy={pendingKey === `all:${l.key}`}
              anyBusy={pendingKey !== null}
              onGenerate={(numQuestions) => generate(null, l.key, numQuestions)}
              onStart={onStart}
            />
          ))}
        </div>
      ) : (
        plan.topics.map((topic, i) => (
          <div key={topic.id} style={s.examTopicBlock}>
            <h3 style={s.examTopicTitle}>
              <span style={s.deckNum}>{i + 1}</span>
              {topic.title}
            </h3>
            <div style={s.levelGrid}>
              {EXAM_LEVELS.map((l) => (
                <ExamLevelCard
                  key={l.key}
                  level={l}
                  exam={findExam(topic.id, l.key)}
                  busy={pendingKey === `${topic.id}:${l.key}`}
                  anyBusy={pendingKey !== null}
                  onGenerate={(numQuestions) => generate(topic.id, l.key, numQuestions)}
                  onStart={onStart}
                />
              ))}
            </div>
          </div>
        ))
      )}

      {legacyExams.map((exam) => (
        <div key={exam.id} className="vkb-card" style={s.examCard}>
          <div>
            <div style={s.examTitle}>{exam.title}</div>
            <div style={s.examMeta}>
              <span>{exam.numQuestions} preguntas</span>
              {exam.attemptCount > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    {exam.attemptCount} {exam.attemptCount === 1 ? 'intento' : 'intentos'}
                  </span>
                </>
              )}
            </div>
          </div>
          <button className="btn btn-primary" style={s.examStart} onClick={() => onStart(exam.id)}>
            {exam.attemptCount > 0 ? 'Repetir' : 'Empezar'}
          </button>
        </div>
      ))}
    </div>
  );
}

function ExamLevelCard({
  level,
  exam,
  busy,
  anyBusy,
  onGenerate,
  onStart,
}: {
  level: { key: StudyPlanExamLevel; label: string; preset: string };
  exam: StudyPlanExamInfo | undefined;
  busy: boolean;
  anyBusy: boolean;
  onGenerate: (numQuestions?: number) => void;
  onStart: (bankId: string) => void;
}) {
  const [adjusting, setAdjusting] = useState(false);
  const [numQuestions, setNumQuestions] = useState<number | undefined>(undefined);

  const passed = exam?.bestScore != null && exam.bestScore >= PASS_SCORE;

  return (
    <div className="vkb-card" style={s.levelCard}>
      <div style={s.levelHeader}>
        <span style={s.levelName}>{level.label}</span>
        {passed && (
          <span style={s.levelPassed} title="Nivel aprobado">
            ✓ Aprobado
          </span>
        )}
      </div>

      {exam ? (
        <>
          <div style={s.examMeta}>
            <span>{exam.numQuestions} preguntas</span>
            {exam.attemptCount > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  {exam.attemptCount} {exam.attemptCount === 1 ? 'intento' : 'intentos'}
                </span>
              </>
            )}
            {exam.bestScore != null && (
              <>
                <span aria-hidden="true">·</span>
                <span style={passed ? s.scoreOk : s.scoreKo}>
                  Mejor nota: {Math.round(exam.bestScore)}%
                </span>
              </>
            )}
          </div>
          <button className="btn btn-primary" onClick={() => onStart(exam.id)}>
            {exam.attemptCount > 0 ? 'Repetir' : 'Empezar'}
          </button>
        </>
      ) : (
        <>
          <p style={s.levelPreset}>{level.preset}</p>
          {adjusting && (
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor={`nq-${level.key}`}>Nº de preguntas</label>
              <select
                id={`nq-${level.key}`}
                value={numQuestions ?? ''}
                onChange={(e) =>
                  setNumQuestions(e.target.value ? Number(e.target.value) : undefined)
                }
              >
                <option value="">Por defecto</option>
                {[5, 8, 10, 15, 20].map((n) => (
                  <option key={n} value={n}>
                    {n} preguntas
                  </option>
                ))}
              </select>
            </div>
          )}
          <div style={s.levelActions}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={anyBusy}
              onClick={() => onGenerate(numQuestions)}
            >
              {busy ? <span className="spinner" /> : 'Generar examen'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setAdjusting((v) => !v)}
            >
              {adjusting ? 'Ocultar ajustes' : 'Ajustar'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 1040,
    margin: '0 auto',
    padding: '24px 16px 64px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    color: 'var(--brand-deep)',
    fontSize: '0.875rem',
    textDecoration: 'none',
    fontWeight: 600,
    width: 'fit-content',
  },
  eyebrow: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  tabWarn: { color: 'var(--color-error)', fontWeight: 800 },
  content: { display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 },
  muted: { color: 'var(--color-text-muted)', fontSize: '0.95rem', margin: 0 },

  deckList: { display: 'flex', flexDirection: 'column', gap: 14 },
  deckCard: { display: 'flex', flexDirection: 'column', gap: 0 },
  deckNum: {
    flex: 'none',
    width: 34,
    height: 34,
    borderRadius: 10,
    display: 'grid',
    placeItems: 'center',
    fontFamily: 'var(--font-display)',
    fontSize: '1.1rem',
    color: 'var(--brand-deep)',
    background: 'var(--brand-soft)',
    border: '1px solid var(--brand)',
  },
  deckBody: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  deckTitle: { fontWeight: 700, fontSize: '0.9375rem', color: 'var(--color-text)' },
  deckTag: {
    fontSize: '0.7rem',
    fontWeight: 700,
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  deckContent: { marginTop: 16 },

  titleRow: { display: 'flex', alignItems: 'flex-start', gap: 12 },
  renameBtn: { flexShrink: 0, marginTop: 6 },
  renameRow: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  renameInput: {
    flex: 1,
    minWidth: 260,
    fontSize: '1.1rem',
    fontWeight: 700,
    padding: '10px 14px',
    background: 'var(--color-surface)',
    border: '1.5px solid var(--brand)',
    borderRadius: 10,
    color: 'var(--color-text)',
  },

  examIntro: { display: 'flex', flexDirection: 'column', gap: 12, padding: '18px 22px' },
  examIntroText: { margin: 0, fontSize: '0.95rem', color: 'var(--color-text)', lineHeight: 1.5 },
  examModeRow: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  levelGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
    gap: 14,
  },
  levelCard: { display: 'flex', flexDirection: 'column', gap: 12, padding: '18px 20px' },
  levelHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  levelName: {
    fontFamily: 'var(--font-display)',
    fontSize: '1.05rem',
    fontWeight: 800,
    color: 'var(--color-text)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  levelPassed: {
    fontSize: '0.75rem',
    fontWeight: 800,
    color: 'var(--color-success, #16a34a)',
    background: 'rgba(22,163,74,0.12)',
    padding: '3px 10px',
    borderRadius: 999,
  },
  levelPreset: { margin: 0, fontSize: '0.85rem', color: 'var(--color-text-muted)' },
  levelActions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  scoreOk: { color: 'var(--color-success, #16a34a)', fontWeight: 700 },
  scoreKo: { color: 'var(--color-text)', fontWeight: 700 },
  examTopicBlock: { display: 'flex', flexDirection: 'column', gap: 10 },
  examTopicTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    margin: '6px 0 0',
    fontSize: '0.95rem',
    fontWeight: 700,
    color: 'var(--color-text)',
  },

  examCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: '20px 24px',
    flexWrap: 'wrap',
  },
  examTitle: { fontWeight: 700, color: 'var(--color-text)', marginBottom: 6, fontSize: '1rem' },
  examMeta: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    fontSize: '0.8rem',
    color: 'var(--color-text-muted)',
  },
  examMetaItem: { display: 'inline-flex', alignItems: 'center', gap: 4 },
  examStart: { padding: '9px 20px', fontSize: '0.875rem', flexShrink: 0 },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: 12, flexWrap: 'wrap' },
  deleteBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    background: 'transparent',
    border: '1px solid rgba(220,38,38,0.4)',
    color: 'var(--color-error)',
    padding: '10px 18px',
    borderRadius: 8,
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
};
