import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useExamBankInfo, useStartExam, useSubmitExam, useExamHistory } from '../hooks/useExams';
import { useMyCertificates } from '../hooks/useCertificates';
import { downloadCertificatePdf } from '../utils/certificatePdf';
import type { ExamAttemptStarted, ExamAttemptResult, ExamQuestionPublic } from '@vkbacademy/shared';
import { downloadExamPdf } from '../utils/examPdf';

// ─── Tipos internos ───────────────────────────────────────────────────────────

type ExamState = 'config' | 'in-progress' | 'results';

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '2rem', maxWidth: 760, margin: '0 auto' },
  back: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--color-text-muted)', fontSize: '0.875rem', padding: 0, marginBottom: '1.5rem',
  },
  heading: { fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.5rem' },
  subheading: { fontSize: '1.1rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: '1rem' },
  card: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 12,
    padding: '1.5rem',
    marginBottom: '1.5rem',
  },
  label: { display: 'block', fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.4rem' },
  input: {
    width: '100%', padding: '0.5rem 0.75rem', borderRadius: 8,
    border: '1px solid var(--color-border)', background: 'var(--color-bg)',
    color: 'var(--color-text)', fontSize: '0.95rem', boxSizing: 'border-box' as const,
  },
  toggle: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem' },
  row: { display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' as const },
  btn: {
    padding: '0.6rem 1.25rem', borderRadius: 8, border: 'none', cursor: 'pointer',
    fontWeight: 600, fontSize: '0.9rem', transition: 'opacity 0.15s',
  },
  btnPrimary: { background: 'var(--color-primary)', color: '#fff' },
  btnSecondary: {
    background: 'var(--color-border)', color: 'var(--color-text)',
  },
  progressBarWrap: { height: 8, background: 'var(--color-border)', borderRadius: 4, overflow: 'hidden', marginBottom: '1.5rem' },
  progressBarFill: { height: '100%', background: 'var(--color-primary)', borderRadius: 4, transition: 'width 0.3s' },
  timerBar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: '1.25rem', fontSize: '0.9rem', color: 'var(--color-text-muted)',
  },
  questionCard: {
    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
    borderRadius: 10, padding: '1.25rem', marginBottom: '1rem',
  },
  questionText: { fontWeight: 600, marginBottom: '0.75rem', color: 'var(--color-text)' },
  answerBtn: {
    display: 'block', width: '100%', textAlign: 'left' as const,
    padding: '0.5rem 0.875rem', marginBottom: '0.4rem', borderRadius: 8,
    border: '1px solid var(--color-border)', background: 'var(--color-bg)',
    color: 'var(--color-text)', cursor: 'pointer', fontSize: '0.9rem',
    transition: 'all 0.15s',
  },
  scoreCard: {
    textAlign: 'center' as const, padding: '2rem',
    background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12,
    marginBottom: '1.5rem',
  },
  scoreBig: { fontSize: '3rem', fontWeight: 800, color: 'var(--color-primary)', lineHeight: 1 },
  scoreLabel: { fontSize: '1rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' },
  correctionCard: {
    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
    borderRadius: 10, padding: '1rem 1.25rem', marginBottom: '0.75rem',
  },
  error: { color: 'var(--color-error)', padding: '1rem' },
  muted: { color: 'var(--color-text-muted)', fontSize: '0.85rem' },
};

// ─── Componente: Configuración ────────────────────────────────────────────────

function ConfigStep({
  scopeTitle,
  maxQuestions,
  onStart,
  isLoading,
  recentAttempts,
}: {
  scopeTitle: string;
  maxQuestions: number;
  onStart: (numQ: number, timeLimit?: number, onlyOnce?: boolean) => void;
  isLoading: boolean;
  recentAttempts: { attemptId: string; score: number; numQuestions: number; submittedAt: string }[];
}) {
  const [numQ, setNumQ] = useState(Math.min(10, maxQuestions));
  const [useTimer, setUseTimer] = useState(false);
  const [timeMins, setTimeMins] = useState(15);
  const [onlyOnce, setOnlyOnce] = useState(false);

  return (
    <div>
      <h2 style={styles.subheading}>Configurar examen — {scopeTitle}</h2>
      <div style={styles.card}>
        <label style={styles.label}>Número de preguntas (máx. {maxQuestions})</label>
        <input
          type="number"
          min={1}
          max={maxQuestions}
          value={numQ}
          onChange={(e) => setNumQ(Math.min(maxQuestions, Math.max(1, Number(e.target.value))))}
          style={{ ...styles.input, width: 120 }}
        />

        <div style={{ ...styles.toggle, marginTop: '1.25rem' }}>
          <input
            id="use-timer"
            type="checkbox"
            checked={useTimer}
            onChange={(e) => setUseTimer(e.target.checked)}
          />
          <label htmlFor="use-timer" style={{ cursor: 'pointer' }}>
            ⏱ Límite de tiempo
          </label>
        </div>
        {useTimer && (
          <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="number"
              min={1}
              max={180}
              value={timeMins}
              onChange={(e) => setTimeMins(Math.max(1, Number(e.target.value)))}
              style={{ ...styles.input, width: 80 }}
            />
            <span style={styles.muted}>minutos</span>
          </div>
        )}

        <div style={styles.toggle}>
          <input
            id="only-once"
            type="checkbox"
            checked={onlyOnce}
            onChange={(e) => setOnlyOnce(e.target.checked)}
          />
          <label htmlFor="only-once" style={{ cursor: 'pointer' }}>
            🔒 Respuesta única (no se puede cambiar una vez elegida)
          </label>
        </div>

        <button
          style={{ ...styles.btn, ...styles.btnPrimary, marginTop: '0.5rem' }}
          disabled={isLoading}
          onClick={() =>
            onStart(numQ, useTimer ? timeMins * 60 : undefined, onlyOnce || undefined)
          }
        >
          {isLoading ? 'Preparando...' : 'Empezar examen'}
        </button>
      </div>

      {recentAttempts.length > 0 && (
        <div style={styles.card}>
          <div style={{ fontWeight: 600, marginBottom: '0.75rem' }}>Historial reciente</div>
          {recentAttempts.map((a) => (
            <div
              key={a.attemptId}
              style={{
                display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0',
                borderBottom: '1px solid var(--color-border)', fontSize: '0.875rem',
              }}
            >
              <span>{new Date(a.submittedAt).toLocaleDateString('es-ES')}</span>
              <span>{a.numQuestions} preguntas</span>
              <span style={{ fontWeight: 700, color: a.score >= 50 ? 'var(--color-primary)' : 'var(--color-error)' }}>
                {a.score.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Componente: Examen en progreso ───────────────────────────────────────────

function InProgressStep({
  attempt,
  onSubmit,
  isLoading,
}: {
  attempt: ExamAttemptStarted;
  onSubmit: (answers: { questionId: string; answerId: string }[]) => void;
  isLoading: boolean;
}) {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [secondsLeft, setSecondsLeft] = useState<number | null>(
    attempt.timeLimit ?? null,
  );

  const handleSubmit = useCallback(() => {
    const answers = Object.entries(selectedAnswers).map(([questionId, answerId]) => ({
      questionId,
      answerId,
    }));
    onSubmit(answers);
  }, [selectedAnswers, onSubmit]);

  // Cuenta atrás
  useEffect(() => {
    if (secondsLeft === null) return;
    if (secondsLeft <= 0) {
      handleSubmit();
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => (s !== null ? s - 1 : null)), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft, handleSubmit]);

  const answeredCount = Object.keys(selectedAnswers).length;
  const totalCount = attempt.questions.length;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const selectAnswer = (question: ExamQuestionPublic, answerId: string) => {
    if (attempt.onlyOnce && selectedAnswers[question.id]) return; // bloqueado
    setSelectedAnswers((prev) => ({ ...prev, [question.id]: answerId }));
  };

  return (
    <div>
      <div style={styles.timerBar}>
        <span>{answeredCount} de {totalCount} respondidas</span>
        {secondsLeft !== null && (
          <span style={{ fontWeight: 700, color: secondsLeft < 60 ? 'var(--color-error)' : undefined }}>
            ⏱ {formatTime(secondsLeft)}
          </span>
        )}
      </div>
      <div style={styles.progressBarWrap}>
        <div
          style={{
            ...styles.progressBarFill,
            width: `${(answeredCount / totalCount) * 100}%`,
          }}
        />
      </div>

      {attempt.questions.map((q, idx) => {
        const chosen = selectedAnswers[q.id];
        return (
          <div key={q.id} style={styles.questionCard}>
            <div style={styles.questionText}>
              {idx + 1}. {q.text}
            </div>
            {q.answers.map((a) => {
              const isSelected = chosen === a.id;
              const locked = attempt.onlyOnce && !!chosen;
              return (
                <button
                  key={a.id}
                  style={{
                    ...styles.answerBtn,
                    background: isSelected ? 'var(--color-primary)' : 'var(--color-bg)',
                    color: isSelected ? '#fff' : 'var(--color-text)',
                    borderColor: isSelected ? 'var(--color-primary)' : 'var(--color-border)',
                    cursor: locked && !isSelected ? 'not-allowed' : 'pointer',
                    opacity: locked && !isSelected ? 0.6 : 1,
                  }}
                  disabled={locked && !isSelected}
                  onClick={() => selectAnswer(q, a.id)}
                >
                  {a.text}
                </button>
              );
            })}
          </div>
        );
      })}

      <button
        style={{
          ...styles.btn,
          ...styles.btnPrimary,
          opacity: answeredCount < totalCount ? 0.5 : 1,
          cursor: answeredCount < totalCount ? 'not-allowed' : 'pointer',
        }}
        disabled={answeredCount < totalCount || isLoading}
        onClick={handleSubmit}
      >
        {isLoading ? 'Entregando...' : 'Entregar examen'}
      </button>
    </div>
  );
}

// ─── Componente: Resultados ───────────────────────────────────────────────────

function ResultsStep({
  result,
  scopeTitle,
  courseId,
  moduleId,
  onRepeat,
  onBack,
  historyItems,
}: {
  result: ExamAttemptResult;
  scopeTitle: string;
  courseId?: string;
  moduleId?: string;
  onRepeat: () => void;
  onBack: () => void;
  historyItems: { attemptId: string; score: number | null; numQuestions: number; submittedAt: string | null }[];
}) {
  // Buscar el certificado de examen recién emitido
  const { data: certs } = useMyCertificates();
  const examCertType = courseId ? 'COURSE_EXAM' : 'MODULE_EXAM';
  const examScopeId = courseId ?? moduleId;
  const examCert = certs?.find(
    (c) => c.scopeId === examScopeId && c.type === examCertType,
  );

  return (
    <div>
      <div style={styles.scoreCard}>
        <div style={styles.scoreBig}>{result.score.toFixed(1)}%</div>
        <div style={styles.scoreLabel}>
          {result.correctCount} de {result.numQuestions} correctas
        </div>
        {result.score >= 50 && (
          <div style={{
            marginTop: '0.75rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 14px',
            borderRadius: 999,
            background: '#f0fdf4',
            border: '1px solid #86efac',
            color: '#16a34a',
            fontWeight: 600,
            fontSize: '0.875rem',
          }}>
            📜 Certificado emitido
          </div>
        )}
      </div>

      <div style={styles.card}>
        <div style={{ fontWeight: 600, marginBottom: '1rem' }}>Correcciones</div>
        {result.corrections.map((c, i) => (
          <div
            key={c.questionId}
            style={{
              ...styles.correctionCard,
              borderLeft: `4px solid ${c.isCorrect ? 'var(--color-primary)' : 'var(--color-error)'}`,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '0.4rem' }}>
              {c.isCorrect ? '✓' : '✗'} {i + 1}. {c.questionText}
            </div>
            {c.selectedAnswerText ? (
              <div style={{ fontSize: '0.85rem', color: c.isCorrect ? 'var(--color-text-muted)' : 'var(--color-error)' }}>
                Tu respuesta: {c.selectedAnswerText}
              </div>
            ) : (
              <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                Sin respuesta
              </div>
            )}
            {!c.isCorrect && c.correctAnswerText && (
              <div style={{ fontSize: '0.85rem', color: 'var(--color-primary)', marginTop: '0.2rem' }}>
                Respuesta correcta: {c.correctAnswerText}
              </div>
            )}
          </div>
        ))}
      </div>

      {historyItems.filter((h) => h.submittedAt).length > 1 && (
        <div style={styles.card}>
          <div style={{ fontWeight: 600, marginBottom: '0.75rem' }}>Historial</div>
          {historyItems
            .filter((h) => h.submittedAt)
            .map((h) => (
              <div
                key={h.attemptId}
                style={{
                  display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0',
                  borderBottom: '1px solid var(--color-border)', fontSize: '0.875rem',
                }}
              >
                <span>{new Date(h.submittedAt!).toLocaleDateString('es-ES')}</span>
                <span>{h.numQuestions} preguntas</span>
                <span style={{ fontWeight: 700, color: (h.score ?? 0) >= 50 ? 'var(--color-primary)' : 'var(--color-error)' }}>
                  {h.score?.toFixed(1)}%
                </span>
              </div>
            ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={onBack}>
          ← Volver al curso
        </button>
        <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={onRepeat}>
          Repetir examen
        </button>
        <button
          style={{ ...styles.btn, ...styles.btnSecondary }}
          onClick={() => downloadExamPdf(result, scopeTitle)}
        >
          ⬇️ Descargar PDF examen
        </button>
        {examCert && (
          <button
            style={{ ...styles.btn, background: '#16a34a', color: '#fff' }}
            onClick={() => downloadCertificatePdf(examCert)}
          >
            📜 Descargar certificado
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ExamPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const courseId = searchParams.get('courseId') ?? undefined;
  const moduleId = searchParams.get('moduleId') ?? undefined;

  const [examState, setExamState] = useState<ExamState>('config');
  const [currentAttempt, setCurrentAttempt] = useState<ExamAttemptStarted | null>(null);
  const [result, setResult] = useState<ExamAttemptResult | null>(null);

  const { data: bankInfo, isLoading: bankLoading, isError: bankError } = useExamBankInfo(courseId, moduleId);
  const { data: history } = useExamHistory(courseId, moduleId);

  const startMut = useStartExam();
  const submitMut = useSubmitExam(
    currentAttempt?.attemptId ?? '',
    courseId,
    moduleId,
  );

  const handleStart = async (numQuestions: number, timeLimit?: number, onlyOnce?: boolean) => {
    const attempt = await startMut.mutateAsync({ courseId, moduleId, numQuestions, timeLimit, onlyOnce });
    setCurrentAttempt(attempt);
    setExamState('in-progress');
  };

  const handleSubmit = async (answers: { questionId: string; answerId: string }[]) => {
    if (!currentAttempt) return;
    const res = await submitMut.mutateAsync({ answers });
    setResult(res);
    setExamState('results');
  };

  const handleRepeat = () => {
    setCurrentAttempt(null);
    setResult(null);
    setExamState('config');
  };

  const handleBack = () => {
    if (courseId) navigate(`/courses/${courseId}`);
    else navigate('/courses');
  };

  if (bankLoading) {
    return (
      <div style={styles.page}>
        <div style={{ color: 'var(--color-text-muted)' }}>Cargando banco de preguntas...</div>
      </div>
    );
  }

  if (bankError || !bankInfo) {
    return <div style={styles.error}>Error al cargar el examen.</div>;
  }

  if (bankInfo.questionCount === 0) {
    return (
      <div style={styles.page}>
        <button style={styles.back} onClick={handleBack}>← Volver</button>
        <h1 style={styles.heading}>Examen — {bankInfo.scopeTitle}</h1>
        <div style={styles.card}>
          <p style={{ color: 'var(--color-text-muted)' }}>
            Este banco de preguntas está vacío. El administrador debe añadir preguntas antes de poder examinarse.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {examState !== 'in-progress' && (
        <button style={styles.back} onClick={handleBack}>← Volver al curso</button>
      )}
      <h1 style={styles.heading}>
        🎓 Examen — {bankInfo.scopeTitle}
      </h1>
      <div style={{ ...styles.muted, marginBottom: '1.5rem' }}>
        Banco: {bankInfo.questionCount} preguntas disponibles
      </div>

      {examState === 'config' && (
        <ConfigStep
          scopeTitle={bankInfo.scopeTitle}
          maxQuestions={bankInfo.questionCount}
          onStart={handleStart}
          isLoading={startMut.isPending}
          recentAttempts={bankInfo.recentAttempts}
        />
      )}

      {examState === 'in-progress' && currentAttempt && (
        <InProgressStep
          attempt={currentAttempt}
          onSubmit={handleSubmit}
          isLoading={submitMut.isPending}
        />
      )}

      {examState === 'results' && result && (
        <ResultsStep
          result={result}
          scopeTitle={bankInfo.scopeTitle}
          courseId={courseId}
          moduleId={moduleId}
          onRepeat={handleRepeat}
          onBack={handleBack}
          historyItems={history ?? []}
        />
      )}
    </div>
  );
}
