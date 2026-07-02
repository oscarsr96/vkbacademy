interface ProgressBarProps {
  value: number;
  max?: number;
  /** 'brand' = naranja de marca; 'amber' = ámbar LED (zona estadio) */
  variant?: 'brand' | 'amber';
  height?: number;
  /** Etiqueta accesible (ej. "Progreso del curso") */
  label?: string;
}

/** Barra de progreso animada con glow, accesible. */
export default function ProgressBar({
  value,
  max = 100,
  variant = 'brand',
  height = 8,
  label,
}: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, Math.round((value / max) * 100))) : 0;

  return (
    <div
      className="progress-bar"
      style={{ height }}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={`progress-fill${variant === 'amber' ? ' amber' : ''}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
