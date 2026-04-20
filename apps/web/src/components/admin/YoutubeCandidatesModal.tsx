import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi, type YoutubeCandidate } from '../../api/admin.api';

interface Props {
  lessonId: string;
  lessonTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (youtubeId: string) => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function YoutubeCandidatesModal({
  lessonId,
  lessonTitle,
  isOpen,
  onClose,
  onSelect,
}: Props) {
  const [excludeIds, setExcludeIds] = useState<string[]>([]);

  const { data, isLoading, isError, refetch } = useQuery<YoutubeCandidate[]>({
    queryKey: ['youtube-candidates', lessonId, excludeIds.join(',')],
    queryFn: () => adminApi.getLessonYoutubeCandidates(lessonId, excludeIds),
    enabled: isOpen,
  });

  if (!isOpen) return null;

  function handleSearchOthers() {
    if (data && data.length > 0) {
      setExcludeIds((prev) => [...prev, ...data.map((c) => c.youtubeId)]);
    }
    void refetch();
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--color-surface)',
          borderRadius: 12,
          padding: 24,
          maxWidth: 720,
          width: '92%',
          maxHeight: '85vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>🔍 Vídeos para "{lessonTitle}"</h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}
          >
            ✕
          </button>
        </header>

        {isLoading && <p>Buscando candidatos…</p>}
        {isError && (
          <p style={{ color: 'var(--color-error)' }}>
            Error al buscar. Revisa la configuración de YOUTUBE_API_KEY o la cuota.
          </p>
        )}

        {data && data.length === 0 && (
          <p>
            Sin resultados que cumplan los criterios. Puedes pegar un ID manualmente en el campo de
            la lección.
          </p>
        )}

        {data && data.length > 0 && (
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {data.map((c) => (
              <li
                key={c.youtubeId}
                style={{
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  padding: 12,
                  display: 'flex',
                  gap: 12,
                }}
              >
                <img
                  src={c.thumbnailUrl}
                  alt=""
                  width={160}
                  height={90}
                  style={{ borderRadius: 6 }}
                />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <strong>{c.title}</strong>
                  <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                    {c.channelTitle} {c.isWhitelisted && '⭐'}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    {formatDuration(c.durationSeconds)} · {formatViews(c.viewCount)} views ·{' '}
                    {(c.engagementRatio * 100).toFixed(1)}% 👍
                  </span>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => onSelect(c.youtubeId)}
                  style={{ alignSelf: 'center' }}
                >
                  ✓ Usar este
                </button>
              </li>
            ))}
          </ul>
        )}

        <footer style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={handleSearchOthers} disabled={isLoading}>
            🔄 Buscar otros
          </button>
          <button onClick={onClose}>Cerrar</button>
        </footer>
      </div>
    </div>
  );
}
