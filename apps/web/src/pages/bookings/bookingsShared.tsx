import React from 'react';
import { useStudentCourseProgress } from '../../hooks/useCourses';

// ---------------------------------------------------------------------------
// Helpers de fechas
// ---------------------------------------------------------------------------

export const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export const DAY_NAMES_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export function getWeekStart(offset: number): Date {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday + offset * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export function formatDate(date: Date): string {
  return `${DAY_NAMES_FULL[date.getDay()]}, ${date.getDate()} de ${MONTH_NAMES[date.getMonth()]}`;
}

export function formatTime(date: Date): string {
  return date.toTimeString().slice(0, 5);
}

export function formatShortDate(date: Date): string {
  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()].slice(0, 3).charAt(0).toUpperCase() + MONTH_NAMES[date.getMonth()].slice(0, 3).slice(1)}`;
}

// ---------------------------------------------------------------------------
// Estilos compartidos base
// ---------------------------------------------------------------------------

export const base: Record<string, React.CSSProperties> = {
  input: {
    padding: '9px 12px',
    border: '1.5px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.875rem',
    background: 'var(--color-bg)',
    color: 'var(--color-text)',
    outline: 'none',
    transition: 'border-color 0.15s',
    width: 90,
  },
  select: {
    padding: '9px 12px',
    border: '1.5px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.875rem',
    background: 'var(--color-bg)',
    color: 'var(--color-text)',
    outline: 'none',
  },
  textarea: {
    width: '100%',
    padding: '10px 12px',
    border: '1.5px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.875rem',
    background: 'var(--color-bg)',
    color: 'var(--color-text)',
    resize: 'vertical' as const,
    minHeight: 80,
    boxSizing: 'border-box' as const,
    outline: 'none',
  },
  toast: {
    position: 'fixed' as const,
    bottom: '1.5rem',
    right: '1.5rem',
    padding: '12px 20px',
    borderRadius: 'var(--radius-md)',
    color: '#fff',
    fontWeight: 700,
    fontSize: '0.9rem',
    zIndex: 200,
    boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
  },
  modeOption: { display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.875rem' },
};

// ---------------------------------------------------------------------------
// Badge de estado
// ---------------------------------------------------------------------------

export function StatusBadge({ status }: { status: string }) {
  const badgeStyles: Record<string, React.CSSProperties> = {
    PENDING: {
      padding: '3px 10px',
      borderRadius: 999,
      fontSize: '0.72rem',
      fontWeight: 700,
      background: 'rgba(234,88,12,0.12)',
      color: '#c2410c',
      border: '1px solid rgba(234,88,12,0.28)',
      letterSpacing: '0.03em',
      textTransform: 'uppercase' as const,
    },
    CONFIRMED: {
      padding: '3px 10px',
      borderRadius: 999,
      fontSize: '0.72rem',
      fontWeight: 700,
      background: 'rgba(22,163,74,0.10)',
      color: '#166534',
      border: '1px solid rgba(22,163,74,0.28)',
      letterSpacing: '0.03em',
      textTransform: 'uppercase' as const,
    },
    CANCELLED: {
      padding: '3px 10px',
      borderRadius: 999,
      fontSize: '0.72rem',
      fontWeight: 700,
      background: 'rgba(107,114,128,0.10)',
      color: '#6b7280',
      border: '1px solid rgba(107,114,128,0.22)',
      letterSpacing: '0.03em',
      textTransform: 'uppercase' as const,
    },
  };

  const label = status === 'PENDING' ? 'Pendiente' : status === 'CONFIRMED' ? 'Confirmada' : 'Cancelada';
  return <span style={badgeStyles[status] ?? badgeStyles.CANCELLED}>{label}</span>;
}

// ---------------------------------------------------------------------------
// Booking card reutilizable
// ---------------------------------------------------------------------------

export function bookingCardBorder(status: string): string {
  if (status === 'PENDING') return 'rgba(234,88,12,0.35)';
  if (status === 'CONFIRMED') return 'rgba(22,163,74,0.35)';
  return 'rgba(107,114,128,0.30)';
}

// ---------------------------------------------------------------------------
// Panel de progreso del alumno (visible para el profesor)
// ---------------------------------------------------------------------------

export function StudentProgressPanel({ courseId, studentId }: { courseId: string; studentId: string }) {
  const { data, isLoading } = useStudentCourseProgress(courseId, studentId);

  if (isLoading) {
    return (
      <div
        style={{
          width: '100%',
          marginTop: 12,
          padding: '14px 16px',
          background: 'var(--color-bg)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--color-border)',
          fontSize: '0.82rem',
          color: 'var(--color-text-muted)',
        }}
      >
        Cargando progreso...
      </div>
    );
  }
  if (!data) return null;

  const pct = data.percentageComplete;

  return (
    <div
      style={{
        width: '100%',
        marginTop: 12,
        padding: '14px 16px',
        background: 'var(--color-bg)',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--color-border)',
        fontSize: '0.82rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>Progreso en {data.courseTitle}</span>
        <span
          style={{
            fontWeight: 800,
            background: 'var(--gradient-orange)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          {pct}%
        </span>
      </div>
      <div className="progress-bar" style={{ marginBottom: 10 }}>
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div style={{ color: 'var(--color-text-muted)', marginBottom: 8 }}>
        {data.completedLessons} / {data.totalLessons} lecciones completadas
      </div>
      {data.modules.map((m) => {
        const allDone = m.completedLessons === m.totalLessons && m.totalLessons > 0;
        return (
          <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', color: 'var(--color-text-muted)' }}>
            <span>{m.title}</span>
            <span style={{ fontWeight: 600, color: allDone ? '#16a34a' : 'var(--color-text-muted)', fontSize: '0.75rem' }}>
              {m.completedLessons}/{m.totalLessons}{allDone ? ' ✓' : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}
