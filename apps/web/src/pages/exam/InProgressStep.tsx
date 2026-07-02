import { useState, useEffect, useCallback } from 'react';
import type { ExamAttemptStarted, ExamQuestionPublic } from '@vkbacademy/shared';

// ─── Componente: Examen en progreso ───────────────────────────────────────────

export function InProgressStep({
  attempt,
  onSubmit,
  isLoading,
}: {
  attempt: ExamAttemptStarted;
  onSubmit: (answers: { questionId: string; answerIds: string[] }[]) => void;
  isLoading: boolean;
}) {
  // Mapa pregunta → ids seleccionados. Para SINGLE/TRUE_FALSE el array tiene
  // siempre 1 elemento; para MULTIPLE puede tener varios.
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string[]>>({});
  const [secondsLeft, setSecondsLeft] = useState<number | null>(attempt.timeLimit ?? null);

  const handleSubmit = useCallback(() => {
    const answers = Object.entries(selectedAnswers)
      .filter(([, ids]) => ids.length > 0)
      .map(([questionId, answerIds]) => ({ questionId, answerIds }));
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

  const answeredCount = Object.values(selectedAnswers).filter((ids) => ids.length > 0).length;
  const totalCount = attempt.questions.length;
  const progressPct = (answeredCount / totalCount) * 100;

  const isTimeCritical = secondsLeft !== null && secondsLeft < 60;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const toggleAnswer = (question: ExamQuestionPublic, answerId: string) => {
    const isMultiple = question.type === 'MULTIPLE';
    setSelectedAnswers((prev) => {
      const current = prev[question.id] ?? [];
      // Bloqueo onlyOnce: si ya hay selección y no es la misma respuesta en MULTIPLE, no permitir cambios.
      if (attempt.onlyOnce && current.length > 0 && !isMultiple) return prev;

      if (isMultiple) {
        const exists = current.includes(answerId);
        const next = exists ? current.filter((id) => id !== answerId) : [...current, answerId];
        return { ...prev, [question.id]: next };
      }
      // SINGLE / TRUE_FALSE: reemplazo
      return { ...prev, [question.id]: [answerId] };
    });
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
      <div
        className="progress-bar"
        style={{ marginBottom: 28 }}
        role="progressbar"
        aria-valuenow={Math.round(progressPct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="progress-fill" style={{ width: `${progressPct}%` }} />
      </div>

      {/* Preguntas */}
      {attempt.questions.map((q, idx) => {
        const chosen = selectedAnswers[q.id] ?? [];
        const isMultiple = q.type === 'MULTIPLE';
        return (
          <div key={q.id} className="vkb-card" style={{ padding: '22px 24px', marginBottom: 16 }}>
            <div
              style={{
                fontWeight: 700,
                marginBottom: 6,
                color: 'var(--color-text)',
                fontSize: '0.975rem',
                lineHeight: 1.4,
              }}
            >
              <span style={{ color: 'var(--color-primary)', marginRight: 8, fontWeight: 900 }}>
                {idx + 1}.
              </span>
              {q.text}
            </div>

            {/* Hint para MULTIPLE */}
            {isMultiple && (
              <div
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: 'var(--color-primary)',
                  marginBottom: 12,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase' as const,
                }}
              >
                ☑ Selecciona todas las correctas
              </div>
            )}

            <div
              style={{ display: 'flex', flexDirection: 'column' as const, gap: 8, marginTop: 10 }}
            >
              {q.answers.map((a) => {
                const isSelected = chosen.includes(a.id);
                const locked = attempt.onlyOnce && chosen.length > 0 && !isMultiple;

                return (
                  <button
                    key={a.id}
                    disabled={locked && !isSelected}
                    onClick={() => toggleAnswer(q, a.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      textAlign: 'left' as const,
                      padding: '11px 16px',
                      borderRadius: 'var(--radius-sm)',
                      border: isSelected
                        ? '1.5px solid var(--color-primary)'
                        : '1.5px solid rgba(234,88,12,0.20)',
                      background: isSelected ? 'rgba(234,88,12,0.12)' : 'var(--color-bg)',
                      color: isSelected ? 'var(--color-primary)' : 'var(--color-text)',
                      cursor: locked && !isSelected ? 'not-allowed' : 'pointer',
                      opacity: locked && !isSelected ? 0.5 : 1,
                      fontSize: '0.9rem',
                      fontWeight: isSelected ? 600 : 400,
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected && !(locked && !isSelected)) {
                        (e.currentTarget as HTMLButtonElement).style.background =
                          'rgba(234,88,12,0.06)';
                        (e.currentTarget as HTMLButtonElement).style.borderColor =
                          'rgba(234,88,12,0.40)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg)';
                        (e.currentTarget as HTMLButtonElement).style.borderColor =
                          'rgba(234,88,12,0.20)';
                      }
                    }}
                  >
                    {/* Marcador: ☑ en MULTIPLE, ◉ en SINGLE/TRUE_FALSE */}
                    <span
                      aria-hidden
                      style={{
                        flexShrink: 0,
                        width: 18,
                        height: 18,
                        borderRadius: isMultiple ? 4 : '50%',
                        border: isSelected
                          ? '2px solid var(--color-primary)'
                          : '2px solid rgba(234,88,12,0.30)',
                        background: isSelected ? 'var(--color-primary)' : 'transparent',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontSize: '0.7rem',
                        fontWeight: 900,
                        lineHeight: 1,
                      }}
                    >
                      {isSelected ? (isMultiple ? '✓' : '●') : ''}
                    </span>
                    <span>{a.text}</span>
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
