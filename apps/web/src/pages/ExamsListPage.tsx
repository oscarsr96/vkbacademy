import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useAvailableExams,
  useMyAiExamBanks,
  useGenerateAiExam,
  useDeleteAiExamBank,
  useStartAiAttempt,
} from '../hooks/useExams';
import { useCourses } from '../hooks/useCourses';
import type { AiExamBankSummary } from '../api/exams.api';

// ─── Helper: color de score ───────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 70) return '#16a34a';
  if (score >= 50) return '#ea580c';
  return '#dc2626';
}

function scoreBg(score: number): string {
  if (score >= 70) return 'rgba(22,163,74,0.10)';
  if (score >= 50) return 'rgba(234,88,12,0.10)';
  return 'rgba(220,38,38,0.10)';
}

function scoreBorder(score: number): string {
  if (score >= 70) return 'rgba(22,163,74,0.25)';
  if (score >= 50) return 'rgba(234,88,12,0.25)';
  return 'rgba(220,38,38,0.25)';
}

// ─── Skeleton de carga ────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1.5px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px 24px',
        height: 96,
        animation: 'pulse-glow 1.5s ease-in-out infinite',
      }}
    />
  );
}

// ─── Card de examen ───────────────────────────────────────────────────────────

interface ExamCardProps {
  title: string;
  badge?: string;
  questionCount: number;
  lastAttempt?: { score: number; submittedAt?: string } | null;
  onStart: () => void;
}

function ExamCard({ title, badge, questionCount, lastAttempt, onStart }: ExamCardProps) {
  return (
    <div
      className="vkb-card animate-in"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '20px 24px',
        flexWrap: 'wrap' as const,
      }}
    >
      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Título */}
        <div
          style={{ fontWeight: 700, color: 'var(--color-text)', marginBottom: 8, fontSize: '1rem' }}
        >
          {title}
        </div>

        {/* Metadatos */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
          {badge && (
            <span
              style={{
                display: 'inline-block',
                padding: '2px 10px',
                borderRadius: 999,
                background: 'rgba(234,88,12,0.10)',
                color: 'var(--color-primary)',
                fontSize: '0.72rem',
                fontWeight: 700,
                border: '1px solid rgba(234,88,12,0.20)',
              }}
            >
              {badge}
            </span>
          )}

          <span
            style={{
              fontSize: '0.8rem',
              color: 'var(--color-text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span>📋</span>
            <span>{questionCount} preguntas</span>
          </span>

          {lastAttempt && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 10px',
                borderRadius: 999,
                background: scoreBg(lastAttempt.score),
                color: scoreColor(lastAttempt.score),
                fontSize: '0.75rem',
                fontWeight: 700,
                border: `1px solid ${scoreBorder(lastAttempt.score)}`,
              }}
            >
              Ultimo: {lastAttempt.score.toFixed(1)}%
            </span>
          )}
        </div>
      </div>

      {/* Boton */}
      <button
        className="btn btn-primary"
        style={{ padding: '9px 20px', fontSize: '0.875rem', flexShrink: 0 }}
        onClick={onStart}
      >
        {lastAttempt ? 'Repetir' : 'Empezar'}
      </button>
    </div>
  );
}

// ─── Separador de sección ─────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 14,
        marginTop: 28,
      }}
    >
      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)' }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
    </div>
  );
}

// ─── Card de banco IA ────────────────────────────────────────────────────────

function AiBankCard({
  bank,
  onStart,
  onDelete,
  isDeleting,
  isStarting,
}: {
  bank: AiExamBankSummary;
  onStart: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  isStarting: boolean;
}) {
  const lockedByOnce = bank.onlyOnce && bank.submittedAttemptCount > 0;
  const startDisabled = isStarting || lockedByOnce;
  const startLabel = lockedByOnce
    ? 'Completado'
    : isStarting
      ? 'Iniciando...'
      : bank.attemptCount > 0
        ? 'Repetir'
        : 'Empezar';

  const timeMinutes = bank.timeLimit ? Math.round(bank.timeLimit / 60) : null;

  return (
    <div
      className="vkb-card animate-in"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '20px 24px',
        flexWrap: 'wrap' as const,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 700,
            color: 'var(--color-text)',
            marginBottom: 6,
            fontSize: '1rem',
          }}
        >
          {bank.title}
        </div>
        <div
          style={{
            fontSize: '0.8rem',
            color: 'var(--color-text-muted)',
            marginBottom: 8,
            lineHeight: 1.4,
          }}
        >
          {bank.course.title}
          {bank.module ? ` · ${bank.module.title}` : ''} · Tema: {bank.topic}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
          <span
            style={{
              display: 'inline-block',
              padding: '2px 10px',
              borderRadius: 999,
              background: 'rgba(234,88,12,0.10)',
              color: 'var(--color-primary)',
              fontSize: '0.72rem',
              fontWeight: 700,
              border: '1px solid rgba(234,88,12,0.20)',
            }}
          >
            🤖 IA
          </span>
          <span
            style={{
              fontSize: '0.78rem',
              color: 'var(--color-text-muted)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span>📋</span>
            <span>{bank.questionCount} preguntas</span>
          </span>
          {timeMinutes !== null && (
            <span
              style={{
                fontSize: '0.78rem',
                color: 'var(--color-text-muted)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
              title="Límite de tiempo"
            >
              <span>⏱</span>
              <span>{timeMinutes} min</span>
            </span>
          )}
          {bank.onlyOnce && (
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '2px 10px',
                borderRadius: 999,
                background: 'rgba(234,88,12,0.08)',
                border: '1px solid rgba(234,88,12,0.18)',
                color: 'var(--color-primary)',
              }}
              title="Solo un intento permitido"
            >
              🔒 1 intento
            </span>
          )}
          {bank.attemptCount > 0 && (
            <span
              style={{
                fontSize: '0.78rem',
                color: 'var(--color-text-muted)',
              }}
            >
              {bank.attemptCount} {bank.attemptCount === 1 ? 'intento' : 'intentos'}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          className="btn btn-ghost"
          style={{ padding: '8px 14px', fontSize: '0.8rem' }}
          onClick={onDelete}
          disabled={isDeleting}
          title="Eliminar banco"
        >
          {isDeleting ? '...' : '🗑'}
        </button>
        <button
          className="btn btn-primary"
          style={{
            padding: '9px 20px',
            fontSize: '0.875rem',
            opacity: lockedByOnce ? 0.55 : 1,
            cursor: startDisabled ? 'not-allowed' : 'pointer',
          }}
          onClick={onStart}
          disabled={startDisabled}
          title={
            lockedByOnce ? 'Examen marcado como un solo intento. Ya lo completaste.' : undefined
          }
        >
          {startLabel}
        </button>
      </div>
    </div>
  );
}

// ─── Modal: crear examen IA ─────────────────────────────────────────────────

function CreateAiExamModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { data: coursesPage } = useCourses();
  const [courseId, setCourseId] = useState('');
  const [topic, setTopic] = useState('');
  const [numQuestions, setNumQuestions] = useState<5 | 10>(5);
  const [useTimer, setUseTimer] = useState(false);
  const [timerMins, setTimerMins] = useState(15);
  const [onlyOnce, setOnlyOnce] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const generate = useGenerateAiExam();

  const courses = coursesPage?.data ?? [];

  const canSubmit = courseId && topic.trim().length >= 3 && !generate.isPending;

  const handleSubmit = async () => {
    setSubmitError(null);
    try {
      await generate.mutateAsync({
        courseId,
        topic: topic.trim(),
        numQuestions,
        timeLimit: useTimer ? Math.round(timerMins * 60) : undefined,
        onlyOnce,
      });
      onSuccess();
    } catch (err) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? ((err as { response?: { data?: { message?: string } } }).response?.data?.message ??
            'No se pudo generar el examen')
          : 'No se pudo generar el examen';
      setSubmitError(message);
    }
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--color-text-muted)',
    marginBottom: 6,
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 'var(--radius-sm)',
    border: '1.5px solid var(--color-border)',
    background: 'var(--color-bg)',
    color: 'var(--color-text)',
    fontSize: '0.95rem',
    outline: 'none',
    boxSizing: 'border-box' as const,
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    appearance: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    backgroundImage:
      "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8' fill='none'%3e%3cpath d='M1 1.5L6 6.5L11 1.5' stroke='%236b7280' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3e%3c/svg%3e\")",
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 14px center',
    paddingRight: 38,
    cursor: 'pointer',
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="vkb-card"
        style={{
          width: '100%',
          maxWidth: 520,
          padding: 28,
          maxHeight: '92vh',
          overflowY: 'auto' as const,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 18,
          }}
        >
          <h3
            style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-text)' }}
          >
            🤖 Crear examen
          </h3>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-muted)',
              fontSize: '1.4rem',
              cursor: 'pointer',
              padding: 0,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Curso */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Curso</label>
          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            style={selectStyle}
          >
            <option value="">Selecciona un curso...</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>

        {/* Tema */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Tema</label>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Ej: Propiedades de los logaritmos"
            rows={2}
            style={{ ...inputStyle, resize: 'vertical' as const, fontFamily: 'inherit' }}
          />
        </div>

        {/* Nº preguntas: 5 o 10 */}
        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle}>Número de preguntas</label>
          <div style={{ display: 'flex', gap: 10 }}>
            {([5, 10] as const).map((n) => {
              const active = numQuestions === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNumQuestions(n)}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-sm)',
                    border: active
                      ? '2px solid var(--color-primary)'
                      : '1.5px solid var(--color-border)',
                    background: active ? 'rgba(234,88,12,0.10)' : 'var(--color-bg)',
                    color: active ? 'var(--color-primary)' : 'var(--color-text)',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {n} preguntas
                </button>
              );
            })}
          </div>
        </div>

        {/* Toggle: límite de tiempo */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 0',
            borderTop: '1px solid var(--color-border)',
            cursor: 'pointer',
            fontSize: '0.9rem',
            color: 'var(--color-text)',
          }}
        >
          <input
            type="checkbox"
            checked={useTimer}
            onChange={(e) => setUseTimer(e.target.checked)}
            style={{ accentColor: 'var(--color-primary)', width: 16, height: 16 }}
          />
          <span style={{ fontWeight: 500 }}>⏱ Límite de tiempo</span>
        </label>
        {useTimer && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '4px 0 12px 26px',
            }}
          >
            <input
              type="number"
              min={1}
              max={180}
              value={timerMins}
              onChange={(e) =>
                setTimerMins(Math.min(180, Math.max(1, Number(e.target.value) || 1)))
              }
              style={{ ...inputStyle, width: 90 }}
            />
            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>minutos</span>
          </div>
        )}

        {/* Toggle: solo un intento */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 0',
            borderTop: '1px solid var(--color-border)',
            borderBottom: '1px solid var(--color-border)',
            cursor: 'pointer',
            fontSize: '0.9rem',
            color: 'var(--color-text)',
            marginBottom: 18,
          }}
        >
          <input
            type="checkbox"
            checked={onlyOnce}
            onChange={(e) => setOnlyOnce(e.target.checked)}
            style={{ accentColor: 'var(--color-primary)', width: 16, height: 16 }}
          />
          <span style={{ fontWeight: 500 }}>🔒 Solo un intento</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            (no podrás repetirlo)
          </span>
        </label>

        {submitError && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(220,38,38,0.10)',
              border: '1px solid rgba(220,38,38,0.30)',
              color: '#dc2626',
              fontSize: '0.85rem',
              marginBottom: 14,
            }}
          >
            {submitError}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={generate.isPending}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {generate.isPending ? 'Generando con IA...' : 'Generar examen'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ExamsListPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useAvailableExams();

  // ─── IA ───
  const { data: aiBanks, isLoading: aiLoading } = useMyAiExamBanks();
  const deleteMut = useDeleteAiExamBank();
  const startAiMut = useStartAiAttempt();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [pendingStartId, setPendingStartId] = useState<string | null>(null);

  const handleStartAiBank = async (bankId: string) => {
    setPendingStartId(bankId);
    try {
      // Empuja al usuario a /exam con aiBankId; ExamPage hará el start interno
      navigate(`/exam?aiBankId=${bankId}`);
    } finally {
      setPendingStartId(null);
    }
  };

  const handleDeleteBank = async (bankId: string) => {
    if (
      !confirm(
        '¿Eliminar este banco? Los intentos previos se conservarán pero ya no podrás repetirlo.',
      )
    ) {
      return;
    }
    await deleteMut.mutateAsync(bankId);
  };

  const hasCourses = (data?.courses?.length ?? 0) > 0;
  const hasModules = (data?.modules?.length ?? 0) > 0;
  const hasAiBanks = (aiBanks?.length ?? 0) > 0;
  const isEmpty = !hasCourses && !hasModules && !hasAiBanks;

  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      {/* Hero */}
      <div className="page-hero animate-in">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
          <span style={{ fontSize: '2.4rem' }}>🎓</span>
        </div>
        <h1 className="hero-title">Exámenes</h1>
        <p className="hero-subtitle">
          Pon a prueba tus conocimientos. Configura el numero de preguntas y el tiempo limite.
        </p>
      </div>

      {/* Sección: Mis Exámenes */}
      <div style={{ marginTop: 28 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 14,
          }}
        >
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)' }}>
            🤖 Mis Exámenes
          </span>
          <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
          <button
            className="btn btn-primary"
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            onClick={() => setShowCreateModal(true)}
          >
            + Crear examen
          </button>
        </div>

        {aiLoading && (
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 14 }}>
            <SkeletonCard />
          </div>
        )}

        {!aiLoading && hasAiBanks && (
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 14 }}>
            {aiBanks!.map((b) => (
              <AiBankCard
                key={b.id}
                bank={b}
                onStart={() => handleStartAiBank(b.id)}
                onDelete={() => handleDeleteBank(b.id)}
                isDeleting={deleteMut.isPending && deleteMut.variables === b.id}
                isStarting={
                  pendingStartId === b.id || (startAiMut.isPending && startAiMut.variables === b.id)
                }
              />
            ))}
          </div>
        )}

        {!aiLoading && !hasAiBanks && (
          <div
            style={{
              padding: '24px 20px',
              borderRadius: 'var(--radius-lg)',
              border: '1.5px dashed var(--color-border)',
              textAlign: 'center' as const,
              fontSize: '0.875rem',
              color: 'var(--color-text-muted)',
              lineHeight: 1.5,
            }}
          >
            Aún no has creado ningún examen con IA. Genera el primero con un tema a tu elección y 5
            o 10 preguntas.
          </div>
        )}
      </div>

      {/* Skeletons de carga */}
      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 14 }}>
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Estado vacío */}
      {!isLoading && isEmpty && (
        <div
          style={{
            textAlign: 'center' as const,
            padding: '56px 24px',
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-xl)',
            border: '1.5px solid var(--color-border)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div style={{ fontSize: '4rem', marginBottom: 16 }}>📭</div>
          <div
            style={{
              fontWeight: 700,
              fontSize: '1.1rem',
              color: 'var(--color-text)',
              marginBottom: 8,
            }}
          >
            No hay examenes disponibles
          </div>
          <div
            style={{
              fontSize: '0.9rem',
              color: 'var(--color-text-muted)',
              maxWidth: 380,
              margin: '0 auto',
              lineHeight: 1.6,
            }}
          >
            Crea tu primer examen con IA o espera a que el administrador añada preguntas a un banco.
          </div>
        </div>
      )}

      {/* Examenes por curso */}
      {!isLoading && hasCourses && (
        <>
          <SectionLabel label="Por curso" />
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 14 }}>
            {data!.courses.map((c) => (
              <ExamCard
                key={c.courseId}
                title={c.title}
                badge={c.schoolYear ?? undefined}
                questionCount={c.questionCount}
                lastAttempt={c.lastAttempt ?? null}
                onStart={() => navigate(`/exam?courseId=${c.courseId}`)}
              />
            ))}
          </div>
        </>
      )}

      {/* Examenes por modulo */}
      {!isLoading && hasModules && (
        <>
          <SectionLabel label="Por modulo" />
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 14 }}>
            {data!.modules.map((m) => (
              <ExamCard
                key={m.moduleId}
                title={m.title}
                badge={m.courseTitle}
                questionCount={m.questionCount}
                lastAttempt={m.lastAttempt ?? null}
                onStart={() => navigate(`/exam?moduleId=${m.moduleId}`)}
              />
            ))}
          </div>
        </>
      )}

      {/* Modal de creación de examen IA */}
      {showCreateModal && (
        <CreateAiExamModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}
