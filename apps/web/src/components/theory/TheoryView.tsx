import { useMemo, useState } from 'react';
import type {
  TheoryLesson,
  TheoryModuleWithLessons,
  TheoryVideoCandidate,
} from '@vkbacademy/shared';
import { TheoryMarkdown, THEORY_CALLOUT_CSS } from './theoryMarkdown';
import TheorySlides from './TheorySlides';
import { buildSlides, stripLeadingEmoji } from '../../utils/theorySlides';
import { downloadTheoryPdf, shareTheoryPdf } from '../../utils/theoryPdf';

interface TheoryViewProps {
  module: TheoryModuleWithLessons;
  /** Título del curso: cabecera y nombre de fichero del PDF. */
  courseTitle: string;
}

export default function TheoryView({ module, courseTitle }: TheoryViewProps) {
  const [showSlides, setShowSlides] = useState(false);
  // La presentación es la fuente; los apuntes en texto quedan colapsados por defecto.
  const [showArticle, setShowArticle] = useState(false);
  const [pdfBusy, setPdfBusy] = useState<'download' | 'share' | null>(null);
  const [pdfProgress, setPdfProgress] = useState<{ page: number; total: number } | null>(null);
  const slideCount = useMemo(() => buildSlides(module).length, [module]);

  const pdfBusyLabel = pdfProgress
    ? `⏳ Generando… ${pdfProgress.page}/${pdfProgress.total}`
    : '⏳ Generando…';

  async function handleDownload() {
    if (pdfBusy) return;
    setPdfBusy('download');
    try {
      await downloadTheoryPdf(module, courseTitle, (page, total) =>
        setPdfProgress({ page, total }),
      );
    } catch {
      window.alert('No se pudo generar el PDF. Inténtalo de nuevo.');
    } finally {
      setPdfBusy(null);
      setPdfProgress(null);
    }
  }

  async function handleShare() {
    if (pdfBusy) return;
    setPdfBusy('share');
    try {
      await shareTheoryPdf(module, courseTitle, (page, total) => setPdfProgress({ page, total }));
    } catch {
      window.alert('No se pudo compartir el PDF. Inténtalo de nuevo.');
    } finally {
      setPdfBusy(null);
      setPdfProgress(null);
    }
  }

  return (
    <div style={s.wrap}>
      <style>
        {ANIMATIONS}
        {THEORY_CALLOUT_CSS}
        {HERO_CSS}
      </style>

      <section className="theory-hero">
        <span className="theory-hero-play" aria-hidden>
          ▶
        </span>
        <div className="theory-hero-copy">
          <h2 className="theory-hero-title">Presentación del temario</h2>
          <p className="theory-hero-sub">
            Empieza aquí: recorre los apuntes diapositiva a diapositiva, con ejemplos resueltos
            paso a paso.
          </p>
          <span className="theory-hero-meta">{slideCount} diapositivas</span>
        </div>
        <button
          type="button"
          className="btn btn-primary theory-hero-cta"
          onClick={() => setShowSlides(true)}
        >
          ▶ Empezar
        </button>
      </section>

      <div style={s.actions}>
        <button
          type="button"
          onClick={handleDownload}
          disabled={pdfBusy !== null}
          style={s.secondaryBtn}
        >
          {pdfBusy === 'download' ? pdfBusyLabel : '⬇️ Descargar PDF'}
        </button>
        <button
          type="button"
          onClick={handleShare}
          disabled={pdfBusy !== null}
          style={s.secondaryBtn}
        >
          {pdfBusy === 'share' ? pdfBusyLabel : '📲 Enviar por WhatsApp'}
        </button>
        <button
          type="button"
          onClick={() => setShowArticle((v) => !v)}
          style={s.secondaryBtn}
          aria-expanded={showArticle}
        >
          {showArticle ? '▴ Ocultar apuntes en texto' : '▾ Ver apuntes en texto'}
        </button>
      </div>

      {showSlides && <TheorySlides module={module} onClose={() => setShowSlides(false)} />}

      {showArticle && (
        <article style={s.article}>
          {module.lessons.map((lesson, idx) => (
            <LessonSection key={lesson.id} lesson={lesson} index={idx} />
          ))}
        </article>
      )}
    </div>
  );
}

function LessonSection({ lesson, index }: { lesson: TheoryLesson; index: number }) {
  return (
    <section className="theory-section" style={{ ...s.section, animationDelay: `${index * 90}ms` }}>
      <h2 style={s.sectionTitle}>{stripLeadingEmoji(lesson.heading)}</h2>
      {lesson.kind === 'VIDEO' ? (
        <VideoLesson lesson={lesson} />
      ) : (
        <div style={s.markdown}>
          <TheoryMarkdown>{lesson.body ?? ''}</TheoryMarkdown>
        </div>
      )}
    </section>
  );
}

const ANIMATIONS = `
  @keyframes theory-fade-in-up {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .theory-section {
    animation: theory-fade-in-up 0.55s cubic-bezier(0.2, 0.8, 0.25, 1) backwards;
  }
  @media (prefers-reduced-motion: reduce) {
    .theory-section { animation: none; }
  }
`;

// CTA protagonista de la presentación (zona dark del design system estadio).
const HERO_CSS = `
  .theory-hero {
    display: flex;
    align-items: center;
    gap: 20px;
    flex-wrap: wrap;
    padding: 24px 26px;
    border-radius: 16px;
    color: #fff;
    background:
      radial-gradient(120% 90% at 50% -20%, var(--brand-soft), transparent 60%),
      radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1.4px) 0 0 / 14px 14px,
      linear-gradient(180deg, var(--navy-950, #080e1a) 0%, var(--navy-800, #0d1b2a) 100%);
    border: 1px solid rgba(255,255,255,0.08);
  }
  .theory-hero-play {
    flex: none;
    width: 64px;
    height: 64px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-size: 1.6rem;
    color: #fff;
    background: var(--gradient-signature, var(--brand));
    box-shadow: 0 0 24px var(--brand-glow);
  }
  .theory-hero-copy { flex: 1; min-width: 220px; display: flex; flex-direction: column; gap: 6px; }
  .theory-hero-title { margin: 0; font-size: 1.15rem; font-weight: 800; }
  .theory-hero-sub { margin: 0; font-size: 0.9rem; color: rgba(255,255,255,0.75); line-height: 1.5; }
  .theory-hero-meta {
    font-family: var(--font-display, inherit);
    font-size: 0.95rem;
    letter-spacing: 0.08em;
    color: var(--amber-led, #ffd24d);
  }
  .theory-hero-cta { padding: 14px 28px; font-size: 1rem; font-weight: 800; flex: none; }
`;

function VideoLesson({ lesson }: { lesson: TheoryLesson }) {
  const candidates: TheoryVideoCandidate[] =
    lesson.videoCandidates && lesson.videoCandidates.length > 0
      ? lesson.videoCandidates
      : lesson.youtubeId
        ? [
            {
              youtubeId: lesson.youtubeId,
              title: lesson.heading,
              channelTitle: '',
              durationSeconds: 0,
              thumbnailUrl: `https://img.youtube.com/vi/${lesson.youtubeId}/mqdefault.jpg`,
            },
          ]
        : [];

  const [selected, setSelected] = useState(0);

  if (candidates.length === 0) {
    return <p style={s.muted}>No se encontró un vídeo adecuado para este tema.</p>;
  }

  const current = candidates[Math.min(selected, candidates.length - 1)];

  return (
    <div style={s.videoBlock}>
      <div style={s.videoWrapper}>
        <iframe
          key={current.youtubeId}
          style={s.videoIframe}
          src={`https://www.youtube.com/embed/${current.youtubeId}`}
          title={current.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      {candidates.length > 1 && (
        <>
          <p style={s.candidatesLabel}>{candidates.length} vídeos sugeridos — pulsa para cambiar</p>
          <ul style={s.candidatesList}>
            {candidates.map((c, idx) => {
              const isActive = idx === selected;
              return (
                <li key={c.youtubeId}>
                  <button
                    type="button"
                    onClick={() => setSelected(idx)}
                    style={{ ...s.candidate, ...(isActive ? s.candidateActive : {}) }}
                    aria-pressed={isActive}
                  >
                    <img src={c.thumbnailUrl} alt="" style={s.candidateThumb} loading="lazy" />
                    <span style={s.candidateMeta}>
                      <span style={s.candidateTitle}>{c.title}</span>
                      <span style={s.candidateChannel}>
                        {c.channelTitle}
                        {c.durationSeconds > 0 && ` · ${formatDuration(c.durationSeconds)}`}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

const s: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 20 },
  actions: { display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  secondaryBtn: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text)',
    padding: '10px 16px',
    borderRadius: 8,
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  article: { display: 'flex', flexDirection: 'column', gap: 32 },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 14,
    padding: 24,
  },
  sectionTitle: { fontSize: '1.25rem', fontWeight: 700, margin: 0 },
  markdown: { fontSize: '1rem', lineHeight: 1.7, color: 'var(--color-text)' },
  muted: { color: 'var(--color-text-muted)', fontSize: '0.95rem', margin: 0 },
  videoBlock: { display: 'flex', flexDirection: 'column', gap: 12 },
  videoWrapper: {
    position: 'relative',
    paddingTop: '56.25%',
    borderRadius: 10,
    overflow: 'hidden',
    background: '#000',
  },
  videoIframe: { position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 },
  candidatesLabel: { fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: '4px 0 0' },
  candidatesList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 10,
  },
  candidate: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: 8,
    background: 'var(--color-bg)',
    border: '1.5px solid var(--color-border)',
    borderRadius: 10,
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
    color: 'var(--color-text)',
    transition: 'border-color 0.15s, transform 0.15s',
  },
  candidateActive: { borderColor: 'var(--brand-deep)', background: 'var(--brand-soft)' },
  candidateThumb: {
    width: '100%',
    aspectRatio: '16 / 9',
    objectFit: 'cover',
    borderRadius: 6,
    background: '#000',
  },
  candidateMeta: { display: 'flex', flexDirection: 'column', gap: 2 },
  candidateTitle: {
    fontSize: '0.85rem',
    fontWeight: 600,
    lineHeight: 1.3,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  candidateChannel: { fontSize: '0.7rem', color: 'var(--color-text-muted)' },
};
