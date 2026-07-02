import { useState, useEffect, useCallback } from 'react';
import type { ExamAttemptStarted, ExamQuestionPublic } from '@vkbacademy/shared';
import Icon from '../../components/ui/Icon';
import ProgressBar from '../../components/ui/ProgressBar';

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
      {/* Mini-marcador sticky: respondidas + temporizador + progreso */}
      <div
        style={{
          position: 'sticky' as const,
          top: 0,
          zIndex: 5,
          background: 'var(--color-bg)',
          paddingBottom: 10,
          marginBottom: 18,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
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
                gap: 10,
                padding: '7px 18px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--navy-800)',
                border: isTimeCritical
                  ? '1px solid rgba(203,32,39,0.5)'
                  : '1px solid rgba(255,255,255,0.09)',
                animation: isTimeCritical ? 'pulse-glow 0.8s ease-in-out infinite' : 'none',
              }}
            >
              <Icon name="clock" size={15} color={isTimeCritical ? '#cb2027' : 'var(--amber-led)'} />
              <span
                className={isTimeCritical ? undefined : 'score-number'}
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.15rem',
                  letterSpacing: '0.04em',
                  fontVariantNumeric: 'tabular-nums',
                  color: isTimeCritical ? '#cb2027' : undefined,
                }}
              >
                {formatTime(secondsLeft)}
              </span>
            </div>
          )}
        </div>

        {/* Barra de progreso */}
        <ProgressBar value={answeredCount} max={totalCount} variant="brand" label="Progreso del examen" />
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
              <span style={{ color: 'var(--brand)', marginRight: 8, fontWeight: 900 }}>{idx + 1}.</span>
              {q.text}
            </div>

            {/* Hint para MULTIPLE */}
            {isMultiple && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: 'var(--brand-deep)',
                  marginBottom: 12,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase' as const,
                }}
              >
                <Icon name="check" size={13} />
                Selecciona todas las correctas
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
                      border: isSelected ? '1.5px solid var(--brand)' : '1.5px solid var(--color-border)',
                      background: isSelected ? 'var(--brand-faint)' : 'var(--color-bg)',
                      color: isSelected ? 'var(--brand-deep)' : 'var(--color-text)',
                      cursor: locked && !isSelected ? 'not-allowed' : 'pointer',
                      opacity: locked && !isSelected ? 0.5 : 1,
                      fontSize: '0.9rem',
                      fontWeight: isSelected ? 600 : 400,
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected && !(locked && !isSelected)) {
                        (e.currentTarget as HTMLButtonElement).style.background = 'var(--brand-faint)';
                        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--brand-glow)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg)';
                        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)';
                      }
                    }}
                  >
                    {/* Marcador: check en MULTIPLE, punto relleno en SINGLE/TRUE_FALSE */}
                    <span
                      aria-hidden
                      style={{
                        flexShrink: 0,
                        width: 18,
                        height: 18,
                        borderRadius: isMultiple ? 4 : '50%',
                        border: isSelected ? '2px solid var(--brand)' : '2px solid var(--color-border)',
                        background: isSelected ? 'var(--brand)' : 'transparent',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {isSelected &&
                        (isMultiple ? (
                          <Icon name="check" size={11} color="var(--brand-contrast)" strokeWidth={3.5} />
                        ) : (
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: 'var(--brand-contrast)',
                            }}
                          />
                        ))}
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
          {isLoading ? (
            'Entregando...'
          ) : (
            <>
              <Icon name="check" size={16} />
              Entregar examen
            </>
          )}
        </button>
      </div>
    </div>
  );
}
