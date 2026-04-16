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

export default function ExercisesPage() {
  const { data: coursesData } = useCourses(1);
  const courses = coursesData?.data ?? [];

  const [courseId, setCourseId] = useState('');
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(5);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});

  const { mutate, isPending, error } = useMutation({
    mutationFn: (payload: GeneratePayload) =>
      api.post<GenerateResponse>('/exercises/generate', payload).then((r) => r.data),
    onSuccess: (data) => {
      setExercises(data.exercises);
      setRevealed({});
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
  onToggle,
}: {
  exercise: Exercise;
  index: number;
  revealed: boolean;
  onToggle: () => void;
}) {
  return (
    <article style={s.card}>
      <header style={s.cardHeader}>
        <span style={s.cardNumber}>#{index + 1}</span>
        <span style={s.cardType}>{labelForType(exercise.type)}</span>
      </header>

      <p style={s.statement}>{exercise.statement}</p>

      {exercise.options.length > 0 && (
        <ul style={s.options}>
          {exercise.options.map((opt, j) => (
            <li key={j} style={s.option}>
              <span style={s.optionLetter}>{String.fromCharCode(65 + j)}.</span>
              {opt}
            </li>
          ))}
        </ul>
      )}

      <button onClick={onToggle} style={s.revealBtn}>
        {revealed ? '🙈 Ocultar solución' : '💡 Ver solución'}
      </button>

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
    color: 'rgba(255,255,255,0.55)',
    fontSize: '0.95rem',
    lineHeight: 1.5,
    margin: 0,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: 24,
  },
  row: { display: 'flex', gap: 16, flexWrap: 'wrap' as const },
  textarea: {
    width: '100%',
    background: 'rgba(8,14,26,0.6)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8,
    color: '#f1f5f9',
    padding: '10px 12px',
    fontSize: '0.95rem',
    fontFamily: 'inherit',
    resize: 'vertical' as const,
  },
  errorBox: {
    background: 'rgba(220,38,38,0.15)',
    borderLeft: '4px solid #dc2626',
    color: '#fca5a5',
    padding: '12px 14px',
    borderRadius: 8,
    fontSize: '0.875rem',
  },
  results: { display: 'flex', flexDirection: 'column', gap: 16 },
  resultsTitle: { fontSize: '1.2rem', fontWeight: 700, margin: 0 },
  exerciseList: { display: 'flex', flexDirection: 'column', gap: 16 },
  card: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
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
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    background: 'rgba(255,255,255,0.05)',
    padding: '2px 8px',
    borderRadius: 6,
  },
  statement: {
    margin: 0,
    fontSize: '1rem',
    lineHeight: 1.5,
    color: '#f1f5f9',
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
    background: 'rgba(8,14,26,0.5)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: '0.95rem',
    color: 'rgba(255,255,255,0.85)',
    display: 'flex',
    gap: 10,
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
  solutionLine: { color: 'rgba(255,255,255,0.85)' },
  solutionLabel: { color: '#10b981' },
};
