import { useEffect, useState } from 'react';
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
  // Insignia cuya explicación está abierta, y si se abrió "fijada" (por toque o
  // click) o solo de paso (ratón encima o foco de teclado).
  //
  // La distinción no es un capricho: al tocar, el navegador emula mouseenter y
  // además la pierde el foco al soltar, así que un tooltip que se cerrara con
  // cualquiera de las dos cosas se abría y se cerraba dentro del mismo gesto.
  // Y sin toque el tooltip sería invisible en el móvil, que es justo desde
  // donde entra el alumno.
  const [open, setOpen] = useState<{ id: string; fijado: boolean } | null>(null);
  const openId = open?.id ?? null;

  /** Abre "de paso": no pisa una explicación que el alumno haya fijado. */
  const abrirAlPasar = (id: string) => setOpen((prev) => (prev?.fijado ? prev : { id, fijado: false }));
  const cerrarAlSalir = (id: string) =>
    setOpen((prev) => (prev && prev.id === id && !prev.fijado ? null : prev));

  useEffect(() => {
    if (!openId) return;
    const cerrar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
    };
    window.addEventListener('keydown', cerrar);
    return () => window.removeEventListener('keydown', cerrar);
  }, [openId]);

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
          <li key={b.id} style={S.item}>
            <button
              type="button"
              style={S.trigger}
              aria-describedby={openId === b.id ? `badge-tip-${b.id}` : undefined}
              aria-expanded={openId === b.id}
              // Solo el ratón abre por proximidad. Al tocar, el navegador emula
              // mouseenter ANTES del click: sin este filtro, el toque abría el
              // tooltip y el click posterior lo cerraba en el mismo gesto.
              onPointerEnter={(e) => e.pointerType === 'mouse' && abrirAlPasar(b.id)}
              onPointerLeave={(e) => e.pointerType === 'mouse' && cerrarAlSalir(b.id)}
              onFocus={() => abrirAlPasar(b.id)}
              onBlur={() => cerrarAlSalir(b.id)}
              onClick={() =>
                setOpen((prev) => (prev?.id === b.id && prev.fijado ? null : { id: b.id, fijado: true }))
              }
            >
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
            </button>

            {openId === b.id && <BadgeTip badge={b} />}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Explicación de una insignia: en qué consiste y cómo va.
 *
 * Antes esto era el atributo `title` del navegador, que en las conseguidas
 * repetía el nombre que ya está debajo y en las pendientes tardaba un segundo
 * en aparecer. Y en móvil no salía nunca.
 */
function BadgeTip({ badge }: { badge: ChallengeWithProgress }) {
  const faltan = Math.max(badge.target - badge.progress, 0);

  return (
    <div id={`badge-tip-${badge.id}`} role="tooltip" style={S.tip}>
      <p style={S.tipTitle}>{badge.title}</p>
      <p style={S.tipText}>{badge.description}</p>
      <p style={S.tipMeta}>
        {badge.completed
          ? `Conseguida · ${badge.points} pts`
          : `Te faltan ${faltan} de ${badge.target} · ${badge.points} pts`}
      </p>
    </div>
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
  item: { position: 'relative', display: 'flex', justifyContent: 'center' },
  trigger: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    textAlign: 'center',
    width: '100%',
    padding: 0,
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    font: 'inherit',
    color: 'inherit',
  },
  tip: {
    position: 'absolute',
    bottom: 'calc(100% + 8px)',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 5,
    width: 210,
    padding: '10px 12px',
    borderRadius: 10,
    background: 'var(--navy-900, #0a1628)',
    border: '1px solid var(--color-border)',
    boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
    textAlign: 'left',
    pointerEvents: 'none',
  },
  tipTitle: { margin: 0, fontSize: '0.8rem', fontWeight: 800, color: '#fff' },
  tipText: { margin: '4px 0 0', fontSize: '0.75rem', lineHeight: 1.45, color: 'rgba(255,255,255,0.75)' },
  tipMeta: { margin: '6px 0 0', fontSize: '0.7rem', fontWeight: 700, color: 'var(--brand, #f5911e)' },
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
