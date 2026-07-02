import { useState } from 'react';
import type {
  TheoryLesson,
  TheoryLessonKind,
  TheoryModuleWithLessons,
  TheoryVideoCandidate,
} from '@vkbacademy/shared';
import { TheoryMarkdown, THEORY_CALLOUT_CSS } from './theoryMarkdown';
import TheorySlides from './TheorySlides';
import { downloadTheoryPdf, shareTheoryPdf } from '../../utils/theoryPdf';

const KIND_ICON: Record<TheoryLessonKind, string> = {
  INTRO: '🧭',
  CONTENT: '📚',
  EXAMPLE: '💡',
  VIDEO: '▶️',
};

export default function TheoryView({ module }: { module: TheoryModuleWithLessons }) {
  const [showSlides, setShowSlides] = useState(false);
  const [pdfBusy, setPdfBusy] = useState<'download' | 'share' | null>(null);

  async function handleDownload() {
    if (pdfBusy) return;
    setPdfBusy('download');
    try {
      await downloadTheoryPdf(module);
    } catch {
      window.alert('No se pudo generar el PDF. Inténtalo de nuevo.');
    } finally {
      setPdfBusy(null);
    }
  }

  async function handleShare() {
    if (pdfBusy) return;
    setPdfBusy('share');
    try {
      await shareTheoryPdf(module);
    } catch {
      window.alert('No se pudo compartir el PDF. Inténtalo de nuevo.');
    } finally {
      setPdfBusy(null);
    }
  }

  return (
    <div style={s.wrap}>
      <style>
        {ANIMATIONS}
        {THEORY_CALLOUT_CSS}
      </style>

      <div style={s.actions}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setShowSlides(true)}
          style={s.presentBtn}
        >
          ▶ Presentación
        </button>
        <button
          type="button"
          onClick={handleDownload}
          disabled={pdfBusy !== null}
          style={s.secondaryBtn}
        >
          {pdfBusy === 'download' ? '⏳ Generando…' : '⬇️ Descargar PDF'}
        </button>
        <button
          type="button"
          onClick={handleShare}
          disabled={pdfBusy !== null}
          style={s.secondaryBtn}
        >
          {pdfBusy === 'share' ? '⏳ Generando…' : '📲 Enviar por WhatsApp'}
        </button>
      </div>

      {showSlides && <TheorySlides module={module} onClose={() => setShowSlides(false)} />}

      <article style={s.article}>
        {module.lessons.map((lesson, idx) => (
          <LessonSection key={lesson.id} lesson={lesson} index={idx} />
        ))}
      </article>
    </div>
  );
}

function LessonSection({ lesson, index }: { lesson: TheoryLesson; index: number }) {
  return (
    <section className="theory-section" style={{ ...s.section, animationDelay: `${index * 90}ms` }}>
      <h2 style={s.sectionTitle}>
        <span aria-hidden>{KIND_ICON[lesson.kind]}</span> {lesson.heading}
      </h2>
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
  wrap: { display: 'flex', flexDirection: 'column', gap: 24 },
  actions: { display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  presentBtn: { padding: '10px 18px', fontSize: '0.9rem', fontWeight: 700 },
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
  candidateActive: { borderColor: '#f97316', background: 'rgba(234,88,12,0.08)' },
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
