import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  adminApi,
  type AnalyticsQueryParams,
  type TimeSeriesPoint,
  type CourseActivity,
  type StudentActivity,
  type TeacherActivity,
  type AtRiskStudent,
  type LowCompletionLesson,
  type BookingHeatmapCell,
  type AdminCertificate,
  type AdminCertificateType,
} from '../../api/admin.api';

// ─── Types ────────────────────────────────────────────────────────────────────

type Granularity = 'day' | 'week' | 'month';
type Preset = '7d' | '30d' | '3m' | '6m' | '1y';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function presetRange(p: Preset): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  if (p === '7d') from.setDate(to.getDate() - 6);
  else if (p === '30d') from.setDate(to.getDate() - 29);
  else if (p === '3m') from.setMonth(to.getMonth() - 3);
  else if (p === '6m') from.setMonth(to.getMonth() - 6);
  else from.setFullYear(to.getFullYear() - 1);
  return { from: fmtDate(from), to: fmtDate(to) };
}

function defaultGran(from: string, to: string): Granularity {
  const days = (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000;
  if (days <= 31) return 'day';
  if (days <= 120) return 'week';
  return 'month';
}

function fmtDateLabel(date: string, gran: Granularity): string {
  if (gran === 'month') {
    const [y, m] = date.split('-');
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${months[parseInt(m, 10) - 1]} ${y.slice(2)}`;
  }
  const d = new Date(date + 'T12:00:00');
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const init = presetRange('30d');
  const [from, setFrom] = useState(init.from);
  const [to, setTo] = useState(init.to);
  const [gran, setGran] = useState<Granularity>('day');
  const [activePreset, setActivePreset] = useState<Preset | ''>('30d');
  const [courseId, setCourseId] = useState('');
  const [schoolYearId, setSchoolYearId] = useState('');

  function applyPreset(p: Preset) {
    const range = presetRange(p);
    setFrom(range.from);
    setTo(range.to);
    setActivePreset(p);
    setGran(defaultGran(range.from, range.to));
  }

  const params: AnalyticsQueryParams = {
    from,
    to,
    granularity: gran,
    ...(courseId ? { courseId } : {}),
    ...(schoolYearId ? { schoolYearId } : {}),
  };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['admin', 'analytics', params],
    queryFn: () => adminApi.getAnalytics(params),
    staleTime: 60_000,
  });

  const { data: schoolYears } = useQuery({
    queryKey: ['school-years'],
    queryFn: adminApi.listSchoolYears,
  });

  const { data: coursesPage } = useQuery({
    queryKey: ['admin', 'courses-all'],
    queryFn: () => adminApi.listCourses({ limit: 200 }),
  });

  const { data: certs = [] } = useQuery({
    queryKey: ['admin', 'certificates'],
    queryFn: adminApi.listCertificates,
    staleTime: 60_000,
  });

  const PRESETS: { key: Preset; label: string }[] = [
    { key: '7d', label: '7 días' },
    { key: '30d', label: '30 días' },
    { key: '3m', label: '3 meses' },
    { key: '6m', label: '6 meses' },
    { key: '1y', label: '1 año' },
  ];

  const kpis = data?.kpis;
  const pendingBookings =
    data?.bookings.byStatus.find((b) => b.status === 'PENDING')?.count ?? 0;

  // Conteo de certificados por tipo
  const certByType = (type: AdminCertificateType) =>
    certs.filter((c) => c.type === type).length;
  const recentCerts = certs.slice(0, 10);

  return (
    <div style={s.page}>
      {/* ── CSS de impresión ── */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-title { display: block !important; }
          body { background: #fff !important; }
          @page { margin: 1.5cm; size: A4 portrait; }
          section { break-inside: avoid; }
          h2 { break-after: avoid; }
        }
        .print-title { display: none; }
      `}</style>

      {/* ── Cabecera ── */}
      <div style={s.pageHeader}>
        <h1 style={s.title}>Panel de administración</h1>
        {isFetching && <span style={s.fetchBadge}>Actualizando…</span>}
        <div style={{ flex: 1 }} />
        <button
          className="no-print"
          style={s.exportBtn}
          onClick={() => window.print()}
        >
          Exportar PDF
        </button>
      </div>
      {/* Título visible solo al imprimir */}
      <div className="print-title" style={{ marginBottom: '0.5rem', fontSize: '0.85rem', color: '#666' }}>
        Período: {from} → {to} · Exportado {new Date().toLocaleDateString('es-ES')}
      </div>

      {/* ── Filtros ── */}
      <div className="no-print" style={s.filterCard}>
        {/* Presets */}
        <div style={s.filterRow}>
          <span style={s.filterLabel}>Período</span>
          <div style={s.presets}>
            {PRESETS.map((p) => (
              <button
                key={p.key}
                style={{ ...s.presetBtn, ...(activePreset === p.key ? s.presetBtnActive : {}) }}
                onClick={() => applyPreset(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div style={s.dateRange}>
            <input
              type="date"
              style={s.dateInput}
              value={from}
              max={to}
              onChange={(e) => { setFrom(e.target.value); setActivePreset(''); }}
            />
            <span style={s.arrow}>→</span>
            <input
              type="date"
              style={s.dateInput}
              value={to}
              min={from}
              onChange={(e) => { setTo(e.target.value); setActivePreset(''); }}
            />
          </div>
        </div>

        {/* Granularidad + Filtros */}
        <div style={s.filterRow}>
          <span style={s.filterLabel}>Agrupación</span>
          <div style={s.granTabs}>
            {(['day', 'week', 'month'] as Granularity[]).map((g) => (
              <button
                key={g}
                style={{ ...s.granBtn, ...(gran === g ? s.granBtnActive : {}) }}
                onClick={() => setGran(g)}
              >
                {{ day: 'Día', week: 'Semana', month: 'Mes' }[g]}
              </button>
            ))}
          </div>
          <select
            style={s.filterSelect}
            value={schoolYearId}
            onChange={(e) => { setSchoolYearId(e.target.value); if (e.target.value) setCourseId(''); }}
          >
            <option value="">Todos los niveles</option>
            {schoolYears?.map((sy) => (
              <option key={sy.id} value={sy.id}>{sy.label}</option>
            ))}
          </select>
          <select
            style={s.filterSelect}
            value={courseId}
            onChange={(e) => { setCourseId(e.target.value); if (e.target.value) setSchoolYearId(''); }}
          >
            <option value="">Todos los cursos</option>
            {coursesPage?.data.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading && <p style={s.loading}>Cargando estadísticas…</p>}

      {kpis && (
        <>
          {/* ── KPIs ── */}
          <div style={s.kpiGrid}>
            <KpiCard label="Nuevos alumnos" value={kpis.newUsers} color="#6366f1" icon="👤" />
            <KpiCard label="Matrículas" value={kpis.newEnrollments} color="#06b6d4" icon="📋" />
            <KpiCard label="Lecciones completadas" value={kpis.completedLessons} color="#10b981" icon="✅" />
            <KpiCard label="Intentos de quiz" value={kpis.quizAttempts} color="#8b5cf6" icon="🧠" />
            <KpiCard label="Score medio" value={`${kpis.avgQuizScore}%`} color="#f97316" icon="⭐" />
            <KpiCard label="Reservas creadas" value={kpis.newBookings} color="var(--color-primary)" icon="📅" />
            <KpiCard label="Confirmadas" value={kpis.confirmedBookings} color="#10b981" icon="✔️" />
            <KpiCard label="Canceladas" value={kpis.cancelledBookings} color="#ef4444" icon="❌" />
            <KpiCard label="Certificados emitidos" value={certs.length} color="#7c3aed" icon="📜" subtitle="Total histórico" />
            <KpiCard label="Cursos completados" value={certByType('COURSE_COMPLETION')} color="#0891b2" icon="🏆" subtitle="Certificados" />
          </div>

          {/* ── Gráfico de actividad ── */}
          <section style={s.section}>
            <h2 style={s.sectionTitle}>Actividad en el tiempo</h2>
            <div style={s.chartCard}>
              <MultiLineChart
                data={data.timeSeries}
                gran={gran}
                series={[
                  { key: 'completedLessons', label: 'Lecciones completadas', color: '#10b981' },
                  { key: 'quizAttempts', label: 'Intentos de quiz', color: '#8b5cf6' },
                  { key: 'newBookings', label: 'Reservas', color: '#f59e0b' },
                  { key: 'newUsers', label: 'Nuevos alumnos', color: '#6366f1' },
                ]}
              />
            </div>
          </section>

          {/* ── Rankings ── */}
          <div style={s.twoCol}>
            <section style={s.section}>
              <h2 style={s.sectionTitle}>Cursos más activos</h2>
              <div style={s.rankCard}>
                {data.topCourses.length === 0 ? (
                  <p style={s.empty}>Sin datos para el período</p>
                ) : (
                  data.topCourses.map((c, i) => (
                    <CourseBar key={c.courseId} rank={i + 1} course={c} max={data.topCourses[0].enrollments} />
                  ))
                )}
              </div>
            </section>

            <section style={s.section}>
              <h2 style={s.sectionTitle}>Alumnos más activos</h2>
              <div style={s.rankCard}>
                {data.topStudents.length === 0 ? (
                  <p style={s.empty}>Sin datos para el período</p>
                ) : (
                  data.topStudents.map((st, i) => (
                    <StudentBar key={st.studentId} rank={i + 1} student={st} max={data.topStudents[0].completedLessons} />
                  ))
                )}
              </div>
            </section>
          </div>

          {/* ── Desglose de reservas ── */}
          <section style={s.section}>
            <h2 style={s.sectionTitle}>Desglose de reservas</h2>
            <div style={s.twoCol}>
              <div style={s.rankCard}>
                <p style={s.cardSubtitle}>Por estado</p>
                {data.bookings.byStatus.length === 0
                  ? <p style={s.empty}>Sin reservas</p>
                  : data.bookings.byStatus.map((b) => {
                    const labels: Record<string, string> = { CONFIRMED: 'Confirmadas', PENDING: 'Pendientes', CANCELLED: 'Canceladas' };
                    const colors: Record<string, string> = { CONFIRMED: '#10b981', PENDING: '#f59e0b', CANCELLED: '#ef4444' };
                    const max = Math.max(...data.bookings.byStatus.map((x) => x.count), 1);
                    return (
                      <HorizBar
                        key={b.status}
                        label={labels[b.status] ?? b.status}
                        value={b.count}
                        max={max}
                        unit="reservas"
                        color={colors[b.status] ?? '#6366f1'}
                      />
                    );
                  })
                }
                {data.bookings.byStatus.length > 0 && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.75rem' }}>
                    {pendingBookings > 0 && `⚠️ ${pendingBookings} pendiente${pendingBookings !== 1 ? 's' : ''} sin confirmar`}
                  </p>
                )}
              </div>
              <div style={s.rankCard}>
                <p style={s.cardSubtitle}>Por modalidad</p>
                {data.bookings.byMode.length === 0
                  ? <p style={s.empty}>Sin reservas</p>
                  : data.bookings.byMode.map((b) => {
                    const labels: Record<string, string> = { IN_PERSON: 'Presencial', ONLINE: 'Online' };
                    const colors: Record<string, string> = { IN_PERSON: '#6366f1', ONLINE: '#f97316' };
                    const max = Math.max(...data.bookings.byMode.map((x) => x.count), 1);
                    return (
                      <HorizBar
                        key={b.mode}
                        label={labels[b.mode] ?? b.mode}
                        value={b.count}
                        max={max}
                        unit="reservas"
                        color={colors[b.mode] ?? '#6366f1'}
                      />
                    );
                  })
                }
              </div>
            </div>
          </section>

          {/* ── Profesores ── */}
          <section style={s.section}>
            <h2 style={s.sectionTitle}>Actividad de profesores</h2>

            {/* Resumen en 3 mini-KPIs */}
            <div style={s.teacherSummary}>
              <div style={s.teacherKpi}>
                <span style={s.teacherKpiValue}>{data.teachers.summary.activeTeachers}</span>
                <span style={s.teacherKpiLabel}>Profesores activos</span>
              </div>
              <div style={s.teacherKpiDivider} />
              <div style={s.teacherKpi}>
                <span style={s.teacherKpiValue}>{data.teachers.summary.totalConfirmedSessions}</span>
                <span style={s.teacherKpiLabel}>Sesiones confirmadas</span>
              </div>
              <div style={s.teacherKpiDivider} />
              <div style={s.teacherKpi}>
                <span style={s.teacherKpiValue}>{data.teachers.summary.totalHoursTaught}h</span>
                <span style={s.teacherKpiLabel}>Horas impartidas</span>
              </div>
            </div>

            {/* Lista de profesores */}
            {data.teachers.top.length === 0 ? (
              <div style={s.rankCard}>
                <p style={s.empty}>Sin actividad de profesores en el período</p>
              </div>
            ) : (
              <div style={s.teacherList}>
                {data.teachers.top.map((t, i) => (
                  <TeacherRow key={t.teacherId} rank={i + 1} teacher={t} />
                ))}
              </div>
            )}
          </section>

          {/* ── Distribución de scores + Lecciones menos completadas ── */}
          <div style={s.twoCol}>
            <section style={s.section}>
              <h2 style={s.sectionTitle}>Distribución de scores de quiz</h2>
              <div style={s.rankCard}>
                {data.insights.scoreDistribution.every((b) => b.count === 0) ? (
                  <p style={s.empty}>Sin intentos en el período</p>
                ) : (
                  <>
                    {data.insights.scoreDistribution.map((b) => {
                      const colors = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981'];
                      const idx = data.insights.scoreDistribution.indexOf(b);
                      const max = Math.max(...data.insights.scoreDistribution.map((x) => x.count), 1);
                      return (
                        <HorizBar
                          key={b.bucket}
                          label={b.bucket}
                          value={b.count}
                          max={max}
                          unit="intentos"
                          color={colors[idx]}
                        />
                      );
                    })}
                    <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
                      Total: {data.insights.scoreDistribution.reduce((a, b) => a + b.count, 0)} intentos en el período
                    </p>
                  </>
                )}
              </div>
            </section>

            <section style={s.section}>
              <h2 style={s.sectionTitle}>Lecciones con menos completados</h2>
              <div style={s.rankCard}>
                {data.insights.lowCompletionLessons.length === 0 ? (
                  <p style={s.empty}>Sin datos en el período</p>
                ) : (
                  data.insights.lowCompletionLessons.map((l) => (
                    <LowCompletionRow key={l.lessonId} lesson={l} />
                  ))
                )}
              </div>
            </section>
          </div>

          {/* ── Heatmap de reservas ── */}
          <section style={s.section}>
            <h2 style={s.sectionTitle}>
              Heatmap de reservas por hora
              {data.insights.avgBookingLeadDays > 0 && (
                <span style={s.leadTimeBadge}>
                  Antelación media: {data.insights.avgBookingLeadDays} días
                </span>
              )}
            </h2>
            <div style={s.chartCard}>
              {data.insights.bookingHeatmap.length === 0 ? (
                <p style={s.empty}>Sin reservas en el período</p>
              ) : (
                <BookingHeatmap data={data.insights.bookingHeatmap} />
              )}
            </div>
          </section>

          {/* ── Alumnos en riesgo ── */}
          {data.insights.atRiskStudents.length > 0 && (
            <section style={s.section}>
              <h2 style={s.sectionTitle}>
                Alumnos en riesgo de abandono
                <span style={{ ...s.leadTimeBadge, background: '#fef2f2', color: '#ef4444', borderColor: '#fecaca' }}>
                  Sin actividad en 14+ días
                </span>
              </h2>
              <div style={s.rankCard}>
                {data.insights.atRiskStudents.map((st) => (
                  <AtRiskRow key={st.studentId} student={st} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* ── Certificados emitidos ── */}
      <section style={s.section}>
        <h2 style={s.sectionTitle}>Certificados emitidos</h2>

        {/* Mini-KPIs por tipo */}
        <div style={s.certTypeGrid}>
          <CertTypeKpi
            icon="🏅"
            label="Módulo completado"
            count={certByType('MODULE_COMPLETION')}
            color="#10b981"
          />
          <CertTypeKpi
            icon="🏆"
            label="Curso completado"
            count={certByType('COURSE_COMPLETION')}
            color="#0891b2"
          />
          <CertTypeKpi
            icon="📝"
            label="Examen de módulo"
            count={certByType('MODULE_EXAM')}
            color="#8b5cf6"
          />
          <CertTypeKpi
            icon="🎓"
            label="Examen de curso"
            count={certByType('COURSE_EXAM')}
            color="#f97316"
          />
        </div>

        {/* Tabla de últimos certificados */}
        <div style={s.rankCard}>
          {certs.length === 0 ? (
            <p style={s.empty}>Aún no se han emitido certificados</p>
          ) : (
            <>
              {recentCerts.map((c) => (
                <CertRow key={c.id} cert={c} />
              ))}
              {certs.length > 10 && (
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.5rem', textAlign: 'center' as const }}>
                  Mostrando los 10 más recientes de {certs.length} totales
                </p>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, color, icon, subtitle }: {
  label: string;
  value: number | string;
  color: string;
  icon: string;
  subtitle?: string;
}) {
  return (
    <div style={s.kpiCard}>
      <div style={{ ...s.kpiAccent, background: color }} />
      <div style={s.kpiBody}>
        <span style={s.kpiIcon}>{icon}</span>
        <div style={{ ...s.kpiValue, color }}>{value}</div>
        <div style={s.kpiLabel}>{label}</div>
        {subtitle && (
          <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{subtitle}</div>
        )}
      </div>
    </div>
  );
}

// ─── Horizontal Bar ───────────────────────────────────────────────────────────

function HorizBar({ label, value, max, unit, color }: {
  label: string;
  value: number;
  max: number;
  unit: string;
  color: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ marginBottom: '0.875rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
        <span style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>{label}</span>
        <span style={{ fontSize: '0.82rem', fontWeight: 700, color }}>
          {value} <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>{unit}</span>
        </span>
      </div>
      <div style={{ height: 7, background: 'var(--color-border)', borderRadius: 4 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  );
}

// ─── Course Bar ───────────────────────────────────────────────────────────────

function CourseBar({ rank, course, max }: { rank: number; course: CourseActivity; max: number }) {
  const pct = max > 0 ? (course.enrollments / max) * 100 : 0;
  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.25rem' }}>
        <span style={s.rank}>{rank}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {course.title}
          </span>
          {course.schoolYear && (
            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{course.schoolYear}</span>
          )}
        </div>
        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#06b6d4', whiteSpace: 'nowrap' }}>
          {course.enrollments} <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>matrículas</span>
        </span>
      </div>
      <div style={{ height: 6, background: 'var(--color-border)', borderRadius: 3 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: '#06b6d4', borderRadius: 3, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  );
}

// ─── Student Bar ──────────────────────────────────────────────────────────────

function StudentBar({ rank, student, max }: { rank: number; student: StudentActivity; max: number }) {
  const pct = max > 0 ? (student.completedLessons / max) * 100 : 0;
  const initials = student.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
        <span style={s.rank}>{rank}</span>
        <div style={{ ...s.miniAvatar }}>{initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {student.name}
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{student.email}</span>
        </div>
        <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#10b981' }}>
            {student.completedLessons} <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>lecc.</span>
          </div>
          {student.avgScore > 0 && (
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>⭐ {student.avgScore}%</div>
          )}
        </div>
      </div>
      <div style={{ height: 6, background: 'var(--color-border)', borderRadius: 3 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: '#10b981', borderRadius: 3, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  );
}

// ─── Low Completion Lesson Row ────────────────────────────────────────────────

function LowCompletionRow({ lesson }: { lesson: LowCompletionLesson }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', paddingBottom: '0.75rem', marginBottom: '0.75rem', borderBottom: '1px solid var(--color-border)' }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', flexShrink: 0, marginTop: '0.35rem' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {lesson.title}
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {lesson.courseTitle} › {lesson.moduleTitle}
        </div>
      </div>
      <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f59e0b' }}>{lesson.completedCount}</span>
        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}> alumnos</span>
      </div>
    </div>
  );
}

// ─── Booking Heatmap ──────────────────────────────────────────────────────────

function BookingHeatmap({ data }: { data: BookingHeatmapCell[] }) {
  // Horas visibles: 7–22 (horario habitual)
  const hours = Array.from({ length: 16 }, (_, i) => i + 7);
  // Días: 0=Dom en JS → reordenamos Lun(1)…Dom(0)
  const dayOrder = [1, 2, 3, 4, 5, 6, 0];
  const dayLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  const heatmapMap = new Map(data.map((c) => [`${c.day}-${c.hour}`, c.count]));
  const maxCount = Math.max(...data.map((c) => c.count), 1);

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'inline-grid', gridTemplateColumns: `44px repeat(${hours.length}, 30px)`, gap: 3, minWidth: 0 }}>
        {/* Cabecera horas */}
        <div />
        {hours.map((h) => (
          <div key={h} style={{ textAlign: 'center' as const, fontSize: '0.6rem', color: 'var(--color-text-muted)', paddingBottom: 3 }}>
            {h}h
          </div>
        ))}
        {/* Filas por día */}
        {dayOrder.map((jsDay, i) => (
          <React.Fragment key={jsDay}>
            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', paddingRight: 4 }}>
              {dayLabels[i]}
            </div>
            {hours.map((h) => {
              const count = heatmapMap.get(`${jsDay}-${h}`) ?? 0;
              const intensity = count / maxCount;
              return (
                <div
                  key={h}
                  title={`${dayLabels[i]} ${h}:00 — ${count} reserva${count !== 1 ? 's' : ''}`}
                  style={{
                    height: 22,
                    borderRadius: 3,
                    background:
                      count === 0
                        ? 'var(--color-border)'
                        : `rgba(249, 115, 22, ${0.12 + intensity * 0.88})`,
                    transition: 'background 0.3s',
                    cursor: count > 0 ? 'default' : undefined,
                  }}
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>
      {/* Leyenda */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.75rem', fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>
        <span>Menos</span>
        {[0.1, 0.3, 0.55, 0.75, 1].map((op) => (
          <div key={op} style={{ width: 14, height: 14, borderRadius: 2, background: `rgba(249, 115, 22, ${op})` }} />
        ))}
        <span>Más</span>
      </div>
    </div>
  );
}

// ─── At-risk Student Row ──────────────────────────────────────────────────────

function AtRiskRow({ student }: { student: AtRiskStudent }) {
  const days = student.daysSinceLastActivity;
  const color = days === null ? '#ef4444' : days >= 30 ? '#ef4444' : '#f97316';
  const label = days === null ? 'Sin actividad nunca' : `${days} días sin actividad`;
  const initials = student.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', paddingBottom: '0.6rem', marginBottom: '0.6rem', borderBottom: '1px solid var(--color-border)' }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: color, color: '#fff', fontSize: '0.65rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {student.name}
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {student.email}
        </div>
      </div>
      <span style={{ fontSize: '0.75rem', fontWeight: 700, color, background: `${color}1a`, padding: '2px 8px', borderRadius: 10, flexShrink: 0 }}>
        {label}
      </span>
    </div>
  );
}

// ─── Teacher Row ──────────────────────────────────────────────────────────────

function TeacherRow({ rank, teacher }: { rank: number; teacher: TeacherActivity }) {
  const initials = teacher.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  const total = teacher.confirmed + teacher.pending + teacher.cancelled;
  const confirmedPct = total > 0 ? (teacher.confirmed / total) * 100 : 0;
  const pendingPct = total > 0 ? (teacher.pending / total) * 100 : 0;
  const cancelledPct = total > 0 ? (teacher.cancelled / total) * 100 : 0;

  return (
    <div style={s.teacherRow}>
      {/* Cabecera: avatar + nombre + métricas rápidas */}
      <div style={s.teacherRowHeader}>
        <span style={s.rank}>{rank}</span>
        <div style={{ ...s.miniAvatar, background: '#f97316' }}>{initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {teacher.name}
          </span>
          <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
            {teacher.email}
          </span>
        </div>
        {/* Horas */}
        <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
          <div style={{ fontSize: '1rem', fontWeight: 800, color: '#f97316', lineHeight: 1 }}>
            {teacher.hoursTaught}h
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>impartidas</div>
        </div>
      </div>

      {/* Barra de sesiones por estado */}
      <div style={s.teacherRowBars}>
        {/* Barra compuesta confirmadas / pendientes / canceladas */}
        <div style={{ marginBottom: '0.6rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', gap: '0.5rem', flexWrap: 'wrap' as const }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
              <strong style={{ color: '#10b981' }}>{teacher.confirmed}</strong> confirmadas ·{' '}
              <strong style={{ color: '#f59e0b' }}>{teacher.pending}</strong> pendientes ·{' '}
              <strong style={{ color: '#ef4444' }}>{teacher.cancelled}</strong> canceladas
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
              {teacher.online > 0 && `${teacher.online} online`}
              {teacher.online > 0 && teacher.inPerson > 0 && ' · '}
              {teacher.inPerson > 0 && `${teacher.inPerson} presencial`}
            </span>
          </div>
          {/* Barra compuesta */}
          <div style={{ height: 8, background: 'var(--color-border)', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
            <div style={{ width: `${confirmedPct}%`, background: '#10b981', transition: 'width 0.4s ease' }} />
            <div style={{ width: `${pendingPct}%`, background: '#f59e0b', transition: 'width 0.4s ease' }} />
            <div style={{ width: `${cancelledPct}%`, background: '#ef4444', transition: 'width 0.4s ease' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Multi-line SVG Chart ─────────────────────────────────────────────────────

interface SeriesCfg {
  key: keyof TimeSeriesPoint;
  label: string;
  color: string;
}

function MultiLineChart({ data, series, gran }: {
  data: TimeSeriesPoint[];
  series: SeriesCfg[];
  gran: Granularity;
}) {
  const W = 720;
  const H = 220;
  const PAD = { top: 16, right: 16, bottom: 44, left: 42 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  if (data.length === 0) {
    return <p style={{ padding: '3rem', textAlign: 'center' as const, color: 'var(--color-text-muted)' }}>Sin actividad en el período</p>;
  }

  const allVals = series.flatMap((s) => data.map((d) => Number(d[s.key]) || 0));
  const maxVal = Math.max(...allVals, 1);

  const xOf = (i: number) =>
    PAD.left + (data.length > 1 ? (i / (data.length - 1)) * innerW : innerW / 2);
  const yOf = (v: number) => PAD.top + (1 - v / maxVal) * innerH;

  // Y ticks: 5 steps
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    y: yOf(t * maxVal),
    label: Math.round(t * maxVal),
  }));

  // Show at most 8 X labels
  const step = Math.max(1, Math.ceil(data.length / 8));

  return (
    <div>
      <svg
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        style={{ display: 'block', overflow: 'visible' }}
      >
        {/* Grid lines */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line
              x1={PAD.left} y1={t.y} x2={W - PAD.right} y2={t.y}
              stroke="var(--color-border)" strokeWidth={1}
            />
            <text
              x={PAD.left - 6} y={t.y + 4}
              textAnchor="end" fontSize={11}
              fill="currentColor" opacity={0.45}
            >
              {t.label}
            </text>
          </g>
        ))}

        {/* X axis labels */}
        {data.map((d, i) =>
          i % step === 0 ? (
            <text
              key={i}
              x={xOf(i)} y={H - 8}
              textAnchor="middle" fontSize={10}
              fill="currentColor" opacity={0.5}
            >
              {fmtDateLabel(d.date, gran)}
            </text>
          ) : null,
        )}

        {/* Lines + area fills */}
        {series.map((ser) => {
          const pts = data.map((d, i) => ({
            x: xOf(i),
            y: yOf(Number(d[ser.key]) || 0),
          }));
          const linePath = pts
            .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
            .join(' ');
          const areaPath = `${linePath} L${pts[pts.length - 1].x.toFixed(1)},${(PAD.top + innerH).toFixed(1)} L${pts[0].x.toFixed(1)},${(PAD.top + innerH).toFixed(1)} Z`;
          const gid = `grad-${ser.key as string}`;
          return (
            <g key={ser.key as string}>
              <defs>
                <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ser.color} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={ser.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <path d={areaPath} fill={`url(#${gid})`} />
              <path d={linePath} fill="none" stroke={ser.color} strokeWidth={2} strokeLinejoin="round" />
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' as const, marginTop: '0.25rem', paddingLeft: PAD.left }}>
        {series.map((ser) => (
          <div key={ser.key as string} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <div style={{ width: 18, height: 3, background: ser.color, borderRadius: 2 }} />
            <span style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)' }}>{ser.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Cert Type KPI ────────────────────────────────────────────────────────────

function CertTypeKpi({ icon, label, count, color }: {
  icon: string;
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 10,
      padding: '0.875rem 1rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
    }}>
      <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>{icon}</span>
      <div>
        <div style={{ fontSize: '1.5rem', fontWeight: 800, color, lineHeight: 1 }}>{count}</div>
        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 500, marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

// ─── Cert Row ─────────────────────────────────────────────────────────────────

const CERT_META: Record<string, { icon: string; label: string; color: string }> = {
  MODULE_COMPLETION: { icon: '🏅', label: 'Módulo completado', color: '#10b981' },
  COURSE_COMPLETION: { icon: '🏆', label: 'Curso completado', color: '#0891b2' },
  MODULE_EXAM:       { icon: '📝', label: 'Examen de módulo', color: '#8b5cf6' },
  COURSE_EXAM:       { icon: '🎓', label: 'Examen de curso',  color: '#f97316' },
};

function CertRow({ cert }: { cert: AdminCertificate }) {
  const meta = CERT_META[cert.type] ?? { icon: '📜', label: cert.type, color: '#6366f1' };
  const initials = cert.recipientName.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  const date = new Date(cert.issuedAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingBottom: '0.75rem', marginBottom: '0.75rem', borderBottom: '1px solid var(--color-border)' }}>
      {/* Avatar */}
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: meta.color, color: '#fff', fontSize: '0.7rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {initials}
      </div>
      {/* Alumno */}
      <div style={{ flex: '0 0 160px', minWidth: 0 }}>
        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {cert.recipientName}
        </div>
        <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {cert.recipientEmail}
        </div>
      </div>
      {/* Tipo */}
      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: meta.color, background: `${meta.color}18`, padding: '2px 8px', borderRadius: 8, flexShrink: 0 }}>
        {meta.icon} {meta.label}
      </span>
      {/* Scope */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.82rem', color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {cert.scopeTitle}
        </div>
        {cert.courseTitle && (
          <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {cert.courseTitle}
          </div>
        )}
      </div>
      {/* Score (si es de examen) */}
      {cert.examScore !== null && (
        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: cert.examScore >= 50 ? '#10b981' : '#ef4444', flexShrink: 0 }}>
          {cert.examScore}%
        </span>
      )}
      {/* Fecha */}
      <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', flexShrink: 0 }}>
        {date}
      </span>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page: { padding: '2rem', maxWidth: 1100, margin: '0 auto' },
  pageHeader: { display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' },
  title: { fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 },
  fetchBadge: { fontSize: '0.75rem', color: 'var(--color-text-muted)', background: 'var(--color-border)', padding: '2px 8px', borderRadius: 12 },

  // ── Filter card
  filterCard: { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column' as const, gap: '0.75rem' },
  filterRow: { display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' as const },
  filterLabel: { fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.05em', width: 76, flexShrink: 0 },
  presets: { display: 'flex', gap: '0.35rem' },
  presetBtn: { padding: '0.3rem 0.65rem', borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 500 },
  presetBtnActive: { background: 'var(--color-primary)', color: '#fff', borderColor: 'var(--color-primary)' },
  dateRange: { display: 'flex', alignItems: 'center', gap: '0.4rem' },
  dateInput: { padding: '0.3rem 0.5rem', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: '0.82rem', background: 'var(--color-bg)', color: 'var(--color-text)' },
  arrow: { color: 'var(--color-text-muted)', fontSize: '0.8rem' },
  granTabs: { display: 'flex', border: '1px solid var(--color-border)', borderRadius: 6, overflow: 'hidden' },
  granBtn: { padding: '0.3rem 0.7rem', border: 'none', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 500, borderRight: '1px solid var(--color-border)' },
  granBtnActive: { background: 'var(--color-primary)', color: '#fff' },
  filterSelect: { padding: '0.3rem 0.6rem', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: '0.82rem', background: 'var(--color-bg)', color: 'var(--color-text)' },

  // ── KPI grid
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '0.875rem', marginBottom: '1.75rem' },
  kpiCard: { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column' as const },
  kpiAccent: { height: 4 },
  kpiBody: { padding: '1rem 1.1rem' },
  kpiIcon: { fontSize: '1.1rem', display: 'block', marginBottom: '0.4rem' },
  kpiValue: { fontSize: '1.875rem', fontWeight: 800, lineHeight: 1, marginBottom: 3 },
  kpiLabel: { fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 },

  // ── Sections
  section: { marginBottom: '1.5rem' },
  sectionTitle: { fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '0.6rem' },
  chartCard: { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '1.25rem' },
  rankCard: { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '1.25rem' },
  cardSubtitle: { fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: '0.875rem', marginTop: 0 },
  twoCol: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' },

  // ── Misc
  rank: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: '50%', background: 'var(--color-border)', fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', flexShrink: 0 },
  miniAvatar: { width: 28, height: 28, borderRadius: '50%', background: '#10b981', color: '#fff', fontSize: '0.65rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  loading: { textAlign: 'center' as const, color: 'var(--color-text-muted)', padding: '3rem' },
  empty: { color: 'var(--color-text-muted)', fontSize: '0.85rem', textAlign: 'center' as const, padding: '1rem 0' },

  // ── Header
  exportBtn: { padding: '0.45rem 1rem', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 },

  // ── Insights
  leadTimeBadge: { marginLeft: '0.6rem', fontSize: '0.7rem', fontWeight: 600, background: 'var(--color-border)', color: 'var(--color-text-muted)', padding: '2px 8px', borderRadius: 10, border: '1px solid var(--color-border)', verticalAlign: 'middle' as const },

  // ── Certificates section
  certTypeGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '0.875rem' },

  // ── Teacher section
  teacherSummary: { display: 'flex', alignItems: 'center', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '1rem 1.5rem', marginBottom: '0.875rem', gap: 0 },
  teacherKpi: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', flex: 1, gap: '0.2rem' },
  teacherKpiValue: { fontSize: '1.75rem', fontWeight: 800, color: '#f97316', lineHeight: 1 },
  teacherKpiLabel: { fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.04em', fontWeight: 600 },
  teacherKpiDivider: { width: 1, height: 40, background: 'var(--color-border)', flexShrink: 0, margin: '0 1rem' },
  teacherList: { display: 'flex', flexDirection: 'column' as const, gap: '0.625rem' },
  teacherRow: { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '0.875rem 1.1rem' },
  teacherRowHeader: { display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem' },
  teacherRowBars: {},
};
