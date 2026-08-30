import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLeaderboard, useMyChallenges } from '../hooks/useChallenges';
import type { ChallengeWithProgress, LeaderboardEntry } from '../api/challenges.api';
import { usePageZone } from '../hooks/usePageZone';
import Icon from '../components/ui/Icon';
import ScoreValue from '../components/ui/ScoreValue';
import ProgressBar from '../components/ui/ProgressBar';
import EmptyState from '../components/ui/EmptyState';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'in-progress' | 'completed';

/**
 * Reto más cercano a completarse de los que quedan.
 *
 * Criterio: mayor fracción de progreso y, a igualdad, el de objetivo más
 * pequeño. El desempate es lo que hace útil el primer día: con todo a cero,
 * el "más cercano" pasa a ser el de menos pasos ("Primer plan", 0/1) en vez
 * de uno de 0/100 elegido por fecha de creación.
 *
 * La lista de abajo NO se reordena: cambiar el orden entre visitas desorienta.
 * Esto solo saca uno arriba.
 */
export function pickClosest(
  challenges: ChallengeWithProgress[],
): ChallengeWithProgress | undefined {
  const pendientes = challenges.filter((c) => !c.completed && c.target > 0);
  if (pendientes.length === 0) return undefined;

  return [...pendientes].sort((a, b) => {
    const ratioA = Math.min(a.progress / a.target, 1);
    const ratioB = Math.min(b.progress / b.target, 1);
    if (ratioA !== ratioB) return ratioB - ratioA;
    return a.target - b.target;
  })[0];
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function ChallengeCard({ c, index }: { c: ChallengeWithProgress; index: number }) {
  const cardStyle: React.CSSProperties = {
    border: c.completed ? '1.5px solid rgba(255, 210, 77, 0.35)' : '1px solid var(--panel-border)',
    padding: '20px 24px',
    display: 'flex',
    gap: 20,
    alignItems: 'flex-start',
    boxShadow: c.completed ? '0 4px 20px rgba(255, 210, 77, 0.08)' : undefined,
    animation: `riseIn 0.5s cubic-bezier(0.18, 0.72, 0.24, 1.12) ${index * 50}ms both`,
  };

  return (
    <div className="panel-glass" style={cardStyle}>
      {/* Icono grande del reto */}
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          background: c.completed ? c.badgeColor : 'var(--brand-soft)',
          border: c.completed ? 'none' : '1.5px solid var(--brand-soft)',
          boxShadow: c.completed ? `0 4px 16px ${c.badgeColor}44` : 'none',
        }}
      >
        <span style={{ fontSize: '2rem', lineHeight: 1 }}>{c.badgeIcon}</span>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Cabecera */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 6,
            flexWrap: 'wrap' as const,
          }}
        >
          <span style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '1rem' }}>
            {c.title}
          </span>
          {c.completed && (
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: 20,
                background: 'rgba(255, 210, 77, 0.14)',
                color: 'var(--amber-led)',
                border: '1px solid rgba(255, 210, 77, 0.35)',
                letterSpacing: '0.03em',
                textTransform: 'uppercase' as const,
              }}
            >
              Completado
            </span>
          )}
        </div>

        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: '0 0 14px' }}>
          {c.description}
        </p>

        {/* Barra de progreso */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <ProgressBar
              value={c.progress}
              max={c.target}
              variant={c.completed ? 'amber' : 'brand'}
              label={`Progreso del reto ${c.title}`}
            />
          </div>
          <span
            style={{
              fontSize: '0.8rem',
              color: 'var(--color-text-muted)',
              whiteSpace: 'nowrap' as const,
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {c.progress}/{c.target}
          </span>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '0.875rem',
              fontWeight: 700,
              color: 'var(--brand-light)',
            }}
          >
            <Icon name="star" size={14} />
            {c.points} pts
          </span>
          {c.completedAt && (
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              {new Date(c.completedAt).toLocaleDateString('es-ES')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Destacado del reto más cercano.
 *
 * El titular cambia con el progreso: "lo tienes casi" seria mentira el primer
 * dia, cuando todo esta a cero, y una promesa falsa es peor que ninguna.
 */
function ClosestChallenge({ c }: { c: ChallengeWithProgress }) {
  const empezado = c.progress > 0;
  const faltan = Math.max(c.target - c.progress, 0);

  return (
    <section className="panel-glass animate-in" style={S_CLOSEST.card}>
      <span style={{ ...S_CLOSEST.badge, background: `${c.badgeColor}22`, color: c.badgeColor }}>
        {c.badgeIcon}
      </span>

      <div style={{ flex: 1, minWidth: 200 }}>
        <p style={S_CLOSEST.kicker}>{empezado ? 'Lo tienes casi' : 'Empieza por aquí'}</p>
        <p style={S_CLOSEST.title}>{c.title}</p>
        <p style={S_CLOSEST.detail}>
          {empezado
            ? `Te faltan ${faltan} para completarlo y sumar ${c.points} pts.`
            : `${c.description} Son ${c.points} pts.`}
        </p>
        <div style={{ marginTop: 10 }}>
          <ProgressBar value={c.progress} max={c.target} />
        </div>
      </div>
    </section>
  );
}

/**
 * Franja local de la clasificación semanal.
 *
 * Se ven el alumno y sus vecinos inmediatos, sin puestos ni número de
 * participantes: el que va último no puede saber que va último, solo ve a los
 * dos que tiene justo encima. Si no hay con quién compararse (alumno solo en
 * su academia, o sin academia) el bloque no se pinta.
 */
function WeeklyBand({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length < 2) return null;

  return (
    <section style={{ marginBottom: 32 }}>
      <div style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>
          Tu grupo esta semana
        </h3>
        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
          se reinicia cada lunes
        </span>
      </div>

      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          border: '1px solid var(--panel-border)',
          borderRadius: 14,
          overflow: 'hidden',
        }}
      >
        {entries.map((entry) => (
          <li
            key={entry.userId}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 16px',
              background: entry.isMe ? 'rgba(255, 210, 77, 0.10)' : 'transparent',
              borderLeft: `3px solid ${entry.isMe ? 'var(--brand, #ffd24d)' : 'transparent'}`,
            }}
          >
            <span
              style={{
                flex: 1,
                fontWeight: entry.isMe ? 800 : 600,
                color: 'var(--color-text)',
                fontSize: '0.9rem',
              }}
            >
              {entry.isMe ? 'Tú' : entry.name}
            </span>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
              {entry.points} pts
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const S_CLOSEST: Record<string, React.CSSProperties> = {
  card: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 16,
    flexWrap: 'wrap' as const,
    padding: '18px 22px',
    marginBottom: 24,
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
    borderRadius: 14,
    fontSize: '1.4rem',
    flexShrink: 0,
  },
  kicker: {
    margin: 0,
    fontSize: '0.7rem',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: 'var(--color-text-muted)',
  },
  title: { margin: '4px 0 0', fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text)' },
  detail: { margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--color-text-muted)' },
};

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ChallengesPage() {
  const [filter, setFilter] = useState<FilterTab>('all');
  const { data, isLoading, isError } = useMyChallenges();
  const { data: leaderboard } = useLeaderboard();
  usePageZone('dark');

  const totalPoints = data?.meta.totalPoints ?? 0;
  const currentStreak = data?.meta.currentStreak ?? 0;
  const longestStreak = data?.meta.longestStreak ?? 0;
  const currentDailyStreak = data?.meta.currentDailyStreak ?? 0;
  const longestDailyStreak = data?.meta.longestDailyStreak ?? 0;
  const completedCount = (data?.challenges ?? []).filter((c) => c.completed).length;
  const totalCount = data?.challenges.length ?? 0;

  const filtered = (data?.challenges ?? []).filter((c) => {
    if (filter === 'completed') return c.completed;
    if (filter === 'in-progress') return !c.completed;
    return true;
  });

  const weekly = filtered.filter((c) => c.cadence === 'WEEKLY');
  const permanent = filtered.filter((c) => c.cadence !== 'WEEKLY');

  // Sobre la lista completa, no la filtrada: el destacado no debe depender de
  // qué pestaña esté abierta
  const closest = pickClosest(data?.challenges ?? []);

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      {/* Hero marcador */}
      <div className="page-hero court-lines sweep-light animate-in">
        <div
          style={{ display: 'flex', alignItems: 'flex-end', gap: 32, flexWrap: 'wrap' as const }}
        >
          {/* Puntos totales en marcador LED, con acceso directo a la tienda */}
          <div>
            <ScoreValue value={totalPoints} size="3.6rem" pulse suffix="pts" />
            <div
              style={{
                color: 'rgba(255,255,255,0.55)',
                fontSize: '0.75rem',
                marginTop: 6,
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase' as const,
              }}
            >
              Puntos totales
            </div>
            <Link
              to="/shop"
              className="btn btn-primary"
              style={{
                marginTop: 12,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                fontSize: '0.85rem',
                textDecoration: 'none',
              }}
            >
              <Icon name="gift" size={16} />
              Canjear puntos
            </Link>
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 56, background: 'rgba(255,255,255,0.12)' }} />

          {/* Stats secundarias */}
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 20 }}>
            <HeroStat icon="flame" value={String(currentDailyStreak)} label="días seguidos" />
            <HeroStat icon="calendar" value={String(currentStreak)} label="semanas racha" />
            <HeroStat
              icon="check"
              value={`${completedCount}/${totalCount}`}
              label="retos completados"
            />
            <HeroStat icon="medal" value={String(longestDailyStreak)} label="mejor racha diaria" />
            <HeroStat icon="medal" value={String(longestStreak)} label="mejor racha semanal" />
          </div>
        </div>

        <h1 className="hero-title" style={{ marginTop: 22, fontSize: '1.8rem' }}>
          Mis Retos
        </h1>
        <p className="hero-subtitle">Tus misiones de la semana y tus logros acumulados</p>
      </div>

      {/* ── Retos ────────────────────────────────────────────────────────── */}
      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap' as const,
          gap: 12,
        }}
      >
        <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>
          Mis retos
        </h2>

        {/* Tabs de filtro */}
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'in-progress', 'completed'] as FilterTab[]).map((tab) => (
            <button
              key={tab}
              className={`chip${filter === tab ? ' active' : ''}`}
              onClick={() => setFilter(tab)}
            >
              {tab === 'all' ? 'Todos' : tab === 'in-progress' ? 'En progreso' : 'Completados'}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <p
          style={{
            color: 'var(--color-text-muted)',
            padding: '32px 0',
            textAlign: 'center' as const,
          }}
        >
          Cargando retos...
        </p>
      )}
      {isError && (
        <p style={{ color: 'var(--color-error)', padding: '32px 0', textAlign: 'center' as const }}>
          Error al cargar los retos.
        </p>
      )}
      {!isLoading && !isError && filtered.length === 0 && (
        <EmptyState
          icon="target"
          title="No hay retos en esta categoría"
          message="Cambia de filtro o sigue completando lecciones para desbloquear nuevos retos."
        />
      )}

      {!isLoading && !isError && <WeeklyBand entries={leaderboard?.entries ?? []} />}

      {!isLoading && !isError && closest && <ClosestChallenge c={closest} />}

      {weekly.length > 0 && (
        <>
          <div style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <h3
              style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}
            >
              Misiones de la semana
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              se reinician cada lunes
            </span>
          </div>
          <div
            style={{ display: 'flex', flexDirection: 'column' as const, gap: 14, marginBottom: 32 }}
          >
            {weekly.map((c, i) => (
              <ChallengeCard key={c.id} c={c} index={i} />
            ))}
          </div>
        </>
      )}

      {permanent.length > 0 && (
        <>
          <h3
            style={{
              fontSize: '1rem',
              fontWeight: 800,
              color: 'var(--color-text)',
              margin: '0 0 12px',
            }}
          >
            Logros
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 14 }}>
            {permanent.map((c, i) => (
              <ChallengeCard key={c.id} c={c} index={weekly.length + i} />
            ))}
          </div>
        </>
      )}

    </div>
  );
}

function HeroStat({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: 'var(--amber-led)',
        }}
      >
        <Icon name={icon} size={17} />
        <span className="score-number" style={{ fontSize: '1.5rem' }}>
          {value}
        </span>
      </div>
      <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
}
