import { useMyBookings } from '../../hooks/useBookings';
import { formatDate, formatTime, StatusBadge, bookingCardBorder } from './bookingsShared';
import Icon from '../../components/ui/Icon';
import EmptyState from '../../components/ui/EmptyState';

// ---------------------------------------------------------------------------
// Vista STUDENT — solo lectura
// ---------------------------------------------------------------------------

export function StudentView() {
  const { data: bookings, isLoading, isError } = useMyBookings();

  const pending = bookings?.filter((b) => b.status === 'PENDING').length ?? 0;
  const confirmed = bookings?.filter((b) => b.status === 'CONFIRMED').length ?? 0;

  return (
    <div>
      {/* Hero */}
      <div className="page-hero court-lines sweep-light animate-in">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
          <span style={{ color: 'var(--brand-deep)', display: 'inline-flex' }}>
            <Icon name="calendar" size={32} />
          </span>
          {!isLoading && bookings && bookings.length > 0 && (
            <div style={{ display: 'flex', gap: 10 }}>
              {pending > 0 && (
                <div
                  className="stat-card"
                  style={{ padding: '8px 14px', display: 'inline-flex', gap: 6, alignItems: 'center' }}
                >
                  <span style={{ fontWeight: 800, color: 'var(--color-primary)', fontSize: '1.1rem' }}>
                    {pending}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>pendientes</span>
                </div>
              )}
              {confirmed > 0 && (
                <div
                  style={{
                    padding: '8px 14px',
                    background: 'var(--color-surface)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1.5px solid rgba(22,163,74,0.25)',
                    boxShadow: '0 4px 16px rgba(22,163,74,0.10)',
                    display: 'inline-flex',
                    gap: 6,
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontWeight: 800, color: '#16a34a', fontSize: '1.1rem' }}>
                    {confirmed}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>confirmadas</span>
                </div>
              )}
            </div>
          )}
        </div>
        <h1 className="hero-title">Mis Reservas</h1>
        <p className="hero-subtitle">Tu tutor gestiona las reservas de clases particulares.</p>
      </div>

      {/* Lista */}
      {isLoading && (
        <p style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '12px 0' }}>Cargando...</p>
      )}
      {isError && (
        <div
          style={{
            textAlign: 'center' as const,
            padding: '48px 24px',
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-xl)',
            border: '1.5px solid rgba(220,38,38,0.30)',
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>⚠️</div>
          <div style={{ fontWeight: 600, color: '#dc2626', marginBottom: 6 }}>
            Error al cargar tus reservas
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
            Inténtalo de nuevo más tarde.
          </div>
        </div>
      )}
      {!isLoading && !isError && (!bookings || bookings.length === 0) && (
        <div className="vkb-card">
          <EmptyState
            icon="calendar"
            title="Aun no tienes reservas"
            message="Tu tutor las gestionara por ti."
          />
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
        {bookings?.map((b) => {
          const start = new Date(b.startAt);
          const end = new Date(b.endAt);
          return (
            <div
              key={b.id}
              className="vkb-card animate-in"
              style={{
                border: `1.5px solid ${bookingCardBorder(b.status)}`,
                opacity: b.status === 'CANCELLED' ? 0.65 : 1,
                padding: '18px 22px',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                flexWrap: 'wrap' as const,
              }}
            >
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '0.95rem', marginBottom: 4 }}>
                  {formatDate(start)}
                </div>
                <div style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)' }}>
                  {formatTime(start)}–{formatTime(end)} · Prof. {b.teacher?.user.name ?? '—'} · {b.mode === 'ONLINE' ? 'Online' : 'Presencial'}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' as const }}>
                <StatusBadge status={b.status} />
                {b.mode === 'ONLINE' && b.status === 'CONFIRMED' && b.meetingUrl && (
                  <a
                    href={b.meetingUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      padding: '5px 14px',
                      background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      boxShadow: '0 4px 12px rgba(37,99,235,0.30)',
                    }}
                  >
                    Unirse a la reunion
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
