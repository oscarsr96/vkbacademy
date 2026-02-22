import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tutorsApi, type StudentSummary, type StudentStats, type ActivityDay } from '../api/tutors.api';

// ─── Constantes ────────────────────────────────────────────────────────────────

const ORANGE = '#ea580c';
const NAVY = '#0d1b2a';

const PERIODS = [
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: 'Todo', days: 0 },
] as const;

const CERT_LABELS: Record<string, string> = {
  MODULE_COMPLETION: 'Módulo completado',
  COURSE_COMPLETION: 'Curso completado',
  MODULE_EXAM: 'Examen de módulo',
  COURSE_EXAM: 'Examen de curso',
};

// ─── Estilos ───────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  shell: { display: 'flex', height: '100%', minHeight: '100vh', background: '#f8fafc' },

  // Panel lateral de alumnos
  sidebar: {
    width: 260,
    flexShrink: 0,
    borderRight: '1px solid #e2e8f0',
    background: '#fff',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  sidebarHeader: {
    padding: '1.25rem 1rem 0.75rem',
    borderBottom: '1px solid #e2e8f0',
  },
  sidebarTitle: { fontSize: '1rem', fontWeight: 800, color: NAVY, margin: 0 },
  sidebarSubtitle: { fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 },
  studentList: { flex: 1, overflowY: 'auto' as const },
  studentItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    cursor: 'pointer',
    borderBottom: '1px solid #f1f5f9',
    transition: 'background 0.1s',
  },
  studentItemActive: { background: '#fff7ed', borderRight: `3px solid ${ORANGE}` },
  studentAvatar: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    background: ORANGE,
    color: '#fff',
    fontWeight: 700,
    fontSize: '0.9rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  studentName: { fontSize: '0.85rem', fontWeight: 600, color: '#0f172a', lineHeight: 1.2 },
  studentLevel: { fontSize: '0.7rem', color: '#64748b', marginTop: 2 },
  studentPts: { fontSize: '0.7rem', color: ORANGE, fontWeight: 700 },

  // Panel de detalle
  detail: { flex: 1, overflowY: 'auto' as const, padding: '1.5rem 2rem' },
  empty: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#94a3b8',
    gap: 12,
    padding: '4rem',
  },

  // Cabecera del alumno seleccionado
  studentHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    background: NAVY,
    borderRadius: 14,
    padding: '1.25rem 1.5rem',
    marginBottom: '1.25rem',
    color: '#fff',
  },
  bigAvatar: {
    width: 56,
    height: 56,
    borderRadius: '50%',
    background: ORANGE,
    color: '#fff',
    fontWeight: 800,
    fontSize: '1.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  studentHeaderInfo: { flex: 1 },
  studentHeaderName: { fontSize: '1.2rem', fontWeight: 800, marginBottom: 2 },
  studentHeaderMeta: { fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 },
  streakBadge: {
    background: 'rgba(234,88,12,0.25)',
    border: '1px solid rgba(234,88,12,0.4)',
    color: '#fdba74',
    padding: '4px 12px',
    borderRadius: 999,
    fontSize: '0.8rem',
    fontWeight: 700,
  },

  // Selector de período
  periodRow: {
    display: 'flex',
    gap: 6,
    marginBottom: '1.25rem',
    alignItems: 'center',
  },
  periodLabel: { fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', marginRight: 4 },
  periodBtn: {
    padding: '5px 14px',
    borderRadius: 999,
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.78rem',
    fontWeight: 700,
    transition: 'background 0.15s, color 0.15s',
  },

  // KPI grid
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 10,
    marginBottom: '1.25rem',
  },
  kpiCard: {
    background: '#fff',
    borderRadius: 12,
    border: '1px solid #e2e8f0',
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  kpiEmoji: { fontSize: '1.4rem', lineHeight: 1 },
  kpiValue: { fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.1 },
  kpiLabel: { fontSize: '0.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.04em' },
  kpiSub: { fontSize: '0.72rem', color: '#94a3b8', marginTop: 2 },

  // Secciones
  section: { marginBottom: '1.25rem' },
  sectionTitle: {
    fontSize: '0.8rem',
    fontWeight: 700,
    color: '#94a3b8',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    marginBottom: '0.75rem',
  },
  card: {
    background: '#fff',
    borderRadius: 12,
    border: '1px solid #e2e8f0',
    padding: '1rem 1.25rem',
    marginBottom: 8,
  },

  // Barras de progreso
  progressBarWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  progressBar: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    background: '#f1f5f9',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    background: ORANGE,
    transition: 'width 0.4s',
  },
  progressPct: { fontSize: '0.75rem', fontWeight: 700, color: '#475569', minWidth: 32, textAlign: 'right' as const },
};

// ─── Mini gráfico de actividad (SVG) ──────────────────────────────────────────

function ActivityChart({ activity, days }: { activity: ActivityDay[]; days: number }) {
  // Generar todos los días del rango
  const today = new Date();
  const numDays = days > 0 ? days : Math.min(activity.length > 0 ? 30 : 30, 60);
  const start = new Date(today);
  start.setDate(start.getDate() - numDays + 1);

  const dateRange: string[] = [];
  for (let i = 0; i < numDays; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    dateRange.push(d.toISOString().split('T')[0]);
  }

  const actMap = new Map(activity.map((a) => [a.date, a]));
  const maxVal = Math.max(...dateRange.map((d) => (actMap.get(d)?.lessons ?? 0) + (actMap.get(d)?.quizzes ?? 0)), 1);

  const W = 580;
  const H = 80;
  const barW = Math.max(2, Math.floor((W - numDays) / numDays));
  const gap = Math.floor((W - numDays * barW) / (numDays - 1));

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1rem 1.25rem' }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8 }}>
        Actividad diaria (lecciones + quizzes)
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        {dateRange.map((date, i) => {
          const entry = actMap.get(date);
          const lessons = entry?.lessons ?? 0;
          const quizzes = entry?.quizzes ?? 0;
          const total = lessons + quizzes;
          const heightPct = total / maxVal;
          const barH = Math.max(total > 0 ? 2 : 0, Math.round(heightPct * (H - 4)));
          const x = i * (barW + gap);
          const lessonH = total > 0 ? Math.round((lessons / total) * barH) : 0;
          const quizH = barH - lessonH;

          return (
            <g key={date}>
              {/* Barra de quizzes (arriba, color más claro) */}
              {quizH > 0 && (
                <rect x={x} y={H - barH} width={barW} height={quizH} rx={1} fill="#fbbf24" opacity={0.8} />
              )}
              {/* Barra de lecciones (abajo, naranja) */}
              {lessonH > 0 && (
                <rect x={x} y={H - lessonH} width={barW} height={lessonH} rx={1} fill={ORANGE} />
              )}
            </g>
          );
        })}
      </svg>
      <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: '0.72rem', color: '#64748b' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: ORANGE, display: 'inline-block' }} />
          Lecciones
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#fbbf24', display: 'inline-block' }} />
          Quizzes
        </span>
      </div>
    </div>
  );
}

// ─── Hooks ─────────────────────────────────────────────────────────────────────

function useMyStudents() {
  return useQuery({
    queryKey: ['tutor', 'students'],
    queryFn: tutorsApi.getMyStudents,
  });
}

function useStudentStats(studentId: string | null, from?: string, to?: string) {
  return useQuery({
    queryKey: ['tutor', 'stats', studentId, from, to],
    queryFn: () => tutorsApi.getStudentStats(studentId!, from, to),
    enabled: !!studentId,
  });
}

// ─── Componente: panel de detalle del alumno ───────────────────────────────────

function StudentDetail({ student, periodDays }: { student: StudentSummary; periodDays: number }) {
  const now = new Date();
  const from = periodDays > 0
    ? new Date(now.getTime() - periodDays * 86400000).toISOString()
    : undefined;
  const to = periodDays > 0 ? now.toISOString() : undefined;

  const { data: stats, isLoading } = useStudentStats(student.id, from, to);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#94a3b8' }}>
        Cargando métricas...
      </div>
    );
  }

  if (!stats) return null;

  const { lessons, quizzes, exams, certificates, sessions } = stats;
  const memberSince = new Date(stats.student.createdAt).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <>
      {/* Cabecera */}
      <div style={S.studentHeader}>
        <div style={S.bigAvatar}>{stats.student.name.charAt(0).toUpperCase()}</div>
        <div style={S.studentHeaderInfo}>
          <div style={S.studentHeaderName}>{stats.student.name}</div>
          <div style={S.studentHeaderMeta}>
            {stats.student.email}
            {stats.student.schoolYear && ` · ${stats.student.schoolYear.label}`}
            {` · Miembro desde ${memberSince}`}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
          <span style={S.streakBadge}>🔥 {stats.student.currentStreak} sem. racha</span>
          <span style={{ ...S.streakBadge, background: 'rgba(99,102,241,0.2)', borderColor: 'rgba(99,102,241,0.4)', color: '#a5b4fc' }}>
            🏆 {stats.student.totalPoints} pts
          </span>
        </div>
      </div>

      {/* KPI Grid */}
      <div style={S.kpiGrid}>
        <KpiCard emoji="📚" value={lessons.completedInPeriod} label="Lecciones" sub={`${lessons.completedAllTime} en total`} />
        <KpiCard emoji="📅" value={lessons.activeDays} label="Días activos" sub="en el período" />
        <KpiCard
          emoji="🎯"
          value={quizzes.avgScore !== null ? `${quizzes.avgScore}%` : '—'}
          label="Quiz promedio"
          sub={`${quizzes.attempts} intentos · mejor ${quizzes.bestScore ?? '—'}%`}
        />
        <KpiCard
          emoji="🎓"
          value={exams.passed}
          label="Exámenes aprobados"
          sub={`de ${exams.attempts} · media ${exams.avgScore ?? '—'}%`}
        />
        <KpiCard emoji="📜" value={certificates.total} label="Certificados" sub={certsByTypeSummary(certificates.byType)} />
        <KpiCard emoji="🏆" value={stats.student.totalPoints} label="Puntos totales" sub={`Racha más larga: ${stats.student.longestStreak} sem.`} />
        <KpiCard emoji="📅" value={sessions.confirmed} label="Clases confirmadas" sub={`${sessions.totalHours}h en total`} />
        <KpiCard emoji="🔥" value={stats.student.currentStreak} label="Racha actual" sub="semanas consecutivas" />
      </div>

      {/* Gráfico de actividad */}
      {stats.activity.length > 0 ? (
        <div style={S.section}>
          <ActivityChart activity={stats.activity} days={periodDays} />
        </div>
      ) : (
        <div style={{ ...S.card, color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
          Sin actividad registrada en el período seleccionado.
        </div>
      )}

      {/* Certificados por tipo */}
      {certificates.total > 0 && (
        <div style={S.section}>
          <div style={S.sectionTitle}>Certificados obtenidos</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {Object.entries(certificates.byType).map(([type, count]) => (
              <span key={type} style={{
                background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0',
                borderRadius: 8, padding: '4px 12px', fontSize: '0.78rem', fontWeight: 600,
              }}>
                {CERT_LABELS[type] ?? type} ×{count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Progreso por curso */}
      {stats.courses.length > 0 && (
        <div style={S.section}>
          <div style={S.sectionTitle}>Progreso en cursos ({stats.courses.length})</div>
          {stats.courses.map((course) => (
            <CourseProgressCard key={course.id} course={course} />
          ))}
        </div>
      )}
    </>
  );
}

// ─── Sub-componentes ───────────────────────────────────────────────────────────

function KpiCard({
  emoji, value, label, sub,
}: { emoji: string; value: string | number; label: string; sub?: string }) {
  return (
    <div style={S.kpiCard}>
      <div style={S.kpiEmoji}>{emoji}</div>
      <div style={S.kpiValue}>{value}</div>
      <div style={S.kpiLabel}>{label}</div>
      {sub && <div style={S.kpiSub}>{sub}</div>}
    </div>
  );
}

function CourseProgressCard({ course }: { course: StudentStats['courses'][0] }) {
  const [expanded, setExpanded] = useState(false);
  const pct = course.progressPct;
  const fill = pct === 100 ? '#16a34a' : ORANGE;

  return (
    <div style={S.card}>
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: course.modules.length > 0 ? 'pointer' : 'default' }}
        onClick={() => course.modules.length > 0 && setExpanded((e) => !e)}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>
            {course.title}
            {course.schoolYear && (
              <span style={{ marginLeft: 8, fontSize: '0.7rem', color: '#64748b', fontWeight: 500 }}>
                {course.schoolYear.label}
              </span>
            )}
          </div>
          <div style={S.progressBarWrap}>
            <div style={S.progressBar}>
              <div style={{ ...S.progressFill, width: `${pct}%`, background: fill }} />
            </div>
            <span style={S.progressPct}>{pct}%</span>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
              {course.completedLessons}/{course.totalLessons} lec.
            </span>
          </div>
        </div>
        {course.modules.length > 0 && (
          <span style={{ color: '#94a3b8', fontSize: '0.8rem', marginLeft: 12 }}>
            {expanded ? '▲' : '▼'}
          </span>
        )}
      </div>

      {expanded && (
        <div style={{ marginTop: 10, borderTop: '1px solid #f1f5f9', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {course.modules.map((mod) => {
            const mPct = mod.totalLessons > 0
              ? Math.round((mod.completedLessons / mod.totalLessons) * 100)
              : 0;
            return (
              <div key={mod.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 500 }}>{mod.title}</span>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                    {mod.completedLessons}/{mod.totalLessons}
                  </span>
                </div>
                <div style={{ height: 4, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${mPct}%`, background: mPct === 100 ? '#16a34a' : ORANGE, borderRadius: 999 }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function certsByTypeSummary(byType: Record<string, number>): string {
  const entries = Object.entries(byType);
  if (entries.length === 0) return 'ninguno aún';
  return entries.map(([t, n]) => `${n} ${t.split('_')[0].toLowerCase()}`).join(', ');
}

// ─── Página principal ──────────────────────────────────────────────────────────

export default function TutorStudentsPage() {
  const { data: students, isLoading } = useMyStudents();
  const [selected, setSelected] = useState<StudentSummary | null>(null);
  const [periodIdx, setPeriodIdx] = useState(1); // 30D por defecto

  const period = PERIODS[periodIdx];

  return (
    <div style={S.shell}>
      {/* ── Sidebar de alumnos ── */}
      <aside style={S.sidebar}>
        <div style={S.sidebarHeader}>
          <div style={S.sidebarTitle}>Mis alumnos</div>
          <div style={S.sidebarSubtitle}>
            {isLoading ? 'Cargando...' : `${students?.length ?? 0} alumnos asignados`}
          </div>
        </div>

        <div style={S.studentList}>
          {!isLoading && students?.length === 0 && (
            <div style={{ padding: '1rem', fontSize: '0.8rem', color: '#94a3b8' }}>
              Aún no tienes alumnos asignados.
            </div>
          )}
          {students?.map((st) => (
            <div
              key={st.id}
              style={{
                ...S.studentItem,
                ...(selected?.id === st.id ? S.studentItemActive : {}),
              }}
              onClick={() => setSelected(st)}
            >
              <div style={S.studentAvatar}>{st.name.charAt(0).toUpperCase()}</div>
              <div style={{ minWidth: 0 }}>
                <div style={S.studentName}>{st.name}</div>
                <div style={S.studentLevel}>
                  {st.schoolYear?.label ?? 'Sin nivel'}
                </div>
                <div style={S.studentPts}>🏆 {st.totalPoints} pts · 🔥 {st.currentStreak}sem</div>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* ── Panel de detalle ── */}
      {!selected ? (
        <div style={S.empty}>
          <span style={{ fontSize: '3rem' }}>👈</span>
          <p style={{ fontWeight: 600, color: '#475569' }}>Selecciona un alumno para ver sus métricas</p>
        </div>
      ) : (
        <div style={S.detail}>
          {/* Selector de período */}
          <div style={S.periodRow}>
            <span style={S.periodLabel}>Período:</span>
            {PERIODS.map((p, i) => (
              <button
                key={p.label}
                style={{
                  ...S.periodBtn,
                  background: i === periodIdx ? ORANGE : '#f1f5f9',
                  color: i === periodIdx ? '#fff' : '#475569',
                }}
                onClick={() => setPeriodIdx(i)}
              >
                {p.label}
              </button>
            ))}
          </div>

          <StudentDetail key={`${selected.id}-${period.days}`} student={selected} periodDays={period.days} />
        </div>
      )}
    </div>
  );
}
