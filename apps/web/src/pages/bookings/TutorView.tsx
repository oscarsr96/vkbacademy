import React, { useState } from 'react';
import type { TeacherPublic } from '@vkbacademy/shared';
import Icon from '../../components/ui/Icon';
import EmptyState from '../../components/ui/EmptyState';
import type { FreeSlotRaw } from '../../api/bookings.api';
import type { BookingWithRelations } from '../../api/bookings.api';
import {
  useMyBookings,
  useCreateBooking,
  useCancelBooking,
  useTeachers,
  useFreeSlots,
} from '../../hooks/useBookings';
import { useMyStudents, useStudentCourses } from '../../hooks/useTutors';
import {
  DAY_NAMES,
  getWeekStart,
  formatDate,
  formatTime,
  formatShortDate,
  base,
  StatusBadge,
  bookingCardBorder,
} from './bookingsShared';

// ---------------------------------------------------------------------------
// Vista TUTOR — wizard de nueva reserva + lista
// ---------------------------------------------------------------------------

export function TutorView() {
  const { data: bookings, isLoading, isError } = useMyBookings();
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
      <div className="page-hero court-lines sweep-light animate-in">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
          <span style={{ color: 'var(--brand-deep)', display: 'inline-flex' }}>
            <Icon name="calendar" size={32} />
          </span>
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
        {isError && (
          <p style={{ color: '#dc2626', fontSize: '0.9rem' }}>
            Error al cargar las reservas. Inténtalo de nuevo más tarde.
          </p>
        )}
        {!isLoading && !isError && (!bookings || bookings.length === 0) && (
          <EmptyState icon="calendar" title="No hay reservas todavia." />
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
                            ? 'var(--brand-soft)'
                            : 'var(--color-bg)',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          color: isActive ? '#fff' : isDone ? 'var(--color-primary)' : 'var(--color-text-muted)',
                          border: isActive
                            ? 'none'
                            : isDone
                            ? '1.5px solid var(--brand-glow)'
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
                          background: isDone ? 'var(--brand-glow)' : 'var(--color-border)',
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
                        background: selectedTeacher?.id === t.id ? 'var(--brand-faint)' : 'var(--color-surface)',
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
                          background: isSelected ? 'var(--brand-soft)' : 'var(--color-bg)',
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
