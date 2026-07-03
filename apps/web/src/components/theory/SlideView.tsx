// Render del contenido de UNA diapositiva. Compartido por el deck interactivo
// (TheorySlides) y la exportación a PDF (theoryPdf). El deck pasa `revealed`
// para el revelado progresivo de fragmentos; el PDF usa `forPdf` para mostrarlo
// todo de golpe y sin elementos interactivos (iframes).

import { useState } from 'react';
import type { TheoryVideoCandidate } from '@vkbacademy/shared';
import type { Slide } from '../../utils/theorySlides';
import { TheoryMarkdown } from './theoryMarkdown';

interface SlideViewProps {
  slide: Slide;
  /** Nº de fragmentos visibles (solo aplica a slides de contenido). */
  revealed: number;
  /** Render para PDF: todo visible, sin iframes ni botones. */
  forPdf?: boolean;
}

export function SlideView({ slide, revealed, forPdf = false }: SlideViewProps) {
  switch (slide.kind) {
    case 'cover':
      return <CoverSlide slide={slide} />;
    case 'closing':
      return <ClosingSlide />;
    case 'video':
      return <VideoSlide slide={slide} forPdf={forPdf} />;
    case 'example':
      return <ExampleSlide slide={slide} revealed={revealed} forPdf={forPdf} />;
    default:
      return <ContentSlide slide={slide} revealed={revealed} forPdf={forPdf} />;
  }
}

/** Fragmento revelable (mismo mecanismo que usa el override del PDF). */
function Frag({
  shown,
  delayIndex,
  forPdf,
  children,
}: {
  shown: boolean;
  delayIndex: number;
  forPdf: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`tslides-frag${shown ? ' tslides-frag--shown' : ''}`}
      style={{ transitionDelay: shown && !forPdf ? `${delayIndex * 40}ms` : undefined }}
    >
      {children}
    </div>
  );
}

function CoverSlide({ slide }: { slide: Slide }) {
  return (
    <div className="tsl-cover">
      <span className="tsl-ball" aria-hidden>
        🏀
      </span>
      <span className="tsl-cover-eyebrow">{slide.topic}</span>
      <h1 className="tsl-cover-title">{slide.coverTitle}</h1>
      {slide.coverSubtitle && <p className="tsl-cover-sub">{slide.coverSubtitle}</p>}
    </div>
  );
}

function ContentSlide({
  slide,
  revealed,
  forPdf,
}: {
  slide: Slide;
  revealed: number;
  forPdf: boolean;
}) {
  const blocks = slide.blocks ?? [];
  return (
    <div className={`tsl-content${slide.variant ? ` tsl-content--${slide.variant}` : ''}`}>
      <h2 className="tsl-heading">
        <span className="tsl-icon" aria-hidden>
          {slide.icon}
        </span>
        {slide.heading}
        {slide.continued && <span className="tsl-cont">cont.</span>}
      </h2>
      <div className="tsl-body">
        {blocks.map((block, i) => (
          <Frag key={i} shown={forPdf || i < revealed} delayIndex={i} forPdf={forPdf}>
            <TheoryMarkdown>{block}</TheoryMarkdown>
          </Frag>
        ))}
      </div>
    </div>
  );
}

/**
 * Ejemplo resuelto paso a paso: enunciado, pasos como tarjetas con número
 * grande, resultado destacado y conexión con la teoría. Cada pieza es un
 * fragmento revelable.
 */
function ExampleSlide({
  slide,
  revealed,
  forPdf,
}: {
  slide: Slide;
  revealed: number;
  forPdf: boolean;
}) {
  const steps = slide.steps ?? [];
  const resultIndex = 1 + steps.length;
  const whyIndex = resultIndex + 1;
  const shown = (i: number) => forPdf || i < revealed;

  return (
    <div className="tsl-content tsl-example">
      <h2 className="tsl-heading">{slide.heading}</h2>
      <div className="tsl-body">
        <Frag shown={shown(0)} delayIndex={0} forPdf={forPdf}>
          <div className="tsl-ex-statement">
            <span className="tsl-ex-label">Enunciado</span>
            <TheoryMarkdown>{slide.statement ?? ''}</TheoryMarkdown>
          </div>
        </Frag>
        <ol className="tsl-ex-steps">
          {steps.map((step, i) => (
            <li key={i}>
              <Frag shown={shown(i + 1)} delayIndex={i + 1} forPdf={forPdf}>
                <div className="tsl-ex-step">
                  <span className="tsl-ex-num" aria-hidden>
                    {i + 1}
                  </span>
                  <div className="tsl-ex-step-body">
                    <TheoryMarkdown>{step}</TheoryMarkdown>
                  </div>
                </div>
              </Frag>
            </li>
          ))}
        </ol>
        <Frag shown={shown(resultIndex)} delayIndex={resultIndex} forPdf={forPdf}>
          <div className="tsl-ex-result">
            <span className="tsl-ex-label">Resultado</span>
            <TheoryMarkdown>{slide.result ?? ''}</TheoryMarkdown>
          </div>
        </Frag>
        {slide.why && (
          <Frag shown={shown(whyIndex)} delayIndex={whyIndex} forPdf={forPdf}>
            <div className="tsl-ex-why">
              <span className="tsl-ex-label">Por qué funciona</span>
              <TheoryMarkdown>{slide.why}</TheoryMarkdown>
            </div>
          </Frag>
        )}
      </div>
    </div>
  );
}

function VideoSlide({ slide, forPdf }: { slide: Slide; forPdf: boolean }) {
  const candidates = slide.candidates ?? [];
  const [selected, setSelected] = useState(0);

  if (candidates.length === 0) {
    return (
      <div className="tsl-content">
        <h2 className="tsl-heading">
          <span className="tsl-icon" aria-hidden>
            ▶️
          </span>
          {slide.heading}
        </h2>
        <p className="tsl-muted">No se encontró un vídeo adecuado para este tema.</p>
      </div>
    );
  }

  const current = candidates[Math.min(selected, candidates.length - 1)];

  return (
    <div className="tsl-video">
      <h2 className="tsl-heading">
        <span className="tsl-icon" aria-hidden>
          ▶️
        </span>
        {slide.heading}
      </h2>

      {forPdf ? (
        <div className="tsl-video-card">
          <span className="tsl-video-card-play" aria-hidden>
            ▶
          </span>
          <div>
            <strong>{current.title}</strong>
            {current.channelTitle && <span className="tsl-muted"> · {current.channelTitle}</span>}
            <p className="tsl-muted">Disponible en la app VKB Academy.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="tsl-video-frame">
            <iframe
              key={current.youtubeId}
              src={`https://www.youtube.com/embed/${current.youtubeId}`}
              title={current.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          {candidates.length > 1 && (
            <div className="tsl-candidates">
              {candidates.map((c: TheoryVideoCandidate, idx) => (
                <button
                  type="button"
                  key={c.youtubeId}
                  onClick={() => setSelected(idx)}
                  className={`tsl-candidate${idx === selected ? ' is-active' : ''}`}
                  aria-pressed={idx === selected}
                >
                  <img src={c.thumbnailUrl} alt="" loading="lazy" />
                  <span>{c.title}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ClosingSlide() {
  return (
    <div className="tsl-closing">
      <span className="tsl-ball" aria-hidden>
        🏀
      </span>
      <h2 className="tsl-closing-title">¡Bien jugado!</h2>
      <p className="tsl-closing-sub">
        Apuntes completados. Ahora te toca: practica con los ejercicios y remata con el examen.
        Descarga el PDF si quieres repasar sobre papel.
      </p>
    </div>
  );
}
