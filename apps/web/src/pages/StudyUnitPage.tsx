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

type Tab = 'theory' | 'exercises' | 'exam';

const TABS: { key: Tab; label: string }[] = [
  { key: 'theory', label: '📖 Teoría' },
  { key: 'exercises', label: '🧮 Ejercicios' },
  { key: 'exam', label: '🎓 Examen' },
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
        <p style={s.muted}>No se encontró la unidad de estudio.</p>
        <Link to="/study" style={s.backLink}>
          ← Volver a Estudiar
        </Link>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <Link to="/study" style={s.backLink}>
        ← Volver a Estudiar
      </Link>

      <header style={s.header}>
        <span style={s.eyebrow}>
          {data.course.title} · Tema: {data.topic}
        </span>
        <h1 style={s.title}>{data.title}</h1>
        {data.summary && <p style={s.summary}>{data.summary}</p>}
      </header>

      <nav style={s.tabs}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            style={{ ...s.tab, ...(tab === t.key ? s.tabActive : {}) }}
            aria-pressed={tab === t.key}
          >
            {t.label}
            {!data.sections[t.key] && (
              <span style={s.tabWarn} title="Sección no generada">
                {' '}
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
          {remove.isPending ? 'Borrando…' : '🗑️ Borrar unidad'}
        </button>
      </footer>
    </div>
  );
}

function MissingSection({
  label,
  onRetry,
  retrying,
}: {
  label: string;
  onRetry: () => void;
  retrying: boolean;
}) {
  return (
    <div style={s.missing}>
      <p style={s.muted}>No se pudo generar {label}. Puedes reintentarlo.</p>
      <button type="button" className="btn btn-primary" onClick={onRetry} disabled={retrying}>
        {retrying ? '⏳ Generando…' : '🔄 Reintentar generación'}
      </button>
    </div>
  );
}

function TheoryTab({ unit }: { unit: StudyUnitDetail }) {
  const regen = useRegenerateTheory(unit.id);
  if (!unit.theory) {
    return (
      <MissingSection label="la teoría" onRetry={() => regen.mutate()} retrying={regen.isPending} />
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
        onRetry={() => regen.mutate(undefined)}
        retrying={regen.isPending}
      />
    );
  }
  return <ExercisePractice exercises={unit.exercises} />;
}

function ExamTab({ unit, onStart }: { unit: StudyUnitDetail; onStart: (bankId: string) => void }) {
  const regen = useRegenerateExam(unit.id);
  if (!unit.exam) {
    return (
      <MissingSection label="el examen" onRetry={() => regen.mutate()} retrying={regen.isPending} />
    );
  }
  const { exam } = unit;
  const timeMinutes = exam.timeLimit ? Math.round(exam.timeLimit / 60) : null;
  return (
    <div className="vkb-card" style={s.examCard}>
      <div>
        <div style={s.examTitle}>{exam.title}</div>
        <div style={s.examMeta}>
          {exam.questions.length} preguntas
          {timeMinutes !== null && ` · ⏱ ${timeMinutes} min`}
          {exam.onlyOnce && ' · 🔒 1 intento'}
          {exam.attemptCount > 0 &&
            ` · ${exam.attemptCount} ${exam.attemptCount === 1 ? 'intento' : 'intentos'}`}
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
    gap: 20,
  },
  backLink: { color: '#f97316', fontSize: '0.875rem', textDecoration: 'none', fontWeight: 600 },
  header: { display: 'flex', flexDirection: 'column', gap: 8 },
  eyebrow: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  title: { fontSize: '2rem', fontWeight: 800, margin: 0, lineHeight: 1.15 },
  summary: { fontSize: '1.05rem', color: 'var(--color-text-muted)', lineHeight: 1.6, margin: 0 },
  tabs: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    borderBottom: '1px solid var(--color-border)',
    paddingBottom: 4,
  },
  tab: {
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: 'var(--color-text-muted)',
    padding: '8px 12px',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  tabActive: { color: '#f97316', borderBottomColor: '#f97316' },
  tabWarn: { color: '#dc2626', fontWeight: 800 },
  content: { display: 'flex', flexDirection: 'column', gap: 16 },
  missing: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    alignItems: 'flex-start',
    padding: 24,
    background: 'var(--color-surface)',
    border: '1px dashed var(--color-border)',
    borderRadius: 12,
  },
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
  examMeta: { fontSize: '0.8rem', color: 'var(--color-text-muted)' },
  examStart: { padding: '9px 20px', fontSize: '0.875rem', flexShrink: 0 },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: 12, flexWrap: 'wrap' },
  deleteBtn: {
    background: 'transparent',
    border: '1px solid rgba(220,38,38,0.4)',
    color: '#dc2626',
    padding: '10px 18px',
    borderRadius: 8,
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
};
