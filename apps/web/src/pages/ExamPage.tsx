import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  useExamBankInfo,
  useStartExam,
  useSubmitExam,
  useExamHistory,
  useStartAiAttempt,
} from '../hooks/useExams';
import type { ExamAttemptStarted, ExamAttemptResult } from '@vkbacademy/shared';
import { getApiErrorMessage } from '../utils/errorMessage';
import { ConfigStep } from './exam/ConfigStep';
import { InProgressStep } from './exam/InProgressStep';
import { ResultsStep } from './exam/ResultsStep';

// ─── Tipos internos ───────────────────────────────────────────────────────────

type ExamState = 'config' | 'in-progress' | 'results';

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ExamPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const courseId = searchParams.get('courseId') ?? undefined;
  const moduleId = searchParams.get('moduleId') ?? undefined;
  const aiBankId = searchParams.get('aiBankId') ?? undefined;
  const returnTo = searchParams.get('returnTo') ?? '/study';
  const isAiMode = !!aiBankId;

  const [examState, setExamState] = useState<ExamState>(isAiMode ? 'in-progress' : 'config');
  const [currentAttempt, setCurrentAttempt] = useState<ExamAttemptStarted | null>(null);
  const [result, setResult] = useState<ExamAttemptResult | null>(null);
  const [aiStartError, setAiStartError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const aiStartedRef = useRef(false);

  const {
    data: bankInfo,
    isLoading: bankLoading,
    isError: bankError,
  } = useExamBankInfo(isAiMode ? undefined : courseId, isAiMode ? undefined : moduleId);
  const { data: history } = useExamHistory(courseId, moduleId);

  const startMut = useStartExam();
  const startAiMut = useStartAiAttempt();
  const submitMut = useSubmitExam(currentAttempt?.attemptId ?? '', courseId, moduleId);

  // ── Auto-arranque del examen IA: lanza el primer intento al montar ──
  useEffect(() => {
    if (!isAiMode || aiStartedRef.current) return;
    aiStartedRef.current = true;
    (async () => {
      try {
        const attempt = await startAiMut.mutateAsync(aiBankId!);
        setCurrentAttempt(attempt);
      } catch (err) {
        const message =
          err && typeof err === 'object' && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'No se pudo iniciar el examen';
        setAiStartError(message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiBankId, isAiMode]);

  const handleStart = async (numQuestions: number, timeLimit?: number, onlyOnce?: boolean) => {
    setActionError(null);
    try {
      const attempt = await startMut.mutateAsync({
        courseId,
        moduleId,
        numQuestions,
        timeLimit,
        onlyOnce,
      });
      setCurrentAttempt(attempt);
      setExamState('in-progress');
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'No se pudo iniciar el examen. Inténtalo de nuevo.'));
    }
  };

  const handleSubmit = async (answers: { questionId: string; answerIds: string[] }[]) => {
    if (!currentAttempt) return;
    setActionError(null);
    try {
      const res = await submitMut.mutateAsync({ answers });
      setResult(res);
      setExamState('results');
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'No se pudo entregar el examen. Inténtalo de nuevo.'));
    }
  };

  const handleRepeat = async () => {
    if (isAiMode) {
      setResult(null);
      setCurrentAttempt(null);
      setExamState('in-progress');
      try {
        const attempt = await startAiMut.mutateAsync(aiBankId!);
        setCurrentAttempt(attempt);
      } catch (err) {
        const message =
          err && typeof err === 'object' && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'No se pudo iniciar el examen';
        setAiStartError(message);
      }
      return;
    }
    setCurrentAttempt(null);
    setResult(null);
    setExamState('config');
  };

  const handleBack = () => {
    if (isAiMode) {
      navigate(returnTo);
      return;
    }
    if (courseId) navigate(`/courses/${courseId}`);
    else navigate('/courses');
  };

  // ── Camino IA: no carga bankInfo, renderiza in-progress / results directos ──
  if (isAiMode) {
    return (
      <div style={{ maxWidth: 780, margin: '0 auto' }}>
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
              }}
            >
              Volver
            </button>
          )}
          <h1 className="hero-title" style={{ fontSize: '1.6rem' }}>
            Examen IA
          </h1>
          <p className="hero-subtitle">
            {currentAttempt ? 'Examen generado por IA' : 'Preparando preguntas...'}
          </p>
        </div>

        {aiStartError && (
          <div
            className="vkb-card"
            style={{ padding: '24px', borderColor: 'var(--color-error, #dc2626)' }}
          >
            <p style={{ color: 'var(--color-error, #dc2626)', margin: 0 }}>{aiStartError}</p>
            <button
              className="btn btn-ghost"
              style={{ marginTop: 14 }}
              onClick={() => navigate(returnTo)}
            >
              Volver
            </button>
          </div>
        )}

        {!aiStartError && examState === 'in-progress' && !currentAttempt && (
          <div className="vkb-card" style={{ padding: '24px' }}>
            <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>Cargando preguntas...</p>
          </div>
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
            scopeTitle="Examen IA"
            courseId={undefined}
            moduleId={undefined}
            onRepeat={handleRepeat}
            onBack={handleBack}
            historyItems={[]}
          />
        )}
      </div>
    );
  }

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

  const stepLabel =
    examState === 'config'
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

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap' as const,
          }}
        >
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
                    background:
                      idx === stepIndex
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
                      background:
                        idx < stepIndex ? 'rgba(234,88,12,0.50)' : 'rgba(255,255,255,0.12)',
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

      {/* Error de arranque/entrega — no bloquea, permite reintentar */}
      {actionError && (
        <div
          className="vkb-card"
          style={{ padding: '16px 20px', marginBottom: 16, borderColor: 'var(--color-error, #dc2626)' }}
        >
          <p style={{ color: 'var(--color-error, #dc2626)', margin: 0, fontSize: '0.9rem' }}>
            {actionError}
          </p>
        </div>
      )}

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
