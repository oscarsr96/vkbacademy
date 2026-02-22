import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingsApi, type BookingWithRelations, type CreateSlotPayload } from '../api/bookings.api';
import type { AvailabilitySlot } from '@vkbacademy/shared';
import { useAuthStore } from '../store/auth.store';

// ─── Constantes ────────────────────────────────────────────────────────────────

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const ORANGE = '#ea580c';

// ─── Colores de estado ──────────────────────────────────────────────────────────

function statusBorderColor(status: string): string {
  if (status === 'CONFIRMED') return '#16a34a';
  if (status === 'CANCELLED') return '#94a3b8';
  return ORANGE;
}

function statusBadgeStyle(status: string): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'inline-block',
    padding: '3px 11px',
    borderRadius: 999,
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  };
  if (status === 'CONFIRMED') return { ...base, background: '#dcfce7', color: '#166534' };
  if (status === 'CANCELLED') return { ...base, background: '#f1f5f9', color: '#64748b' };
  return { ...base, background: 'rgba(234,88,12,0.12)', color: '#c94e00', border: '1px solid rgba(234,88,12,0.3)' };
}

function statusLabel(status: string) {
  if (status === 'CONFIRMED') return 'Confirmada';
  if (status === 'CANCELLED') return 'Cancelada';
  return 'Pendiente';
}

// ─── Tab: Reservas ─────────────────────────────────────────────────────────────

function BookingsTab() {
  const qc = useQueryClient();

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['teacher', 'bookings'],
    queryFn: bookingsApi.getMyBookings,
  });

  const { mutate: confirm } = useMutation({
    mutationFn: (id: string) => bookingsApi.confirm(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teacher', 'bookings'] }),
  });

  const { mutate: cancel } = useMutation({
    mutationFn: (id: string) => bookingsApi.cancel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teacher', 'bookings'] }),
  });

  if (isLoading) return <div style={S.empty}>Cargando reservas...</div>;

  const pending = bookings.filter((b) => b.status === 'PENDING');
  const confirmed = bookings.filter((b) => b.status === 'CONFIRMED');
  const cancelled = bookings.filter((b) => b.status === 'CANCELLED');

  function BookingCard({ b }: { b: BookingWithRelations }) {
    const start = new Date(b.startAt);
    const end = new Date(b.endAt);
    const dateStr = start.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    const timeStr = `${start.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} – ${end.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;

    return (
      <div style={{
        ...S.bookingCard,
        borderLeft: `4px solid ${statusBorderColor(b.status)}`,
      }}>
        <div style={S.bookingInfo}>
          <div style={S.bookingStudent}>
            {b.student?.name ?? 'Alumno desconocido'}
          </div>
          <div style={S.bookingMeta}>
            📅 {dateStr} &nbsp;·&nbsp; {timeStr}<br />
            {b.mode === 'ONLINE' ? '💻 Online' : '📍 Presencial'}
            {b.course && ` · ${b.course.title}`}
          </div>
        </div>
        <div style={S.bookingActions}>
          <span style={statusBadgeStyle(b.status)}>{statusLabel(b.status)}</span>
          {b.status === 'PENDING' && (
            <>
              <button
                style={{ ...S.btnSm, background: '#16a34a', color: '#fff' }}
                onClick={() => confirm(b.id)}
              >
                Confirmar
              </button>
              <button
                style={{ ...S.btnSm, background: '#fee2e2', color: '#dc2626' }}
                onClick={() => cancel(b.id)}
              >
                Cancelar
              </button>
            </>
          )}
          {b.status === 'CONFIRMED' && (
            <button
              style={{ ...S.btnSm, background: '#f1f5f9', color: '#475569' }}
              onClick={() => cancel(b.id)}
            >
              Cancelar
            </button>
          )}
        </div>
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div style={S.emptyState}>
        <span style={{ fontSize: '2.5rem' }}>📅</span>
        <p style={{ fontWeight: 600, color: '#64748b', margin: 0 }}>No tienes reservas aún.</p>
      </div>
    );
  }

  return (
    <div>
      {pending.length > 0 && (
        <>
          <h3 style={S.groupTitle}>
            <span style={{ color: ORANGE }}>⏳</span> Pendientes ({pending.length})
          </h3>
          {pending.map((b) => <BookingCard key={b.id} b={b} />)}
        </>
      )}
      {confirmed.length > 0 && (
        <>
          <h3 style={{ ...S.groupTitle, marginTop: '1.75rem' }}>
            <span style={{ color: '#16a34a' }}>✅</span> Confirmadas ({confirmed.length})
          </h3>
          {confirmed.map((b) => <BookingCard key={b.id} b={b} />)}
        </>
      )}
      {cancelled.length > 0 && (
        <>
          <h3 style={{ ...S.groupTitle, marginTop: '1.75rem', color: '#94a3b8' }}>
            <span>❌</span> Canceladas ({cancelled.length})
          </h3>
          {cancelled.map((b) => <BookingCard key={b.id} b={b} />)}
        </>
      )}
    </div>
  );
}

// ─── Tab: Disponibilidad ───────────────────────────────────────────────────────

function AvailabilityTab() {
  const qc = useQueryClient();
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [addError, setAddError] = useState('');

  const { data: slots = [], isLoading } = useQuery({
    queryKey: ['teacher', 'slots'],
    queryFn: bookingsApi.getMySlots,
  });

  const { mutate: addSlot, isPending: adding } = useMutation({
    mutationFn: (payload: CreateSlotPayload) => bookingsApi.addSlot(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teacher', 'slots'] });
      setAddError('');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setAddError(msg ?? 'Error al añadir el slot');
    },
  });

  const { mutate: deleteSlot } = useMutation({
    mutationFn: (id: string) => bookingsApi.deleteSlot(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teacher', 'slots'] }),
  });

  const slotsByDay = DAYS.reduce<Record<number, AvailabilitySlot[]>>((acc, _, i) => {
    acc[i + 1] = slots.filter((s) => s.dayOfWeek === i + 1);
    return acc;
  }, {});

  function handleAdd() {
    setAddError('');
    if (startTime >= endTime) {
      setAddError('La hora de inicio debe ser anterior a la de fin');
      return;
    }
    addSlot({ dayOfWeek, startTime, endTime });
  }

  if (isLoading) return <div style={S.empty}>Cargando disponibilidad...</div>;

  return (
    <div>
      {/* Grid de días */}
      <div style={S.slotGrid}>
        {DAYS.map((day, i) => {
          const daySlots = slotsByDay[i + 1] ?? [];
          return (
            <div key={day} className="vkb-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={S.dayHeader}>{day}</div>
              <div style={{ padding: '10px 14px' }}>
                {daySlots.length === 0 ? (
                  <p style={S.emptySlot}>Sin horario</p>
                ) : (
                  daySlots.map((slot) => (
                    <div key={slot.id} style={S.slotRow}>
                      <span style={S.slotTime}>{slot.startTime} – {slot.endTime}</span>
                      <button
                        style={{ ...S.btnSm, background: '#fee2e2', color: '#dc2626', padding: '4px 10px', fontSize: '0.78rem' }}
                        onClick={() => deleteSlot(slot.id)}
                        title="Eliminar slot"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Formulario añadir */}
      <div className="vkb-card" style={{ marginTop: 8 }}>
        <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '1rem', fontSize: '0.95rem' }}>
          + Añadir franja horaria
        </div>
        {addError && (
          <div className="alert alert-error" style={{ marginBottom: 14 }}>{addError}</div>
        )}
        <div style={S.addRow}>
          <div>
            <label style={S.addLabel}>Día</label>
            <select
              style={S.select}
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(Number(e.target.value))}
            >
              {DAYS.map((d, i) => (
                <option key={d} value={i + 1}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={S.addLabel}>Inicio</label>
            <input
              style={S.timeInput}
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div>
            <label style={S.addLabel}>Fin</label>
            <input
              style={S.timeInput}
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
          <button
            className="btn btn-primary"
            style={{ alignSelf: 'flex-end', opacity: adding ? 0.6 : 1 }}
            onClick={handleAdd}
            disabled={adding}
          >
            {adding ? 'Añadiendo...' : '+ Añadir'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────────

export default function TeacherPortalPage() {
  const [tab, setTab] = useState<'bookings' | 'availability'>('bookings');
  const user = useAuthStore((s) => s.user);

  return (
    <div style={S.page}>
      {/* Hero */}
      <div className="page-hero animate-in">
        <h1 className="hero-title">🏫 Portal Docente</h1>
        {user && (
          <p className="hero-subtitle">
            Bienvenido, {user.name} — gestiona tus reservas y horario de disponibilidad
          </p>
        )}
      </div>

      {/* Tabs */}
      <div style={S.tabs}>
        {(['bookings', 'availability'] as const).map((t) => (
          <button
            key={t}
            style={{
              ...S.tab,
              ...(tab === t ? S.tabActive : S.tabInactive),
            }}
            onClick={() => setTab(t)}
          >
            {t === 'bookings' ? '📅 Mis reservas' : '🗓 Mi disponibilidad'}
          </button>
        ))}
      </div>

      {/* Contenido */}
      <div style={S.body}>
        {tab === 'bookings' ? <BookingsTab /> : <AvailabilityTab />}
      </div>
    </div>
  );
}

// ─── Estilos ───────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  page: { display: 'flex', flexDirection: 'column', minHeight: '100%' },

  // Tabs
  tabs: {
    display: 'flex',
    gap: 8,
    padding: '0 0 0',
    marginBottom: 24,
    borderBottom: '2px solid #e2e8f0',
  },
  tab: {
    padding: '10px 20px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '0.875rem',
    border: 'none',
    borderRadius: '8px 8px 0 0',
    transition: 'background 0.15s, color 0.15s, box-shadow 0.15s',
    letterSpacing: '0.01em',
  },
  tabActive: {
    background: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
    color: '#fff',
    boxShadow: '0 4px 12px rgba(234,88,12,0.3)',
  },
  tabInactive: {
    background: 'transparent',
    color: '#64748b',
    border: '1.5px solid #e2e8f0',
    borderBottom: 'none',
  },

  body: { flex: 1 },

  // Reservas
  bookingCard: {
    background: '#fff',
    borderRadius: 12,
    border: '1.5px solid #e2e8f0',
    padding: '1rem 1.25rem',
    marginBottom: 10,
    display: 'flex',
    alignItems: 'flex-start',
    gap: 16,
    flexWrap: 'wrap' as const,
    transition: 'box-shadow 0.2s, transform 0.2s',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
  },
  bookingInfo: { flex: 1, minWidth: 200 },
  bookingStudent: { fontWeight: 700, fontSize: '0.95rem', color: '#0f172a', marginBottom: 4 },
  bookingMeta: { fontSize: '0.8rem', color: '#64748b', lineHeight: 1.6 },
  bookingActions: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' as const },
  btnSm: {
    padding: '6px 14px',
    borderRadius: 7,
    border: 'none',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '0.78rem',
    transition: 'opacity 0.15s, transform 0.15s',
  },
  groupTitle: {
    fontSize: '0.95rem',
    fontWeight: 700,
    color: '#0f172a',
    marginBottom: 12,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },

  // Disponibilidad
  slotGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 14,
    marginBottom: 20,
  },
  dayHeader: {
    background: 'linear-gradient(135deg, #080e1a 0%, #0d1b2a 100%)',
    color: '#fff',
    fontWeight: 700,
    fontSize: '0.85rem',
    padding: '10px 14px',
    borderBottom: '1px solid rgba(234,88,12,0.2)',
  },
  slotRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 0',
    borderBottom: '1px solid #f1f5f9',
  },
  slotTime: { fontSize: '0.875rem', color: '#0f172a', fontWeight: 500 },
  emptySlot: { color: '#94a3b8', fontStyle: 'italic', fontSize: '0.8rem', padding: '0.25rem 0', margin: 0 },
  addRow: { display: 'flex', gap: 12, flexWrap: 'wrap' as const, alignItems: 'flex-end' },
  addLabel: { fontSize: '0.78rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 },
  select: {
    height: 42,
    padding: '0 10px',
    borderRadius: 8,
    border: '1.5px solid #e2e8f0',
    fontSize: '0.875rem',
    background: '#fff',
    outline: 'none',
  },
  timeInput: {
    height: 42,
    padding: '0 10px',
    borderRadius: 8,
    border: '1.5px solid #e2e8f0',
    fontSize: '0.875rem',
    outline: 'none',
  },

  // Estados vacíos
  empty: { color: '#94a3b8', fontStyle: 'italic', fontSize: '0.85rem', padding: '0.5rem 0' },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: '4rem',
    color: '#94a3b8',
  },
};
