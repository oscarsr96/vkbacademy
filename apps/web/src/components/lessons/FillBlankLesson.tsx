import { useState, useMemo } from 'react';
import type { FillBlankContent } from '@vkbacademy/shared';

interface Props {
  content: FillBlankContent;
  onComplete: () => void;
}

interface ParsedSegment {
  type: 'text' | 'blank';
  value: string;       // texto literal o la palabra correcta
  blankIdx?: number;   // índice en el array de huecos (solo en blanks)
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Parsea el template: divide por {{...}} y construye segmentos + lista de correctas
function parseTemplate(template: string): { segments: ParsedSegment[]; correctWords: string[] } {
  const regex = /\{\{([^}]+)\}\}/g;
  const segments: ParsedSegment[] = [];
  const correctWords: string[] = [];
  let lastIdx = 0;
  let match;

  while ((match = regex.exec(template)) !== null) {
    // Texto anterior
    if (match.index > lastIdx) {
      segments.push({ type: 'text', value: template.slice(lastIdx, match.index) });
    }
    const word = match[1];
    segments.push({ type: 'blank', value: word, blankIdx: correctWords.length });
    correctWords.push(word);
    lastIdx = regex.lastIndex;
  }
  // Texto restante
  if (lastIdx < template.length) {
    segments.push({ type: 'text', value: template.slice(lastIdx) });
  }

  return { segments, correctWords };
}

export default function FillBlankLesson({ content, onComplete }: Props) {
  const { template, distractors } = content;

  const { segments, correctWords } = useMemo(() => parseTemplate(template), [template]);

  // Banco de palabras barajado (correctas + distractors)
  const [bank, setBank] = useState<string[]>(() => shuffle([...correctWords, ...distractors]));

  // Array de palabras colocadas por índice de hueco (null = vacío)
  const [placed, setPlaced] = useState<(string | null)[]>(() => Array(correctWords.length).fill(null));

  const [checked, setChecked] = useState(false);
  const [allCorrect, setAllCorrect] = useState(false);

  const allFilled = placed.every((p) => p !== null);

  // Click en palabra del banco → colocar en primer hueco vacío
  function handleBankClick(word: string) {
    if (checked) return;
    const firstEmpty = placed.findIndex((p) => p === null);
    if (firstEmpty === -1) return;
    const nextPlaced = [...placed];
    nextPlaced[firstEmpty] = word;
    setPlaced(nextPlaced);
    setBank((b) => {
      const idx = b.indexOf(word);
      return [...b.slice(0, idx), ...b.slice(idx + 1)];
    });
  }

  // Click en hueco → devolver al banco
  function handleBlankClick(blankIdx: number) {
    if (checked) return;
    const word = placed[blankIdx];
    if (word === null) return;
    const nextPlaced = [...placed];
    nextPlaced[blankIdx] = null;
    setPlaced(nextPlaced);
    setBank((b) => shuffle([...b, word]));
  }

  function handleVerify() {
    const correct = placed.every((word, idx) => word === correctWords[idx]);
    setChecked(true);
    setAllCorrect(correct);
    if (correct) onComplete();
  }

  function handleReset() {
    setPlaced(Array(correctWords.length).fill(null));
    setBank(shuffle([...correctWords, ...distractors]));
    setChecked(false);
    setAllCorrect(false);
  }

  function blankColor(blankIdx: number): string {
    if (!checked) return 'var(--color-primary)';
    return placed[blankIdx] === correctWords[blankIdx] ? '#16a34a' : '#ef4444';
  }

  return (
    <div style={s.wrapper}>
      <p style={s.instructions}>Rellena los huecos con las palabras correctas.</p>

      {/* Texto con huecos */}
      <div style={s.textBlock}>
        {segments.map((seg, i) => {
          if (seg.type === 'text') {
            return <span key={i}>{seg.value}</span>;
          }
          const bi = seg.blankIdx!;
          const filled = placed[bi];
          return (
            <span key={i} style={{ display: 'inline-block' }}>
              <button
                style={{
                  ...s.blank,
                  minWidth: Math.max(60, (filled?.length ?? seg.value.length) * 9 + 16),
                  borderColor: blankColor(bi),
                  color: blankColor(bi),
                  background: checked
                    ? (placed[bi] === correctWords[bi] ? '#d1fae5' : '#fee2e2')
                    : filled ? 'rgba(99,102,241,0.08)' : 'var(--color-surface)',
                }}
                onClick={() => handleBlankClick(bi)}
                disabled={checked}
              >
                {filled ?? '___'}
              </button>
              {/* Mostrar respuesta correcta debajo si fallo */}
              {checked && placed[bi] !== correctWords[bi] && (
                <div style={s.correctHint}>{correctWords[bi]}</div>
              )}
            </span>
          );
        })}
      </div>

      {/* Banco de palabras */}
      <div style={s.bankSection}>
        <p style={s.bankLabel}>Palabras disponibles:</p>
        <div style={s.bank}>
          {bank.map((word, idx) => (
            <button
              key={`${word}-${idx}`}
              style={s.bankWord}
              onClick={() => handleBankClick(word)}
              disabled={checked}
            >
              {word}
            </button>
          ))}
          {bank.length === 0 && (
            <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
              Todas las palabras han sido colocadas.
            </span>
          )}
        </div>
      </div>

      {/* Resultado */}
      {checked && (
        <div style={{ ...s.feedback, background: allCorrect ? '#d1fae5' : '#fee2e2', color: allCorrect ? '#065f46' : '#991b1b' }}>
          {allCorrect
            ? '¡Todo correcto! Puedes marcar la lección como completada.'
            : 'Hay huecos incorrectos. Revisa las respuestas marcadas en rojo.'}
        </div>
      )}

      {/* Acciones */}
      {!checked ? (
        <button
          style={{
            ...s.btn,
            background: allFilled ? 'var(--color-primary)' : 'var(--color-border)',
            color: allFilled ? '#fff' : 'var(--color-text-muted)',
            cursor: allFilled ? 'pointer' : 'not-allowed',
          }}
          disabled={!allFilled}
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
  textBlock: {
    fontSize: '1rem',
    lineHeight: 2.2,
    color: 'var(--color-text)',
    flexWrap: 'wrap',
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    marginBottom: '1.25rem',
  },
  blank: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 8px',
    height: 30,
    borderRadius: 6,
    border: '2px solid',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.15s',
    margin: '0 2px',
  },
  correctHint: {
    fontSize: '0.72rem',
    color: '#16a34a',
    textAlign: 'center',
    marginTop: 2,
  },
  bankSection: {
    borderTop: '1px solid var(--color-border)',
    paddingTop: '1rem',
  },
  bankLabel: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--color-text-muted)',
    marginBottom: '0.5rem',
  },
  bank: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
  },
  bankWord: {
    padding: '0.35rem 0.75rem',
    borderRadius: 20,
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    fontSize: '0.875rem',
    cursor: 'pointer',
    fontWeight: 500,
    transition: 'background 0.1s',
  },
  feedback: {
    marginTop: '0.75rem',
    borderRadius: 8,
    padding: '0.7rem 1rem',
    fontSize: '0.9rem',
    fontWeight: 600,
  },
  btn: {
    marginTop: '1rem',
    border: 'none',
    borderRadius: 8,
    padding: '0.55rem 1.25rem',
    fontSize: '0.875rem',
    fontWeight: 600,
  },
};
