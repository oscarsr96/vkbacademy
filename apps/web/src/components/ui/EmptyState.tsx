import type { ReactNode } from 'react';
import Icon from './Icon';

interface EmptyStateProps {
  icon?: string;
  title: string;
  message?: string;
  /** CTA opcional (botón o link) */
  action?: ReactNode;
}

/** Estado vacío consistente: icono tenue + título + mensaje + CTA opcional. */
export default function EmptyState({ icon = 'basketball', title, message, action }: EmptyStateProps) {
  return (
    <div
      className="animate-in"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 12,
        padding: '56px 24px',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: 'var(--brand-soft)',
          color: 'var(--brand)',
        }}
      >
        <Icon name={icon} size={30} />
      </span>
      <p style={{ fontWeight: 700, fontSize: '1.0625rem', color: 'var(--color-text)' }}>{title}</p>
      {message && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', maxWidth: 420 }}>
          {message}
        </p>
      )}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}
