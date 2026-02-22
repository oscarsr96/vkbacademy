import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingsApi, type BookingWithRelations, type CreateSlotPayload } from '../api/bookings.api';
import type { AvailabilitySlot } from '@vkbacademy/shared';

// ─── Estilos ───────────────────────────────────────────────────────────────────

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const ORANGE = '#ea580c';

const S: Record<string, React.CSSProperties> = {
  page: { display: 'flex', flexDirection: 'column', minHeight: '100%' },
  hero: {
    padding: '2.5rem 2.5rem 2rem',
    background: '#0d1b2a',
    borderBottom: 'none',
  },
  heroTitle: {
    fontSize: '2rem',
    fontWeight: 900,
    color: '#fff',
    letterSpacing: '-0.03em',
    textTransform: 'uppercase',
    marginBottom: '0.25rem',
  },
  heroSub: { fontSize: '0.9rem', color: 'rgba(255,255,255,0.55)' },

  tabs: {
    display: 'flex',
    borderBottom: '2px solid #e2e8f0',
    background: '#fff',
    padding: '0 2.5rem',
  },
  tab: {
    padding: '0.875rem 1.25rem',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '0.875rem',
    border: 'none',
    background: 'none',
    color: '#64748b',
    borderBottom: '2px solid transparent',
    marginBottom: -2,
    transition: 'color 0.15s',
  },
  tabActive: { color: ORANGE, borderBottomColor: ORANGE },

  body: { padding: '2rem 2.5rem', flex: 1, background: '#f8fafc' },

  // Reservas
  bookingCard: {
    background: '#fff',
    borderRadius: 12,
    border: '1px solid #e2e8f0',
    padding: '1rem 1.25rem',
    marginBottom: 12,
    display: 'flex',
    alignItems: 'flex-start',
    gap: 16,
    flexWrap: 'wrap' as const,
  },
  bookingInfo: { flex: 1, minWidth: 200 },
  bookingStudent: { fontWeight: 700, fontSize: '0.95rem', color: '#0f172a', marginBottom: 4 },
  bookingMeta: { fontSize: '0.8rem', color: '#64748b', lineHeight: 1.6 },
  badge: {
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: 999,
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  bookingActions: { display: 'flex', gap: 8, alignItems: 'center' },
  btnSm: {
    padding: '6px 14px',
    borderRadius: 7,
    border: 'none',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '0.78rem',
    transition: 'opacity 0.15s',
  },

  // Disponibilidad
  slotGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: 16,
    marginBottom: '2rem',
  },
  dayCard: {
    background: '#fff',
    borderRadius: 12,
    border: '1px solid #e2e8f0',
    overflow: 'hidden',
  },
  dayHeader: {
    background: '#0d1b2a',
    color: '#fff',
    fontWeight: 700,
    fontSize: '0.85rem',
    padding: '10px 14px',
  },
  dayBody: { padding: '10px 14px' },
  slotRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 0',
    borderBottom: '1px solid #f1f5f9',
  },
  slotTime: { fontSize: '0.875rem', color: '#0f172a', fontWeight: 500 },
  addSlotCard: {
    background: '#fff',
    borderRadius: 12,
    border: '1px solid #e2e8f0',
    padding: '1.5rem',
  },
  addTitle: { fontWeight: 700, marginBottom: '1rem', color: '#0f172a' },
  addRow: { display: 'flex', gap: 12, flexWrap: 'wrap' as const, alignItems: 'flex-end' },
  select: {
    height: 40,
    padding: '0 10px',
    borderRadius: 8,
    border: '1.5px solid #e2e8f0',
    fontSize: '0.875rem',
    background: '#fff',
  },
  timeInput: {
    height: 40,
    padding: '0 10px',
    borderRadius: 8,
    border: '1.5px solid #e2e8f0',
    fontSize: '0.875rem',
  },
  empty: { color: '#94a3b8', fontStyle: 'italic', fontSize: '0.85rem', padding: '0.5rem 0' },
};

// ─── Colores de estado ──────────────────────────────────────────────────────────

function statusStyle(status: string): React.CSSProperties {
  if (status === 'CONFIRMED') return { ...S.badge, background: '#dcfce7', color: '#166534' };
  if (status === 'CANCELLED') return { ...S.badge, background: '#fee2e2', color: '#991b1b' };
  return { ...S.badge, background: '#fef9c3', color: '#854d0e' };
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

  // Separar reservas por estado
  const pending = bookings.filter((b) => b.status === 'PENDING');
  const confirmed = bookings.filter((b) => b.status === 'CONFIRMED');
  const cancelled = bookings.filter((b) => b.status === 'CANCELLED');

  function BookingCard({ b }: { b: BookingWithRelations }) {
    const start = new Date(b.startAt);
    const end = new Date(b.endAt);
    const dateStr = start.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    const timeStr = `${start.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} – ${end.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;

    return (
      <div style={S.bookingCard}>
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
          <span style={statusStyle(b.status)}>{statusLabel(b.status)}</span>
          {b.status === 'PENDING' && (
            <>
              <button
                style={{ ...S.btnSm, background: '#16a34a', color: '#fff' }}
                onClick={() => confirm(b.id)}
              >
                Confirmar
              </button>
              <button
                style={{ ...S.btnSm, background: '#dc2626', color: '#fff' }}
                onClick={() => cancel(b.id)}
              >
                Cancelar
              </button>
            </>
          )}
          {b.status === 'CONFIRMED' && (
            <button
              style={{ ...S.btnSm, background: '#e2e8f0', color: '#475569' }}
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
    return <p style={{ color: '#94a3b8' }}>No tienes reservas aún.</p>;
  }

  return (
    <div>
      {pending.length > 0 && (
        <>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>
            ⏳ Pendientes ({pending.length})
          </h3>
          {pending.map((b) => <BookingCard key={b.id} b={b} />)}
        </>
      )}
      {confirmed.length > 0 && (
        <>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: '1.5rem 0 12px' }}>
            ✅ Confirmadas ({confirmed.length})
          </h3>
          {confirmed.map((b) => <BookingCard key={b.id} b={b} />)}
        </>
      )}
      {cancelled.length > 0 && (
        <>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#94a3b8', margin: '1.5rem 0 12px' }}>
            ❌ Canceladas ({cancelled.length})
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

  // Agrupar slots por día
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
      {/* Grid por día */}
      <div style={S.slotGrid}>
        {DAYS.map((day, i) => {
          const daySlots = slotsByDay[i + 1] ?? [];
          return (
            <div key={day} style={S.dayCard}>
              <div style={S.dayHeader}>{day}</div>
              <div style={S.dayBody}>
                {daySlots.length === 0 ? (
                  <p style={S.empty}>Sin horario</p>
                ) : (
                  daySlots.map((slot) => (
                    <div key={slot.id} style={S.slotRow}>
                      <span style={S.slotTime}>{slot.startTime} – {slot.endTime}</span>
                      <button
                        style={{ ...S.btnSm, background: '#fee2e2', color: '#991b1b', padding: '4px 10px' }}
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
      <div style={S.addSlotCard}>
        <div style={S.addTitle}>Añadir franja horaria</div>
        {addError && (
          <div style={{ color: '#dc2626', fontSize: '0.85rem', marginBottom: 10 }}>{addError}</div>
        )}
        <div style={S.addRow}>
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>
              Día
            </label>
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
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>
              Inicio
            </label>
            <input
              style={S.timeInput}
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>
              Fin
            </label>
            <input
              style={S.timeInput}
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
          <button
            style={{
              ...S.btnSm,
              background: adding ? '#cbd5e1' : ORANGE,
              color: '#fff',
              height: 40,
              padding: '0 18px',
              fontSize: '0.875rem',
            }}
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

  return (
    <div style={S.page}>
      {/* Hero */}
      <div style={S.hero}>
        <div style={S.heroTitle}>Portal Docente</div>
        <div style={S.heroSub}>Gestiona tus reservas y horario de disponibilidad</div>
      </div>

      {/* Tabs */}
      <div style={S.tabs}>
        {(['bookings', 'availability'] as const).map((t) => (
          <button
            key={t}
            style={{ ...S.tab, ...(tab === t ? S.tabActive : {}) }}
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
