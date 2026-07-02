import Icon from './Icon';
import ScoreValue from './ScoreValue';

interface StatTileProps {
  icon: string;
  /** Número → marcador LED con count-up; string → se muestra tal cual */
  value: number | string;
  label: string;
  /** Pulso LED (reservar para el dato estrella, ej. racha activa) */
  pulse?: boolean;
  suffix?: string;
  /** Retardo de entrada escalonada en ms */
  delay?: number;
}

/** Tarjeta de estadística estilo marcador de estadio. */
export default function StatTile({ icon, value, label, pulse, suffix, delay = 0 }: StatTileProps) {
  return (
    <div
      className="panel-glass"
      style={{
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        animation: `riseIn 0.5s cubic-bezier(0.18, 0.72, 0.24, 1.12) ${delay}ms both`,
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 34,
          height: 34,
          borderRadius: 10,
          background: 'var(--brand-soft)',
          color: 'var(--brand-light)',
        }}
      >
        <Icon name={icon} size={18} />
      </span>
      {typeof value === 'number' ? (
        <ScoreValue value={value} pulse={pulse} suffix={suffix} />
      ) : (
        <span className={`score-number${pulse ? ' pulse' : ''}`} style={{ fontSize: '2.6rem' }}>
          {value}
        </span>
      )}
      <span
        style={{
          fontSize: '0.72rem',
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--color-text-muted)',
        }}
      >
        {label}
      </span>
    </div>
  );
}
