import { useState } from 'react';
import type { BookingWithRelations } from '../../api/bookings.api';
import { useMyBookings, useCancelBooking } from '../../hooks/useBookings';
import { formatDate, formatTime, base, StatusBadge } from './bookingsShared';

// ---------------------------------------------------------------------------
// Vista ADMIN
// ---------------------------------------------------------------------------

export function AdminView() {
  const { data: bookings, isLoading, isError } = useMyBookings();
  const cancelBooking = useCancelBooking();
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  function showToast(msg: string, type: 'ok' | 'err') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleCancel(id: string) {
    try {
      await cancelBooking.mutateAsync(id);
      showToast('Reserva cancelada', 'ok');
    } catch {
      showToast('Error al cancelar', 'err');
    }
  }

  return (
    <div>
      {/* Hero */}
      <div className="page-hero animate-in">
        <span style={{ fontSize: '2.2rem', display: 'block', marginBottom: 12 }}>📅</span>
        <h1 className="hero-title">Todas las Reservas</h1>
        <p className="hero-subtitle">Vista administrativa de todas las reservas del sistema.</p>
      </div>

      {isLoading && <p style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Cargando...</p>}
      {isError && (
        <p style={{ color: '#dc2626', fontSize: '0.9rem' }}>
          Error al cargar las reservas. Inténtalo de nuevo más tarde.
        </p>
      )}
      {!isLoading && !isError && (!bookings || bookings.length === 0) && (
        <p style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>
          No hay reservas en el sistema.
        </p>
      )}

      {bookings && bookings.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Alumno</th>
                <th>Profesor</th>
                <th>Fecha</th>
                <th>Modo</th>
                <th>Asignatura</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => {
                const start = new Date(b.startAt);
                const end = new Date(b.endAt);
                return (
                  <tr key={b.id}>
                    <td>{(b as BookingWithRelations & { student?: { name: string } }).student?.name ?? '—'}</td>
                    <td>{b.teacher?.user.name ?? '—'}</td>
                    <td>{formatDate(start)} {formatTime(start)}–{formatTime(end)}</td>
                    <td>{b.mode === 'ONLINE' ? 'Online' : 'Presencial'}</td>
                    <td>{b.course?.title ?? '—'}</td>
                    <td><StatusBadge status={b.status} /></td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {b.mode === 'ONLINE' && b.status === 'CONFIRMED' && b.meetingUrl && (
                          <a
                            href={b.meetingUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              padding: '4px 10px',
                              background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 6,
                              cursor: 'pointer',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            Sala
                          </a>
                        )}
                        {b.status !== 'CANCELLED' && (
                          <button
                            style={{
                              padding: '4px 10px',
                              background: 'transparent',
                              color: '#ef4444',
                              border: '1.5px solid rgba(239,68,68,0.35)',
                              borderRadius: 6,
                              cursor: 'pointer',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                            }}
                            onClick={() => handleCancel(b.id)}
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {toast && (
        <div style={{ ...base.toast, background: toast.type === 'ok' ? 'linear-gradient(135deg,#16a34a,#22c55e)' : 'linear-gradient(135deg,#dc2626,#ef4444)' }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
