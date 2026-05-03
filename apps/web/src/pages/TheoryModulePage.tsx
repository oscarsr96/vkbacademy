import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { theoryApi } from '../api/theory.api';
import type { TheoryLesson, TheoryLessonKind } from '@vkbacademy/shared';

const KIND_ICON: Record<TheoryLessonKind, string> = {
  INTRO: '🧭',
  CONTENT: '📚',
  EXAMPLE: '💡',
  VIDEO: '▶️',
};

export default function TheoryModulePage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['theory', id],
    queryFn: () => theoryApi.getById(id),
    enabled: !!id,
  });

  const remove = useMutation({
    mutationFn: () => theoryApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['theory', 'mine'] });
      navigate('/theory');
    },
  });

  if (isLoading) {
    return (
      <div style={s.page}>
        <p style={s.muted}>Cargando temario…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={s.page}>
        <p style={s.muted}>No se encontró el temario.</p>
        <Link to="/theory" style={s.backLink}>
          ← Volver a Teoría
        </Link>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <Link to="/theory" style={s.backLink}>
        ← Volver a Teoría
      </Link>

      <header style={s.header}>
        <span style={s.eyebrow}>Tema solicitado: {data.topic}</span>
        <h1 style={s.title}>{data.title}</h1>
        <p style={s.summary}>{data.summary}</p>
      </header>

      <article style={s.article}>
        {data.lessons.map((lesson) => (
          <LessonSection key={lesson.id} lesson={lesson} />
        ))}
      </article>

      <footer style={s.footer}>
        <button
          type="button"
          onClick={() => {
            if (window.confirm('¿Borrar este temario de tu biblioteca?')) remove.mutate();
          }}
          disabled={remove.isPending}
          style={s.deleteBtn}
        >
          {remove.isPending ? 'Borrando…' : '🗑️ Borrar temario'}
        </button>
      </footer>
    </div>
  );
}

function LessonSection({ lesson }: { lesson: TheoryLesson }) {
  return (
    <section style={s.section}>
      <h2 style={s.sectionTitle}>
        <span aria-hidden>{KIND_ICON[lesson.kind]}</span> {lesson.heading}
      </h2>

      {lesson.kind === 'VIDEO' ? (
        lesson.youtubeId ? (
          <div style={s.videoWrapper}>
            <iframe
              style={s.videoIframe}
              src={`https://www.youtube.com/embed/${lesson.youtubeId}`}
              title={lesson.heading}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <p style={s.muted}>No se encontró un vídeo adecuado para este tema.</p>
        )
      ) : (
        <div style={s.markdown}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{lesson.body ?? ''}</ReactMarkdown>
        </div>
      )}
    </section>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 820,
    margin: '0 auto',
    padding: '24px 16px 64px',
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  backLink: {
    color: '#f97316',
    fontSize: '0.875rem',
    textDecoration: 'none',
    fontWeight: 600,
  },
  header: { display: 'flex', flexDirection: 'column', gap: 8 },
  eyebrow: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  title: { fontSize: '2rem', fontWeight: 800, margin: 0, lineHeight: 1.15 },
  summary: {
    fontSize: '1.05rem',
    color: 'var(--color-text-muted)',
    lineHeight: 1.6,
    margin: 0,
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
  videoWrapper: {
    position: 'relative',
    paddingTop: '56.25%',
    borderRadius: 10,
    overflow: 'hidden',
    background: '#000',
  },
  videoIframe: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    border: 0,
  },
  muted: { color: 'var(--color-text-muted)', fontSize: '0.95rem', margin: 0 },
  footer: { display: 'flex', justifyContent: 'flex-end' },
  deleteBtn: {
    background: 'transparent',
    border: '1px solid rgba(220,38,38,0.4)',
    color: '#dc2626',
    padding: '10px 18px',
    borderRadius: 8,
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
};
