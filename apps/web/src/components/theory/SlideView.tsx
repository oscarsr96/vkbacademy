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
    default:
      return <ContentSlide slide={slide} revealed={revealed} forPdf={forPdf} />;
  }
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
    <div className="tsl-content">
      <h2 className="tsl-heading">
        <span className="tsl-icon" aria-hidden>
          {slide.icon}
        </span>
        {slide.heading}
        {slide.continued && <span className="tsl-cont">cont.</span>}
      </h2>
      <div className="tsl-body">
        {blocks.map((block, i) => {
          const shown = forPdf || i < revealed;
          return (
            <div
              key={i}
              className={`tslides-frag${shown ? ' tslides-frag--shown' : ''}`}
              style={{ transitionDelay: shown && !forPdf ? `${i * 40}ms` : undefined }}
            >
              <TheoryMarkdown>{block}</TheoryMarkdown>
            </div>
          );
        })}
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
        Has terminado el temario. Descárgalo en PDF o envíatelo a WhatsApp para repasarlo cuando
        quieras.
      </p>
    </div>
  );
}
