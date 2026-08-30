import type { ChallengeWithProgress } from '../api/challenges.api';

/**
 * Estantería de insignias del perfil.
 *
 * Las conseguidas van a todo color y con su fecha; las que faltan, en silueta
 * —mismo tamaño, sin candados ni "no conseguida"—. Es deliberado: si lo que
 * falta pesa más que lo que hay, la estantería se lee como una lista de
 * fracasos en vez de como una colección.
 *
 * Solo entran los retos PERMANENTES. Una misión semanal se gana otra vez cada
 * lunes, así que su insignia se encendería y apagaría cada semana: eso no es
 * una colección, es un contador.
 */

export interface BadgeShelfProps {
  challenges: ChallengeWithProgress[];
}

/** Retos coleccionables: los permanentes, ganados o no. */
export function collectibleBadges(challenges: ChallengeWithProgress[]): ChallengeWithProgress[] {
  return challenges
    .filter((c) => c.cadence !== 'WEEKLY')
    .sort((a, b) => {
      // Las conseguidas primero, y entre ellas la más reciente arriba
      if (a.completed !== b.completed) return a.completed ? -1 : 1;
      if (a.completed && b.completed) {
        return new Date(b.completedAt ?? 0).getTime() - new Date(a.completedAt ?? 0).getTime();
      }
      // Entre las que faltan, la más cercana a caer primero
      return b.progress / b.target - a.progress / a.target;
    });
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

export default function BadgeShelf({ challenges }: BadgeShelfProps) {
  const badges = collectibleBadges(challenges);
  if (badges.length === 0) return null;

  const conseguidas = badges.filter((b) => b.completed).length;

  return (
    <section className="panel-glass animate-in" style={S.shelf}>
      <header style={S.header}>
        <h2 style={S.title}>Insignias</h2>
        <span style={S.count}>
          {conseguidas} de {badges.length}
        </span>
      </header>

      {conseguidas === 0 && (
        <p style={S.empty}>
          Aún no tienes ninguna. Completa un reto y aparecerá aquí, con su fecha.
        </p>
      )}

      <ul style={S.grid}>
        {badges.map((b) => (
          <li key={b.id} style={S.item} title={b.completed ? b.title : `${b.title} — ${b.description}`}>
            <span
              aria-hidden="true"
              style={{
                ...S.badge,
                background: b.completed ? `${b.badgeColor}22` : 'var(--color-border)',
                border: `1.5px solid ${b.completed ? `${b.badgeColor}66` : 'transparent'}`,
                filter: b.completed ? 'none' : 'grayscale(1)',
                opacity: b.completed ? 1 : 0.35,
              }}
            >
              {b.badgeIcon}
            </span>
            <span style={{ ...S.name, opacity: b.completed ? 1 : 0.5 }}>{b.title}</span>
            {b.completed && <span style={S.date}>{formatDate(b.completedAt)}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

const S: Record<string, React.CSSProperties> = {
  shelf: { padding: '20px 22px', marginBottom: 24 },
  header: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  title: { margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text)' },
  count: { fontSize: '0.8rem', color: 'var(--color-text-muted)' },
  empty: { margin: '10px 0 0', fontSize: '0.85rem', color: 'var(--color-text-muted)' },
  grid: {
    listStyle: 'none',
    margin: '16px 0 0',
    padding: 0,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))',
    gap: 16,
  },
  item: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center' },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 52,
    height: 52,
    borderRadius: '50%',
    fontSize: '1.5rem',
  },
  name: { fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.3 },
  date: { fontSize: '0.66rem', color: 'var(--color-text-muted)' },
};
