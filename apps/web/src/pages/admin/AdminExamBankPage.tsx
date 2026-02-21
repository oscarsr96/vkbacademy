import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../api/admin.api';
import type { AdminExamQuestion } from '../../api/exams.api';
import { QuestionType } from '@vkbacademy/shared';
import type { AnswerPayload } from '../../api/admin.api';

// ─── Tipos internos ───────────────────────────────────────────────────────────

interface AnswerDraft {
  text: string;
  isCorrect: boolean;
}

interface QuestionForm {
  text: string;
  type: QuestionType;
  answers: AnswerDraft[];
}

function emptyForm(): QuestionForm {
  return {
    text: '',
    type: QuestionType.SINGLE,
    answers: [
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
    ],
  };
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '2rem', maxWidth: 900, margin: '0 auto' },
  back: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--color-text-muted)', fontSize: '0.875rem', padding: 0, marginBottom: '1.25rem',
  },
  heading: { fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.25rem' },
  subheading: { fontSize: '1rem', color: 'var(--color-text-muted)', marginBottom: '1.5rem' },
  tabBar: { display: 'flex', gap: 4, marginBottom: '1.5rem', borderBottom: '1px solid var(--color-border)' },
  tab: {
    padding: '0.5rem 1rem', background: 'none', border: 'none', cursor: 'pointer',
    fontSize: '0.9rem', color: 'var(--color-text-muted)', borderBottom: '2px solid transparent',
    marginBottom: -1,
  },
  tabActive: { color: 'var(--color-primary)', borderBottomColor: 'var(--color-primary)', fontWeight: 600 },
  toolbar: { display: 'flex', gap: 8, marginBottom: '1.25rem', flexWrap: 'wrap' as const },
  btn: {
    padding: '0.5rem 1rem', borderRadius: 8, border: 'none', cursor: 'pointer',
    fontWeight: 600, fontSize: '0.875rem',
  },
  btnPrimary: { background: 'var(--color-primary)', color: '#fff' },
  btnSecondary: { background: 'var(--color-border)', color: 'var(--color-text)' },
  btnDanger: { background: 'var(--color-error)', color: '#fff' },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.875rem' },
  th: {
    textAlign: 'left' as const, padding: '0.5rem 0.75rem',
    borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-muted)',
    fontWeight: 600,
  },
  td: { padding: '0.6rem 0.75rem', borderBottom: '1px solid var(--color-border)', verticalAlign: 'middle' as const },
  badge: {
    display: 'inline-block', padding: '2px 8px', borderRadius: 999,
    background: 'var(--color-border)', fontSize: '0.75rem', fontWeight: 600,
  },
  overlay: {
    position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  modal: {
    background: 'var(--color-surface)', borderRadius: 12, padding: '1.75rem',
    width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' as const,
  },
  modalTitle: { fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' },
  label: { display: 'block', fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.3rem', marginTop: '0.75rem' },
  input: {
    width: '100%', padding: '0.5rem 0.75rem', borderRadius: 8,
    border: '1px solid var(--color-border)', background: 'var(--color-bg)',
    color: 'var(--color-text)', fontSize: '0.9rem', boxSizing: 'border-box' as const,
  },
  select: {
    padding: '0.45rem 0.75rem', borderRadius: 8,
    border: '1px solid var(--color-border)', background: 'var(--color-bg)',
    color: 'var(--color-text)', fontSize: '0.9rem',
  },
  answerRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.5rem' },
  error: { color: 'var(--color-error)', fontSize: '0.875rem', marginTop: '0.5rem' },
  muted: { color: 'var(--color-text-muted)', fontSize: '0.875rem' },
  empty: { padding: '2rem', textAlign: 'center' as const, color: 'var(--color-text-muted)' },
};

// ─── Hook para el banco de examen ─────────────────────────────────────────────

function useExamBank(courseId?: string, moduleId?: string) {
  const qc = useQueryClient();
  const key = ['admin', 'exam-questions', courseId ?? moduleId];

  const questions = useQuery({
    queryKey: key,
    queryFn: () => adminApi.listExamQuestions({ courseId, moduleId }),
    enabled: !!(courseId || moduleId),
  });

  const attempts = useQuery({
    queryKey: ['admin', 'exam-attempts', courseId ?? moduleId],
    queryFn: () => adminApi.listExamAttempts({ courseId, moduleId }),
    enabled: !!(courseId || moduleId),
  });

  const createMut = useMutation({
    mutationFn: (payload: Parameters<typeof adminApi.createExamQuestion>[0]) =>
      adminApi.createExamQuestion(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const generateMut = useMutation({
    mutationFn: (payload: Parameters<typeof adminApi.generateExamQuestions>[0]) =>
      adminApi.generateExamQuestions(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof adminApi.updateExamQuestion>[1] }) =>
      adminApi.updateExamQuestion(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminApi.deleteExamQuestion(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { questions, attempts, createMut, generateMut, updateMut, deleteMut };
}

// ─── Modal de pregunta (crear/editar) ─────────────────────────────────────────

function QuestionModal({
  initial,
  onSave,
  onClose,
  isLoading,
  error,
}: {
  initial?: AdminExamQuestion;
  courseId?: string;
  moduleId?: string;
  onSave: (form: QuestionForm) => void;
  onClose: () => void;
  isLoading: boolean;
  error?: string;
}) {
  const [form, setForm] = useState<QuestionForm>(
    initial
      ? {
          text: initial.text,
          type: initial.type as QuestionType,
          answers: initial.answers.map((a) => ({ text: a.text, isCorrect: a.isCorrect })),
        }
      : emptyForm(),
  );

  const updateAnswer = (i: number, field: keyof AnswerDraft, value: string | boolean) => {
    setForm((prev) => {
      const answers = [...prev.answers];
      answers[i] = { ...answers[i], [field]: value };
      // Para SINGLE/TRUE_FALSE, solo una respuesta correcta
      if (field === 'isCorrect' && value === true && form.type !== QuestionType.MULTIPLE) {
        answers.forEach((a, idx) => {
          if (idx !== i) answers[idx] = { ...a, isCorrect: false };
        });
      }
      return { ...prev, answers };
    });
  };

  const addAnswer = () =>
    setForm((prev) => ({ ...prev, answers: [...prev.answers, { text: '', isCorrect: false }] }));

  const removeAnswer = (i: number) =>
    setForm((prev) => ({ ...prev, answers: prev.answers.filter((_, idx) => idx !== i) }));

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.modalTitle}>
          {initial ? 'Editar pregunta' : 'Nueva pregunta de examen'}
        </div>

        <label style={styles.label}>Enunciado *</label>
        <textarea
          rows={3}
          value={form.text}
          onChange={(e) => setForm((p) => ({ ...p, text: e.target.value }))}
          style={{ ...styles.input }}
          placeholder="Escribe el enunciado de la pregunta..."
        />

        <label style={styles.label}>Tipo</label>
        <select
          value={form.type}
          onChange={(e) =>
            setForm((p) => ({ ...p, type: e.target.value as QuestionType }))
          }
          style={styles.select}
        >
          <option value={QuestionType.SINGLE}>Única respuesta</option>
          <option value={QuestionType.MULTIPLE}>Múltiple</option>
          <option value={QuestionType.TRUE_FALSE}>Verdadero / Falso</option>
        </select>

        <label style={styles.label}>Respuestas</label>
        {form.answers.map((a, i) => (
          <div key={i} style={styles.answerRow}>
            <input
              type="checkbox"
              checked={a.isCorrect}
              onChange={(e) => updateAnswer(i, 'isCorrect', e.target.checked)}
              title="Correcta"
            />
            <input
              style={{ ...styles.input, flex: 1 }}
              value={a.text}
              onChange={(e) => updateAnswer(i, 'text', e.target.value)}
              placeholder={`Opción ${i + 1}`}
            />
            {form.answers.length > 2 && (
              <button
                style={{ ...styles.btn, padding: '0.3rem 0.6rem', background: 'var(--color-error)', color: '#fff' }}
                onClick={() => removeAnswer(i)}
              >
                ✕
              </button>
            )}
          </div>
        ))}
        {form.type !== QuestionType.TRUE_FALSE && (
          <button
            style={{ ...styles.btn, ...styles.btnSecondary, marginBottom: '1rem' }}
            onClick={addAnswer}
          >
            + Añadir opción
          </button>
        )}

        {error && <div style={styles.error}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={onClose}>
            Cancelar
          </button>
          <button
            style={{ ...styles.btn, ...styles.btnPrimary }}
            disabled={isLoading}
            onClick={() => onSave(form)}
          >
            {isLoading ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal IA ─────────────────────────────────────────────────────────────────

function IaModal({
  onGenerate,
  onClose,
  isLoading,
  error,
}: {
  courseId?: string;
  moduleId?: string;
  onGenerate: (topic: string, count: number) => void;
  onClose: () => void;
  isLoading: boolean;
  error?: string;
}) {
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(3);

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.modalTitle}>⚡ Generar preguntas con IA</div>
        <label style={styles.label}>Tema *</label>
        <input
          style={styles.input}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Ej: Reglas de baloncesto, Defensa en zona..."
        />
        <label style={styles.label}>Número de preguntas (1-10)</label>
        <input
          type="number"
          min={1}
          max={10}
          value={count}
          onChange={(e) => setCount(Math.min(10, Math.max(1, Number(e.target.value))))}
          style={{ ...styles.input, width: 100 }}
        />
        {error && <div style={styles.error}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={onClose}>
            Cancelar
          </button>
          <button
            style={{ ...styles.btn, ...styles.btnPrimary }}
            disabled={isLoading || !topic.trim()}
            onClick={() => onGenerate(topic, count)}
          >
            {isLoading ? 'Generando...' : 'Generar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AdminExamBankPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const courseId = searchParams.get('courseId') ?? undefined;
  const moduleId = searchParams.get('moduleId') ?? undefined;

  const [activeTab, setActiveTab] = useState<'questions' | 'history'>('questions');
  const [showNewModal, setShowNewModal] = useState(false);
  const [showIaModal, setShowIaModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<AdminExamQuestion | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');

  const { questions, attempts, createMut, generateMut, updateMut, deleteMut } = useExamBank(
    courseId,
    moduleId,
  );

  const scopeLabel = courseId ? 'Curso' : 'Módulo';

  const handleCreate = async (form: QuestionForm) => {
    setFormError('');
    try {
      await createMut.mutateAsync({
        courseId,
        moduleId,
        text: form.text,
        type: form.type as import('@vkbacademy/shared').QuestionType,
        answers: form.answers as AnswerPayload[],
      });
      setShowNewModal(false);
    } catch {
      setFormError('Error al crear la pregunta. Verifica los datos.');
    }
  };

  const handleUpdate = async (form: QuestionForm) => {
    if (!editingQuestion) return;
    setFormError('');
    try {
      await updateMut.mutateAsync({
        id: editingQuestion.id,
        payload: {
          text: form.text,
          type: form.type as import('@vkbacademy/shared').QuestionType,
          answers: form.answers as AnswerPayload[],
        },
      });
      setEditingQuestion(null);
    } catch {
      setFormError('Error al actualizar la pregunta.');
    }
  };

  const handleGenerate = async (topic: string, count: number) => {
    setFormError('');
    try {
      await generateMut.mutateAsync({ courseId, moduleId, topic, count });
      setShowIaModal(false);
    } catch {
      setFormError('Error al generar preguntas. Inténtalo de nuevo.');
    }
  };

  const handleDelete = async (id: string) => {
    await deleteMut.mutateAsync(id);
    setDeletingId(null);
  };

  const questionList = questions.data ?? [];
  const attemptList = attempts.data ?? [];

  return (
    <div style={styles.page}>
      <button style={styles.back} onClick={() => navigate(-1)}>
        ← Volver
      </button>
      <h1 style={styles.heading}>🎓 Banco de examen — {scopeLabel}</h1>
      <p style={styles.subheading}>
        {questionList.length} preguntas · {attemptList.length} intentos registrados
      </p>

      {/* Pestañas */}
      <div style={styles.tabBar}>
        {(['questions', 'history'] as const).map((tab) => (
          <button
            key={tab}
            style={{
              ...styles.tab,
              ...(activeTab === tab ? styles.tabActive : {}),
            }}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'questions' ? 'Preguntas' : 'Historial de intentos'}
          </button>
        ))}
      </div>

      {activeTab === 'questions' && (
        <>
          <div style={styles.toolbar}>
            <button
              style={{ ...styles.btn, ...styles.btnPrimary }}
              onClick={() => { setFormError(''); setShowNewModal(true); }}
            >
              ➕ Añadir pregunta
            </button>
            <button
              style={{ ...styles.btn, ...styles.btnSecondary }}
              onClick={() => { setFormError(''); setShowIaModal(true); }}
            >
              ⚡ Generar con IA
            </button>
          </div>

          {questions.isLoading ? (
            <div style={styles.muted}>Cargando preguntas...</div>
          ) : questionList.length === 0 ? (
            <div style={styles.empty}>
              Todavía no hay preguntas en este banco. Añade algunas manualmente o genera con IA.
            </div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>#</th>
                  <th style={styles.th}>Pregunta</th>
                  <th style={styles.th}>Tipo</th>
                  <th style={styles.th}>Respuestas</th>
                  <th style={styles.th}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {questionList.map((q, idx) => (
                  <tr key={q.id}>
                    <td style={styles.td}>{idx + 1}</td>
                    <td style={{ ...styles.td, maxWidth: 360 }}>
                      <span title={q.text}>
                        {q.text.length > 80 ? q.text.slice(0, 80) + '…' : q.text}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.badge}>{q.type}</span>
                    </td>
                    <td style={styles.td}>{q.answers.length}</td>
                    <td style={styles.td}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          style={{ ...styles.btn, padding: '0.3rem 0.6rem', ...styles.btnSecondary }}
                          onClick={() => { setFormError(''); setEditingQuestion(q); }}
                        >
                          ✏️
                        </button>
                        <button
                          style={{ ...styles.btn, padding: '0.3rem 0.6rem', ...styles.btnDanger }}
                          onClick={() => setDeletingId(q.id)}
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {activeTab === 'history' && (
        <>
          {attempts.isLoading ? (
            <div style={styles.muted}>Cargando historial...</div>
          ) : attemptList.length === 0 ? (
            <div style={styles.empty}>Aún no hay intentos de examen registrados.</div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Alumno</th>
                  <th style={styles.th}>Email</th>
                  <th style={styles.th}>Fecha</th>
                  <th style={styles.th}>Preguntas</th>
                  <th style={styles.th}>Score</th>
                </tr>
              </thead>
              <tbody>
                {attemptList.map((a) => (
                  <tr key={a.id}>
                    <td style={styles.td}>{a.user.name}</td>
                    <td style={styles.td}>{a.user.email}</td>
                    <td style={styles.td}>
                      {a.submittedAt
                        ? new Date(a.submittedAt).toLocaleDateString('es-ES')
                        : <span style={{ color: 'var(--color-text-muted)' }}>En progreso</span>}
                    </td>
                    <td style={styles.td}>{a.numQuestions}</td>
                    <td style={styles.td}>
                      {a.score !== null ? (
                        <span
                          style={{
                            fontWeight: 700,
                            color: a.score >= 50 ? 'var(--color-primary)' : 'var(--color-error)',
                          }}
                        >
                          {a.score.toFixed(1)}%
                        </span>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {/* Modal: Nueva pregunta */}
      {showNewModal && (
        <QuestionModal
          courseId={courseId}
          moduleId={moduleId}
          onSave={handleCreate}
          onClose={() => setShowNewModal(false)}
          isLoading={createMut.isPending}
          error={formError}
        />
      )}

      {/* Modal: Editar pregunta */}
      {editingQuestion && (
        <QuestionModal
          initial={editingQuestion}
          courseId={courseId}
          moduleId={moduleId}
          onSave={handleUpdate}
          onClose={() => setEditingQuestion(null)}
          isLoading={updateMut.isPending}
          error={formError}
        />
      )}

      {/* Modal: Generar con IA */}
      {showIaModal && (
        <IaModal
          courseId={courseId}
          moduleId={moduleId}
          onGenerate={handleGenerate}
          onClose={() => setShowIaModal(false)}
          isLoading={generateMut.isPending}
          error={formError}
        />
      )}

      {/* Confirmación de borrado */}
      {deletingId && (
        <div style={styles.overlay}>
          <div style={{ ...styles.modal, maxWidth: 380 }}>
            <div style={styles.modalTitle}>¿Eliminar esta pregunta?</div>
            <p style={styles.muted}>Esta acción no se puede deshacer.</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button
                style={{ ...styles.btn, ...styles.btnSecondary }}
                onClick={() => setDeletingId(null)}
              >
                Cancelar
              </button>
              <button
                style={{ ...styles.btn, ...styles.btnDanger }}
                disabled={deleteMut.isPending}
                onClick={() => handleDelete(deletingId)}
              >
                {deleteMut.isPending ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
