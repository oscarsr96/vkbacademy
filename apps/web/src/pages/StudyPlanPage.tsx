import { Fragment, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { StudyPlanDetail, StudyPlanExercise, StudyPlanTopicDetail } from '@vkbacademy/shared';
import {
  useStudyPlan,
  useDeleteStudyPlan,
  useRegenerateTopicTheory,
  useRegeneratePlanExercises,
  useRegeneratePlanExam,
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
  { key: 'exam', label: 'Examen', icon: 'graduation', desc: 'Un examen con preguntas de cada tema' },
];

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
  const [tab, setTab] = useState<Tab>('theory');

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

      <PageHeader variant="light" title={data.title} subtitle={data.summary} />

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
                  {!data.sections[t.key] && (
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

// ─── Examen: mismo flujo AiExamBank que StudyUnitPage (sin código nuevo de examen) ──

function ExamTab({ plan, onStart }: { plan: StudyPlanDetail; onStart: (bankId: string) => void }) {
  const regen = useRegeneratePlanExam(plan.id);
  if (!plan.exam) {
    return (
      <MissingSection
        label="el examen"
        icon="graduation"
        onRetry={() => regen.mutate()}
        retrying={regen.isPending}
        isError={regen.isError}
        error={regen.error}
      />
    );
  }
  const { exam } = plan;
  const timeMinutes = exam.timeLimit ? Math.round(exam.timeLimit / 60) : null;
  return (
    <div className="vkb-card" style={s.examCard}>
      <div>
        <div style={s.examTitle}>{exam.title}</div>
        <div style={s.examMeta}>
          <span>{exam.questions.length} preguntas</span>
          {timeMinutes !== null && (
            <>
              <span aria-hidden="true">·</span>
              <span style={s.examMetaItem}>
                <Icon name="clock" size={12} />
                {timeMinutes} min
              </span>
            </>
          )}
          {exam.onlyOnce && (
            <>
              <span aria-hidden="true">·</span>
              <span style={s.examMetaItem}>
                <Icon name="lock" size={12} />1 intento
              </span>
            </>
          )}
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
