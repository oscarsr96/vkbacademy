// Modo presentación del temario: deck de diapositivas a pantalla completa,
// animado y responsive (teclado / click / swipe). Inspirado en los decks de
// referencia (charla summer camp, cunef-claude-sessions) pero con la marca VKB.

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type TouchEvent as ReactTouchEvent,
} from 'react';
import type { TheoryModuleWithLessons } from '@vkbacademy/shared';
import { buildSlides, fragmentCount } from '../../utils/theorySlides';
import { SlideView } from './SlideView';
import { THEORY_CALLOUT_CSS } from './theoryMarkdown';

interface Props {
  module: TheoryModuleWithLessons;
  onClose: () => void;
}

export default function TheorySlides({ module, onClose }: Props) {
  const slides = useMemo(() => buildSlides(module), [module]);
  const total = slides.length;

  const [current, setCurrent] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const [gridOpen, setGridOpen] = useState(false);

  const slide = slides[current];
  const frags = fragmentCount(slide);

  const stageRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  const goTo = useCallback(
    (idx: number, reveal: 'all' | 'none') => {
      const clamped = Math.max(0, Math.min(total - 1, idx));
      setCurrent(clamped);
      setRevealed(reveal === 'all' ? fragmentCount(slides[clamped]) : 0);
    },
    [slides, total],
  );

  const next = useCallback(() => {
    if (revealed < frags) {
      setRevealed((r) => r + 1);
      return;
    }
    if (current < total - 1) goTo(current + 1, 'none');
  }, [revealed, frags, current, total, goTo]);

  const prev = useCallback(() => {
    if (revealed > 0) {
      setRevealed((r) => r - 1);
      return;
    }
    if (current > 0) goTo(current - 1, 'all');
  }, [revealed, current, goTo]);

  // Atajos de teclado (estilo deck de presentaciones).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (gridOpen) {
        if (e.key === 'Escape' || e.key === 'g' || e.key === 'G') {
          e.preventDefault();
          setGridOpen(false);
        }
        return;
      }
      switch (e.key) {
        case 'ArrowRight':
        case ' ':
        case 'PageDown':
          e.preventDefault();
          next();
          break;
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          prev();
          break;
        case 'Home':
          e.preventDefault();
          goTo(0, 'none');
          break;
        case 'End':
          e.preventDefault();
          goTo(total - 1, 'all');
          break;
        case 'g':
        case 'G':
          e.preventDefault();
          setGridOpen(true);
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, goTo, total, onClose, gridOpen]);

  // Bloquear scroll del body mientras el deck está abierto.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Auto-fit: escala la slide para que no desborde verticalmente en desktop.
  // En móvil no se escala (se hace scroll vertical).
  useLayoutEffect(() => {
    const inner = innerRef.current;
    const stage = stageRef.current;
    if (!inner || !stage) return;
    inner.style.transform = '';
    if (window.matchMedia('(max-width: 720px)').matches) return;
    const avail = stage.clientHeight - 24;
    const need = inner.scrollHeight;
    if (need > avail) {
      inner.style.transform = `scale(${Math.max(0.55, avail / need)})`;
    }
  }, [current, revealed, slide]);

  // Swipe en móvil.
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: ReactTouchEvent) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: ReactTouchEvent) => {
    if (!touch.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.current.x;
    const dy = t.clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) next();
      else prev();
    }
  };

  const progress = ((current + 1) / total) * 100;
  const atStart = current === 0 && revealed === 0;
  const atEnd = current === total - 1 && revealed >= frags;

  return (
    <div
      className="tslides"
      role="dialog"
      aria-modal="true"
      aria-label={`Presentación: ${module.title}`}
    >
      <style>
        {TSLIDES_CSS}
        {THEORY_CALLOUT_CSS}
      </style>

      <div className="tslides-progress">
        <span style={{ width: `${progress}%` }} />
      </div>

      <header className="tslides-topbar">
        <div className="tslides-title">{module.title}</div>
        <div className="tslides-actions">
          <button
            type="button"
            onClick={() => setGridOpen(true)}
            aria-label="Índice de diapositivas"
            title="Índice (G)"
          >
            ▦
          </button>
          <span className="tslides-counter">
            {current + 1} / {total}
          </span>
          <button
            type="button"
            className="tslides-close"
            onClick={onClose}
            aria-label="Cerrar presentación"
            title="Cerrar (Esc)"
          >
            ✕
          </button>
        </div>
      </header>

      <div
        className="tslides-stage"
        ref={stageRef}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <button
          type="button"
          className="tslides-zone left"
          onClick={prev}
          aria-label="Anterior"
          tabIndex={-1}
        />
        <button
          type="button"
          className="tslides-zone right"
          onClick={next}
          aria-label="Siguiente"
          tabIndex={-1}
        />
        <div className="tslides-slide" key={slide.id}>
          <div className="tslides-inner" ref={innerRef}>
            <SlideView slide={slide} revealed={revealed} />
          </div>
        </div>
      </div>

      <nav className="tslides-nav">
        <button
          type="button"
          className="tslides-arrow"
          onClick={prev}
          disabled={atStart}
          aria-label="Anterior"
        >
          ‹
        </button>
        <div className="tslides-dots">
          {slides.map((s, i) => (
            <button
              type="button"
              key={s.id}
              className={`tslides-dot${i === current ? ' is-active' : ''}`}
              onClick={() => goTo(i, 'none')}
              aria-label={`Ir a la diapositiva ${i + 1}`}
              aria-current={i === current}
            />
          ))}
        </div>
        <button
          type="button"
          className="tslides-arrow"
          onClick={next}
          disabled={atEnd}
          aria-label="Siguiente"
        >
          ›
        </button>
      </nav>

      <p className="tslides-hint">← → o toca para avanzar · G índice · Esc para salir</p>

      {gridOpen && (
        <div className="tslides-grid" onClick={() => setGridOpen(false)}>
          <div className="tslides-grid-panel" onClick={(e) => e.stopPropagation()}>
            <h3>Índice del temario</h3>
            <ul>
              {slides.map((s, i) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className={i === current ? 'is-active' : ''}
                    onClick={() => {
                      goTo(i, 'none');
                      setGridOpen(false);
                    }}
                  >
                    <span className="n">{i + 1}</span>
                    <span className="t">{s.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export const TSLIDES_CSS = `
  .tslides {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    background:
      radial-gradient(120% 80% at 50% -10%, rgba(234,88,12,0.22), transparent 60%),
      linear-gradient(180deg, #080e1a 0%, #0d1b2a 60%, #152233 100%);
    color: #fff;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  .tslides-progress {
    height: 4px;
    background: rgba(255,255,255,0.08);
    flex: none;
  }
  .tslides-progress > span {
    display: block;
    height: 100%;
    background: linear-gradient(90deg, #ea580c, #f97316);
    border-radius: 0 4px 4px 0;
    transition: width 0.35s cubic-bezier(0.2,0.8,0.25,1);
  }

  .tslides-topbar {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 18px;
  }
  .tslides-title {
    font-family: 'Unbounded', 'Inter', sans-serif;
    font-weight: 700;
    font-size: 0.95rem;
    color: #fff;
    opacity: 0.9;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 60vw;
  }
  .tslides-actions { display: flex; align-items: center; gap: 10px; }
  .tslides-actions button {
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.14);
    color: #fff;
    width: 38px;
    height: 38px;
    border-radius: 10px;
    font-size: 1rem;
    cursor: pointer;
    display: grid;
    place-items: center;
    transition: background 0.15s, transform 0.15s;
  }
  .tslides-actions button:hover { background: rgba(234,88,12,0.35); transform: translateY(-1px); }
  .tslides-counter {
    font-variant-numeric: tabular-nums;
    font-size: 0.85rem;
    color: rgba(255,255,255,0.65);
    min-width: 54px;
    text-align: center;
  }

  .tslides-stage {
    position: relative;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    padding: 8px 5vw;
  }
  .tslides-zone {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 12%;
    background: transparent;
    border: 0;
    cursor: pointer;
    z-index: 1;
  }
  .tslides-zone.left { left: 0; }
  .tslides-zone.right { right: 0; }

  .tslides-slide {
    width: 100%;
    max-width: 940px;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
    animation: tslides-in 0.5s cubic-bezier(0.2,0.8,0.25,1) both;
  }
  .tslides-inner {
    width: 100%;
    transform-origin: center center;
  }

  @keyframes tslides-in {
    from { opacity: 0; transform: translateY(22px) scale(0.99); }
    to   { opacity: 1; transform: none; }
  }

  /* ── Fragmentos (revelado progresivo) ── */
  .tslides-frag {
    opacity: 0;
    transform: translateY(14px);
    transition: opacity 0.32s ease, transform 0.32s ease;
  }
  .tslides-frag--shown { opacity: 1; transform: none; }

  /* ── Portada / cierre ── */
  .tsl-cover, .tsl-closing {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
  }
  .tsl-ball {
    font-size: clamp(48px, 9vw, 96px);
    animation: tsl-bounce 2.4s ease-in-out infinite;
    filter: drop-shadow(0 14px 24px rgba(234,88,12,0.35));
  }
  @keyframes tsl-bounce {
    0%, 100% { transform: translateY(0) rotate(-6deg); }
    50% { transform: translateY(-16px) rotate(6deg); }
  }
  .tsl-cover-eyebrow {
    text-transform: uppercase;
    letter-spacing: 0.16em;
    font-size: clamp(0.75rem, 1.6vw, 0.95rem);
    font-weight: 700;
    color: #fb923c;
  }
  .tsl-cover-title {
    font-family: 'Unbounded', 'Inter', sans-serif;
    font-weight: 800;
    font-size: clamp(2.2rem, 7vw, 4.6rem);
    line-height: 1.05;
    margin: 0;
    background: linear-gradient(120deg, #fff 30%, #fdba74);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .tsl-cover-sub {
    font-size: clamp(1rem, 2.2vw, 1.35rem);
    color: rgba(255,255,255,0.78);
    max-width: 30ch;
    line-height: 1.5;
    margin: 0;
  }
  .tsl-closing-title {
    font-family: 'Unbounded', 'Inter', sans-serif;
    font-weight: 800;
    font-size: clamp(2rem, 6vw, 3.6rem);
    margin: 0;
  }
  .tsl-closing-sub {
    font-size: clamp(1rem, 2vw, 1.25rem);
    color: rgba(255,255,255,0.78);
    max-width: 34ch;
    line-height: 1.55;
    margin: 0;
  }

  /* ── Slide de contenido ── */
  .tsl-heading {
    font-family: 'Unbounded', 'Inter', sans-serif;
    font-weight: 700;
    font-size: clamp(1.5rem, 4vw, 2.6rem);
    line-height: 1.15;
    margin: 0 0 18px;
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  .tsl-icon { font-size: 1.1em; }
  .tsl-cont {
    font-family: 'Inter', sans-serif;
    font-size: 0.6em;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(255,255,255,0.5);
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 999px;
    padding: 2px 10px;
  }
  .tsl-body {
    font-size: clamp(1.05rem, 2.1vw, 1.4rem);
    line-height: 1.65;
    color: rgba(255,255,255,0.92);
  }
  .tsl-body p { margin: 0 0 0.8em; }
  .tsl-body ul, .tsl-body ol { margin: 0 0 0.8em; padding-left: 1.4em; }
  .tsl-body li { margin: 0.3em 0; }
  .tsl-body strong { color: #fdba74; }
  .tsl-body h2, .tsl-body h3 {
    font-family: 'Unbounded', 'Inter', sans-serif;
    font-size: 1.1em;
    margin: 0 0 0.5em;
  }
  .tsl-body code {
    background: rgba(255,255,255,0.1);
    padding: 1px 6px;
    border-radius: 6px;
    font-size: 0.92em;
  }
  .tsl-body .katex { font-size: 1.12em; }
  .tsl-body .katex-display { margin: 0.7em 0; overflow-x: auto; overflow-y: hidden; }
  .tsl-muted { color: rgba(255,255,255,0.6); }

  /* Callouts legibles sobre fondo oscuro */
  .tslides .theory-callout { color: #fff; }
  .tslides .theory-callout-default {
    background: rgba(255,255,255,0.06);
    border-left-color: rgba(255,255,255,0.28);
  }

  /* ── Slide de vídeo ── */
  .tsl-video-frame {
    position: relative;
    padding-top: 56.25%;
    border-radius: 14px;
    overflow: hidden;
    background: #000;
    box-shadow: 0 18px 50px rgba(0,0,0,0.5);
  }
  .tsl-video-frame iframe {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border: 0;
  }
  .tsl-candidates {
    display: flex;
    gap: 10px;
    overflow-x: auto;
    padding: 12px 0 4px;
  }
  .tsl-candidate {
    flex: 0 0 150px;
    background: rgba(255,255,255,0.06);
    border: 1.5px solid rgba(255,255,255,0.14);
    border-radius: 10px;
    padding: 6px;
    color: #fff;
    cursor: pointer;
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .tsl-candidate.is-active { border-color: #f97316; background: rgba(234,88,12,0.18); }
  .tsl-candidate img { width: 100%; aspect-ratio: 16/9; object-fit: cover; border-radius: 6px; }
  .tsl-candidate span {
    font-size: 0.72rem;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .tsl-video-card {
    display: flex;
    gap: 16px;
    align-items: center;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.14);
    border-radius: 14px;
    padding: 20px;
  }
  .tsl-video-card-play {
    font-size: 2rem;
    color: #f97316;
    background: rgba(234,88,12,0.18);
    width: 64px;
    height: 64px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    flex: none;
  }

  /* ── Navegación inferior ── */
  .tslides-nav {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 10px 18px 4px;
  }
  .tslides-arrow {
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.16);
    color: #fff;
    width: 46px;
    height: 46px;
    border-radius: 50%;
    font-size: 1.6rem;
    line-height: 1;
    cursor: pointer;
    display: grid;
    place-items: center;
    transition: background 0.15s, transform 0.15s;
  }
  .tslides-arrow:hover:not(:disabled) { background: rgba(234,88,12,0.4); transform: scale(1.06); }
  .tslides-arrow:disabled { opacity: 0.3; cursor: default; }
  .tslides-dots {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
    justify-content: center;
    max-width: 60vw;
  }
  .tslides-dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    border: 0;
    padding: 0;
    background: rgba(255,255,255,0.25);
    cursor: pointer;
    transition: transform 0.15s, background 0.15s;
  }
  .tslides-dot:hover { background: rgba(255,255,255,0.5); }
  .tslides-dot.is-active { background: #f97316; transform: scale(1.4); }

  .tslides-hint {
    flex: none;
    text-align: center;
    font-size: 0.72rem;
    color: rgba(255,255,255,0.4);
    padding: 0 0 12px;
    margin: 0;
  }

  /* ── Vista índice (G) ── */
  .tslides-grid {
    position: absolute;
    inset: 0;
    background: rgba(8,14,26,0.82);
    backdrop-filter: blur(4px);
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    animation: tslides-in 0.25s ease both;
  }
  .tslides-grid-panel {
    background: #0d1b2a;
    border: 1px solid rgba(255,255,255,0.14);
    border-radius: 16px;
    padding: 22px;
    width: min(560px, 100%);
    max-height: 80vh;
    overflow-y: auto;
  }
  .tslides-grid-panel h3 {
    font-family: 'Unbounded', 'Inter', sans-serif;
    margin: 0 0 14px;
    font-size: 1.1rem;
  }
  .tslides-grid-panel ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .tslides-grid-panel button {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    background: rgba(255,255,255,0.04);
    border: 1px solid transparent;
    color: #fff;
    padding: 10px 12px;
    border-radius: 10px;
    cursor: pointer;
    text-align: left;
    font-size: 0.9rem;
  }
  .tslides-grid-panel button:hover { background: rgba(255,255,255,0.1); }
  .tslides-grid-panel button.is-active { border-color: #f97316; background: rgba(234,88,12,0.18); }
  .tslides-grid-panel .n {
    flex: none;
    width: 26px;
    height: 26px;
    border-radius: 7px;
    background: rgba(234,88,12,0.3);
    color: #fdba74;
    font-weight: 700;
    font-size: 0.78rem;
    display: grid;
    place-items: center;
  }
  .tslides-grid-panel .t { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  /* ── Móvil: scroll vertical, sin escalado ── */
  @media (max-width: 720px) {
    .tslides-stage { overflow-y: auto; align-items: flex-start; padding: 16px 18px 24px; }
    .tslides-inner { transform: none !important; }
    .tslides-zone { display: none; }
    .tslides-title { max-width: 48vw; }
    .tslides-dots { max-width: 56vw; }
    .tsl-body { font-size: 1.1rem; }
  }

  @media (prefers-reduced-motion: reduce) {
    .tslides-slide, .tsl-ball, .tslides-frag, .tslides-grid { animation: none; transition: none; }
    .tslides-frag { opacity: 1; transform: none; }
  }
`;
