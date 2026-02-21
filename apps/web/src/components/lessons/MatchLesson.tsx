import { useState } from 'react';
import type { MatchContent } from '@vkbacademy/shared';

interface Props {
  content: MatchContent;
  onComplete: () => void;
}

// Baraja un array de forma inmutable
function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function MatchLesson({ content, onComplete }: Props) {
  const { pairs } = content;

  // Índices barajados para cada columna
  const [leftOrder] = useState(() => shuffle(pairs.map((_, i) => i)));
  const [rightOrder] = useState(() => shuffle(pairs.map((_, i) => i)));

  // Ítem izquierdo seleccionado (índice en leftOrder)
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  // Emparejamientos: Map<índice original left → índice original right>
  const [matched, setMatched] = useState<Map<number, number>>(new Map());
  // Estado de verificación
  const [checked, setChecked] = useState(false);
  const [allCorrect, setAllCorrect] = useState(false);

  const totalPairs = pairs.length;
  const matchedCount = matched.size;

  function handleLeftClick(posIdx: number) {
    if (checked) return;
    // Si ya está emparejado, deseleccionar el actual y seleccionar éste
    setSelectedLeft(selectedLeft === posIdx ? null : posIdx);
  }

  function handleRightClick(posIdx: number) {
    if (checked || selectedLeft === null) return;
    const origLeft = leftOrder[selectedLeft];
    const origRight = rightOrder[posIdx];

    // Crear nuevo mapa con el emparejamiento
    const next = new Map(matched);
    // Si el right ya estaba emparejado con otro left, quitar ese par
    for (const [k, v] of next.entries()) {
      if (v === origRight) next.delete(k);
    }
    next.set(origLeft, origRight);
    setMatched(next);
    setSelectedLeft(null);
  }

  function handleVerify() {
    // Comprobar que cada left apunta al right del mismo par original
    let correct = true;
    for (const [origLeft, origRight] of matched.entries()) {
      if (origLeft !== origRight) { correct = false; break; }
    }
    setChecked(true);
    setAllCorrect(correct);
    if (correct) onComplete();
  }

  function handleReset() {
    setMatched(new Map());
    setSelectedLeft(null);
    setChecked(false);
    setAllCorrect(false);
  }

  // Helpers de color
  function leftBg(posIdx: number): string {
    const origIdx = leftOrder[posIdx];
    if (checked) {
      if (!matched.has(origIdx)) return 'var(--color-surface)';
      return matched.get(origIdx) === origIdx ? '#d1fae5' : '#fee2e2';
    }
    if (selectedLeft === posIdx) return 'rgba(99,102,241,0.12)';
    if (matched.has(origIdx)) return '#f3f4f6';
    return 'var(--color-surface)';
  }

  function rightBg(posIdx: number): string {
    const origRight = rightOrder[posIdx];
    if (checked) {
      // Buscar si algún left se emparejó con este right
      for (const [origLeft, v] of matched.entries()) {
        if (v === origRight) {
          return origLeft === origRight ? '#d1fae5' : '#fee2e2';
        }
      }
      return 'var(--color-surface)';
    }
    // ¿Este right ya está emparejado?
    for (const v of matched.values()) {
      if (v === origRight) return '#f3f4f6';
    }
    return 'var(--color-surface)';
  }

  return (
    <div style={s.wrapper}>
      <p style={s.instructions}>Empareja cada elemento de la columna izquierda con su par de la derecha.</p>

      <div style={s.columns}>
        {/* Columna izquierda */}
        <div style={s.column}>
          {leftOrder.map((origIdx, posIdx) => (
            <button
              key={origIdx}
              style={{
                ...s.item,
                background: leftBg(posIdx),
                borderColor: selectedLeft === posIdx ? 'var(--color-primary)' : 'var(--color-border)',
                fontWeight: selectedLeft === posIdx ? 700 : 400,
              }}
              onClick={() => handleLeftClick(posIdx)}
              disabled={checked}
            >
              {pairs[origIdx].left}
              {matched.has(origIdx) && !checked && (
                <span style={s.paired}>✓</span>
              )}
            </button>
          ))}
        </div>

        {/* Columna derecha */}
        <div style={s.column}>
          {rightOrder.map((origRight, posIdx) => (
            <button
              key={origRight}
              style={{
                ...s.item,
                background: rightBg(posIdx),
                borderColor: 'var(--color-border)',
              }}
              onClick={() => handleRightClick(posIdx)}
              disabled={checked}
            >
              {pairs[origRight].right}
            </button>
          ))}
        </div>
      </div>

      {/* Progreso */}
      {!checked && (
        <p style={s.progress}>{matchedCount} / {totalPairs} pares emparejados</p>
      )}

      {/* Resultado */}
      {checked && (
        <div style={{ ...s.feedback, background: allCorrect ? '#d1fae5' : '#fee2e2' }}>
          {allCorrect
            ? '¡Todo correcto! Puedes marcar la lección como completada.'
            : 'Hay pares incorrectos. ¡Inténtalo de nuevo!'}
        </div>
      )}

      {/* Botones de acción */}
      <div style={s.actions}>
        {!checked ? (
          <button
            style={{
              ...s.btn,
              background: matchedCount === totalPairs ? 'var(--color-primary)' : 'var(--color-border)',
              color: matchedCount === totalPairs ? '#fff' : 'var(--color-text-muted)',
              cursor: matchedCount === totalPairs ? 'pointer' : 'not-allowed',
            }}
            disabled={matchedCount < totalPairs}
            onClick={handleVerify}
          >
            Verificar
          </button>
        ) : (
          !allCorrect && (
            <button style={{ ...s.btn, background: 'var(--color-primary)', color: '#fff' }} onClick={handleReset}>
              Intentar de nuevo
            </button>
          )
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrapper: {
    border: '1px solid var(--color-border)',
    borderRadius: 10,
    padding: '1.25rem',
    marginBottom: '1rem',
    background: 'var(--color-surface)',
  },
  instructions: {
    fontSize: '0.9rem',
    color: 'var(--color-text-muted)',
    marginBottom: '1rem',
  },
  columns: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1rem',
  },
  column: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  item: {
    padding: '0.6rem 0.9rem',
    borderRadius: 8,
    border: '1px solid var(--color-border)',
    textAlign: 'left',
    cursor: 'pointer',
    fontSize: '0.875rem',
    color: 'var(--color-text)',
    transition: 'background 0.15s, border-color 0.15s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  paired: {
    color: '#16a34a',
    fontWeight: 700,
    flexShrink: 0,
  },
  progress: {
    fontSize: '0.82rem',
    color: 'var(--color-text-muted)',
    marginTop: '0.75rem',
    textAlign: 'center',
  },
  feedback: {
    marginTop: '0.75rem',
    borderRadius: 8,
    padding: '0.7rem 1rem',
    fontSize: '0.9rem',
    fontWeight: 600,
    color: '#065f46',
  },
  actions: {
    marginTop: '1rem',
  },
  btn: {
    border: 'none',
    borderRadius: 8,
    padding: '0.55rem 1.25rem',
    fontSize: '0.875rem',
    fontWeight: 600,
  },
};
