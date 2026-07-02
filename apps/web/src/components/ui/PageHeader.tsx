import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** 'stadium' = hero oscuro con cancha y barrido; 'light' = cabecera editorial */
  variant?: 'stadium' | 'light';
  /** Contenido extra (badges, stats, CTAs) renderizado bajo el subtítulo */
  children?: ReactNode;
}

/** Cabecera de página del design system Híbrido Estadio. */
export default function PageHeader({ title, subtitle, variant = 'light', children }: PageHeaderProps) {
  if (variant === 'stadium') {
    return (
      <header className="page-hero court-lines sweep-light animate-in">
        <h1 className="hero-title">{title}</h1>
        {subtitle && <p className="hero-subtitle">{subtitle}</p>}
        {children}
      </header>
    );
  }

  return (
    <header className="animate-in" style={{ marginBottom: 28 }}>
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 400,
          fontSize: 'clamp(1.9rem, 4vw, 2.4rem)',
          letterSpacing: '0.03em',
          textTransform: 'uppercase',
          color: 'var(--color-text)',
          lineHeight: 1.05,
        }}
      >
        {title}
      </h1>
      <div
        style={{
          width: 44,
          height: 4,
          background: 'var(--gradient-orange)',
          borderRadius: 2,
          margin: '10px 0',
          transformOrigin: 'left',
          animation: 'dashGrow 0.4s ease 0.15s both',
        }}
      />
      {subtitle && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9375rem' }}>{subtitle}</p>
      )}
      {children}
    </header>
  );
}
