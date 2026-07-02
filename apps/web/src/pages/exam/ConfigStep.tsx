import { useState } from 'react';
import { scoreColor } from './examShared';

// ─── Componente: Configuración ────────────────────────────────────────────────

export function ConfigStep({
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
      <div className="vkb-card" style={{ padding: '28px' }}>
        <h3
          style={{
            fontSize: '1rem',
            fontWeight: 700,
            color: 'var(--color-text)',
            marginBottom: 20,
          }}
        >
          {scopeTitle}
        </h3>

        {/* Numero de preguntas */}
        <div style={{ marginBottom: 20 }}>
          <label
            style={{
              display: 'block',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'var(--color-text-muted)',
              marginBottom: 8,
            }}
          >
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
            <span
              style={{
                fontSize: '0.8rem',
                color: 'var(--color-text-muted)',
                fontWeight: 600,
                whiteSpace: 'nowrap' as const,
              }}
            >
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
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0 12px 26px' }}
          >
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
          <h4
            style={{
              fontSize: '0.9rem',
              fontWeight: 700,
              color: 'var(--color-text)',
              marginBottom: 16,
            }}
          >
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
