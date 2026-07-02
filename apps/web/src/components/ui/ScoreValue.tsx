import { useCountUp } from '../../hooks/useCountUp';

interface ScoreValueProps {
  value: number;
  /** Tamaño de fuente (ej. '2.6rem') */
  size?: number | string;
  /** Pulso LED continuo (reservar para el dato estrella) */
  pulse?: boolean;
  /** Sufijo pequeño tras el número (ej. 'pts', 'días') */
  suffix?: string;
}

/**
 * Número de marcador LED: Bebas Neue + ámbar + glow + count-up.
 * Cada dígito ocupa ancho fijo para que el conteo no haga saltar el layout.
 */
export default function ScoreValue({ value, size = '2.6rem', pulse = false, suffix }: ScoreValueProps) {
  const display = useCountUp(value);
  const chars = String(display).split('');

  return (
    <span
      className={`score-number${pulse ? ' pulse' : ''}`}
      style={{ fontSize: size, display: 'inline-flex', alignItems: 'baseline' }}
    >
      {chars.map((ch, i) => (
        <span
          key={i}
          style={
            /\d/.test(ch)
              ? { display: 'inline-block', minWidth: '0.56em', textAlign: 'center' }
              : undefined
          }
        >
          {ch}
        </span>
      ))}
      {suffix && (
        <span style={{ fontSize: '0.4em', marginLeft: 5, opacity: 0.85, letterSpacing: '0.08em' }}>
          {suffix}
        </span>
      )}
    </span>
  );
}
