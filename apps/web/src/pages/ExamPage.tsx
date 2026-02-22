import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useExamBankInfo, useStartExam, useSubmitExam, useExamHistory } from '../hooks/useExams';
import { useMyCertificates } from '../hooks/useCertificates';
import { downloadCertificatePdf } from '../utils/certificatePdf';
import type { ExamAttemptStarted, ExamAttemptResult, ExamQuestionPublic } from '@vkbacademy/shared';
import { downloadExamPdf } from '../utils/examPdf';

// ─── Tipos internos ───────────────────────────────────────────────────────────

type ExamState = 'config' | 'in-progress' | 'results';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 70) return '#16a34a';
  if (score >= 50) return '#ea580c';
  return '#dc2626';
}

function scoreGradient(score: number): string {
  if (score >= 70) return 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)';
  if (score >= 50) return 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)';
  return 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)';
}

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

  const inputStyle: React.CSSProperties = {
    padding: '10px 14px',
    borderRadius: 'var(--radius-sm)',
    border: '1.5px solid var(--color-border)',
    background: 'var(--color-bg)',
    color: 'var(--color-text)',
    fontSize: '0.95rem',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    boxSizing: 'border-box' as const,
  };

  const toggleRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 0',
    borderBottom: '1px solid var(--color-border)',
    cursor: 'pointer',
    fontSize: '0.9rem',
    color: 'var(--color-text)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 20 }}>

      {/* Card de configuracion */}
      <div
        className="vkb-card"
        style={{ padding: '28px' }}
      >
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: 20 }}>
          {scopeTitle}
        </h3>

        {/* Numero de preguntas */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 8 }}>
            Numero de preguntas (maximo: {maxQuestions})
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="number"
              min={1}
              max={maxQuestions}
              value={numQ}
              onChange={(e) => setNumQ(Math.min(maxQuestions, Math.max(1, Number(e.target.value))))}
              style={{ ...inputStyle, width: 100 }}
            />
            <div className="progress-bar" style={{ flex: 1 }}>
              <div className="progress-fill" style={{ width: `${(numQ / maxQuestions) * 100}%` }} />
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 600, whiteSpace: 'nowrap' as const }}>
              {numQ}/{maxQuestions}
            </span>
          </div>
        </div>

        {/* Toggle: limite de tiempo */}
        <label style={toggleRowStyle}>
          <input
            id="use-timer"
            type="checkbox"
            checked={useTimer}
            onChange={(e) => setUseTimer(e.target.checked)}
            style={{ accentColor: 'var(--color-primary)', width: 16, height: 16 }}
          />
          <span style={{ fontWeight: 500 }}>Limite de tiempo</span>
        </label>
        {useTimer && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0 12px 26px' }}>
            <input
              type="number"
              min={1}
              max={180}
              value={timeMins}
              onChange={(e) => setTimeMins(Math.max(1, Number(e.target.value)))}
              style={{ ...inputStyle, width: 80 }}
            />
            <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>minutos</span>
          </div>
        )}

        {/* Toggle: respuesta unica */}
        <label style={{ ...toggleRowStyle, borderBottom: 'none', marginBottom: 0 }}>
          <input
            id="only-once"
            type="checkbox"
            checked={onlyOnce}
            onChange={(e) => setOnlyOnce(e.target.checked)}
            style={{ accentColor: 'var(--color-primary)', width: 16, height: 16 }}
          />
          <span style={{ fontWeight: 500 }}>Respuesta unica (no se puede cambiar)</span>
        </label>

        <button
          className="btn btn-primary"
          style={{ marginTop: 24, width: '100%', fontSize: '1rem', padding: '13px' }}
          disabled={isLoading}
          onClick={() => onStart(numQ, useTimer ? timeMins * 60 : undefined, onlyOnce || undefined)}
        >
          {isLoading ? 'Preparando...' : 'Comenzar examen'}
        </button>
      </div>

      {/* Historial reciente */}
      {recentAttempts.length > 0 && (
        <div className="vkb-card" style={{ padding: '24px' }}>
          <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: 16 }}>
            Intentos recientes
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 0 }}>
            {recentAttempts.map((a) => (
              <div
                key={a.attemptId}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 0',
                  borderBottom: '1px solid var(--color-border)',
                  fontSize: '0.875rem',
                  gap: 12,
                }}
              >
                <span style={{ color: 'var(--color-text-muted)' }}>
                  {new Date(a.submittedAt).toLocaleDateString('es-ES')}
                </span>
                <span style={{ color: 'var(--color-text-muted)' }}>{a.numQuestions} preguntas</span>
                <span
                  style={{
                    fontWeight: 800,
                    color: scoreColor(a.score),
                    fontSize: '0.95rem',
                  }}
                >
                  {a.score.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
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

  // Cuenta atras
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
  const progressPct = (answeredCount / totalCount) * 100;

  const isTimeCritical = secondsLeft !== null && secondsLeft < 60;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const selectAnswer = (question: ExamQuestionPublic, answerId: string) => {
    if (attempt.onlyOnce && selectedAnswers[question.id]) return;
    setSelectedAnswers((prev) => ({ ...prev, [question.id]: answerId }));
  };

  return (
    <div>
      {/* Barra de estado */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 14,
          gap: 12,
          flexWrap: 'wrap' as const,
        }}
      >
        <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
          {answeredCount} de {totalCount} respondidas
        </span>

        {/* Temporizador */}
        {secondsLeft !== null && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              background: isTimeCritical ? 'rgba(220,38,38,0.12)' : 'var(--color-surface)',
              border: isTimeCritical
                ? '1.5px solid rgba(220,38,38,0.35)'
                : '1.5px solid var(--color-border)',
              animation: isTimeCritical ? 'pulse-glow 0.8s ease-in-out infinite' : 'none',
            }}
          >
            <span style={{ fontSize: '1rem' }}>⏱</span>
            <span
              style={{
                fontSize: '1.1rem',
                fontWeight: 800,
                color: isTimeCritical ? '#dc2626' : 'var(--color-text)',
                letterSpacing: '0.05em',
              }}
            >
              {formatTime(secondsLeft)}
            </span>
          </div>
        )}
      </div>

      {/* Barra de progreso */}
      <div className="progress-bar" style={{ marginBottom: 28 }}>
        <div className="progress-fill" style={{ width: `${progressPct}%` }} />
      </div>

      {/* Preguntas */}
      {attempt.questions.map((q, idx) => {
        const chosen = selectedAnswers[q.id];
        return (
          <div
            key={q.id}
            className="vkb-card"
            style={{ padding: '22px 24px', marginBottom: 16 }}
          >
            <div style={{ fontWeight: 700, marginBottom: 16, color: 'var(--color-text)', fontSize: '0.975rem', lineHeight: 1.4 }}>
              <span style={{ color: 'var(--color-primary)', marginRight: 8, fontWeight: 900 }}>
                {idx + 1}.
              </span>
              {q.text}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
              {q.answers.map((a) => {
                const isSelected = chosen === a.id;
                const locked = attempt.onlyOnce && !!chosen;

                return (
                  <button
                    key={a.id}
                    disabled={locked && !isSelected}
                    onClick={() => selectAnswer(q, a.id)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left' as const,
                      padding: '11px 16px',
                      borderRadius: 'var(--radius-sm)',
                      border: isSelected
                        ? '1.5px solid var(--color-primary)'
                        : '1.5px solid rgba(234,88,12,0.20)',
                      background: isSelected
                        ? 'rgba(234,88,12,0.12)'
                        : 'var(--color-bg)',
                      color: isSelected ? 'var(--color-primary)' : 'var(--color-text)',
                      cursor: locked && !isSelected ? 'not-allowed' : 'pointer',
                      opacity: locked && !isSelected ? 0.5 : 1,
                      fontSize: '0.9rem',
                      fontWeight: isSelected ? 600 : 400,
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected && !(locked && !isSelected)) {
                        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(234,88,12,0.06)';
                        (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(234,88,12,0.40)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg)';
                        (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(234,88,12,0.20)';
                      }
                    }}
                  >
                    {a.text}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Boton entregar */}
      <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
        <button
          className="btn btn-primary"
          style={{
            padding: '12px 28px',
            fontSize: '1rem',
            opacity: answeredCount < totalCount ? 0.45 : 1,
            cursor: answeredCount < totalCount ? 'not-allowed' : 'pointer',
          }}
          disabled={answeredCount < totalCount || isLoading}
          onClick={handleSubmit}
        >
          {isLoading ? 'Entregando...' : 'Entregar examen'}
        </button>
      </div>
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
  const { data: certs } = useMyCertificates();
  const examCertType = courseId ? 'COURSE_EXAM' : 'MODULE_EXAM';
  const examScopeId = courseId ?? moduleId;
  const examCert = certs?.find(
    (c) => c.scopeId === examScopeId && c.type === examCertType,
  );

  const passed = result.score >= 50;

  return (
    <div>
      {/* Score grande */}
      <div
        style={{
          background: 'var(--gradient-hero)',
          borderRadius: 'var(--radius-xl)',
          padding: '40px 36px',
          textAlign: 'center' as const,
          marginBottom: 24,
          position: 'relative' as const,
          overflow: 'hidden',
        }}
      >
        {/* Glow decorativo */}
        <div
          style={{
            position: 'absolute' as const,
            top: -80,
            right: -80,
            width: 280,
            height: 280,
            background: `radial-gradient(circle, ${scoreColor(result.score)}22 0%, transparent 70%)`,
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            fontSize: '5rem',
            fontWeight: 900,
            background: scoreGradient(result.score),
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            lineHeight: 1,
            letterSpacing: '-0.03em',
            marginBottom: 8,
          }}
        >
          {result.score.toFixed(1)}%
        </div>

        <div style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.65)', marginBottom: 16 }}>
          {result.correctCount} de {result.numQuestions} respuestas correctas
        </div>

        {passed && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 18px',
              borderRadius: 999,
              background: 'rgba(22,163,74,0.15)',
              border: '1px solid rgba(22,163,74,0.35)',
              color: '#4ade80',
              fontWeight: 700,
              fontSize: '0.875rem',
            }}
          >
            Certificado emitido
          </div>
        )}
      </div>

      {/* Correcciones */}
      <div className="vkb-card" style={{ padding: '24px', marginBottom: 20 }}>
        <h3 style={{ fontWeight: 700, marginBottom: 16, fontSize: '0.95rem', color: 'var(--color-text)' }}>
          Correcciones
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
          {result.corrections.map((c, i) => (
            <div
              key={c.questionId}
              style={{
                borderRadius: 'var(--radius-sm)',
                padding: '14px 16px',
                borderLeft: `4px solid ${c.isCorrect ? '#16a34a' : '#dc2626'}`,
                background: c.isCorrect ? 'rgba(22,163,74,0.05)' : 'rgba(220,38,38,0.04)',
                border: `1px solid ${c.isCorrect ? 'rgba(22,163,74,0.20)' : 'rgba(220,38,38,0.18)'}`,
                borderLeftWidth: 4,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 6, fontSize: '0.9rem', color: 'var(--color-text)', lineHeight: 1.4 }}>
                <span style={{ marginRight: 6, fontSize: '0.85rem' }}>
                  {c.isCorrect ? '✓' : '✗'}
                </span>
                {i + 1}. {c.questionText}
              </div>

              {c.selectedAnswerText ? (
                <div style={{ fontSize: '0.82rem', color: c.isCorrect ? 'var(--color-text-muted)' : '#dc2626', marginBottom: c.isCorrect ? 0 : 4 }}>
                  Tu respuesta: {c.selectedAnswerText}
                </div>
              ) : (
                <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>Sin respuesta</div>
              )}

              {!c.isCorrect && c.correctAnswerText && (
                <div style={{ fontSize: '0.82rem', color: '#16a34a', fontWeight: 600, marginTop: 4 }}>
                  Respuesta correcta: {c.correctAnswerText}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Historial */}
      {historyItems.filter((h) => h.submittedAt).length > 1 && (
        <div className="vkb-card" style={{ padding: '24px', marginBottom: 24 }}>
          <h4 style={{ fontWeight: 700, marginBottom: 14, fontSize: '0.9rem', color: 'var(--color-text)' }}>
            Historial de intentos
          </h4>
          {historyItems
            .filter((h) => h.submittedAt)
            .map((h) => (
              <div
                key={h.attemptId}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '9px 0',
                  borderBottom: '1px solid var(--color-border)',
                  fontSize: '0.875rem',
                  gap: 12,
                }}
              >
                <span style={{ color: 'var(--color-text-muted)' }}>
                  {new Date(h.submittedAt!).toLocaleDateString('es-ES')}
                </span>
                <span style={{ color: 'var(--color-text-muted)' }}>{h.numQuestions} preguntas</span>
                <span
                  style={{
                    fontWeight: 800,
                    color: scoreColor(h.score ?? 0),
                  }}
                >
                  {h.score?.toFixed(1)}%
                </span>
              </div>
            ))}
        </div>
      )}

      {/* Acciones */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' as const }}>
        <button className="btn btn-ghost" onClick={onBack}>
          Volver al curso
        </button>
        <button className="btn btn-primary" onClick={onRepeat}>
          Repetir examen
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => downloadExamPdf(result, scopeTitle)}
        >
          Descargar PDF examen
        </button>
        {examCert && (
          <button
            className="btn"
            style={{
              background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
              color: '#fff',
              boxShadow: '0 4px 16px rgba(22,163,74,0.30)',
            }}
            onClick={() => downloadCertificatePdf(examCert)}
          >
            Descargar certificado
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

  // ── Estados de carga y error ──

  if (bankLoading) {
    return (
      <div style={{ maxWidth: 780, margin: '0 auto' }}>
        <div className="page-hero animate-in">
          <h1 className="hero-title">Cargando examen...</h1>
          <p className="hero-subtitle">Preparando el banco de preguntas</p>
        </div>
      </div>
    );
  }

  if (bankError || !bankInfo) {
    return (
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '2rem' }}>
        <div style={{ color: 'var(--color-error)', padding: '1rem' }}>
          Error al cargar el examen.
        </div>
      </div>
    );
  }

  if (bankInfo.questionCount === 0) {
    return (
      <div style={{ maxWidth: 780, margin: '0 auto' }}>
        <div className="page-hero animate-in">
          <button
            onClick={handleBack}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,0.55)',
              cursor: 'pointer',
              fontSize: '0.875rem',
              padding: 0,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            Volver
          </button>
          <h1 className="hero-title">Examen — {bankInfo.scopeTitle}</h1>
          <p className="hero-subtitle">Este banco de preguntas esta vacio.</p>
        </div>
        <div className="vkb-card" style={{ padding: '24px' }}>
          <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>
            El administrador debe anadir preguntas antes de poder examinarse.
          </p>
        </div>
      </div>
    );
  }

  // ── Estado del examen: label del paso activo ──

  const stepLabel = examState === 'config'
    ? 'Configuracion'
    : examState === 'in-progress'
    ? 'En progreso'
    : 'Resultados';

  const stepIndex = examState === 'config' ? 0 : examState === 'in-progress' ? 1 : 2;

  return (
    <div style={{ maxWidth: 780, margin: '0 auto' }}>

      {/* Hero */}
      <div className="page-hero animate-in">
        {examState !== 'in-progress' && (
          <button
            onClick={handleBack}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,0.50)',
              cursor: 'pointer',
              fontSize: '0.85rem',
              padding: 0,
              marginBottom: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            Volver al curso
          </button>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' as const }}>
          <div>
            <h1 className="hero-title" style={{ fontSize: '1.6rem' }}>
              Examen
            </h1>
            <p className="hero-subtitle">{bankInfo.scopeTitle}</p>
          </div>

          {/* Indicador de paso */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {['Configurar', 'Examen', 'Resultados'].map((label, idx) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: idx === stepIndex
                      ? 'var(--gradient-orange)'
                      : idx < stepIndex
                      ? 'rgba(234,88,12,0.35)'
                      : 'rgba(255,255,255,0.10)',
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    color: idx <= stepIndex ? '#fff' : 'rgba(255,255,255,0.40)',
                    border: idx === stepIndex ? 'none' : '1px solid rgba(255,255,255,0.15)',
                  }}
                >
                  {idx < stepIndex ? '✓' : idx + 1}
                </div>
                {idx < 2 && (
                  <div
                    style={{
                      width: 24,
                      height: 2,
                      background: idx < stepIndex ? 'rgba(234,88,12,0.50)' : 'rgba(255,255,255,0.12)',
                      borderRadius: 1,
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.8rem', marginTop: 8 }}>
          {stepLabel} · {bankInfo.questionCount} preguntas disponibles
        </div>
      </div>

      {/* Contenido del paso activo */}
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
