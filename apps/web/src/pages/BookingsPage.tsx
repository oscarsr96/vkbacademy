import React, { useState } from 'react';
import { useAuthStore } from '../store/auth.store';
import { Role } from '@vkbacademy/shared';
import type { TeacherPublic } from '@vkbacademy/shared';
import type { FreeSlotRaw } from '../api/bookings.api';
import type { BookingWithRelations } from '../api/bookings.api';
import {
  useMyBookings,
  useCreateBooking,
  useConfirmBooking,
  useCancelBooking,
  useTeachers,
  useFreeSlots,
  useMyAvailability,
  useAddSlot,
  useDeleteSlot,
} from '../hooks/useBookings';
import { useMyStudents, useStudentCourses } from '../hooks/useTutors';
import { useStudentCourseProgress } from '../hooks/useCourses';

// ---------------------------------------------------------------------------
// Helpers de fechas
// ---------------------------------------------------------------------------

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DAY_NAMES_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function getWeekStart(offset: number): Date {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday + offset * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function formatDate(date: Date): string {
  return `${DAY_NAMES_FULL[date.getDay()]}, ${date.getDate()} de ${MONTH_NAMES[date.getMonth()]}`;
}

function formatTime(date: Date): string {
  return date.toTimeString().slice(0, 5);
}

function formatShortDate(date: Date): string {
  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()].slice(0, 3).charAt(0).toUpperCase() + MONTH_NAMES[date.getMonth()].slice(0, 3).slice(1)}`;
}

// ---------------------------------------------------------------------------
// Estilos compartidos base
// ---------------------------------------------------------------------------

const base: Record<string, React.CSSProperties> = {
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

function StatusBadge({ status }: { status: string }) {
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

function bookingCardBorder(status: string): string {
  if (status === 'PENDING') return 'rgba(234,88,12,0.35)';
  if (status === 'CONFIRMED') return 'rgba(22,163,74,0.35)';
  return 'rgba(107,114,128,0.30)';
}

// ---------------------------------------------------------------------------
// Panel de progreso del alumno (visible para el profesor)
// ---------------------------------------------------------------------------

function StudentProgressPanel({ courseId, studentId }: { courseId: string; studentId: string }) {
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

// ---------------------------------------------------------------------------
// Vista STUDENT — solo lectura
// ---------------------------------------------------------------------------

function StudentView() {
  const { data: bookings, isLoading } = useMyBookings();

  const pending = bookings?.filter((b) => b.status === 'PENDING').length ?? 0;
  const confirmed = bookings?.filter((b) => b.status === 'CONFIRMED').length ?? 0;

  return (
    <div>
      {/* Hero */}
      <div className="page-hero animate-in">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
          <span style={{ fontSize: '2.2rem' }}>📅</span>
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
      {!isLoading && (!bookings || bookings.length === 0) && (
        <div
          style={{
            textAlign: 'center' as const,
            padding: '48px 24px',
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-xl)',
            border: '1.5px solid var(--color-border)',
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>📅</div>
          <div style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 }}>
            Aun no tienes reservas
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
            Tu tutor las gestionara por ti.
          </div>
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

// ---------------------------------------------------------------------------
// Vista TUTOR — wizard de nueva reserva + lista
// ---------------------------------------------------------------------------

function TutorView() {
  const { data: bookings, isLoading } = useMyBookings();
  const { data: students, isLoading: loadingStudents } = useMyStudents();
  const createBooking = useCreateBooking();
  const cancelBooking = useCancelBooking();

  const [step, setStep] = useState(0);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherPublic | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<FreeSlotRaw | null>(null);
  const [bookingMode, setBookingMode] = useState<'IN_PERSON' | 'ONLINE'>('IN_PERSON');
  const [bookingNotes, setBookingNotes] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  const weekStart = getWeekStart(weekOffset);
  const weekStartISO = weekStart.toISOString().slice(0, 10);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const { data: teachers, isLoading: loadingTeachers } = useTeachers();
  const { data: freeSlots, isLoading: loadingSlots } = useFreeSlots(
    selectedTeacher?.id ?? null,
    weekStartISO,
  );

  const selectedStudent = students?.find((s) => s.id === selectedStudentId);
  const { data: studentCourses } = useStudentCourses(selectedStudentId || null);

  function showToast(msg: string, type: 'ok' | 'err') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  function closeModal() {
    setStep(0);
    setSelectedStudentId('');
    setSelectedTeacher(null);
    setWeekOffset(0);
    setSelectedSlot(null);
    setBookingMode('IN_PERSON');
    setBookingNotes('');
    setSelectedCourseId('');
  }

  async function handleConfirm() {
    if (!selectedTeacher || !selectedSlot || !selectedStudentId) return;
    try {
      await createBooking.mutateAsync({
        studentId: selectedStudentId,
        teacherId: selectedTeacher.id,
        startAt: selectedSlot.startAt,
        endAt: selectedSlot.endAt,
        mode: bookingMode,
        notes: bookingNotes || undefined,
        courseId: selectedCourseId || undefined,
      });
      showToast('Reserva creada correctamente', 'ok');
      closeModal();
    } catch {
      showToast('Error al crear la reserva', 'err');
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

  const STEP_LABELS = ['Alumno', 'Profesor', 'Horario', 'Confirmar'];

  return (
    <div>
      {/* Hero */}
      <div className="page-hero animate-in">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
          <span style={{ fontSize: '2.2rem' }}>📅</span>
        </div>
        <h1 className="hero-title">Reservas</h1>
        <p className="hero-subtitle">Gestiona las clases particulares de tus alumnos.</p>
      </div>

      {/* Lista de reservas */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap' as const, gap: 10 }}>
          <h2 style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--color-text)', margin: 0 }}>
            Reservas de mis alumnos
          </h2>
          <button className="btn btn-primary" style={{ padding: '9px 20px', fontSize: '0.875rem' }} onClick={() => setStep(1)}>
            Nueva reserva
          </button>
        </div>

        {isLoading && <p style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Cargando...</p>}
        {!isLoading && (!bookings || bookings.length === 0) && (
          <p style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>
            No hay reservas todavia.
          </p>
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
                  flexWrap: 'wrap' as const,
                  alignItems: 'flex-start',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, width: '100%', flexWrap: 'wrap' as const }}>
                  <div style={{ flex: '1 1 200px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '0.95rem', marginBottom: 4 }}>
                      {formatDate(start)}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                      Alumno: {(b as BookingWithRelations & { student?: { name: string } }).student?.name ?? '—'}
                      {' · '}Prof. {b.teacher?.user.name ?? '—'}
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
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal wizard */}
      {step > 0 && (
        <div
          style={{
            position: 'fixed' as const,
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div
            style={{
              background: 'var(--color-surface)',
              borderRadius: 'var(--radius-xl)',
              padding: '28px',
              width: '100%',
              maxWidth: 520,
              maxHeight: '85vh',
              overflowY: 'auto' as const,
              boxShadow: '0 24px 64px rgba(0,0,0,0.30)',
            }}
          >
            {/* Indicador de pasos */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 24 }}>
              {STEP_LABELS.map((label, idx) => {
                const stepNum = idx + 1;
                const isActive = step === stepNum;
                const isDone = step > stepNum;
                return (
                  <React.Fragment key={label}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: isActive
                            ? 'var(--gradient-orange)'
                            : isDone
                            ? 'rgba(234,88,12,0.20)'
                            : 'var(--color-bg)',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          color: isActive ? '#fff' : isDone ? 'var(--color-primary)' : 'var(--color-text-muted)',
                          border: isActive
                            ? 'none'
                            : isDone
                            ? '1.5px solid rgba(234,88,12,0.35)'
                            : '1.5px solid var(--color-border)',
                          boxShadow: isActive ? 'var(--shadow-orange)' : 'none',
                        }}
                      >
                        {isDone ? '✓' : stepNum}
                      </div>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: isActive ? 700 : 500,
                          color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                        }}
                      >
                        {label}
                      </span>
                    </div>
                    {idx < STEP_LABELS.length - 1 && (
                      <div
                        style={{
                          flex: 1,
                          height: 2,
                          background: isDone ? 'rgba(234,88,12,0.30)' : 'var(--color-border)',
                          borderRadius: 1,
                        }}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Paso 1: elegir alumno */}
            {step === 1 && (
              <>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 16, color: 'var(--color-text)' }}>
                  Selecciona el alumno
                </h3>
                {loadingStudents && <p style={{ color: 'var(--color-text-muted)' }}>Cargando alumnos...</p>}
                {!loadingStudents && (!students || students.length === 0) && (
                  <p style={{ color: 'var(--color-text-muted)' }}>No tienes alumnos asignados.</p>
                )}
                <select
                  style={{ ...base.select, width: '100%', marginBottom: 20, padding: '11px 14px' }}
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                >
                  <option value=''>— Elige un alumno —</option>
                  {students?.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name}{st.schoolYear ? ` (${st.schoolYear.label})` : ''}
                    </option>
                  ))}
                </select>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button className="btn btn-ghost" style={{ padding: '9px 18px' }} onClick={closeModal}>Cancelar</button>
                  <button className="btn btn-primary" style={{ padding: '9px 18px' }} disabled={!selectedStudentId} onClick={() => setStep(2)}>Siguiente</button>
                </div>
              </>
            )}

            {/* Paso 2: elegir profesor */}
            {step === 2 && (
              <>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 16, color: 'var(--color-text)' }}>
                  Elige un profesor
                </h3>
                {loadingTeachers && <p style={{ color: 'var(--color-text-muted)' }}>Cargando profesores...</p>}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10, marginBottom: 20 }}>
                  {teachers?.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTeacher(t)}
                      style={{
                        border: selectedTeacher?.id === t.id
                          ? '2px solid var(--color-primary)'
                          : '1.5px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        padding: '14px',
                        cursor: 'pointer',
                        background: selectedTeacher?.id === t.id ? 'rgba(234,88,12,0.06)' : 'var(--color-surface)',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ fontWeight: 700, color: 'var(--color-text)', marginBottom: 4, fontSize: '0.9rem' }}>
                        {t.user.name}
                      </div>
                      {t.bio && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                          {t.bio}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button className="btn btn-ghost" style={{ padding: '9px 18px' }} onClick={() => setStep(1)}>Volver</button>
                  <button className="btn btn-primary" style={{ padding: '9px 18px' }} disabled={!selectedTeacher} onClick={() => setStep(3)}>Siguiente</button>
                </div>
              </>
            )}

            {/* Paso 3: elegir slot */}
            {step === 3 && (
              <>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 16, color: 'var(--color-text)' }}>
                  Elige un horario
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <button
                    className="btn btn-ghost"
                    style={{ padding: '7px 14px', fontSize: '0.82rem' }}
                    onClick={() => setWeekOffset((w) => w - 1)}
                  >
                    Ant
                  </button>
                  <span style={{ flex: 1, textAlign: 'center' as const, fontWeight: 600, color: 'var(--color-text)', fontSize: '0.875rem' }}>
                    {formatShortDate(weekStart)} – {formatShortDate(weekEnd)}
                  </span>
                  <button
                    className="btn btn-ghost"
                    style={{ padding: '7px 14px', fontSize: '0.82rem' }}
                    onClick={() => setWeekOffset((w) => w + 1)}
                  >
                    Sig
                  </button>
                </div>
                {loadingSlots && <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Cargando horarios...</p>}
                {!loadingSlots && (!freeSlots || freeSlots.length === 0) && (
                  <p style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: '0.875rem', marginBottom: 12 }}>
                    No hay slots disponibles esta semana.
                  </p>
                )}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                    gap: 8,
                    marginBottom: 20,
                  }}
                >
                  {freeSlots?.map((slot, i) => {
                    const start = new Date(slot.startAt);
                    const end = new Date(slot.endAt);
                    const isSelected = selectedSlot?.startAt === slot.startAt;
                    return (
                      <button
                        key={i}
                        onClick={() => setSelectedSlot(slot)}
                        style={{
                          padding: '10px 8px',
                          border: isSelected
                            ? '2px solid var(--color-primary)'
                            : '1.5px solid var(--color-border)',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          background: isSelected ? 'rgba(234,88,12,0.10)' : 'var(--color-bg)',
                          color: isSelected ? 'var(--color-primary)' : 'var(--color-text)',
                          fontSize: '0.8rem',
                          textAlign: 'center' as const,
                          fontWeight: isSelected ? 700 : 400,
                          transition: 'all 0.15s',
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>{DAY_NAMES[start.getDay()]} {start.getDate()}</div>
                        <div style={{ marginTop: 2 }}>{formatTime(start)}–{formatTime(end)}</div>
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button className="btn btn-ghost" style={{ padding: '9px 18px' }} onClick={() => setStep(2)}>Volver</button>
                  <button className="btn btn-primary" style={{ padding: '9px 18px' }} disabled={!selectedSlot} onClick={() => setStep(4)}>Siguiente</button>
                </div>
              </>
            )}

            {/* Paso 4: confirmar */}
            {step === 4 && selectedTeacher && selectedSlot && (
              <>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 16, color: 'var(--color-text)' }}>
                  Confirmar reserva
                </h3>
                <div
                  style={{
                    background: 'var(--color-bg)',
                    borderRadius: 'var(--radius-md)',
                    padding: '16px',
                    marginBottom: 18,
                    fontSize: '0.875rem',
                  }}
                >
                  {[
                    { label: 'Alumno', value: selectedStudent?.name ?? '—' },
                    { label: 'Profesor', value: selectedTeacher.user.name },
                    { label: 'Fecha', value: formatDate(new Date(selectedSlot.startAt)) },
                    { label: 'Hora', value: `${formatTime(new Date(selectedSlot.startAt))}–${formatTime(new Date(selectedSlot.endAt))}` },
                  ].map((row) => (
                    <div key={row.label} style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                      <span style={{ color: 'var(--color-text-muted)', minWidth: 72, fontWeight: 500 }}>{row.label}:</span>
                      <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{row.value}</span>
                    </div>
                  ))}
                </div>

                {/* Asignatura */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 6, color: 'var(--color-text)' }}>
                    Asignatura (opcional)
                  </div>
                  <select
                    style={{ ...base.select, width: '100%' }}
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                  >
                    <option value=''>Sin especificar</option>
                    {studentCourses?.map((c) => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                </div>

                {/* Modalidad */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 8, color: 'var(--color-text)' }}>
                    Modalidad
                  </div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <label style={base.modeOption}>
                      <input type="radio" value="IN_PERSON" checked={bookingMode === 'IN_PERSON'} onChange={() => setBookingMode('IN_PERSON')} />
                      Presencial
                    </label>
                    <label style={base.modeOption}>
                      <input type="radio" value="ONLINE" checked={bookingMode === 'ONLINE'} onChange={() => setBookingMode('ONLINE')} />
                      Online
                    </label>
                  </div>
                </div>

                {/* Notas */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 6, color: 'var(--color-text)' }}>
                    Notas (opcional)
                  </div>
                  <textarea
                    style={base.textarea}
                    placeholder="Anadir cualquier detalle relevante..."
                    value={bookingNotes}
                    onChange={(e) => setBookingNotes(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button className="btn btn-ghost" style={{ padding: '9px 18px' }} onClick={() => setStep(3)}>Volver</button>
                  <button
                    className="btn btn-primary"
                    style={{ padding: '9px 22px' }}
                    onClick={handleConfirm}
                    disabled={createBooking.isPending}
                  >
                    {createBooking.isPending ? 'Confirmando...' : 'Confirmar reserva'}
                  </button>
                </div>
              </>
            )}
          </div>
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

// ---------------------------------------------------------------------------
// Vista TEACHER
// ---------------------------------------------------------------------------

function TeacherView() {
  const { data: bookings, isLoading } = useMyBookings();
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
        {!isLoading && (!bookings || bookings.length === 0) && (
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

// ---------------------------------------------------------------------------
// Vista ADMIN
// ---------------------------------------------------------------------------

function AdminView() {
  const { data: bookings, isLoading } = useMyBookings();
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
      {!isLoading && (!bookings || bookings.length === 0) && (
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

// ---------------------------------------------------------------------------
// Pagina principal
// ---------------------------------------------------------------------------

export default function BookingsPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div style={{ maxWidth: 920, margin: '0 auto' }}>
      {user?.role === Role.STUDENT && <StudentView />}
      {user?.role === Role.TUTOR   && <TutorView />}
      {user?.role === Role.TEACHER && <TeacherView />}
      {user?.role === Role.ADMIN   && <AdminView />}
    </div>
  );
}
