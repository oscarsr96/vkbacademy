import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useCourses } from '../hooks/useCourses';
import api from '../lib/axios';

type ExerciseType = 'SINGLE' | 'TRUE_FALSE' | 'OPEN';

interface Exercise {
  statement: string;
  type: ExerciseType;
  options: string[];
  solution: string;
  explanation: string;
}

interface GenerateResponse {
  exercises: Exercise[];
}

interface GeneratePayload {
  courseId: string;
  topic: string;
  count: number;
}

type Verdict = 'correct' | 'partial' | 'incorrect';

interface EvaluationResult {
  verdict: Verdict;
  feedback: string;
}

interface EvaluatePayload {
  statement: string;
  studentAnswer: string;
  solution: string;
}

export default function ExercisesPage() {
  const { data: coursesData } = useCourses(1);
  const courses = coursesData?.data ?? [];

  const [courseId, setCourseId] = useState('');
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(5);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [selected, setSelected] = useState<Record<number, number | null>>({});
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [evaluations, setEvaluations] = useState<Record<number, EvaluationResult>>({});
  const [evalErrors, setEvalErrors] = useState<Record<number, string>>({});
  const [evaluatingIdx, setEvaluatingIdx] = useState<number | null>(null);

  const { mutate, isPending, error } = useMutation({
    mutationFn: (payload: GeneratePayload) =>
      api.post<GenerateResponse>('/exercises/generate', payload).then((r) => r.data),
    onSuccess: (data) => {
      setExercises(data.exercises);
      setRevealed({});
      setSelected({});
      setAnswers({});
      setEvaluations({});
      setEvalErrors({});
    },
  });

  const evalMutation = useMutation({
    mutationFn: ({ index, ...payload }: EvaluatePayload & { index: number }) =>
      api
        .post<EvaluationResult>('/exercises/evaluate', payload)
        .then((r) => ({ index, data: r.data })),
    onSuccess: ({ index, data }) => {
      setEvaluations((prev) => ({ ...prev, [index]: data }));
      setRevealed((prev) => ({ ...prev, [index]: true }));
      setEvalErrors((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
      setEvaluatingIdx(null);
    },
    onError: (err, variables) => {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } } | null)?.response?.data
          ?.message;
      const text = Array.isArray(msg) ? msg.join(' · ') : msg;
      setEvalErrors((prev) => ({
        ...prev,
        [variables.index]: text ?? 'No se pudo evaluar la respuesta. Inténtalo de nuevo en unos segundos.',
      }));
      setEvaluatingIdx(null);
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!courseId || !topic.trim()) return;
    mutate({ courseId, topic: topic.trim(), count });
  }

  function toggleSolution(index: number) {
    setRevealed((prev) => ({ ...prev, [index]: !prev[index] }));
  }

  function chooseOption(exerciseIndex: number, optionIndex: number) {
    setSelected((prev) => ({ ...prev, [exerciseIndex]: optionIndex }));
  }

  function updateAnswer(index: number, value: string) {
    setAnswers((prev) => ({ ...prev, [index]: value }));
  }

  function evaluateOpen(index: number, ex: Exercise) {
    const answer = (answers[index] ?? '').trim();
    if (!answer) return;
    setEvaluatingIdx(index);
    evalMutation.mutate({
      index,
      statement: ex.statement,
      studentAnswer: answer,
      solution: ex.solution,
    });
  }

  const apiError = (error as { response?: { data?: { message?: string } } } | null)?.response?.data
    ?.message;

  return (
    <div style={s.page}>
      <header style={s.header}>
        <h1 style={s.title}>🧮 Ejercicios</h1>
        <p style={s.subtitle}>
          Pide ejercicios de práctica sobre cualquier tema de tus cursos. La IA te generará el
          número que indiques con su solución y explicación.
        </p>
      </header>

      <form onSubmit={handleSubmit} style={s.form}>
        <div style={s.row}>
          <div className="field" style={{ flex: 2 }}>
            <label htmlFor="courseId">Curso</label>
            <select
              id="courseId"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              required
            >
              <option value="">Selecciona un curso</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="count">Nº de ejercicios</label>
            <input
              id="count"
              type="number"
              min={1}
              max={20}
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="topic">¿Sobre qué tema quieres ejercicios?</label>
          <textarea
            id="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Ej: propiedades de logaritmos, ecuaciones de segundo grado, análisis sintáctico..."
            rows={3}
            style={s.textarea}
            required
          />
        </div>

        {apiError && (
          <div style={s.errorBox}>
            <strong>!</strong> {apiError}
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={isPending || !courseId || !topic.trim()}
          style={{ alignSelf: 'flex-start', padding: '12px 24px' }}
        >
          {isPending ? '⏳ Generando ejercicios...' : '✨ Generar ejercicios'}
        </button>
      </form>

      {exercises.length > 0 && (
        <section style={s.results}>
          <h2 style={s.resultsTitle}>
            {exercises.length} ejercicios sobre "{topic}"
          </h2>
          <div style={s.exerciseList}>
            {exercises.map((ex, i) => (
              <ExerciseCard
                key={i}
                exercise={ex}
                index={i}
                revealed={!!revealed[i]}
                selected={selected[i] ?? null}
                answer={answers[i] ?? ''}
                evaluation={evaluations[i] ?? null}
                evaluationError={evalErrors[i] ?? null}
                evaluating={evaluatingIdx === i}
                onChoose={(optIdx) => chooseOption(i, optIdx)}
                onAnswerChange={(value) => updateAnswer(i, value)}
                onEvaluate={() => evaluateOpen(i, ex)}
                onToggle={() => toggleSolution(i)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ExerciseCard({
  exercise,
  index,
  revealed,
  selected,
  answer,
  evaluation,
  evaluationError,
  evaluating,
  onChoose,
  onAnswerChange,
  onEvaluate,
  onToggle,
}: {
  exercise: Exercise;
  index: number;
  revealed: boolean;
  selected: number | null;
  answer: string;
  evaluation: EvaluationResult | null;
  evaluationError: string | null;
  evaluating: boolean;
  onChoose: (optionIndex: number) => void;
  onAnswerChange: (value: string) => void;
  onEvaluate: () => void;
  onToggle: () => void;
}) {
  const hasOptions = exercise.options.length > 0;
  const correctIndex = hasOptions
    ? exercise.options.findIndex((o) => o.trim() === exercise.solution.trim())
    : -1;
  const canCheck = hasOptions ? selected !== null : answer.trim().length > 0;

  function optionStyle(j: number): React.CSSProperties {
    if (revealed) {
      if (j === correctIndex) return { ...s.option, ...s.optionCorrect };
      if (j === selected) return { ...s.option, ...s.optionWrong };
      return s.option;
    }
    if (j === selected) return { ...s.option, ...s.optionSelected };
    return s.option;
  }

  function handleCheckClick() {
    if (revealed) {
      onToggle();
      return;
    }
    if (hasOptions) {
      onToggle();
    } else {
      onEvaluate();
    }
  }

  const buttonLabel = evaluating
    ? '⏳ Evaluando...'
    : revealed
      ? '🙈 Ocultar solución'
      : '✓ Comprobar';

  return (
    <article style={s.card}>
      <header style={s.cardHeader}>
        <span style={s.cardNumber}>#{index + 1}</span>
        <span style={s.cardType}>{labelForType(exercise.type)}</span>
      </header>

      <p style={s.statement}>{exercise.statement}</p>

      {hasOptions && (
        <ul style={s.options}>
          {exercise.options.map((opt, j) => (
            <li
              key={j}
              style={{ ...optionStyle(j), cursor: revealed ? 'default' : 'pointer' }}
              onClick={revealed ? undefined : () => onChoose(j)}
            >
              <span style={s.optionLetter}>{String.fromCharCode(65 + j)}.</span>
              {opt}
            </li>
          ))}
        </ul>
      )}

      {!hasOptions && (
        <textarea
          value={answer}
          onChange={(e) => onAnswerChange(e.target.value)}
          disabled={revealed || evaluating}
          placeholder="Escribe aquí tu respuesta..."
          rows={3}
          style={s.openAnswer}
        />
      )}

      <button
        onClick={handleCheckClick}
        style={{
          ...s.revealBtn,
          opacity: (!revealed && !canCheck) || evaluating ? 0.5 : 1,
        }}
        disabled={(!revealed && !canCheck) || evaluating}
      >
        {buttonLabel}
      </button>

      {evaluationError && !evaluating && (
        <div style={s.errorBox}>
          <strong>!</strong> {evaluationError}
        </div>
      )}

      {revealed && evaluation && (
        <div style={{ ...s.verdictBox, ...s[`verdict_${evaluation.verdict}`] }}>
          <div style={s.verdictHeader}>{verdictLabel(evaluation.verdict)}</div>
          <div style={s.verdictFeedback}>{evaluation.feedback}</div>
        </div>
      )}

      {revealed && (
        <div style={s.solution}>
          <div style={s.solutionLine}>
            <strong style={s.solutionLabel}>Solución:</strong> {exercise.solution}
          </div>
          {exercise.explanation && (
            <div style={s.solutionLine}>
              <strong style={s.solutionLabel}>Explicación:</strong> {exercise.explanation}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function verdictLabel(verdict: Verdict): string {
  switch (verdict) {
    case 'correct':
      return '✅ Correcto';
    case 'partial':
      return '⚠️ Parcialmente correcto';
    case 'incorrect':
      return '❌ Incorrecto';
  }
}

function labelForType(type: ExerciseType): string {
  switch (type) {
    case 'SINGLE':
      return 'Opción múltiple';
    case 'TRUE_FALSE':
      return 'Verdadero/Falso';
    case 'OPEN':
      return 'Respuesta abierta';
  }
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
  subtitle: {
    color: 'var(--color-text-muted)',
    fontSize: '0.95rem',
    lineHeight: 1.5,
    margin: 0,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 14,
    padding: 24,
  },
  row: { display: 'flex', gap: 16, flexWrap: 'wrap' as const },
  textarea: {
    width: '100%',
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    color: 'var(--color-text)',
    padding: '10px 12px',
    fontSize: '0.95rem',
    fontFamily: 'inherit',
    resize: 'vertical' as const,
  },
  errorBox: {
    background: 'rgba(220,38,38,0.15)',
    borderLeft: '4px solid #dc2626',
    color: 'var(--color-error)',
    padding: '12px 14px',
    borderRadius: 8,
    fontSize: '0.875rem',
  },
  results: { display: 'flex', flexDirection: 'column', gap: 16 },
  resultsTitle: { fontSize: '1.2rem', fontWeight: 700, margin: 0 },
  exerciseList: { display: 'flex', flexDirection: 'column', gap: 16 },
  card: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 12,
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardNumber: {
    fontSize: '0.9rem',
    fontWeight: 700,
    color: '#f97316',
  },
  cardType: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    background: 'rgba(0,0,0,0.05)',
    padding: '2px 8px',
    borderRadius: 6,
  },
  statement: {
    margin: 0,
    fontSize: '1rem',
    lineHeight: 1.5,
    color: 'var(--color-text)',
  },
  options: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  option: {
    background: 'var(--color-bg)',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: '0.95rem',
    color: 'var(--color-text)',
    display: 'flex',
    gap: 10,
    transition: 'background 0.15s, border-color 0.15s',
  },
  optionSelected: {
    background: '#fef9c3',
    border: '1px solid #eab308',
  },
  optionCorrect: {
    background: '#dcfce7',
    border: '1px solid #16a34a',
  },
  optionWrong: {
    background: '#fee2e2',
    border: '1px solid #dc2626',
  },
  optionLetter: {
    color: '#f97316',
    fontWeight: 700,
    minWidth: 20,
  },
  revealBtn: {
    alignSelf: 'flex-start',
    background: 'transparent',
    border: '1px solid rgba(234,88,12,0.4)',
    color: '#f97316',
    padding: '8px 16px',
    borderRadius: 8,
    fontSize: '0.875rem',
    cursor: 'pointer',
    fontWeight: 600,
  },
  solution: {
    background: 'rgba(16,185,129,0.08)',
    border: '1px solid rgba(16,185,129,0.25)',
    borderRadius: 8,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    fontSize: '0.92rem',
    lineHeight: 1.5,
  },
  solutionLine: { color: 'var(--color-text)' },
  solutionLabel: { color: '#10b981' },
  openAnswer: {
    width: '100%',
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    color: 'var(--color-text)',
    padding: '10px 12px',
    fontSize: '0.95rem',
    fontFamily: 'inherit',
    resize: 'vertical' as const,
    minHeight: 80,
  },
  verdictBox: {
    borderRadius: 8,
    padding: 14,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
    fontSize: '0.92rem',
    lineHeight: 1.5,
  },
  verdictHeader: {
    fontWeight: 700,
    fontSize: '0.95rem',
  },
  verdictFeedback: {
    color: 'var(--color-text)',
  },
  verdict_correct: {
    background: '#dcfce7',
    border: '1px solid #16a34a',
    color: '#166534',
  },
  verdict_partial: {
    background: '#fef9c3',
    border: '1px solid #eab308',
    color: '#854d0e',
  },
  verdict_incorrect: {
    background: '#fee2e2',
    border: '1px solid #dc2626',
    color: '#991b1b',
  },
};
