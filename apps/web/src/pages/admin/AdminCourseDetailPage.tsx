import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { AdminModule, AdminLesson, AdminQuestion, AdminAnswer, MatchContent, SortContent, FillBlankContent } from '@vkbacademy/shared';
import { LessonType, QuestionType } from '@vkbacademy/shared';
import {
  useAdminCourseDetail,
  useGenerateModule,
  useCreateModule,
  useUpdateModule,
  useDeleteModule,
  useGenerateLesson,
  useCreateLesson,
  useUpdateLesson,
  useDeleteLesson,
  useInitQuiz,
  useGenerateQuestion,
  useCreateQuestion,
  useUpdateQuestion,
  useDeleteQuestion,
} from '../../hooks/useAdminCourseDetail';
import type { CreateQuestionPayload, AnswerPayload } from '../../api/admin.api';

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

function emptyQuestionForm(): QuestionForm {
  return {
    text: '',
    type: QuestionType.SINGLE,
    answers: [
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
    ],
  };
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AdminCourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();

  const { data: course, isLoading } = useAdminCourseDetail(courseId!);

  // Mutations
  const generateModuleMut = useGenerateModule(courseId!);
  const createModuleMut = useCreateModule(courseId!);
  const updateModuleMut = useUpdateModule(courseId!);
  const deleteModuleMut = useDeleteModule(courseId!);
  const generateLessonMut = useGenerateLesson(courseId!);
  const createLessonMut = useCreateLesson(courseId!);
  const updateLessonMut = useUpdateLesson(courseId!);
  const deleteLessonMut = useDeleteLesson(courseId!);
  const initQuizMut = useInitQuiz(courseId!);
  const generateQuestionMut = useGenerateQuestion(courseId!);
  const createQuestionMut = useCreateQuestion(courseId!);
  const updateQuestionMut = useUpdateQuestion(courseId!);
  const deleteQuestionMut = useDeleteQuestion(courseId!);

  // Estado: módulos
  const [showNewModule, setShowNewModule] = useState(false);
  const [newModuleTab, setNewModuleTab] = useState<'manual' | 'ia'>('manual');
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [iaModuleName, setIaModuleName] = useState('');
  const [editingModule, setEditingModule] = useState<AdminModule | null>(null);
  const [editModuleTitle, setEditModuleTitle] = useState('');
  const [deletingModuleId, setDeletingModuleId] = useState<string | null>(null);

  // Estado: lecciones
  const [newLessonModuleId, setNewLessonModuleId] = useState<string | null>(null);
  const [newLessonTab, setNewLessonTab] = useState<'manual' | 'ia'>('manual');
  const [newLessonTitle, setNewLessonTitle] = useState('');
  const [newLessonType, setNewLessonType] = useState<LessonType>(LessonType.VIDEO);
  const [iaLessonTopic, setIaLessonTopic] = useState('');
  const [editingLesson, setEditingLesson] = useState<AdminLesson | null>(null);
  const [editLessonTitle, setEditLessonTitle] = useState('');
  const [deletingLessonId, setDeletingLessonId] = useState<string | null>(null);

  // Estado: quiz/preguntas
  const [expandedLessonId, setExpandedLessonId] = useState<string | null>(null);
  const [newQuestionQuizId, setNewQuestionQuizId] = useState<string | null>(null);
  const [newQuestionTab, setNewQuestionTab] = useState<'manual' | 'ia'>('manual');
  const [iaQuestionTopic, setIaQuestionTopic] = useState('');
  const [editingQuestion, setEditingQuestion] = useState<AdminQuestion | null>(null);
  const [deletingQuestionId, setDeletingQuestionId] = useState<string | null>(null);
  const [questionForm, setQuestionForm] = useState<QuestionForm>(emptyQuestionForm());

  // Estado: modal YouTube (input de URL manual)
  const [youtubeModal, setYoutubeModal] = useState<{ lessonId: string; url: string } | null>(null);

  // Estado: modal de contenido interactivo (MATCH, SORT, FILL_BLANK)
  const [contentModal, setContentModal] = useState<{
    lessonId: string;
    type: 'MATCH' | 'SORT' | 'FILL_BLANK';
    draft: MatchContent | SortContent | FillBlankContent;
  } | null>(null);

  // Toast
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  function showToast(msg: string, type: 'ok' | 'err' = 'ok') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  // ── Módulos ────────────────────────────────────────────────────────────────

  async function handleCreateModule(e: React.FormEvent) {
    e.preventDefault();
    if (!newModuleTitle.trim()) return;
    try {
      await createModuleMut.mutateAsync({ title: newModuleTitle });
      setShowNewModule(false);
      setNewModuleTitle('');
      showToast('Módulo creado');
    } catch {
      showToast('Error al crear el módulo', 'err');
    }
  }

  async function handleGenerateModule(e: React.FormEvent) {
    e.preventDefault();
    if (!iaModuleName.trim()) return;
    try {
      await generateModuleMut.mutateAsync(iaModuleName);
      setShowNewModule(false);
      setIaModuleName('');
      setNewModuleTab('manual');
      showToast('Módulo generado con IA correctamente');
    } catch {
      showToast('El agente IA no pudo generar el módulo', 'err');
    }
  }

  async function handleUpdateModule(e: React.FormEvent) {
    e.preventDefault();
    if (!editingModule) return;
    try {
      await updateModuleMut.mutateAsync({ moduleId: editingModule.id, payload: { title: editModuleTitle } });
      setEditingModule(null);
      showToast('Módulo actualizado');
    } catch {
      showToast('Error al actualizar el módulo', 'err');
    }
  }

  async function handleDeleteModule(moduleId: string) {
    try {
      await deleteModuleMut.mutateAsync(moduleId);
      setDeletingModuleId(null);
      showToast('Módulo eliminado');
    } catch {
      showToast('Error al eliminar el módulo', 'err');
    }
  }

  // ── Lecciones ──────────────────────────────────────────────────────────────

  function closeLessonModal() {
    setNewLessonModuleId(null);
    setNewLessonTitle('');
    setNewLessonType(LessonType.VIDEO);
    setIaLessonTopic('');
    setNewLessonTab('manual');
  }

  async function handleCreateLesson(e: React.FormEvent) {
    e.preventDefault();
    if (!newLessonModuleId || !newLessonTitle.trim()) return;
    try {
      await createLessonMut.mutateAsync({
        moduleId: newLessonModuleId,
        payload: { title: newLessonTitle, type: newLessonType },
      });
      closeLessonModal();
      showToast('Lección creada');
    } catch {
      showToast('Error al crear la lección', 'err');
    }
  }

  async function handleGenerateLesson(e: React.FormEvent) {
    e.preventDefault();
    if (!newLessonModuleId || !iaLessonTopic.trim()) return;
    try {
      await generateLessonMut.mutateAsync({ moduleId: newLessonModuleId, topic: iaLessonTopic });
      closeLessonModal();
      showToast('Lección generada con IA correctamente');
    } catch {
      showToast('El agente IA no pudo generar la lección', 'err');
    }
  }

  async function handleUpdateLesson(e: React.FormEvent) {
    e.preventDefault();
    if (!editingLesson) return;
    try {
      await updateLessonMut.mutateAsync({
        lessonId: editingLesson.id,
        payload: { title: editLessonTitle },
      });
      setEditingLesson(null);
      showToast('Lección actualizada');
    } catch {
      showToast('Error al actualizar la lección', 'err');
    }
  }

  async function handleDeleteLesson(lessonId: string) {
    try {
      await deleteLessonMut.mutateAsync(lessonId);
      setDeletingLessonId(null);
      if (expandedLessonId === lessonId) setExpandedLessonId(null);
      showToast('Lección eliminada');
    } catch {
      showToast('Error al eliminar la lección', 'err');
    }
  }

  // ── Quiz ───────────────────────────────────────────────────────────────────

  async function handleToggleQuiz(lesson: AdminLesson) {
    if (expandedLessonId === lesson.id) {
      setExpandedLessonId(null);
      return;
    }
    // Si no tiene quiz, inicializarlo
    if (!lesson.quiz) {
      try {
        await initQuizMut.mutateAsync(lesson.id);
      } catch {
        showToast('Error al inicializar el quiz', 'err');
        return;
      }
    }
    setExpandedLessonId(lesson.id);
  }

  // ── Preguntas ──────────────────────────────────────────────────────────────

  function openNewQuestion(quizId: string) {
    setNewQuestionQuizId(quizId);
    setNewQuestionTab('manual');
    setIaQuestionTopic('');
    setEditingQuestion(null);
    setQuestionForm(emptyQuestionForm());
  }

  function openEditQuestion(question: AdminQuestion) {
    setEditingQuestion(question);
    setNewQuestionQuizId(null);
    setQuestionForm({
      text: question.text,
      type: question.type,
      answers: question.answers.map((a: AdminAnswer) => ({ text: a.text, isCorrect: a.isCorrect })),
    });
  }

  function closeQuestionModal() {
    setNewQuestionQuizId(null);
    setNewQuestionTab('manual');
    setIaQuestionTopic('');
    setEditingQuestion(null);
    setQuestionForm(emptyQuestionForm());
  }

  function addAnswerRow() {
    setQuestionForm((f) => ({ ...f, answers: [...f.answers, { text: '', isCorrect: false }] }));
  }

  function removeAnswerRow(idx: number) {
    setQuestionForm((f) => ({ ...f, answers: f.answers.filter((_, i) => i !== idx) }));
  }

  function updateAnswer(idx: number, field: keyof AnswerDraft, value: string | boolean) {
    setQuestionForm((f) => {
      const answers = f.answers.map((a, i) => (i === idx ? { ...a, [field]: value } : a));
      return { ...f, answers };
    });
  }

  async function handleSaveQuestion(e: React.FormEvent) {
    e.preventDefault();
    const payload: CreateQuestionPayload = {
      text: questionForm.text,
      type: questionForm.type,
      answers: questionForm.answers.filter((a) => a.text.trim()) as AnswerPayload[],
    };
    try {
      if (editingQuestion) {
        await updateQuestionMut.mutateAsync({ questionId: editingQuestion.id, payload });
        showToast('Pregunta actualizada');
      } else if (newQuestionQuizId) {
        await createQuestionMut.mutateAsync({ quizId: newQuestionQuizId, payload });
        showToast('Pregunta añadida');
      }
      closeQuestionModal();
    } catch {
      showToast('Error al guardar la pregunta', 'err');
    }
  }

  async function handleGenerateQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!newQuestionQuizId || !iaQuestionTopic.trim()) return;
    try {
      await generateQuestionMut.mutateAsync({ quizId: newQuestionQuizId, topic: iaQuestionTopic });
      closeQuestionModal();
      showToast('Pregunta generada con IA correctamente');
    } catch {
      showToast('El agente IA no pudo generar la pregunta', 'err');
    }
  }

  async function handleDeleteQuestion(questionId: string) {
    try {
      await deleteQuestionMut.mutateAsync(questionId);
      setDeletingQuestionId(null);
      showToast('Pregunta eliminada');
    } catch {
      showToast('Error al eliminar la pregunta', 'err');
    }
  }

  // ── YouTube ────────────────────────────────────────────────────────────────

  function extractYoutubeId(input: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /^([a-zA-Z0-9_-]{11})$/,
    ];
    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  async function handleConfirmYoutube() {
    if (!youtubeModal) return;
    const youtubeId = extractYoutubeId(youtubeModal.url.trim());
    if (!youtubeId) {
      showToast('URL de YouTube no válida', 'err');
      return;
    }
    try {
      await updateLessonMut.mutateAsync({
        lessonId: youtubeModal.lessonId,
        payload: { youtubeId },
      });
      setYoutubeModal(null);
      showToast('Vídeo asignado correctamente');
    } catch {
      showToast('Error al asignar el vídeo', 'err');
    }
  }

  // ── Contenido interactivo ──────────────────────────────────────────────────

  function openContentModal(lesson: AdminLesson) {
    const type = lesson.type as 'MATCH' | 'SORT' | 'FILL_BLANK';
    let draft: MatchContent | SortContent | FillBlankContent;
    if (lesson.content) {
      draft = lesson.content as MatchContent | SortContent | FillBlankContent;
    } else if (type === 'MATCH') {
      draft = { pairs: [{ left: '', right: '' }, { left: '', right: '' }] } as MatchContent;
    } else if (type === 'SORT') {
      draft = { prompt: '', items: [{ text: '', correctOrder: 0 }, { text: '', correctOrder: 1 }] } as SortContent;
    } else {
      draft = { template: '', distractors: [] } as FillBlankContent;
    }
    setContentModal({ lessonId: lesson.id, type, draft });
  }

  async function handleSaveContent() {
    if (!contentModal) return;
    try {
      await updateLessonMut.mutateAsync({
        lessonId: contentModal.lessonId,
        payload: { content: contentModal.draft },
      });
      setContentModal(null);
      showToast('Contenido guardado');
    } catch {
      showToast('Error al guardar el contenido', 'err');
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (isLoading) {
    return <div style={s.page}><p style={s.muted}>Cargando curso...</p></div>;
  }

  if (!course) {
    return <div style={s.page}><p style={s.muted}>Curso no encontrado.</p></div>;
  }

  const isQuestionModalOpen = !!(newQuestionQuizId || editingQuestion);

  return (
    <div style={s.page}>
      {/* Toast */}
      {toast && (
        <div style={{ ...s.toast, background: toast.type === 'ok' ? 'var(--color-primary)' : 'var(--color-error)' }}>
          {toast.msg}
        </div>
      )}

      {/* Hero con breadcrumb */}
      <div className="page-hero animate-in" style={{ marginBottom: 24 }}>
        <button
          style={s.btnBack}
          onClick={() => navigate('/admin/courses')}
        >
          ← Volver a cursos
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' as const, marginTop: 8 }}>
          <h1 className="hero-title" style={{ fontSize: '1.6rem' }}>{course.title}</h1>
          {course.schoolYear && (
            <span style={s.badgeLevel}>{course.schoolYear.label}</span>
          )}
          <span style={course.published ? s.badgeOk : s.badgeDraft}>
            {course.published ? 'Publicado' : 'Borrador'}
          </span>
          <button
            className="btn btn-dark"
            style={{ fontSize: '0.82rem', padding: '5px 12px', marginLeft: 'auto' }}
            title="Gestionar banco de preguntas del curso"
            onClick={() => navigate(`/admin/exam-banks?courseId=${courseId}`)}
          >
            Banco examen
          </button>
        </div>
      </div>

      {/* Lista de módulos */}
      {course.modules.map((mod) => (
        <div key={mod.id} style={s.moduleCard}>
          {/* Cabecera módulo */}
          <div style={s.moduleHeader}>
            <span style={s.moduleTitle}>{mod.title}</span>
            <div style={s.actions}>
              <button
                style={s.btnActionSm}
                title="Banco de preguntas del módulo"
                onClick={() => navigate(`/admin/exam-banks?moduleId=${mod.id}`)}
              >
                Banco
              </button>
              <button
                style={s.btnIcon}
                title="Renombrar módulo"
                onClick={() => {
                  setEditingModule(mod);
                  setEditModuleTitle(mod.title);
                }}
              >
                ✏️
              </button>
              {deletingModuleId === mod.id ? (
                <span style={s.confirmDelete}>
                  ¿Seguro?{' '}
                  <button
                    style={s.btnDangerSm}
                    disabled={deleteModuleMut.isPending}
                    onClick={() => void handleDeleteModule(mod.id)}
                  >
                    Sí
                  </button>{' '}
                  <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: '0.78rem' }} onClick={() => setDeletingModuleId(null)}>No</button>
                </span>
              ) : (
                <button style={{ ...s.btnIcon, color: '#ef4444' }} title="Eliminar módulo" onClick={() => setDeletingModuleId(mod.id)}>🗑️</button>
              )}
            </div>
          </div>

          {/* Lecciones */}
          {mod.lessons.map((lesson) => (
            <div key={lesson.id}>
              <div style={s.lessonRow}>
                <span style={s.lessonBadge}>{lesson.type}</span>
                <span style={s.lessonTitle}>{lesson.title}</span>
                <div style={s.actions}>
                  {lesson.type === LessonType.VIDEO && (
                    <>
                      {lesson.youtubeId && (
                        <img
                          src={`https://img.youtube.com/vi/${lesson.youtubeId}/default.jpg`}
                          alt="miniatura"
                          style={{ width: 80, height: 45, borderRadius: 4, objectFit: 'cover' }}
                        />
                      )}
                      <button
                        style={s.btnActionSm}
                        title={lesson.youtubeId ? 'Cambiar vídeo de YouTube' : 'Añadir vídeo de YouTube'}
                        onClick={() => setYoutubeModal({ lessonId: lesson.id, url: '' })}
                      >
                        {lesson.youtubeId ? 'Cambiar' : 'Añadir vídeo'}
                      </button>
                    </>
                  )}
                  {lesson.type === LessonType.QUIZ && (
                    <button
                      style={s.btnActionSm}
                      title="Gestionar preguntas"
                      onClick={() => void handleToggleQuiz(lesson)}
                    >
                      Preguntas
                    </button>
                  )}
                  {(lesson.type === LessonType.MATCH || lesson.type === LessonType.SORT || lesson.type === LessonType.FILL_BLANK) && (
                    <button
                      style={{ ...s.btnActionSm, background: 'rgba(234,88,12,0.1)', color: 'var(--color-primary)', borderColor: 'rgba(234,88,12,0.3)' }}
                      title="Editar contenido de la actividad"
                      onClick={() => openContentModal(lesson)}
                    >
                      Contenido
                    </button>
                  )}
                  <button
                    style={s.btnIcon}
                    title="Renombrar lección"
                    onClick={() => {
                      setEditingLesson(lesson);
                      setEditLessonTitle(lesson.title);
                    }}
                  >
                    ✏️
                  </button>
                  {deletingLessonId === lesson.id ? (
                    <span style={s.confirmDelete}>
                      ¿Seguro?{' '}
                      <button
                        style={s.btnDangerSm}
                        disabled={deleteLessonMut.isPending}
                        onClick={() => void handleDeleteLesson(lesson.id)}
                      >
                        Sí
                      </button>{' '}
                      <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: '0.78rem' }} onClick={() => setDeletingLessonId(null)}>No</button>
                    </span>
                  ) : (
                    <button style={{ ...s.btnIcon, color: '#ef4444' }} title="Eliminar lección" onClick={() => setDeletingLessonId(lesson.id)}>🗑️</button>
                  )}
                </div>
              </div>

              {/* Sección preguntas (expandible) */}
              {expandedLessonId === lesson.id && lesson.quiz && (
                <div style={s.questionsSection}>
                  {lesson.quiz.questions.length === 0 && (
                    <p style={s.muted}>Sin preguntas. Añade la primera.</p>
                  )}
                  {lesson.quiz.questions.map((q, qi) => (
                    <div key={q.id} style={s.questionRow}>
                      <div style={s.questionHeader}>
                        <span style={s.questionNum}>{qi + 1}.</span>
                        <span style={s.questionText}>{q.text}</span>
                        <span style={s.questionType}>{q.type}</span>
                        <div style={s.actions}>
                          <button style={s.btnIcon} title="Editar pregunta" onClick={() => openEditQuestion(q)}>✏️</button>
                          {deletingQuestionId === q.id ? (
                            <span style={s.confirmDelete}>
                              ¿Seguro?{' '}
                              <button
                                style={s.btnDangerSm}
                                disabled={deleteQuestionMut.isPending}
                                onClick={() => void handleDeleteQuestion(q.id)}
                              >
                                Sí
                              </button>{' '}
                              <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: '0.78rem' }} onClick={() => setDeletingQuestionId(null)}>No</button>
                            </span>
                          ) : (
                            <button style={{ ...s.btnIcon, color: '#ef4444' }} title="Eliminar pregunta" onClick={() => setDeletingQuestionId(q.id)}>🗑️</button>
                          )}
                        </div>
                      </div>
                      <div style={s.answerList}>
                        {q.answers.map((a) => (
                          <div key={a.id} style={s.answerItem}>
                            <span style={a.isCorrect ? s.answerCorrect : s.answerWrong}>
                              {a.isCorrect ? '✓' : '○'}
                            </span>
                            <span>{a.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <button
                    style={s.btnAddSmall}
                    onClick={() => openNewQuestion(lesson.quiz!.id)}
                  >
                    + Añadir pregunta
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Botón añadir lección */}
          <button style={{ ...s.btnAddSmall, margin: '10px 14px' }} onClick={() => setNewLessonModuleId(mod.id)}>
            + Añadir lección
          </button>
        </div>
      ))}

      {/* Botón añadir módulo */}
      <button
        className="btn btn-ghost"
        style={{ marginTop: 16, width: '100%', borderStyle: 'dashed', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}
        onClick={() => setShowNewModule(true)}
      >
        + Añadir módulo
      </button>

      {/* Modal: nueva lección (Manual / IA) */}
      {newLessonModuleId && (
        <div style={s.overlay} onClick={closeLessonModal}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>Nueva lección</h2>
              <button style={s.closeBtn} onClick={closeLessonModal}>✕</button>
            </div>

            {/* Tabs */}
            <div style={s.tabs}>
              <button
                style={{ ...s.tab, ...(newLessonTab === 'manual' ? s.tabActive : {}) }}
                onClick={() => setNewLessonTab('manual')}
              >
                Manual
              </button>
              <button
                style={{ ...s.tab, ...(newLessonTab === 'ia' ? s.tabActive : {}) }}
                onClick={() => setNewLessonTab('ia')}
              >
                Generar con IA
              </button>
            </div>

            {newLessonTab === 'manual' ? (
              <form onSubmit={(e) => void handleCreateLesson(e)} style={s.form}>
                <div className="field">
                  <label>Título</label>
                  <input
                    required
                    autoFocus
                    placeholder="Ej: Introducción a las fracciones"
                    value={newLessonTitle}
                    onChange={(e) => setNewLessonTitle(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Tipo</label>
                  <select
                    value={newLessonType}
                    onChange={(e) => setNewLessonType(e.target.value as LessonType)}
                  >
                    <option value={LessonType.VIDEO}>VIDEO</option>
                    <option value={LessonType.QUIZ}>QUIZ</option>
                    <option value={LessonType.EXERCISE}>EXERCISE</option>
                    <option value={LessonType.MATCH}>Emparejar (MATCH)</option>
                    <option value={LessonType.SORT}>Ordenar (SORT)</option>
                    <option value={LessonType.FILL_BLANK}>Rellenar huecos (FILL_BLANK)</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="btn btn-primary btn-full"
                  style={{ marginTop: 16 }}
                  disabled={createLessonMut.isPending}
                >
                  {createLessonMut.isPending ? 'Creando...' : 'Crear lección'}
                </button>
              </form>
            ) : (
              <form onSubmit={(e) => void handleGenerateLesson(e)} style={s.form}>
                <div className="field">
                  <label>Tema de la lección</label>
                  <input
                    required
                    autoFocus
                    placeholder="Ej: Las fracciones equivalentes, El sistema nervioso..."
                    value={iaLessonTopic}
                    onChange={(e) => setIaLessonTopic(e.target.value)}
                  />
                </div>
                <p style={{ ...s.hint, textAlign: 'left' }}>
                  El agente elegirá el tipo (VIDEO o QUIZ) según el tema y el contexto del módulo.
                </p>
                <button
                  type="submit"
                  className="btn btn-primary btn-full"
                  style={{ marginTop: 16 }}
                  disabled={generateLessonMut.isPending}
                >
                  {generateLessonMut.isPending ? 'El agente está creando la lección...' : 'Generar con IA'}
                </button>
                {generateLessonMut.isPending && (
                  <p style={s.hint}>Esto puede tardar unos segundos.</p>
                )}
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal: nuevo módulo (Manual / IA) */}
      {showNewModule && (
        <div style={s.overlay} onClick={() => { setShowNewModule(false); setNewModuleTitle(''); setIaModuleName(''); setNewModuleTab('manual'); }}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>Nuevo módulo</h2>
              <button style={s.closeBtn} onClick={() => { setShowNewModule(false); setNewModuleTitle(''); setIaModuleName(''); setNewModuleTab('manual'); }}>✕</button>
            </div>

            {/* Tabs */}
            <div style={s.tabs}>
              <button
                style={{ ...s.tab, ...(newModuleTab === 'manual' ? s.tabActive : {}) }}
                onClick={() => setNewModuleTab('manual')}
              >
                Manual
              </button>
              <button
                style={{ ...s.tab, ...(newModuleTab === 'ia' ? s.tabActive : {}) }}
                onClick={() => setNewModuleTab('ia')}
              >
                Generar con IA
              </button>
            </div>

            {newModuleTab === 'manual' ? (
              <form onSubmit={(e) => void handleCreateModule(e)} style={s.form}>
                <div className="field">
                  <label>Título del módulo</label>
                  <input
                    required
                    autoFocus
                    placeholder="Ej: Introducción al álgebra"
                    value={newModuleTitle}
                    onChange={(e) => setNewModuleTitle(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary btn-full"
                  style={{ marginTop: 16 }}
                  disabled={createModuleMut.isPending}
                >
                  {createModuleMut.isPending ? 'Creando...' : 'Crear módulo'}
                </button>
              </form>
            ) : (
              <form onSubmit={(e) => void handleGenerateModule(e)} style={s.form}>
                <div className="field">
                  <label>Tema del módulo</label>
                  <input
                    required
                    autoFocus
                    placeholder="Ej: Ecuaciones de primer grado, La célula, La Revolución Francesa..."
                    value={iaModuleName}
                    onChange={(e) => setIaModuleName(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary btn-full"
                  style={{ marginTop: 16 }}
                  disabled={generateModuleMut.isPending}
                >
                  {generateModuleMut.isPending ? 'El agente está creando el módulo...' : 'Generar con IA'}
                </button>
                {generateModuleMut.isPending && (
                  <p style={s.hint}>Esto puede tardar unos segundos.</p>
                )}
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal: editar módulo */}
      {editingModule && (
        <div style={s.overlay} onClick={() => setEditingModule(null)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>Renombrar módulo</h2>
              <button style={s.closeBtn} onClick={() => setEditingModule(null)}>✕</button>
            </div>
            <form onSubmit={(e) => void handleUpdateModule(e)} style={s.form}>
              <div className="field">
                <label>Título</label>
                <input
                  required
                  autoFocus
                  value={editModuleTitle}
                  onChange={(e) => setEditModuleTitle(e.target.value)}
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary btn-full"
                style={{ marginTop: 16 }}
                disabled={updateModuleMut.isPending}
              >
                {updateModuleMut.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: editar lección */}
      {editingLesson && (
        <div style={s.overlay} onClick={() => setEditingLesson(null)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>Editar lección</h2>
              <button style={s.closeBtn} onClick={() => setEditingLesson(null)}>✕</button>
            </div>
            <form onSubmit={(e) => void handleUpdateLesson(e)} style={s.form}>
              <div className="field">
                <label>Título</label>
                <input
                  required
                  autoFocus
                  value={editLessonTitle}
                  onChange={(e) => setEditLessonTitle(e.target.value)}
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary btn-full"
                style={{ marginTop: 16 }}
                disabled={updateLessonMut.isPending}
              >
                {updateLessonMut.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: YouTube URL manual */}
      {youtubeModal && (() => {
        const previewId = extractYoutubeId(youtubeModal.url.trim());
        return (
          <div style={s.overlay} onClick={() => setYoutubeModal(null)}>
            <div style={{ ...s.modal, maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
              <div style={s.modalHeader}>
                <h2 style={s.modalTitle}>Añadir vídeo de YouTube</h2>
                <button style={s.closeBtn} onClick={() => setYoutubeModal(null)}>✕</button>
              </div>
              <div style={s.form}>
                <div className="field">
                  <label>URL o ID del vídeo</label>
                  <input
                    autoFocus
                    placeholder="https://www.youtube.com/watch?v=... o el ID directamente"
                    value={youtubeModal.url}
                    onChange={(e) => setYoutubeModal((m) => m ? { ...m, url: e.target.value } : m)}
                  />
                </div>
                {/* Preview del iframe si la URL es válida */}
                {previewId && (
                  <div style={{ aspectRatio: '16/9', borderRadius: 8, overflow: 'hidden', marginTop: 8 }}>
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${previewId}`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      style={{ width: '100%', height: '100%', border: 'none' }}
                      title="Preview"
                    />
                  </div>
                )}
                <button
                  className="btn btn-primary btn-full"
                  style={{ marginTop: 12 }}
                  disabled={!previewId || updateLessonMut.isPending}
                  onClick={() => void handleConfirmYoutube()}
                >
                  {updateLessonMut.isPending ? 'Guardando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal: contenido interactivo */}
      {contentModal && (
        <div style={s.overlay} onClick={() => setContentModal(null)}>
          <div style={{ ...s.modal, maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>
                {contentModal.type === 'MATCH' && 'Emparejar — editar pares'}
                {contentModal.type === 'SORT' && 'Ordenar — editar items'}
                {contentModal.type === 'FILL_BLANK' && 'Rellenar huecos — editar contenido'}
              </h2>
              <button style={s.closeBtn} onClick={() => setContentModal(null)}>✕</button>
            </div>

            {/* MATCH */}
            {contentModal.type === 'MATCH' && (() => {
              const draft = contentModal.draft as MatchContent;
              return (
                <div style={s.form}>
                  <p style={s.hint}>Añade entre 3 y 6 pares. Cada par tiene un elemento izquierdo y uno derecho.</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '6px 8px', alignItems: 'center' }}>
                    <span style={s.label}>Izquierda</span>
                    <span style={s.label}>Derecha</span>
                    <span />
                    {draft.pairs.map((pair, idx) => (
                      <>
                        <input
                          key={`l-${idx}`}
                          style={s.input}
                          placeholder={`Izq. ${idx + 1}`}
                          value={pair.left}
                          onChange={(e) => {
                            const pairs = draft.pairs.map((p, i) => i === idx ? { ...p, left: e.target.value } : p);
                            setContentModal((m) => m ? { ...m, draft: { pairs } } : m);
                          }}
                        />
                        <input
                          key={`r-${idx}`}
                          style={s.input}
                          placeholder={`Der. ${idx + 1}`}
                          value={pair.right}
                          onChange={(e) => {
                            const pairs = draft.pairs.map((p, i) => i === idx ? { ...p, right: e.target.value } : p);
                            setContentModal((m) => m ? { ...m, draft: { pairs } } : m);
                          }}
                        />
                        <button
                          key={`d-${idx}`}
                          style={s.btnIcon}
                          disabled={draft.pairs.length <= 2}
                          onClick={() => {
                            const pairs = draft.pairs.filter((_, i) => i !== idx);
                            setContentModal((m) => m ? { ...m, draft: { pairs } } : m);
                          }}
                        >🗑️</button>
                      </>
                    ))}
                  </div>
                  {draft.pairs.length < 6 && (
                    <button style={s.btnAddSmall} onClick={() => {
                      const pairs = [...draft.pairs, { left: '', right: '' }];
                      setContentModal((m) => m ? { ...m, draft: { pairs } } : m);
                    }}>
                      + Añadir par
                    </button>
                  )}
                  <button
                    className="btn btn-primary btn-full"
                    style={{ marginTop: 16 }}
                    disabled={updateLessonMut.isPending}
                    onClick={() => void handleSaveContent()}
                  >
                    {updateLessonMut.isPending ? 'Guardando...' : 'Guardar contenido'}
                  </button>
                </div>
              );
            })()}

            {/* SORT */}
            {contentModal.type === 'SORT' && (() => {
              const draft = contentModal.draft as SortContent;
              return (
                <div style={s.form}>
                  <p style={s.hint}>El orden correcto es el orden en que aparecen los items en la lista (de arriba a abajo).</p>
                  <div className="field">
                    <label>Instrucción</label>
                    <input
                      placeholder="Ej: Ordena los planetas de menor a mayor distancia al Sol"
                      value={draft.prompt}
                      onChange={(e) => setContentModal((m) => m ? { ...m, draft: { ...draft, prompt: e.target.value } } : m)}
                    />
                  </div>
                  <label style={s.label}>Items (en orden correcto)</label>
                  {draft.items.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ ...s.label, minWidth: 20 }}>{idx + 1}.</span>
                      <input
                        style={{ ...s.input, flex: 1 }}
                        placeholder={`Item ${idx + 1}`}
                        value={item.text}
                        onChange={(e) => {
                          const items = draft.items.map((it, i) => i === idx ? { ...it, text: e.target.value } : it);
                          setContentModal((m) => m ? { ...m, draft: { ...draft, items } } : m);
                        }}
                      />
                      <button
                        style={s.btnIcon}
                        disabled={draft.items.length <= 2}
                        onClick={() => {
                          const items = draft.items
                            .filter((_, i) => i !== idx)
                            .map((it, i) => ({ ...it, correctOrder: i }));
                          setContentModal((m) => m ? { ...m, draft: { ...draft, items } } : m);
                        }}
                      >🗑️</button>
                    </div>
                  ))}
                  {draft.items.length < 8 && (
                    <button style={s.btnAddSmall} onClick={() => {
                      const items = [...draft.items, { text: '', correctOrder: draft.items.length }];
                      setContentModal((m) => m ? { ...m, draft: { ...draft, items } } : m);
                    }}>
                      + Añadir item
                    </button>
                  )}
                  <button
                    className="btn btn-primary btn-full"
                    style={{ marginTop: 16 }}
                    disabled={updateLessonMut.isPending}
                    onClick={() => void handleSaveContent()}
                  >
                    {updateLessonMut.isPending ? 'Guardando...' : 'Guardar contenido'}
                  </button>
                </div>
              );
            })()}

            {/* FILL_BLANK */}
            {contentModal.type === 'FILL_BLANK' && (() => {
              const draft = contentModal.draft as FillBlankContent;
              return (
                <div style={s.form}>
                  <div className="field">
                    <label>Plantilla de texto</label>
                    <p style={s.hint}>Usa {'{{palabra}}'} para marcar los huecos. Ej: {'"El {{triple}} vale {{3}} puntos."'}</p>
                    <textarea
                      style={{ minHeight: 80, resize: 'vertical' as const, fontFamily: 'inherit' }}
                      placeholder="El {{triple}} vale {{3}} puntos."
                      value={draft.template}
                      onChange={(e) => setContentModal((m) => m ? { ...m, draft: { ...draft, template: e.target.value } } : m)}
                    />
                  </div>
                  <label style={s.label}>Distractores (palabras incorrectas para el banco)</label>
                  {draft.distractors.map((d, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        style={{ ...s.input, flex: 1 }}
                        placeholder={`Distractor ${idx + 1}`}
                        value={d}
                        onChange={(e) => {
                          const distractors = draft.distractors.map((x, i) => i === idx ? e.target.value : x);
                          setContentModal((m) => m ? { ...m, draft: { ...draft, distractors } } : m);
                        }}
                      />
                      <button
                        style={s.btnIcon}
                        onClick={() => {
                          const distractors = draft.distractors.filter((_, i) => i !== idx);
                          setContentModal((m) => m ? { ...m, draft: { ...draft, distractors } } : m);
                        }}
                      >🗑️</button>
                    </div>
                  ))}
                  <button style={s.btnAddSmall} onClick={() => {
                    const distractors = [...draft.distractors, ''];
                    setContentModal((m) => m ? { ...m, draft: { ...draft, distractors } } : m);
                  }}>
                    + Añadir distractor
                  </button>
                  <button
                    className="btn btn-primary btn-full"
                    style={{ marginTop: 16 }}
                    disabled={updateLessonMut.isPending}
                    onClick={() => void handleSaveContent()}
                  >
                    {updateLessonMut.isPending ? 'Guardando...' : 'Guardar contenido'}
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Modal: pregunta */}
      {isQuestionModalOpen && (
        <div style={s.overlay} onClick={closeQuestionModal}>
          <div style={{ ...s.modal, maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>{editingQuestion ? 'Editar pregunta' : 'Nueva pregunta'}</h2>
              <button style={s.closeBtn} onClick={closeQuestionModal}>✕</button>
            </div>

            {/* Tabs — solo al crear, no al editar */}
            {!editingQuestion && (
              <div style={s.tabs}>
                <button
                  style={{ ...s.tab, ...(newQuestionTab === 'manual' ? s.tabActive : {}) }}
                  onClick={() => setNewQuestionTab('manual')}
                >
                  Manual
                </button>
                <button
                  style={{ ...s.tab, ...(newQuestionTab === 'ia' ? s.tabActive : {}) }}
                  onClick={() => setNewQuestionTab('ia')}
                >
                  Generar con IA
                </button>
              </div>
            )}

            {/* Tab IA */}
            {!editingQuestion && newQuestionTab === 'ia' ? (
              <form onSubmit={(e) => void handleGenerateQuestion(e)} style={s.form}>
                <div className="field">
                  <label>Tema de la pregunta</label>
                  <input
                    required
                    autoFocus
                    placeholder="Ej: Las leyes de Newton, La fotosíntesis, El presente de indicativo..."
                    value={iaQuestionTopic}
                    onChange={(e) => setIaQuestionTopic(e.target.value)}
                  />
                </div>
                <p style={{ ...s.hint, textAlign: 'left' }}>
                  El agente generará el enunciado, tipo (SINGLE o TRUE/FALSE) y las respuestas automáticamente.
                </p>
                <button
                  type="submit"
                  className="btn btn-primary btn-full"
                  style={{ marginTop: 16 }}
                  disabled={generateQuestionMut.isPending}
                >
                  {generateQuestionMut.isPending ? 'El agente está creando la pregunta...' : 'Generar con IA'}
                </button>
                {generateQuestionMut.isPending && (
                  <p style={s.hint}>Esto puede tardar unos segundos.</p>
                )}
              </form>
            ) : (
              /* Tab Manual (también usado para edición) */
              <form onSubmit={(e) => void handleSaveQuestion(e)} style={s.form}>
                <div className="field">
                  <label>Enunciado</label>
                  <input
                    required
                    autoFocus
                    value={questionForm.text}
                    onChange={(e) => setQuestionForm((f) => ({ ...f, text: e.target.value }))}
                  />
                </div>

                <div className="field">
                  <label>Tipo</label>
                  <select
                    value={questionForm.type}
                    onChange={(e) => setQuestionForm((f) => ({ ...f, type: e.target.value as QuestionType }))}
                  >
                    <option value={QuestionType.SINGLE}>SINGLE (una respuesta)</option>
                    <option value={QuestionType.MULTIPLE}>MULTIPLE (varias respuestas)</option>
                    <option value={QuestionType.TRUE_FALSE}>TRUE/FALSE</option>
                  </select>
                </div>

                <label style={{ ...s.label, marginTop: 12 }}>Respuestas</label>
                {questionForm.answers.map((ans, idx) => (
                  <div key={idx} style={s.answerFormRow}>
                    <input
                      required
                      style={{ ...s.input, flex: 1 }}
                      placeholder={`Respuesta ${idx + 1}`}
                      value={ans.text}
                      onChange={(e) => updateAnswer(idx, 'text', e.target.value)}
                    />
                    <label style={s.checkboxLabel} title="Correcta">
                      <input
                        type="checkbox"
                        checked={ans.isCorrect}
                        onChange={(e) => updateAnswer(idx, 'isCorrect', e.target.checked)}
                      />
                      ✓
                    </label>
                    {questionForm.answers.length > 2 && (
                      <button type="button" style={s.btnIcon} onClick={() => removeAnswerRow(idx)}>🗑️</button>
                    )}
                  </div>
                ))}
                <button type="button" style={s.btnAddSmall} onClick={addAnswerRow}>
                  + Añadir respuesta
                </button>

                <button
                  type="submit"
                  className="btn btn-primary btn-full"
                  style={{ marginTop: 16 }}
                  disabled={createQuestionMut.isPending || updateQuestionMut.isPending}
                >
                  {(createQuestionMut.isPending || updateQuestionMut.isPending) ? 'Guardando...' : 'Guardar pregunta'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page: { padding: '2rem', position: 'relative', maxWidth: 860, margin: '0 auto' },

  // Módulo
  moduleCard: {
    border: '1.5px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    marginBottom: 16,
    overflow: 'hidden',
    background: 'var(--color-surface)',
    boxShadow: 'var(--shadow-sm)',
  },
  moduleHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px 16px',
    background: 'linear-gradient(90deg, rgba(234,88,12,0.06) 0%, transparent 100%)',
    borderBottom: '1px solid var(--color-border)',
    borderLeft: '3px solid var(--color-primary)',
  },
  moduleTitle: { fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text)' },

  // Lección
  lessonRow: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '9px 16px 9px 32px',
    borderBottom: '1px solid var(--color-border)',
  },
  lessonBadge: {
    fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: 999,
    background: 'rgba(234,88,12,0.1)', color: 'var(--color-primary)',
    border: '1px solid rgba(234,88,12,0.2)',
    flexShrink: 0,
  },
  lessonTitle: { flex: 1, fontSize: '0.9rem', color: 'var(--color-text)' },

  // Preguntas
  questionsSection: {
    paddingLeft: 52, paddingRight: 16, paddingTop: 10, paddingBottom: 10,
    background: 'var(--color-bg)',
    borderBottom: '1px solid var(--color-border)',
  },
  questionRow: { marginBottom: 12 },
  questionHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 },
  questionNum: { fontWeight: 700, fontSize: '0.82rem', color: 'var(--color-text-muted)', flexShrink: 0 },
  questionText: { flex: 1, fontSize: '0.88rem', color: 'var(--color-text)' },
  questionType: {
    fontSize: '0.68rem', fontWeight: 700, padding: '1px 6px', borderRadius: 999,
    background: 'var(--color-border)', color: 'var(--color-text-muted)',
  },
  answerList: { paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 2 },
  answerItem: { display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem' },
  answerCorrect: { color: '#16a34a', fontWeight: 700, width: 14 },
  answerWrong: { color: 'var(--color-text-muted)', width: 14 },

  // Answer form row
  answerFormRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 },
  checkboxLabel: {
    display: 'flex', alignItems: 'center', gap: 4,
    fontSize: '0.85rem', cursor: 'pointer', flexShrink: 0,
  },

  actions: { display: 'flex', alignItems: 'center', gap: 4 },
  confirmDelete: {
    fontSize: '0.8rem', color: 'var(--color-text-muted)',
    display: 'inline-flex', alignItems: 'center', gap: 4,
  },
  muted: { color: 'var(--color-text-muted)', fontSize: '0.875rem', padding: '8px 0' },

  // Badges
  badgeLevel: {
    fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: 999,
    background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)', border: '1px solid rgba(255,255,255,0.25)',
  },
  badgeOk: {
    display: 'inline-block', fontSize: '0.72rem', fontWeight: 600,
    padding: '2px 8px', borderRadius: 999,
    background: 'rgba(16,185,129,0.2)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)',
  },
  badgeDraft: {
    display: 'inline-block', fontSize: '0.72rem', fontWeight: 600,
    padding: '2px 8px', borderRadius: 999,
    background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.65)',
  },

  // Botones
  btnDangerSm: {
    background: '#fef2f2', color: '#ef4444',
    border: '1px solid #fecaca', borderRadius: 4, padding: '2px 8px',
    fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer',
  },
  btnIcon: {
    background: 'transparent', border: 'none', cursor: 'pointer',
    fontSize: '1rem', padding: '2px 4px', borderRadius: 4,
  },
  btnActionSm: {
    background: 'transparent', cursor: 'pointer',
    border: '1px solid var(--color-border)', borderRadius: 6,
    padding: '3px 10px', fontSize: '0.78rem', fontWeight: 600,
    color: 'var(--color-text-muted)', flexShrink: 0,
  },
  btnBack: {
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: '0.875rem',
    padding: 0, display: 'block',
  },
  btnAddSmall: {
    background: 'transparent', border: '1px dashed var(--color-border)',
    color: 'var(--color-text-muted)', borderRadius: 6,
    padding: '5px 12px', cursor: 'pointer', fontSize: '0.82rem',
    display: 'block', marginTop: 6,
  },

  // Input / select en modales de contenido
  input: {
    width: '100%', boxSizing: 'border-box' as const,
    padding: '8px 12px', borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)', color: 'var(--color-text)',
    fontSize: '0.9rem',
  },
  label: { fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-muted)' },

  // Modal
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 100,
  },
  modal: {
    background: 'var(--color-surface)',
    borderRadius: 'var(--radius-md)', padding: 28,
    width: '100%', maxWidth: 480,
    boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
    border: '1.5px solid var(--color-border)',
    maxHeight: '90vh', overflowY: 'auto',
  },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 },
  closeBtn: { background: 'transparent', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: 'var(--color-text-muted)' },

  // Tabs
  tabs: { display: 'flex', gap: 4, marginBottom: 20, background: 'var(--color-border)', borderRadius: 8, padding: 3 },
  tab: {
    flex: 1, padding: '7px 0', borderRadius: 6,
    border: 'none', background: 'transparent',
    color: 'var(--color-text-muted)', fontWeight: 500,
    cursor: 'pointer', fontSize: '0.875rem',
  },
  tabActive: { background: 'var(--color-surface)', color: 'var(--color-text)', fontWeight: 600, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' },

  // Formulario
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  hint: { fontSize: '0.8rem', color: 'var(--color-text-muted)', textAlign: 'center' as const, marginTop: 4 },

  // Toast
  toast: {
    position: 'fixed', bottom: 24, right: 24,
    color: '#fff', padding: '10px 20px',
    borderRadius: 8, fontWeight: 600, fontSize: '0.9rem',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 200,
  },
};
