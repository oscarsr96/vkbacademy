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
import PageHeader from '../components/ui/PageHeader';
import Icon from '../components/ui/Icon';
import EmptyState from '../components/ui/EmptyState';

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

  const backButton = (label: string) => (
    <button
      onClick={handleBack}
      className="btn btn-ghost"
      style={{ padding: '5px 12px', fontSize: '0.8rem', marginBottom: 14 }}
    >
      <Icon name="chevron-left" size={14} />
      {label}
    </button>
  );

  // ── Camino IA: no carga bankInfo, renderiza in-progress / results directos ──
  if (isAiMode) {
    return (
      <div style={{ maxWidth: 780, margin: '0 auto' }}>
        {examState !== 'in-progress' && backButton('Volver')}
        <PageHeader
          variant="light"
          title="Examen IA"
          subtitle={currentAttempt ? 'Examen generado por IA' : 'Preparando preguntas...'}
        />

        {aiStartError && (
          <div className="vkb-card" style={{ padding: '24px', borderColor: 'var(--color-error)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <Icon name="close" size={18} color="var(--color-error)" />
              <p style={{ color: 'var(--color-error)', margin: 0 }}>{aiStartError}</p>
            </div>
            <button className="btn btn-ghost" onClick={() => navigate(returnTo)}>
              <Icon name="chevron-left" size={14} />
              Volver
            </button>
          </div>
        )}

        {!aiStartError && examState === 'in-progress' && !currentAttempt && (
          <div className="vkb-card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="spinner dark" />
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
        <PageHeader variant="light" title="Cargando examen..." subtitle="Preparando el banco de preguntas" />
      </div>
    );
  }

  if (bankError || !bankInfo) {
    return (
      <div style={{ maxWidth: 780, margin: '0 auto' }}>
        <PageHeader variant="light" title="Examen" />
        <div className="vkb-card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon name="close" size={18} color="var(--color-error)" />
          <span style={{ color: 'var(--color-error)' }}>Error al cargar el examen.</span>
        </div>
      </div>
    );
  }

  if (bankInfo.questionCount === 0) {
    return (
      <div style={{ maxWidth: 780, margin: '0 auto' }}>
        {backButton('Volver')}
        <PageHeader
          variant="light"
          title={`Examen — ${bankInfo.scopeTitle}`}
          subtitle="Este banco de preguntas esta vacio."
        />
        <div className="vkb-card">
          <EmptyState
            icon="lock"
            title="Banco de preguntas vacio"
            message="El administrador debe anadir preguntas antes de poder examinarse."
          />
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
      {examState !== 'in-progress' && backButton('Volver al curso')}

      {/* Cabecera con indicador de paso */}
      <PageHeader variant="light" title="Examen" subtitle={bankInfo.scopeTitle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' as const, marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {['Configurar', 'Examen', 'Resultados'].map((label, idx) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background:
                      idx === stepIndex
                        ? 'var(--gradient-orange)'
                        : idx < stepIndex
                          ? 'var(--brand-soft)'
                          : 'var(--color-border)',
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    color:
                      idx === stepIndex
                        ? 'var(--brand-contrast)'
                        : idx < stepIndex
                          ? 'var(--brand-deep)'
                          : 'var(--color-text-muted)',
                    border: idx === stepIndex ? 'none' : '1px solid var(--color-border)',
                  }}
                >
                  {idx < stepIndex ? <Icon name="check" size={12} /> : idx + 1}
                </div>
                {idx < 2 && (
                  <div
                    style={{
                      width: 20,
                      height: 2,
                      background: idx < stepIndex ? 'var(--brand-glow)' : 'var(--color-border)',
                      borderRadius: 1,
                    }}
                  />
                )}
              </div>
            ))}
          </div>
          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
            {stepLabel} · {bankInfo.questionCount} preguntas disponibles
          </span>
        </div>
      </PageHeader>

      {/* Error de arranque/entrega — no bloquea, permite reintentar */}
      {actionError && (
        <div
          className="vkb-card"
          style={{
            padding: '14px 20px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            borderColor: 'var(--color-error)',
          }}
        >
          <Icon name="close" size={16} color="var(--color-error)" />
          <p style={{ color: 'var(--color-error)', margin: 0, fontSize: '0.9rem' }}>{actionError}</p>
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
