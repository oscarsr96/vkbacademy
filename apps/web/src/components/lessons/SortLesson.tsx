import { useState } from 'react';
import type { SortItem, SortContent } from '@vkbacademy/shared';

interface Props {
  content: SortContent;
  onComplete: () => void;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function SortLesson({ content, onComplete }: Props) {
  const { prompt, items } = content;

  // Lista mutable con los items barajados
  const [list, setList] = useState<SortItem[]>(() => shuffle(items));
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [correctMask, setCorrectMask] = useState<boolean[]>([]);
  const [allCorrect, setAllCorrect] = useState(false);

  function handleDragStart(idx: number) {
    setDragIdx(idx);
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    // Reordenar en tiempo real
    const next = [...list];
    const [dragged] = next.splice(dragIdx, 1);
    next.splice(idx, 0, dragged);
    setList(next);
    setDragIdx(idx);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragIdx(null);
  }

  function handleVerify() {
    // Comparar posición actual con correctOrder
    const mask = list.map((item, idx) => item.correctOrder === idx);
    const correct = mask.every(Boolean);
    setCorrectMask(mask);
    setChecked(true);
    setAllCorrect(correct);
    if (correct) onComplete();
  }

  function handleReset() {
    setList(shuffle(items));
    setChecked(false);
    setCorrectMask([]);
    setAllCorrect(false);
    setDragIdx(null);
  }

  function itemBg(idx: number): string {
    if (!checked) return 'var(--color-surface)';
    return correctMask[idx] ? '#d1fae5' : '#fee2e2';
  }

  function itemBorder(idx: number): string {
    if (!checked) return dragIdx === idx ? 'var(--color-primary)' : 'var(--color-border)';
    return correctMask[idx] ? '#16a34a' : '#ef4444';
  }

  return (
    <div style={s.wrapper}>
      <p style={s.prompt}>{prompt}</p>
      <p style={s.hint}>Arrastra los elementos para ordenarlos correctamente.</p>

      <div style={s.list}>
        {list.map((item, idx) => (
          <div
            key={item.text}
            draggable={!checked}
            onDragStart={() => handleDragStart(idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDrop={handleDrop}
            style={{
              ...s.item,
              background: itemBg(idx),
              borderColor: itemBorder(idx),
              opacity: dragIdx === idx ? 0.5 : 1,
              cursor: checked ? 'default' : 'grab',
            }}
          >
            <span style={s.handle}>⠿</span>
            <span style={s.itemText}>{item.text}</span>
            {checked && (
              <span style={{ color: correctMask[idx] ? '#16a34a' : '#ef4444', fontWeight: 700 }}>
                {correctMask[idx] ? '✓' : '✗'}
              </span>
            )}
          </div>
        ))}
      </div>

      {checked && (
        <div style={{ ...s.feedback, background: allCorrect ? '#d1fae5' : '#fee2e2', color: allCorrect ? '#065f46' : '#991b1b' }}>
          {allCorrect
            ? '¡Orden correcto! Puedes marcar la lección como completada.'
            : 'El orden no es correcto. ¡Inténtalo de nuevo!'}
        </div>
      )}

      {!checked ? (
        <button style={s.btn} onClick={handleVerify}>
          Verificar
        </button>
      ) : (
        !allCorrect && (
          <button style={{ ...s.btn, background: 'var(--color-primary)' }} onClick={handleReset}>
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
  prompt: {
    fontWeight: 700,
    fontSize: '1rem',
    color: 'var(--color-text)',
    marginBottom: '0.25rem',
  },
  hint: {
    fontSize: '0.82rem',
    color: 'var(--color-text-muted)',
    marginBottom: '1rem',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.65rem 0.9rem',
    borderRadius: 8,
    border: '1px solid var(--color-border)',
    fontSize: '0.875rem',
    color: 'var(--color-text)',
    userSelect: 'none',
    transition: 'background 0.15s, border-color 0.15s',
  },
  handle: {
    fontSize: '1rem',
    color: 'var(--color-text-muted)',
    flexShrink: 0,
  },
  itemText: {
    flex: 1,
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
    background: 'var(--color-primary)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '0.55rem 1.25rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
};
