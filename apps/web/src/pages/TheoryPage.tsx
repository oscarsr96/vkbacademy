import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCourses } from '../hooks/useCourses';
import { theoryApi } from '../api/theory.api';
import type { TheoryModuleSummary } from '@vkbacademy/shared';

export default function TheoryPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: coursesData } = useCourses(1);
  const courses = coursesData?.data ?? [];

  const [courseId, setCourseId] = useState('');
  const [topic, setTopic] = useState('');

  const { data: library, isLoading: libraryLoading } = useQuery({
    queryKey: ['theory', 'mine'],
    queryFn: () => theoryApi.listMine(),
  });

  const generate = useMutation({
    mutationFn: theoryApi.generate,
    onSuccess: (mod) => {
      queryClient.invalidateQueries({ queryKey: ['theory', 'mine'] });
      navigate(`/theory/${mod.id}`);
    },
  });

  const remove = useMutation({
    mutationFn: theoryApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['theory', 'mine'] }),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!courseId || !topic.trim()) return;
    generate.mutate({ courseId, topic: topic.trim() });
  }

  const apiError = (
    generate.error as { response?: { data?: { message?: string | string[] } } } | null
  )?.response?.data?.message;
  const apiErrorText = Array.isArray(apiError) ? apiError.join(' · ') : apiError;

  // Agrupar la biblioteca por curso
  const grouped = (library ?? []).reduce<Record<string, TheoryModuleSummary[]>>((acc, mod) => {
    (acc[mod.courseId] = acc[mod.courseId] ?? []).push(mod);
    return acc;
  }, {});

  const courseTitleById = new Map(courses.map((c) => [c.id, c.title] as const));

  return (
    <div style={s.page}>
      <header style={s.header}>
        <h1 style={s.title}>📖 Teoría</h1>
        <p style={s.subtitle}>
          Pide un temario sobre cualquier tema de tus cursos. La IA generará un módulo con
          explicaciones y un vídeo de YouTube, y se guardará en tu biblioteca.
        </p>
      </header>

      <form onSubmit={handleSubmit} style={s.form}>
        <div className="field">
          <label htmlFor="courseId">Curso</label>
          <select
            id="courseId"
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            required
          >
            <option value="">Selecciona un curso</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="topic">¿Sobre qué tema quieres el temario?</label>
          <textarea
            id="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Ej: propiedades de logaritmos, el Renacimiento, análisis sintáctico..."
            rows={3}
            style={s.textarea}
            required
          />
        </div>

        {apiErrorText && (
          <div style={s.errorBox}>
            <strong>!</strong> {apiErrorText}
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={generate.isPending || !courseId || !topic.trim()}
          style={{ alignSelf: 'flex-start', padding: '12px 24px' }}
        >
          {generate.isPending ? '⏳ Generando temario...' : '✨ Generar temario'}
        </button>
      </form>

      <section style={s.results}>
        <h2 style={s.resultsTitle}>Mi biblioteca</h2>

        {libraryLoading && <p style={s.empty}>Cargando…</p>}

        {!libraryLoading && (library?.length ?? 0) === 0 && (
          <p style={s.empty}>
            Aún no has generado ningún temario. Pide el primero arriba para guardarlo aquí.
          </p>
        )}

        {Object.entries(grouped).map(([cid, mods]) => (
          <div key={cid} style={s.group}>
            <h3 style={s.groupTitle}>{courseTitleById.get(cid) ?? 'Curso'}</h3>
            <ul style={s.list}>
              {mods.map((mod) => (
                <li key={mod.id} style={s.item}>
                  <Link to={`/theory/${mod.id}`} style={s.itemLink}>
                    <strong>{mod.title}</strong>
                    <span style={s.itemMeta}>{mod.summary}</span>
                    <span style={s.itemDate}>
                      {new Date(mod.createdAt).toLocaleDateString('es-ES', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`¿Borrar "${mod.title}" de tu biblioteca?`)) {
                        remove.mutate(mod.id);
                      }
                    }}
                    style={s.deleteBtn}
                    aria-label="Borrar temario"
                  >
                    🗑️
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 900,
    margin: '0 auto',
    padding: '32px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 32,
  },
  header: { display: 'flex', flexDirection: 'column', gap: 8 },
  title: { fontSize: '1.8rem', fontWeight: 800, margin: 0 },
  subtitle: {
    color: 'var(--color-text-muted)',
    fontSize: '0.95rem',
    lineHeight: 1.5,
    margin: 0,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 14,
    padding: 24,
  },
  textarea: {
    width: '100%',
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    color: 'var(--color-text)',
    padding: '10px 12px',
    fontSize: '0.95rem',
    fontFamily: 'inherit',
    resize: 'vertical',
  },
  errorBox: {
    background: 'rgba(220,38,38,0.15)',
    borderLeft: '4px solid #dc2626',
    color: 'var(--color-error)',
    padding: '12px 14px',
    borderRadius: 8,
    fontSize: '0.875rem',
  },
  results: { display: 'flex', flexDirection: 'column', gap: 18 },
  resultsTitle: { fontSize: '1.2rem', fontWeight: 700, margin: 0 },
  empty: { color: 'var(--color-text-muted)', fontSize: '0.9rem', margin: 0 },
  group: { display: 'flex', flexDirection: 'column', gap: 8 },
  groupTitle: {
    fontSize: '0.85rem',
    fontWeight: 700,
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    margin: 0,
  },
  list: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  item: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 12,
    display: 'flex',
    alignItems: 'stretch',
    gap: 8,
  },
  itemLink: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '14px 16px',
    color: 'var(--color-text)',
    textDecoration: 'none',
  },
  itemMeta: { fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: 1.4 },
  itemDate: { fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 },
  deleteBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--color-text-muted)',
    padding: '0 14px',
    cursor: 'pointer',
    fontSize: '1.1rem',
  },
};
