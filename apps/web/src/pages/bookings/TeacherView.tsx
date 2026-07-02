import { useState } from 'react';
import type { BookingWithRelations } from '../../api/bookings.api';
import {
  useMyBookings,
  useConfirmBooking,
  useCancelBooking,
  useMyAvailability,
  useAddSlot,
  useDeleteSlot,
} from '../../hooks/useBookings';
import { formatDate, formatTime, base, StatusBadge, bookingCardBorder, StudentProgressPanel } from './bookingsShared';

// ---------------------------------------------------------------------------
// Vista TEACHER
// ---------------------------------------------------------------------------

export function TeacherView() {
  const { data: bookings, isLoading, isError } = useMyBookings();
  const confirmBooking = useConfirmBooking();
  const cancelBooking = useCancelBooking();
  const { data: mySlots } = useMyAvailability();
  const addSlot = useAddSlot();
  const deleteSlot = useDeleteSlot();

  const [newSlotDay, setNewSlotDay] = useState(1);
  const [newSlotStart, setNewSlotStart] = useState('09:00');
  const [newSlotEnd, setNewSlotEnd] = useState('10:00');
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  function showToast(msg: string, type: 'ok' | 'err') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleConfirm(id: string) {
    try {
      await confirmBooking.mutateAsync(id);
      showToast('Reserva confirmada', 'ok');
    } catch {
      showToast('Error al confirmar', 'err');
    }
  }

  async function handleCancel(id: string) {
    try {
      await cancelBooking.mutateAsync(id);
      showToast('Reserva cancelada', 'ok');
    } catch {
      showToast('Error al cancelar', 'err');
    }
  }

  async function handleAddSlot() {
    if (newSlotStart >= newSlotEnd) {
      showToast('La hora de inicio debe ser anterior a la de fin', 'err');
      return;
    }
    try {
      await addSlot.mutateAsync({ dayOfWeek: newSlotDay, startTime: newSlotStart, endTime: newSlotEnd });
      showToast('Slot anadido', 'ok');
    } catch {
      showToast('Error al anadir slot', 'err');
    }
  }

  async function handleDeleteSlot(id: string) {
    try {
      await deleteSlot.mutateAsync(id);
      showToast('Slot eliminado', 'ok');
    } catch {
      showToast('Error al eliminar slot', 'err');
    }
  }

  const DAY_NAMES_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  return (
    <div>
      {/* Hero */}
      <div className="page-hero animate-in">
        <span style={{ fontSize: '2.2rem', display: 'block', marginBottom: 12 }}>📅</span>
        <h1 className="hero-title">Mis Reservas</h1>
        <p className="hero-subtitle">Gestiona tus clases y disponibilidad horaria.</p>
      </div>

      {/* Reservas */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--color-text)', marginBottom: 16 }}>
          Mis reservas
        </h2>
        {isLoading && <p style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Cargando...</p>}
        {isError && (
          <p style={{ color: '#dc2626', fontSize: '0.9rem' }}>
            Error al cargar las reservas. Inténtalo de nuevo más tarde.
          </p>
        )}
        {!isLoading && !isError && (!bookings || bookings.length === 0) && (
          <p style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>No tienes reservas todavia.</p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
          {bookings?.map((b) => {
            const start = new Date(b.startAt);
            const end = new Date(b.endAt);
            const isExpanded = expandedBookingId === b.id;

            return (
              <div
                key={b.id}
                className="vkb-card animate-in"
                style={{
                  border: `1.5px solid ${bookingCardBorder(b.status)}`,
                  opacity: b.status === 'CANCELLED' ? 0.65 : 1,
                  padding: '18px 22px',
                  flexWrap: 'wrap' as const,
                  alignItems: 'flex-start',
                }}
              >
                <div style={{ display: 'flex', gap: 12, width: '100%', flexWrap: 'wrap' as const, alignItems: 'flex-start' }}>
                  <div style={{ flex: '1 1 200px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '0.95rem', marginBottom: 4 }}>
                      {formatDate(start)}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                      Alumno: {(b as BookingWithRelations & { student?: { name: string } }).student?.name ?? '—'}
                      {b.course ? ` · ${b.course.title}` : ''}
                      {' · '}{b.mode === 'ONLINE' ? 'Online' : 'Presencial'}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                      {formatTime(start)}–{formatTime(end)}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' as const, marginLeft: 'auto' }}>
                    <StatusBadge status={b.status} />
                    {b.mode === 'ONLINE' && b.status === 'CONFIRMED' && b.meetingUrl && (
                      <a
                        href={b.meetingUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          padding: '5px 12px',
                          background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          boxShadow: '0 4px 12px rgba(37,99,235,0.28)',
                        }}
                      >
                        Unirse
                      </a>
                    )}
                    {b.course && (
                      <button
                        style={{
                          padding: '5px 12px',
                          background: 'transparent',
                          color: 'var(--color-text-muted)',
                          border: '1.5px solid var(--color-border)',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          fontSize: '0.78rem',
                          fontWeight: 500,
                        }}
                        onClick={() => setExpandedBookingId(isExpanded ? null : b.id)}
                      >
                        {isExpanded ? 'Ocultar progreso' : 'Ver progreso'}
                      </button>
                    )}
                    {b.status === 'PENDING' && (
                      <button
                        style={{
                          padding: '5px 12px',
                          background: 'linear-gradient(135deg, #16a34a, #22c55e)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          boxShadow: '0 4px 12px rgba(22,163,74,0.28)',
                        }}
                        onClick={() => handleConfirm(b.id)}
                      >
                        Confirmar
                      </button>
                    )}
                    {b.status !== 'CANCELLED' && (
                      <button
                        style={{
                          padding: '5px 12px',
                          background: 'transparent',
                          color: '#ef4444',
                          border: '1.5px solid rgba(239,68,68,0.35)',
                          borderRadius: 'var(--radius-sm)',
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
                </div>

                {isExpanded && b.course && (
                  <StudentProgressPanel courseId={b.course.id} studentId={b.studentId} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Disponibilidad */}
      <div>
        <h2 style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--color-text)', marginBottom: 16 }}>
          Mi disponibilidad
        </h2>
        {(!mySlots || mySlots.length === 0) && (
          <p style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: '0.9rem', marginBottom: 12 }}>
            No tienes slots de disponibilidad configurados.
          </p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8, marginBottom: 16 }}>
          {mySlots?.map((slot) => (
            <div
              key={slot.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 16px',
                background: 'var(--color-surface)',
                border: '1.5px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <span style={{ flex: 1, color: 'var(--color-text)', fontSize: '0.9rem', fontWeight: 500 }}>
                {DAY_NAMES_ES[slot.dayOfWeek]} · {slot.startTime} – {slot.endTime}
              </span>
              <button
                style={{
                  background: 'transparent',
                  color: '#ef4444',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  padding: '4px 8px',
                }}
                onClick={() => handleDeleteSlot(slot.id)}
              >
                Eliminar
              </button>
            </div>
          ))}
        </div>

        {/* Formulario agregar slot */}
        <div
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            flexWrap: 'wrap' as const,
            padding: '16px',
            background: 'var(--color-surface)',
            border: '1.5px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <select
            style={base.select}
            value={newSlotDay}
            onChange={(e) => setNewSlotDay(Number(e.target.value))}
          >
            {DAY_NAMES_ES.map((d, i) => (
              <option key={i} value={i}>{d}</option>
            ))}
          </select>
          <input
            style={base.input}
            type="time"
            value={newSlotStart}
            onChange={(e) => setNewSlotStart(e.target.value)}
          />
          <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>–</span>
          <input
            style={base.input}
            type="time"
            value={newSlotEnd}
            onChange={(e) => setNewSlotEnd(e.target.value)}
          />
          <button
            className="btn btn-primary"
            style={{ padding: '9px 18px', fontSize: '0.875rem' }}
            onClick={handleAddSlot}
            disabled={addSlot.isPending}
          >
            Anadir slot
          </button>
        </div>
      </div>

      {toast && (
        <div style={{ ...base.toast, background: toast.type === 'ok' ? 'linear-gradient(135deg,#16a34a,#22c55e)' : 'linear-gradient(135deg,#dc2626,#ef4444)' }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
