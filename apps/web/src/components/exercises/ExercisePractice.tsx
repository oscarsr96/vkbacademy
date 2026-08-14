import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { StudyDifficulty, StudyExercise } from '@vkbacademy/shared';
import api from '../../lib/axios';
import MathText from '../ui/MathText';

// Los ejercicios del curso multi-tema llegan con dificultad; los del flujo un-tema, sin ella.
type PracticeExercise = StudyExercise & { difficulty?: StudyDifficulty };

const DIFFICULTY_LABEL: Record<StudyDifficulty, string> = {
  EASY: 'Fácil',
  MEDIUM: 'Medio',
  HARD: 'Difícil',
};

type Verdict = 'correct' | 'partial' | 'incorrect';

interface EvaluationResult {
  verdict: Verdict;
  feedback: string;
}

interface AttemptResult {
  verdict: Verdict;
  feedback?: string;
  solution: string;
  explanation: string;
}

export default function ExercisePractice({
  exercises,
  planId,
}: {
  exercises: PracticeExercise[];
  planId: string;
}) {
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [selected, setSelected] = useState<Record<number, number | null>>({});
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [evaluations, setEvaluations] = useState<Record<number, EvaluationResult>>({});
  const [evalErrors, setEvalErrors] = useState<Record<number, string>>({});

  const attemptMutation = useMutation({
    mutationFn: ({
      index,
      exerciseId,
      answer,
    }: {
      index: number;
      exerciseId: string;
      answer: string;
    }) =>
      api
        .post<AttemptResult>(`/study-plans/${planId}/exercises/${exerciseId}/attempt`, { answer })
        .then((r) => ({ index, data: r.data })),
    onSuccess: ({ index, data }) => {
      setEvaluations((prev) => ({
        ...prev,
        [index]: { verdict: data.verdict, feedback: data.feedback ?? '' },
      }));
      setRevealed((prev) => ({ ...prev, [index]: true }));
      setEvalErrors((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    },
    onError: (err, variables) => {
      const msg = (err as { response?: { data?: { message?: string | string[] } } } | null)
        ?.response?.data?.message;
      const text = Array.isArray(msg) ? msg.join(' · ') : msg;
      setEvalErrors((prev) => ({
        ...prev,
        [variables.index]:
          text ?? 'No se pudo registrar la respuesta. Inténtalo de nuevo en unos segundos.',
      }));
      // El alumno no se queda bloqueado: se revela la solución igualmente,
      // aunque el intento no haya llegado a registrarse.
      setRevealed((prev) => ({ ...prev, [variables.index]: true }));
    },
  });

  const evaluatingIdx =
    attemptMutation.isPending && attemptMutation.variables ? attemptMutation.variables.index : null;

  function chooseOption(exerciseIndex: number, optionIndex: number) {
    setSelected((prev) => ({ ...prev, [exerciseIndex]: optionIndex }));
  }
  function updateAnswer(index: number, value: string) {
    setAnswers((prev) => ({ ...prev, [index]: value }));
  }
  function submitAttempt(index: number, ex: PracticeExercise) {
    // Una sola petición en vuelo: la mutación es compartida por todas las tarjetas.
    if (attemptMutation.isPending) return;
    const answer =
      ex.options.length > 0
        ? (ex.options[selected[index] ?? -1] ?? '')
        : (answers[index] ?? '').trim();
    if (!answer) return;
    attemptMutation.mutate({ index, exerciseId: ex.id, answer });
  }
  // El servidor admite reintentos (actualiza el veredicto, no duplica fila ni mueve
  // la racha). Reabre el ejercicio: para los de opción también limpia la selección;
  // para los OPEN se deja el texto escrito, así el alumno lo corrige en vez de
  // partir de cero.
  function retryExercise(index: number, ex: PracticeExercise) {
    setRevealed((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
    setEvaluations((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
    setEvalErrors((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
    if (ex.options.length > 0) {
      setSelected((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    }
  }

  if (exercises.length === 0) {
    return <p style={s.muted}>No hay ejercicios en esta unidad.</p>;
  }

  return (
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
          // La mutación es única para todas las tarjetas: mientras hay una
          // petición en vuelo, comprobar otra tarjeta dispararía un segundo
          // intento en paralelo (carrera en el registro y en los puntos).
          blocked={attemptMutation.isPending}
          onChoose={(optIdx) => chooseOption(i, optIdx)}
          onAnswerChange={(value) => updateAnswer(i, value)}
          onCheck={() => submitAttempt(i, ex)}
          onRetry={() => retryExercise(i, ex)}
        />
      ))}
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
  blocked,
  onChoose,
  onAnswerChange,
  onCheck,
  onRetry,
}: {
  exercise: PracticeExercise;
  index: number;
  revealed: boolean;
  selected: number | null;
  answer: string;
  evaluation: EvaluationResult | null;
  evaluationError: string | null;
  evaluating: boolean;
  /** Hay un intento en vuelo (puede ser el de otra tarjeta) */
  blocked: boolean;
  onChoose: (optionIndex: number) => void;
  onAnswerChange: (value: string) => void;
  onCheck: () => void;
  onRetry: () => void;
}) {
  const hasOptions = exercise.options.length > 0;
  const correctIndex = hasOptions
    ? exercise.options.findIndex(
        (o) => normalizeForMatch(o) === normalizeForMatch(exercise.solution),
      )
    : -1;
  const canCheck = hasOptions ? selected !== null : answer.trim().length > 0;
  const checkDisabled = revealed || !canCheck || evaluating || blocked;

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
    if (checkDisabled) return;
    onCheck();
  }

  const buttonLabel = evaluating ? '⏳ Evaluando...' : revealed ? '✓ Comprobado' : '✓ Comprobar';

  return (
    <article style={s.card}>
      <header style={s.cardHeader}>
        <span style={s.cardNumber}>#{index + 1}</span>
        <span style={s.cardType}>{labelForType(exercise.type)}</span>
        {exercise.difficulty && (
          <span style={{ ...s.cardDifficulty, ...difficultyStyle(exercise.difficulty) }}>
            {DIFFICULTY_LABEL[exercise.difficulty]}
          </span>
        )}
      </header>

      <p style={s.statement}>
        <MathText>{exercise.statement}</MathText>
      </p>

      {hasOptions && (
        <ul style={s.options}>
          {exercise.options.map((opt, j) => (
            <li
              key={j}
              style={{ ...optionStyle(j), cursor: revealed ? 'default' : 'pointer' }}
              onClick={revealed ? undefined : () => onChoose(j)}
            >
              <span style={s.optionLetter}>{String.fromCharCode(65 + j)}.</span>
              <MathText>{opt}</MathText>
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

      <div style={s.buttonRow}>
        <button
          onClick={handleCheckClick}
          style={{ ...s.revealBtn, opacity: checkDisabled ? 0.5 : 1 }}
          disabled={checkDisabled}
        >
          {buttonLabel}
        </button>
        {revealed && (
          <button onClick={onRetry} style={s.retryBtn}>
            ↺ Reintentar
          </button>
        )}
      </div>

      {evaluationError && !evaluating && (
        <div style={s.errorBox}>
          <strong>!</strong> {evaluationError}
        </div>
      )}

      {revealed && evaluation && evaluation.feedback && (
        <div style={{ ...s.verdictBox, ...VERDICT_STYLES[evaluation.verdict] }}>
          <div style={s.verdictHeader}>{verdictLabel(evaluation.verdict)}</div>
          <div style={s.verdictFeedback}>
            <MathText>{evaluation.feedback}</MathText>
          </div>
        </div>
      )}

      {revealed && (
        <div style={s.solution}>
          <div style={s.solutionLine}>
            <strong style={s.solutionLabel}>Solución:</strong>{' '}
            <MathText>{exercise.solution}</MathText>
          </div>
          {exercise.explanation && (
            <div style={s.solutionLine}>
              <strong style={s.solutionLabel}>Explicación:</strong>{' '}
              <MathText>{exercise.explanation}</MathText>
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

// Color del chip de dificultad (verde / ámbar / rojo suaves).
function difficultyStyle(difficulty: StudyDifficulty): React.CSSProperties {
  switch (difficulty) {
    case 'EASY':
      return { color: 'var(--color-success, #16a34a)', background: 'rgba(22,163,74,0.1)' };
    case 'MEDIUM':
      return { color: '#b45309', background: 'rgba(180,83,9,0.1)' };
    case 'HARD':
      return { color: 'var(--color-error)', background: 'rgba(220,38,38,0.08)' };
  }
}

// Normaliza para comparar opción vs solución más allá de diferencias triviales
// de espaciado o notación LaTeX (p. ej. "$x = 2$" vs "$x=2$" deben marcar como
// la misma opción al revelar). Solo afecta a esta comparación, no al texto mostrado.
function normalizeForMatch(s: string): string {
  return s
    .replace(/\s+/g, '')
    .replace(/\$/g, '')
    .replace(/\\dfrac/g, '\\frac');
}

function labelForType(type: StudyExercise['type']): string {
  switch (type) {
    case 'SINGLE':
      return 'Opción múltiple';
    case 'TRUE_FALSE':
      return 'Verdadero/Falso';
    case 'OPEN':
      return 'Respuesta abierta';
  }
}

const GREEN = '#16a34a';
const RED = '#dc2626';
const YELLOW = '#eab308';

const VERDICT_STYLES: Record<Verdict, React.CSSProperties> = {
  correct: { background: '#dcfce7', border: `1px solid ${GREEN}`, color: '#166534' },
  partial: { background: '#fef9c3', border: `1px solid ${YELLOW}`, color: '#854d0e' },
  incorrect: { background: '#fee2e2', border: `1px solid ${RED}`, color: '#991b1b' },
};

const s: Record<string, React.CSSProperties> = {
  muted: { color: 'var(--color-text-muted)', fontSize: '0.95rem', margin: 0 },
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
  cardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  cardNumber: { fontSize: '0.9rem', fontWeight: 700, color: 'var(--brand-deep)' },
  cardDifficulty: {
    fontSize: '0.72rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: '2px 8px',
    borderRadius: 999,
  },
  cardType: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    background: 'rgba(0,0,0,0.05)',
    padding: '2px 8px',
    borderRadius: 6,
  },
  statement: { margin: 0, fontSize: '1rem', lineHeight: 1.5, color: 'var(--color-text)' },
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
  optionSelected: { background: '#fef9c3', border: `1px solid ${YELLOW}` },
  optionCorrect: { background: '#dcfce7', border: `1px solid ${GREEN}` },
  optionWrong: { background: '#fee2e2', border: `1px solid ${RED}` },
  optionLetter: { color: 'var(--brand-deep)', fontWeight: 700, minWidth: 20 },
  buttonRow: { display: 'flex', gap: 10, alignItems: 'center' },
  revealBtn: {
    alignSelf: 'flex-start',
    background: 'transparent',
    border: '1px solid var(--brand-glow)',
    color: 'var(--brand-deep)',
    padding: '8px 16px',
    borderRadius: 8,
    fontSize: '0.875rem',
    cursor: 'pointer',
    fontWeight: 600,
  },
  retryBtn: {
    alignSelf: 'flex-start',
    background: 'transparent',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-muted)',
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
    resize: 'vertical',
    minHeight: 80,
  },
  errorBox: {
    background: 'rgba(220,38,38,0.15)',
    borderLeft: '4px solid #dc2626',
    color: 'var(--color-error)',
    padding: '12px 14px',
    borderRadius: 8,
    fontSize: '0.875rem',
  },
  verdictBox: {
    borderRadius: 8,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    fontSize: '0.92rem',
    lineHeight: 1.5,
  },
  verdictHeader: { fontWeight: 700, fontSize: '0.95rem' },
  verdictFeedback: { color: 'var(--color-text)' },
};
