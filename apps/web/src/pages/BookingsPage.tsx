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

/** Retorna el lunes de la semana actual + offset semanas */
function getWeekStart(offset: number): Date {
  const now = new Date();
  const day = now.getDay(); // 0=Dom
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
// Estilos
// ---------------------------------------------------------------------------

const s: Record<string, React.CSSProperties> = {
  page: { padding: '2rem', maxWidth: 900, margin: '0 auto' },
  title: { fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--color-text)' },
  section: { marginBottom: '2rem' },
  sectionTitle: { fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--color-text)' },
  card: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    padding: '1rem 1.25rem',
    marginBottom: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    flexWrap: 'wrap' as const,
  },
  cardInfo: { flex: 1, minWidth: 200 },
  cardDate: { fontWeight: 600, color: 'var(--color-text)', fontSize: '0.9rem' },
  cardMeta: { fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 2 },
  badgePending: { padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600, background: '#fed7aa', color: '#9a3412' },
  badgeConfirmed: { padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600, background: '#bbf7d0', color: '#14532d' },
  badgeCancelled: { padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600, background: '#e5e7eb', color: '#6b7280' },
  btnPrimary: { padding: '0.5rem 1rem', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' },
  btnSecondary: { padding: '0.5rem 1rem', background: 'transparent', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', borderRadius: 6, cursor: 'pointer', fontSize: '0.875rem' },
  btnDanger: { padding: '0.4rem 0.75rem', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem' },
  btnSuccess: { padding: '0.4rem 0.75rem', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 },
  btnGhost: { padding: '0.4rem 0.75rem', background: 'transparent', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem' },
  empty: { color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: '0.9rem', padding: '1rem 0' },
  // Modal
  overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' },
  modal: { background: 'var(--color-surface)', borderRadius: 12, padding: '1.5rem', width: '100%', maxWidth: 500, maxHeight: '80vh', overflowY: 'auto' as const },
  modalTitle: { fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--color-text)' },
  // Teacher grid
  teacherGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' },
  teacherCard: { border: '1px solid var(--color-border)', borderRadius: 8, padding: '1rem', cursor: 'pointer', background: 'var(--color-surface)', transition: 'border-color 0.15s' },
  teacherName: { fontWeight: 600, color: 'var(--color-text)', marginBottom: 4 },
  teacherBio: { fontSize: '0.8rem', color: 'var(--color-text-muted)' },
  // Slots
  slotsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.5rem', marginBottom: '1rem' },
  slotBtn: { padding: '0.5rem', border: '1px solid var(--color-border)', borderRadius: 6, cursor: 'pointer', background: 'var(--color-bg)', fontSize: '0.8rem', textAlign: 'center' as const },
  slotBtnSelected: { padding: '0.5rem', border: '2px solid var(--color-primary)', borderRadius: 6, cursor: 'pointer', background: 'var(--color-primary)', color: '#fff', fontSize: '0.8rem', textAlign: 'center' as const, fontWeight: 600 },
  weekNav: { display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' },
  weekLabel: { fontWeight: 600, color: 'var(--color-text)', minWidth: 140, textAlign: 'center' as const },
  // Confirm step
  summaryBox: { background: 'var(--color-bg)', borderRadius: 8, padding: '1rem', marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--color-text)' },
  summaryRow: { display: 'flex', gap: '0.5rem', marginBottom: '0.4rem' },
  label: { color: 'var(--color-text-muted)', minWidth: 80 },
  // Availability form
  slotForm: { display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' as const, marginTop: '0.75rem' },
  input: { padding: '0.4rem 0.6rem', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: '0.875rem', background: 'var(--color-bg)', color: 'var(--color-text)', width: 90 },
  select: { padding: '0.4rem 0.6rem', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: '0.875rem', background: 'var(--color-bg)', color: 'var(--color-text)' },
  // Textarea
  textarea: { width: '100%', padding: '0.5rem', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: '0.875rem', background: 'var(--color-bg)', color: 'var(--color-text)', resize: 'vertical' as const, minHeight: 70, boxSizing: 'border-box' as const },
  // Toast
  toast: { position: 'fixed' as const, bottom: '1.5rem', right: '1.5rem', padding: '0.75rem 1.25rem', borderRadius: 8, color: '#fff', fontWeight: 600, fontSize: '0.9rem', zIndex: 200 },
  // Table (admin)
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.875rem' },
  th: { textAlign: 'left' as const, padding: '0.5rem 0.75rem', borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-muted)', fontWeight: 600 },
  td: { padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text)' },
  // Modo selector
  modeGroup: { display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' },
  modeOption: { display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.875rem' },
  // Botón videollamada
  btnMeeting: { padding: '0.4rem 0.75rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' },
  // Panel de progreso del alumno
  progressPanel: { width: '100%', marginTop: '0.75rem', padding: '0.75rem 1rem', background: 'var(--color-bg)', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: '0.82rem' },
  progressBarTrack: { height: 6, background: 'var(--color-border)', borderRadius: 3, overflow: 'hidden', margin: '0.4rem 0 0.6rem' },
  progressBarFill: { height: '100%', background: 'var(--color-primary)', borderRadius: 3, transition: 'width 0.3s' },
  moduleRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.2rem 0', color: 'var(--color-text-muted)' },
  moduleComplete: { color: '#16a34a', fontWeight: 600, fontSize: '0.75rem' },
  moduleIncomplete: { color: 'var(--color-text-muted)', fontSize: '0.75rem' },
};

// ---------------------------------------------------------------------------
// Panel de progreso del alumno (visible para el profesor)
// ---------------------------------------------------------------------------

function StudentProgressPanel({ courseId, studentId }: { courseId: string; studentId: string }) {
  const { data, isLoading } = useStudentCourseProgress(courseId, studentId);

  if (isLoading) return <div style={s.progressPanel}><span style={{ color: 'var(--color-text-muted)' }}>Cargando progreso...</span></div>;
  if (!data) return null;

  return (
    <div style={s.progressPanel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>Progreso en {data.courseTitle}</span>
        <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{data.percentageComplete}%</span>
      </div>
      <div style={s.progressBarTrack}>
        <div style={{ ...s.progressBarFill, width: `${data.percentageComplete}%` }} />
      </div>
      <div style={{ color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
        {data.completedLessons} / {data.totalLessons} lecciones completadas
      </div>
      {data.modules.map((m) => {
        const allDone = m.completedLessons === m.totalLessons && m.totalLessons > 0;
        return (
          <div key={m.id} style={s.moduleRow}>
            <span>{m.title}</span>
            <span style={allDone ? s.moduleComplete : s.moduleIncomplete}>
              {m.completedLessons}/{m.totalLessons}
              {allDone ? ' ✓' : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Badge de estado
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  if (status === 'PENDING') return <span style={s.badgePending}>Pendiente</span>;
  if (status === 'CONFIRMED') return <span style={s.badgeConfirmed}>Confirmada</span>;
  return <span style={s.badgeCancelled}>Cancelada</span>;
}

// ---------------------------------------------------------------------------
// Vista STUDENT — solo lectura
// ---------------------------------------------------------------------------

function StudentView() {
  const { data: bookings, isLoading } = useMyBookings();

  return (
    <div>
      <div style={s.section}>
        <h2 style={s.sectionTitle}>Mis reservas</h2>
        {isLoading && <p style={s.empty}>Cargando...</p>}
        {!isLoading && (!bookings || bookings.length === 0) && (
          <p style={s.empty}>Aún no tienes reservas. Tu tutor las gestionará por ti.</p>
        )}
        {bookings?.map((b) => {
          const start = new Date(b.startAt);
          const end = new Date(b.endAt);
          return (
            <div key={b.id} style={s.card}>
              <div style={s.cardInfo}>
                <div style={s.cardDate}>{formatDate(start)} · {formatTime(start)}–{formatTime(end)}</div>
                <div style={s.cardMeta}>Prof. {b.teacher?.user.name ?? '—'} · {b.mode === 'ONLINE' ? 'Online' : 'Presencial'}</div>
              </div>
              <StatusBadge status={b.status} />
              {b.mode === 'ONLINE' && b.status === 'CONFIRMED' && b.meetingUrl && (
                <a href={b.meetingUrl} target="_blank" rel="noreferrer" style={s.btnMeeting}>
                  📹 Unirse a la reunión
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vista TUTOR — gestión de reservas de sus alumnos
// ---------------------------------------------------------------------------

function TutorView() {
  const { data: bookings, isLoading } = useMyBookings();
  const { data: students, isLoading: loadingStudents } = useMyStudents();
  const createBooking = useCreateBooking();
  const cancelBooking = useCancelBooking();

  // Pasos: 0 = inactivo, 1 = alumno, 2 = profesor, 3 = slot, 4 = confirmar
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
  // Solo cursos en los que está matriculado el alumno seleccionado
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

  return (
    <div>
      {/* Lista de reservas de todos los alumnos */}
      <div style={s.section}>
        <h2 style={s.sectionTitle}>Reservas de mis alumnos</h2>
        {isLoading && <p style={s.empty}>Cargando...</p>}
        {!isLoading && (!bookings || bookings.length === 0) && (
          <p style={s.empty}>No hay reservas todavía.</p>
        )}
        {bookings?.map((b) => {
          const start = new Date(b.startAt);
          const end = new Date(b.endAt);
          return (
            <div key={b.id} style={{ ...s.card, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div style={{ ...s.cardInfo, flex: '1 1 200px' }}>
                <div style={s.cardDate}>{formatDate(start)} · {formatTime(start)}–{formatTime(end)}</div>
                <div style={s.cardMeta}>
                  Alumno: {(b as BookingWithRelations & { student?: { name: string } }).student?.name ?? '—'}
                  {' · '}Prof. {b.teacher?.user.name ?? '—'}
                  {b.course ? ` · ${b.course.title}` : ''}
                  {' · '}{b.mode === 'ONLINE' ? 'Online' : 'Presencial'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <StatusBadge status={b.status} />
                {b.mode === 'ONLINE' && b.status === 'CONFIRMED' && b.meetingUrl && (
                  <a href={b.meetingUrl} target="_blank" rel="noreferrer" style={s.btnMeeting}>
                    📹 Unirse a la reunión
                  </a>
                )}
                {b.status !== 'CANCELLED' && (
                  <button style={s.btnDanger} onClick={() => handleCancel(b.id)}>Cancelar</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <button style={s.btnPrimary} onClick={() => setStep(1)}>+ Nueva reserva</button>

      {/* Modal */}
      {step > 0 && (
        <div style={s.overlay} onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div style={s.modal}>

            {/* Paso 1: elegir alumno */}
            {step === 1 && (
              <>
                <h3 style={s.modalTitle}>Paso 1 — Selecciona el alumno</h3>
                {loadingStudents && <p style={s.empty}>Cargando alumnos...</p>}
                {!loadingStudents && (!students || students.length === 0) && (
                  <p style={s.empty}>No tienes alumnos asignados.</p>
                )}
                <select
                  style={{ ...s.select, width: '100%', marginBottom: '1rem' }}
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
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button style={s.btnSecondary} onClick={closeModal}>Cancelar</button>
                  <button style={s.btnPrimary} disabled={!selectedStudentId} onClick={() => setStep(2)}>Siguiente</button>
                </div>
              </>
            )}

            {/* Paso 2: elegir profesor */}
            {step === 2 && (
              <>
                <h3 style={s.modalTitle}>Paso 2 — Elige un profesor</h3>
                {loadingTeachers && <p style={s.empty}>Cargando profesores...</p>}
                <div style={s.teacherGrid}>
                  {teachers?.map((t) => (
                    <div
                      key={t.id}
                      style={{ ...s.teacherCard, borderColor: selectedTeacher?.id === t.id ? 'var(--color-primary)' : 'var(--color-border)' }}
                      onClick={() => setSelectedTeacher(t)}
                    >
                      <div style={s.teacherName}>{t.user.name}</div>
                      {t.bio && <div style={s.teacherBio}>{t.bio}</div>}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
                  <button style={s.btnSecondary} onClick={() => setStep(1)}>← Volver</button>
                  <button style={s.btnPrimary} disabled={!selectedTeacher} onClick={() => setStep(3)}>Siguiente</button>
                </div>
              </>
            )}

            {/* Paso 3: elegir slot */}
            {step === 3 && (
              <>
                <h3 style={s.modalTitle}>Paso 3 — Elige un horario</h3>
                <div style={s.weekNav}>
                  <button style={s.btnGhost} onClick={() => setWeekOffset((w) => w - 1)}>← Ant</button>
                  <span style={s.weekLabel}>{formatShortDate(weekStart)} – {formatShortDate(weekEnd)}</span>
                  <button style={s.btnGhost} onClick={() => setWeekOffset((w) => w + 1)}>Sig →</button>
                </div>
                {loadingSlots && <p style={s.empty}>Cargando horarios disponibles...</p>}
                {!loadingSlots && (!freeSlots || freeSlots.length === 0) && (
                  <p style={s.empty}>No hay slots disponibles esta semana.</p>
                )}
                <div style={s.slotsGrid}>
                  {freeSlots?.map((slot, i) => {
                    const start = new Date(slot.startAt);
                    const end = new Date(slot.endAt);
                    const isSelected = selectedSlot?.startAt === slot.startAt;
                    return (
                      <button
                        key={i}
                        style={isSelected ? s.slotBtnSelected : s.slotBtn}
                        onClick={() => setSelectedSlot(slot)}
                      >
                        <div>{DAY_NAMES[start.getDay()]} {start.getDate()}</div>
                        <div>{formatTime(start)}–{formatTime(end)}</div>
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
                  <button style={s.btnSecondary} onClick={() => setStep(2)}>← Volver</button>
                  <button style={s.btnPrimary} disabled={!selectedSlot} onClick={() => setStep(4)}>Siguiente</button>
                </div>
              </>
            )}

            {/* Paso 4: confirmar */}
            {step === 4 && selectedTeacher && selectedSlot && (
              <>
                <h3 style={s.modalTitle}>Paso 4 — Confirmar reserva</h3>
                <div style={s.summaryBox}>
                  <div style={s.summaryRow}><span style={s.label}>Alumno:</span> {selectedStudent?.name ?? '—'}</div>
                  <div style={s.summaryRow}><span style={s.label}>Profesor:</span> {selectedTeacher.user.name}</div>
                  <div style={s.summaryRow}><span style={s.label}>Fecha:</span> {formatDate(new Date(selectedSlot.startAt))}</div>
                  <div style={s.summaryRow}><span style={s.label}>Hora:</span> {formatTime(new Date(selectedSlot.startAt))}–{formatTime(new Date(selectedSlot.endAt))}</div>
                </div>
                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--color-text)' }}>Asignatura (opcional)</div>
                  <select
                    style={{ ...s.select, width: '100%' }}
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                  >
                    <option value=''>Sin especificar</option>
                    {studentCourses?.map((c) => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                </div>
                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--color-text)' }}>Modalidad</div>
                  <div style={s.modeGroup}>
                    <label style={s.modeOption}>
                      <input type="radio" value="IN_PERSON" checked={bookingMode === 'IN_PERSON'} onChange={() => setBookingMode('IN_PERSON')} />
                      Presencial
                    </label>
                    <label style={s.modeOption}>
                      <input type="radio" value="ONLINE" checked={bookingMode === 'ONLINE'} onChange={() => setBookingMode('ONLINE')} />
                      Online
                    </label>
                  </div>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--color-text)' }}>Notas (opcional)</div>
                  <textarea
                    style={s.textarea}
                    placeholder="Añade cualquier detalle relevante..."
                    value={bookingNotes}
                    onChange={(e) => setBookingNotes(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button style={s.btnSecondary} onClick={() => setStep(3)}>← Volver</button>
                  <button style={s.btnPrimary} onClick={handleConfirm} disabled={createBooking.isPending}>
                    {createBooking.isPending ? 'Confirmando...' : 'Confirmar reserva'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div style={{ ...s.toast, background: toast.type === 'ok' ? '#22c55e' : '#ef4444' }}>
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
      showToast('Slot añadido', 'ok');
    } catch {
      showToast('Error al añadir slot', 'err');
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
      {/* Reservas del profesor */}
      <div style={s.section}>
        <h2 style={s.sectionTitle}>Mis reservas</h2>
        {isLoading && <p style={s.empty}>Cargando...</p>}
        {!isLoading && (!bookings || bookings.length === 0) && (
          <p style={s.empty}>No tienes reservas todavía.</p>
        )}
        {bookings?.map((b) => {
          const start = new Date(b.startAt);
          const end = new Date(b.endAt);
          const isExpanded = expandedBookingId === b.id;
          return (
            <div key={b.id} style={{ ...s.card, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div style={{ ...s.cardInfo, flex: '1 1 200px' }}>
                <div style={s.cardDate}>{formatDate(start)} · {formatTime(start)}–{formatTime(end)}</div>
                <div style={s.cardMeta}>
                  Alumno: {(b as BookingWithRelations & { student?: { name: string } }).student?.name ?? '—'}
                  {b.course ? ` · ${b.course.title}` : ''}
                  {' · '}{b.mode === 'ONLINE' ? 'Online' : 'Presencial'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <StatusBadge status={b.status} />
                {b.mode === 'ONLINE' && b.status === 'CONFIRMED' && b.meetingUrl && (
                  <a href={b.meetingUrl} target="_blank" rel="noreferrer" style={s.btnMeeting}>
                    📹 Unirse a la reunión
                  </a>
                )}
                {b.course && (
                  <button
                    style={s.btnGhost}
                    onClick={() => setExpandedBookingId(isExpanded ? null : b.id)}
                  >
                    {isExpanded ? 'Ocultar progreso' : 'Ver progreso'}
                  </button>
                )}
                {b.status === 'PENDING' && (
                  <button style={s.btnSuccess} onClick={() => handleConfirm(b.id)}>Confirmar</button>
                )}
                {b.status !== 'CANCELLED' && (
                  <button style={s.btnDanger} onClick={() => handleCancel(b.id)}>Cancelar</button>
                )}
              </div>
              {isExpanded && b.course && (
                <StudentProgressPanel courseId={b.course.id} studentId={b.studentId} />
              )}
            </div>
          );
        })}
      </div>

      {/* Disponibilidad del profesor */}
      <div style={s.section}>
        <h2 style={s.sectionTitle}>Mi disponibilidad</h2>
        {(!mySlots || mySlots.length === 0) && (
          <p style={s.empty}>No tienes slots de disponibilidad configurados.</p>
        )}
        {mySlots?.map((slot) => (
          <div key={slot.id} style={{ ...s.card, padding: '0.6rem 1rem' }}>
            <span style={{ flex: 1, color: 'var(--color-text)', fontSize: '0.9rem' }}>
              {DAY_NAMES_ES[slot.dayOfWeek]} · {slot.startTime} – {slot.endTime}
            </span>
            <button style={s.btnDanger} onClick={() => handleDeleteSlot(slot.id)}>🗑️</button>
          </div>
        ))}

        {/* Formulario para añadir slot */}
        <div style={s.slotForm}>
          <select
            style={s.select}
            value={newSlotDay}
            onChange={(e) => setNewSlotDay(Number(e.target.value))}
          >
            {DAY_NAMES_ES.map((d, i) => (
              <option key={i} value={i}>{d}</option>
            ))}
          </select>
          <input
            style={s.input}
            type="time"
            value={newSlotStart}
            onChange={(e) => setNewSlotStart(e.target.value)}
          />
          <span style={{ color: 'var(--color-text-muted)' }}>–</span>
          <input
            style={s.input}
            type="time"
            value={newSlotEnd}
            onChange={(e) => setNewSlotEnd(e.target.value)}
          />
          <button style={s.btnPrimary} onClick={handleAddSlot} disabled={addSlot.isPending}>
            + Añadir
          </button>
        </div>
      </div>

      {toast && (
        <div style={{ ...s.toast, background: toast.type === 'ok' ? '#22c55e' : '#ef4444' }}>
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
      <div style={s.section}>
        <h2 style={s.sectionTitle}>Todas las reservas</h2>
        {isLoading && <p style={s.empty}>Cargando...</p>}
        {!isLoading && (!bookings || bookings.length === 0) && (
          <p style={s.empty}>No hay reservas en el sistema.</p>
        )}
        {bookings && bookings.length > 0 && (
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Alumno</th>
                <th style={s.th}>Profesor</th>
                <th style={s.th}>Fecha</th>
                <th style={s.th}>Modo</th>
                <th style={s.th}>Asignatura</th>
                <th style={s.th}>Estado</th>
                <th style={s.th}></th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => {
                const start = new Date(b.startAt);
                const end = new Date(b.endAt);
                return (
                  <tr key={b.id}>
                    <td style={s.td}>{(b as BookingWithRelations & { student?: { name: string } }).student?.name ?? '—'}</td>
                    <td style={s.td}>{b.teacher?.user.name ?? '—'}</td>
                    <td style={s.td}>{formatDate(start)} {formatTime(start)}–{formatTime(end)}</td>
                    <td style={s.td}>{b.mode === 'ONLINE' ? 'Online' : 'Presencial'}</td>
                    <td style={s.td}>{b.course?.title ?? '—'}</td>
                    <td style={s.td}><StatusBadge status={b.status} /></td>
                    <td style={s.td}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {b.mode === 'ONLINE' && b.status === 'CONFIRMED' && b.meetingUrl && (
                          <a href={b.meetingUrl} target="_blank" rel="noreferrer" style={s.btnMeeting}>
                            📹 Sala
                          </a>
                        )}
                        {b.status !== 'CANCELLED' && (
                          <button style={s.btnDanger} onClick={() => handleCancel(b.id)}>Cancelar</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {toast && (
        <div style={{ ...s.toast, background: toast.type === 'ok' ? '#22c55e' : '#ef4444' }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------

export default function BookingsPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div style={s.page}>
      <h1 style={s.title}>Reservas</h1>
      {user?.role === Role.STUDENT && <StudentView />}
      {user?.role === Role.TUTOR   && <TutorView />}
      {user?.role === Role.TEACHER && <TeacherView />}
      {user?.role === Role.ADMIN   && <AdminView />}
    </div>
  );
}
