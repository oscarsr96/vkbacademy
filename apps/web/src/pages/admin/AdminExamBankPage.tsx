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

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '1rem',
  };

  const modalStyle: React.CSSProperties = {
    background: 'var(--color-surface)',
    borderRadius: 'var(--radius-lg)',
    padding: '2rem',
    width: '100%',
    maxWidth: 560,
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: 'var(--shadow-card)',
    border: '1px solid var(--color-border)',
  };

  const answerRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: '0.5rem',
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--color-text)' }}>
          {initial ? 'Editar pregunta' : 'Nueva pregunta de examen'}
        </h2>

        <div className="field">
          <label>Enunciado *</label>
          <textarea
            rows={3}
            value={form.text}
            onChange={(e) => setForm((p) => ({ ...p, text: e.target.value }))}
            placeholder="Escribe el enunciado de la pregunta..."
          />
        </div>

        <div className="field">
          <label>Tipo</label>
          <select
            value={form.type}
            onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as QuestionType }))}
          >
            <option value={QuestionType.SINGLE}>Única respuesta</option>
            <option value={QuestionType.MULTIPLE}>Múltiple</option>
            <option value={QuestionType.TRUE_FALSE}>Verdadero / Falso</option>
          </select>
        </div>

        <div className="field">
          <label>Respuestas</label>
          {form.answers.map((a, i) => (
            <div key={i} style={answerRowStyle}>
              <input
                type="checkbox"
                checked={a.isCorrect}
                onChange={(e) => updateAnswer(i, 'isCorrect', e.target.checked)}
                title="Correcta"
                style={{ accentColor: 'var(--color-primary)', width: 16, height: 16, flexShrink: 0 }}
              />
              <input
                style={{
                  flex: 1,
                  padding: '0.5rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg)',
                  color: 'var(--color-text)',
                  fontSize: '0.875rem',
                }}
                value={a.text}
                onChange={(e) => updateAnswer(i, 'text', e.target.value)}
                placeholder={`Opción ${i + 1}`}
              />
              {form.answers.length > 2 && (
                <button
                  className="btn"
                  style={{
                    padding: '0.3rem 0.6rem',
                    background: 'var(--color-error)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                  onClick={() => removeAnswer(i)}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          {form.type !== QuestionType.TRUE_FALSE && (
            <button
              className="btn btn-ghost"
              style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}
              onClick={addAnswer}
            >
              + Añadir opción
            </button>
          )}
        </div>

        {error && (
          <p style={{ color: 'var(--color-error)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
            {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn btn-primary"
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

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '1rem',
  };

  const modalStyle: React.CSSProperties = {
    background: 'var(--color-surface)',
    borderRadius: 'var(--radius-lg)',
    padding: '2rem',
    width: '100%',
    maxWidth: 440,
    boxShadow: 'var(--shadow-card)',
    border: '1px solid var(--color-border)',
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--color-text)' }}>
          Generar preguntas con IA
        </h2>

        <div className="field">
          <label>Tema *</label>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Ej: Reglas de baloncesto, Defensa en zona..."
          />
        </div>

        <div className="field">
          <label>Número de preguntas (1–10)</label>
          <input
            type="number"
            min={1}
            max={10}
            value={count}
            onChange={(e) => setCount(Math.min(10, Math.max(1, Number(e.target.value))))}
            style={{ maxWidth: 120 }}
          />
        </div>

        {error && (
          <p style={{ color: 'var(--color-error)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
            {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn btn-primary"
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
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<AdminExamQuestion | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [importJson, setImportJson] = useState('');
  const [importError, setImportError] = useState('');
  const [importToast, setImportToast] = useState('');

  const qc = useQueryClient();
  const importMut = useMutation({
    mutationFn: (payload: { questions: { text: string; answers: { text: string; isCorrect: boolean }[] }[] }) =>
      adminApi.importExamQuestions({ courseId, moduleId, ...payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'exam-questions', courseId ?? moduleId] }),
  });

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

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportError('');
    let parsed: unknown;
    try {
      parsed = JSON.parse(importJson);
    } catch {
      setImportError('El JSON no es válido. Revisa la sintaxis.');
      return;
    }
    const data = parsed as { questions?: unknown[] };
    if (!Array.isArray(data?.questions)) {
      setImportError('El JSON debe tener una propiedad "questions" con un array.');
      return;
    }
    try {
      const result = await importMut.mutateAsync({ questions: data.questions as { text: string; answers: { text: string; isCorrect: boolean }[] }[] });
      setShowImportModal(false);
      setImportJson('');
      setImportToast(result.message);
      setTimeout(() => setImportToast(''), 3500);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setImportError(msg ?? 'Error al importar las preguntas');
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setImportJson((ev.target?.result as string) ?? ''); setImportError(''); };
    reader.readAsText(file);
  };

  const questionList = questions.data ?? [];
  const attemptList = attempts.data ?? [];

  // Estilos de tabs con indicador naranja activo
  const tabBarStyle: React.CSSProperties = {
    display: 'flex',
    gap: 0,
    marginBottom: '1.75rem',
    borderBottom: '1px solid var(--color-border)',
  };

  const tabBase: React.CSSProperties = {
    padding: '0.65rem 1.25rem',
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    marginBottom: -1,
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: 500,
    color: 'var(--color-text-muted)',
    transition: 'all 0.15s',
  };

  const tabActive: React.CSSProperties = {
    ...tabBase,
    color: 'var(--color-primary)',
    borderBottomColor: 'var(--color-primary)',
    fontWeight: 700,
  };

  const badgeStyle: React.CSSProperties = {
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: 999,
    background: 'rgba(234,88,12,0.1)',
    color: 'var(--color-primary)',
    fontSize: '0.75rem',
    fontWeight: 700,
    border: '1px solid rgba(234,88,12,0.2)',
  };

  const typeBadgeStyle: React.CSSProperties = {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 6,
    background: 'var(--color-bg)',
    border: '1px solid var(--color-border)',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--color-text-muted)',
  };

  const actionBtnStyle: React.CSSProperties = {
    padding: '0.3rem 0.65rem',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--color-border)',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: '0.8rem',
    color: 'var(--color-text)',
  };

  const confirmOverlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '1rem',
  };

  const confirmModalStyle: React.CSSProperties = {
    background: 'var(--color-surface)',
    borderRadius: 'var(--radius-lg)',
    padding: '1.75rem',
    width: '100%',
    maxWidth: 380,
    boxShadow: 'var(--shadow-card)',
    border: '1px solid var(--color-border)',
  };

  return (
    <div style={{ padding: '2rem', maxWidth: 960, margin: '0 auto' }}>

      {/* Hero */}
      <div className="page-hero animate-in" style={{ marginBottom: '1.75rem' }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'rgba(255,255,255,0.6)',
            fontSize: '0.82rem',
            padding: 0,
            marginBottom: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
          }}
        >
          ← Volver a cursos
        </button>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="hero-title">Banco de Examen</h1>
            <p className="hero-subtitle">
              {scopeLabel} · {questionList.length} preguntas · {attemptList.length} intentos registrados
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' as const }}>
            <button
              className="btn btn-ghost"
              style={{ border: '1px solid rgba(255,255,255,0.25)', color: 'rgba(255,255,255,0.9)' }}
              onClick={() => { setFormError(''); setShowIaModal(true); }}
            >
              Generar con IA
            </button>
            <button
              className="btn btn-ghost"
              style={{ border: '1px solid rgba(255,255,255,0.25)', color: 'rgba(255,255,255,0.9)' }}
              onClick={() => { setImportError(''); setImportJson(''); setShowImportModal(true); }}
            >
              ⬆️ Importar JSON
            </button>
            <button
              className="btn btn-dark"
              onClick={() => { setFormError(''); setShowNewModal(true); }}
            >
              + Nueva pregunta
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={tabBarStyle}>
        {(['questions', 'history'] as const).map((tab) => (
          <button
            key={tab}
            style={activeTab === tab ? tabActive : tabBase}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'questions' ? 'Preguntas' : 'Historial de intentos'}
            {tab === 'questions' && questionList.length > 0 && (
              <span style={{ ...badgeStyle, marginLeft: 8 }}>{questionList.length}</span>
            )}
            {tab === 'history' && attemptList.length > 0 && (
              <span style={{ ...badgeStyle, marginLeft: 8 }}>{attemptList.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab: Preguntas */}
      {activeTab === 'questions' && (
        <>
          {questions.isLoading ? (
            <p style={{ color: 'var(--color-text-muted)', padding: '2rem 0', textAlign: 'center' }}>
              Cargando preguntas...
            </p>
          ) : questionList.length === 0 ? (
            <div className="vkb-card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📋</div>
              <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.25rem' }}>
                Todavía no hay preguntas en este banco.
              </p>
              <div style={{ display: 'flex', gap: '0.625rem', justifyContent: 'center' }}>
                <button className="btn btn-ghost" onClick={() => { setFormError(''); setShowIaModal(true); }}>
                  Generar con IA
                </button>
                <button className="btn btn-primary" onClick={() => { setFormError(''); setShowNewModal(true); }}>
                  Añadir pregunta
                </button>
              </div>
            </div>
          ) : (
            <div className="table-wrap">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>#</th>
                    <th style={{ textAlign: 'left', padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>Pregunta</th>
                    <th style={{ textAlign: 'left', padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>Tipo</th>
                    <th style={{ textAlign: 'center', padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>Respuestas</th>
                    <th style={{ textAlign: 'right', padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {questionList.map((q, idx) => (
                    <tr
                      key={q.id}
                      style={{ borderBottom: '1px solid var(--color-border)', transition: 'background 0.12s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '0.875rem 1rem', fontSize: '0.82rem', color: 'var(--color-text-muted)', fontWeight: 600, verticalAlign: 'middle' }}>
                        {idx + 1}
                      </td>
                      <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', color: 'var(--color-text)', maxWidth: 380, verticalAlign: 'middle' }}>
                        <span title={q.text}>
                          {q.text.length > 90 ? q.text.slice(0, 90) + '…' : q.text}
                        </span>
                      </td>
                      <td style={{ padding: '0.875rem 1rem', verticalAlign: 'middle' }}>
                        <span style={typeBadgeStyle}>{q.type}</span>
                      </td>
                      <td style={{ padding: '0.875rem 1rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--color-text)', verticalAlign: 'middle' }}>
                        {q.answers.length}
                      </td>
                      <td style={{ padding: '0.875rem 1rem', textAlign: 'right', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button
                            style={actionBtnStyle}
                            onClick={() => { setFormError(''); setEditingQuestion(q); }}
                          >
                            Editar
                          </button>
                          <button
                            style={{ ...actionBtnStyle, color: 'var(--color-error)', borderColor: 'rgba(220,38,38,0.25)' }}
                            onClick={() => setDeletingId(q.id)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Tab: Historial */}
      {activeTab === 'history' && (
        <>
          {attempts.isLoading ? (
            <p style={{ color: 'var(--color-text-muted)', padding: '2rem 0', textAlign: 'center' }}>
              Cargando historial...
            </p>
          ) : attemptList.length === 0 ? (
            <div className="vkb-card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📊</div>
              <p style={{ color: 'var(--color-text-muted)' }}>
                Aún no hay intentos de examen registrados.
              </p>
            </div>
          ) : (
            <div className="table-wrap">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Alumno', 'Email', 'Fecha', 'Preguntas', 'Score'].map((h, i) => (
                      <th
                        key={h}
                        style={{
                          textAlign: i >= 3 ? 'center' : 'left',
                          padding: '0.75rem 1rem',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: 'var(--color-text-muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          borderBottom: '1px solid var(--color-border)',
                          background: 'var(--color-bg)',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {attemptList.map((a) => (
                    <tr
                      key={a.id}
                      style={{ borderBottom: '1px solid var(--color-border)', transition: 'background 0.12s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '0.875rem 1rem', fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text)', verticalAlign: 'middle' }}>
                        {a.user.name}
                      </td>
                      <td style={{ padding: '0.875rem 1rem', fontSize: '0.82rem', color: 'var(--color-text-muted)', verticalAlign: 'middle' }}>
                        {a.user.email}
                      </td>
                      <td style={{ padding: '0.875rem 1rem', fontSize: '0.82rem', color: 'var(--color-text-muted)', verticalAlign: 'middle' }}>
                        {a.submittedAt
                          ? new Date(a.submittedAt).toLocaleDateString('es-ES')
                          : <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>En progreso</span>}
                      </td>
                      <td style={{ padding: '0.875rem 1rem', textAlign: 'center', fontSize: '0.875rem', verticalAlign: 'middle' }}>
                        {a.numQuestions}
                      </td>
                      <td style={{ padding: '0.875rem 1rem', textAlign: 'center', verticalAlign: 'middle' }}>
                        {a.score !== null ? (
                          <span
                            style={{
                              fontWeight: 800,
                              fontSize: '0.9rem',
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
            </div>
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

      {/* Toast importación */}
      {importToast && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          background: 'var(--color-primary)',
          color: '#fff',
          padding: '10px 20px',
          borderRadius: 8,
          fontWeight: 600,
          zIndex: 200,
          boxShadow: '0 4px 16px rgba(234,88,12,0.4)',
        }}>
          {importToast}
        </div>
      )}

      {/* Modal: Importar JSON */}
      {showImportModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: '1.75rem', width: '100%', maxWidth: 560, boxShadow: 'var(--shadow-card)', border: '1px solid var(--color-border)' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--color-text)' }}>
              Importar preguntas desde JSON
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem' }}>
              Tipos disponibles: <code style={{ background: 'var(--color-bg)', padding: '1px 5px', borderRadius: 4, fontSize: '0.78rem' }}>SINGLE</code> (una correcta), <code style={{ background: 'var(--color-bg)', padding: '1px 5px', borderRadius: 4, fontSize: '0.78rem' }}>MULTIPLE</code> (varias correctas), <code style={{ background: 'var(--color-bg)', padding: '1px 5px', borderRadius: 4, fontSize: '0.78rem' }}>TRUE_FALSE</code>. Si se omite <code style={{ background: 'var(--color-bg)', padding: '1px 5px', borderRadius: 4, fontSize: '0.78rem' }}>type</code>, se usa <code style={{ background: 'var(--color-bg)', padding: '1px 5px', borderRadius: 4, fontSize: '0.78rem' }}>SINGLE</code> por defecto.
            </p>
            <form onSubmit={handleImport}>
              {/* Selector de archivo */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '0.4rem' }}>
                  Subir archivo .json (opcional)
                </label>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportFile}
                  style={{ fontSize: '0.85rem', color: 'var(--color-text)' }}
                />
              </div>

              {/* Textarea para pegar JSON */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '0.4rem' }}>
                  O pega el JSON aquí
                </label>
                <textarea
                  className="field field-dark"
                  rows={10}
                  value={importJson}
                  onChange={(e) => { setImportJson(e.target.value); setImportError(''); }}
                  placeholder={'{\n  "questions": [\n    {\n      "type": "SINGLE",\n      "text": "¿Cuántos puntos vale un triple?",\n      "answers": [\n        { "text": "1", "isCorrect": false },\n        { "text": "2", "isCorrect": false },\n        { "text": "3", "isCorrect": true },\n        { "text": "4", "isCorrect": false }\n      ]\n    },\n    {\n      "type": "MULTIPLE",\n      "text": "¿Qué acciones dan puntos en baloncesto?",\n      "answers": [\n        { "text": "Canasta de 2", "isCorrect": true },\n        { "text": "Triple", "isCorrect": true },\n        { "text": "Tiro libre", "isCorrect": true },\n        { "text": "Saque de banda", "isCorrect": false }\n      ]\n    },\n    {\n      "type": "TRUE_FALSE",\n      "text": "Un tiro libre vale 2 puntos.",\n      "answers": [\n        { "text": "Verdadero", "isCorrect": false },\n        { "text": "Falso", "isCorrect": true }\n      ]\n    }\n  ]\n}'}
                  style={{ fontFamily: 'monospace', fontSize: '0.8rem', width: '100%', resize: 'vertical' }}
                />
              </div>

              {importError && (
                <p style={{ color: 'var(--color-error)', fontSize: '0.82rem', marginBottom: '1rem', padding: '0.5rem 0.75rem', background: 'rgba(239,68,68,0.1)', borderRadius: 6 }}>
                  {importError}
                </p>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => { setShowImportModal(false); setImportJson(''); setImportError(''); }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={importMut.isPending || !importJson.trim()}
                >
                  {importMut.isPending ? 'Importando...' : 'Importar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmación de borrado */}
      {deletingId && (
        <div style={confirmOverlayStyle}>
          <div style={confirmModalStyle}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--color-text)' }}>
              Eliminar pregunta
            </h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
              Esta acción no se puede deshacer.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setDeletingId(null)}>
                Cancelar
              </button>
              <button
                className="btn"
                style={{ background: 'var(--color-error)', color: '#fff', border: 'none' }}
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
