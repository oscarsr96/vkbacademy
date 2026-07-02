import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { StudyUnitDetail } from '@vkbacademy/shared';
import {
  useStudyUnit,
  useDeleteStudyUnit,
  useRegenerateTheory,
  useRegenerateExercises,
  useRegenerateExam,
} from '../hooks/useStudy';
import TheoryView from '../components/theory/TheoryView';
import ExercisePractice from '../components/exercises/ExercisePractice';
import { getApiErrorMessage } from '../utils/errorMessage';
import PageHeader from '../components/ui/PageHeader';
import Icon from '../components/ui/Icon';
import EmptyState from '../components/ui/EmptyState';

type Tab = 'theory' | 'exercises' | 'exam';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'theory', label: 'Teoría', icon: 'book' },
  { key: 'exercises', label: 'Ejercicios', icon: 'target' },
  { key: 'exam', label: 'Examen', icon: 'graduation' },
];

export default function StudyUnitPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = useStudyUnit(id);
  const remove = useDeleteStudyUnit();
  const [tab, setTab] = useState<Tab>('theory');

  if (isLoading) {
    return (
      <div style={s.page}>
        <p style={s.muted}>Cargando unidad…</p>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div style={s.page}>
        <EmptyState
          icon="brain"
          title="No se encontró la unidad de estudio"
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
        {data.course.title} · Tema: {data.topic}
      </span>

      <PageHeader variant="light" title={data.title} subtitle={data.summary} />

      <nav style={s.tabs}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`chip${tab === t.key ? ' active' : ''}`}
            aria-pressed={tab === t.key}
          >
            <Icon name={t.icon} size={14} />
            {t.label}
            {!data.sections[t.key] && (
              <span style={s.tabWarn} title="Sección no generada">
                !
              </span>
            )}
          </button>
        ))}
      </nav>

      <div style={s.content}>
        {tab === 'theory' && <TheoryTab unit={data} />}
        {tab === 'exercises' && <ExercisesTab unit={data} />}
        {tab === 'exam' && (
          <ExamTab
            unit={data}
            onStart={(bankId) => navigate(`/exam?aiBankId=${bankId}&returnTo=/study/${id}`)}
          />
        )}
      </div>

      <footer style={s.footer}>
        <button
          type="button"
          onClick={() => {
            if (window.confirm('¿Borrar esta unidad de estudio?')) {
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
              Borrar unidad
            </>
          )}
        </button>
      </footer>
    </div>
  );
}

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

function TheoryTab({ unit }: { unit: StudyUnitDetail }) {
  const regen = useRegenerateTheory(unit.id);
  if (!unit.theory) {
    return (
      <MissingSection
        label="la teoría"
        icon="book"
        onRetry={() => regen.mutate()}
        retrying={regen.isPending}
        isError={regen.isError}
        error={regen.error}
      />
    );
  }
  return <TheoryView module={unit.theory} />;
}

function ExercisesTab({ unit }: { unit: StudyUnitDetail }) {
  const regen = useRegenerateExercises(unit.id);
  if (!unit.exercises || unit.exercises.length === 0) {
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
  return <ExercisePractice exercises={unit.exercises} />;
}

function ExamTab({ unit, onStart }: { unit: StudyUnitDetail; onStart: (bankId: string) => void }) {
  const regen = useRegenerateExam(unit.id);
  if (!unit.exam) {
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
  const { exam } = unit;
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
    maxWidth: 900,
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
  tabs: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  tabWarn: { color: 'var(--color-error)', fontWeight: 800 },
  content: { display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 },
  muted: { color: 'var(--color-text-muted)', fontSize: '0.95rem', margin: 0 },
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
