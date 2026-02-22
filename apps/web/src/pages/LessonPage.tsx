import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCourse } from '../hooks/useCourses';
import { useLesson, useCompleteLesson, useSubmitQuiz, useQuizAttempts } from '../hooks/useCourses';
import type { QuizAnswerSubmission, QuizSubmitResult, PublicQuiz, MatchContent, SortContent, FillBlankContent } from '@vkbacademy/shared';
import { LessonType } from '@vkbacademy/shared';
import { generateQuizPdf } from '../utils/quizPdf';
import { coursesApi } from '../api/courses.api';
import MatchLesson from '../components/lessons/MatchLesson';
import SortLesson from '../components/lessons/SortLesson';
import FillBlankLesson from '../components/lessons/FillBlankLesson';

const LESSON_TYPE_LABELS: Partial<Record<LessonType, string>> = {
  [LessonType.VIDEO]: 'Vídeo',
  [LessonType.QUIZ]: 'Test',
  [LessonType.EXERCISE]: 'Ejercicio',
  [LessonType.MATCH]: 'Emparejar',
  [LessonType.SORT]: 'Ordenar',
  [LessonType.FILL_BLANK]: 'Rellenar',
};

const S: Record<string, React.CSSProperties> = {
  page: { display: 'flex', flexDirection: 'column', gap: 0, maxWidth: 820, margin: '0 auto' },

  // Navegación superior
  nav: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  backBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--color-text-muted)',
    fontSize: '0.875rem',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontFamily: 'inherit',
    transition: 'color 0.15s',
  },
  prevNextWrap: { display: 'flex', gap: 8 },
  prevNextBtn: {
    background: 'var(--color-surface)',
    border: '1.5px solid var(--color-border)',
    borderRadius: 8,
    padding: '6px 14px',
    cursor: 'pointer',
    fontSize: '0.85rem',
    color: 'var(--color-text)',
    fontFamily: 'inherit',
    fontWeight: 600,
    transition: 'border-color 0.15s, background 0.15s',
  },

  // Breadcrumb dentro de la card de encabezado
  lessonTypeBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '3px 10px',
    borderRadius: 999,
    fontSize: '0.72rem',
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
    background: 'rgba(234,88,12,0.10)',
    color: 'var(--color-primary)',
    marginBottom: 8,
    width: 'fit-content',
  },
  heading: {
    fontSize: '1.4rem',
    fontWeight: 800,
    color: 'var(--color-text)',
    marginBottom: 24,
    lineHeight: 1.25,
    letterSpacing: '-0.01em',
  },

  // Marco de contenido (vídeo / actividad interactiva)
  contentFrame: {
    border: '2px solid rgba(234,88,12,0.20)',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
  },
  iframeWrapper: {
    aspectRatio: '16/9',
    background: '#000',
  },
  iframe: { width: '100%', height: '100%', border: 'none', display: 'block' },
  noVideo: {
    background: 'var(--color-border)',
    height: 220,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--color-text-muted)',
    fontSize: '0.9rem',
  },
  activityFrame: {
    background: '#fff',
    padding: 0,
  },

  // Completar / completada
  completedBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    background: '#d1fae5',
    color: '#065f46',
    borderRadius: 10,
    padding: '10px 20px',
    fontSize: '0.9rem',
    fontWeight: 700,
    marginBottom: 24,
  },

  // Quiz
  quizSection: { marginBottom: 24 },
  questionBlock: { marginBottom: 20 },
  questionText: {
    fontWeight: 700,
    marginBottom: 10,
    color: 'var(--color-text)',
    fontSize: '0.9375rem',
  },
  answerLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
    borderRadius: 10,
    cursor: 'pointer',
    border: '1.5px solid var(--color-border)',
    marginBottom: 6,
    fontSize: '0.875rem',
    color: 'var(--color-text)',
    transition: 'border-color 0.15s, background 0.15s',
  },
  submitBtn: {
    background: 'var(--color-primary)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '10px 24px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: 700,
    fontFamily: 'inherit',
    marginTop: 4,
    transition: 'filter 0.15s',
  },

  // Resultado del quiz
  resultBox: {
    background: 'var(--color-surface)',
    border: '1.5px solid var(--color-border)',
    borderRadius: 14,
    padding: '24px',
    marginBottom: 24,
  },
  score: {
    fontSize: '2.5rem',
    fontWeight: 900,
    color: 'var(--color-primary)',
    letterSpacing: '-0.03em',
    lineHeight: 1,
    marginBottom: 4,
  },
  scoreSubtext: {
    color: 'var(--color-text-muted)',
    fontSize: '0.875rem',
    marginTop: 4,
    marginBottom: 0,
  },

  // Revisión de correcciones
  correctionItem: { marginBottom: 14 },
  correctionRow: { display: 'flex', gap: 10, alignItems: 'flex-start' },

  // Historial
  historySection: {
    marginTop: 20,
    borderTop: '1px solid var(--color-border)',
    paddingTop: 16,
  },
  historyTitle: {
    fontWeight: 700,
    marginBottom: 10,
    color: 'var(--color-text)',
    fontSize: '0.875rem',
  },
  historyRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  historyText: {
    fontSize: '0.875rem',
    color: 'var(--color-text-muted)',
  },
  downloadBtn: {
    background: 'none',
    border: '1.5px solid var(--color-border)',
    borderRadius: 6,
    padding: '3px 10px',
    cursor: 'pointer',
    fontSize: '0.75rem',
    color: 'var(--color-text-muted)',
    fontFamily: 'inherit',
    fontWeight: 600,
    transition: 'border-color 0.15s, color 0.15s',
  },

  // Placeholder (ejercicio / actividad no configurada)
  placeholder: {
    background: 'var(--color-surface)',
    border: '2px solid rgba(234,88,12,0.15)',
    borderRadius: 16,
    padding: '2.5rem',
    textAlign: 'center' as const,
    color: 'var(--color-text-muted)',
    marginBottom: 24,
  },

  error: { color: 'var(--color-error)', padding: '1rem' },
  skeleton: { background: 'var(--color-border)', borderRadius: 8 },
};

export default function LessonPage() {
  const { courseId = '', lessonId = '' } = useParams<{ courseId: string; lessonId: string }>();
  const navigate = useNavigate();

  const { data: lesson, isLoading, isError } = useLesson(lessonId);
  const { data: course } = useCourse(courseId);
  const completeLesson = useCompleteLesson(courseId);

  // Estado de lecciones interactivas (MATCH, SORT, FILL_BLANK)
  const [interactiveCompleted, setInteractiveCompleted] = useState(false);

  // Estado del quiz
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [quizResult, setQuizResult] = useState<QuizSubmitResult | null>(null);
  // Snapshot del quiz antes del submit: permite cruzar textos con las correcciones
  const [quizSnapshot, setQuizSnapshot] = useState<PublicQuiz | null>(null);

  // Resetear todo el estado local al cambiar de lección (navegación prev/next)
  // El componente no se desmonta al navegar entre lecciones del mismo curso
  useEffect(() => {
    setInteractiveCompleted(false);
    setSelectedAnswers({});
    setQuizResult(null);
    setQuizSnapshot(null);
  }, [lessonId]);

  const submitQuiz = useSubmitQuiz(lesson?.quiz?.id ?? '', lessonId);
  const { data: quizAttempts } = useQuizAttempts(lesson?.quiz?.id ?? '');

  // Estado de descarga de PDF por intento histórico
  const [downloadingAttemptId, setDownloadingAttemptId] = useState<string | null>(null);

  // Navegación entre lecciones
  const allLessons = course?.modules?.flatMap((m) => m.lessons ?? []) ?? [];
  const currentIndex = allLessons.findIndex((l) => l.id === lessonId);
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

  const isCompleted = lesson?.progress?.completed ?? false;

  function handleSelectAnswer(questionId: string, answerId: string) {
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: answerId }));
  }

  async function handleSubmitQuiz() {
    if (!lesson?.quiz) return;
    // Guardar snapshot antes del submit para cruzar textos en la revisión
    setQuizSnapshot(lesson.quiz);
    const answers: QuizAnswerSubmission[] = lesson.quiz.questions.map((q) => ({
      questionId: q.id,
      answerId: selectedAnswers[q.id] ?? '',
    }));
    const result = await submitQuiz.mutateAsync(answers);
    setQuizResult(result);
  }

  function handleDownloadCurrentPdf() {
    if (!quizResult || !quizSnapshot || !lesson) return;
    generateQuizPdf({
      courseTitle: course?.title ?? '',
      schoolYearLabel: course?.schoolYear?.label,
      lessonTitle: lesson.title,
      score: quizResult.score,
      completedAt: new Date(),
      corrections: quizResult.corrections.map((c) => {
        const question = quizSnapshot.questions.find((q) => q.id === c.questionId);
        const selected = question?.answers.find((a) => a.id === c.selectedAnswerId);
        const correct = question?.answers.find((a) => a.id === c.correctAnswerId);
        return {
          questionText: question?.text ?? '',
          selectedAnswerText: selected?.text ?? '—',
          isCorrect: c.isCorrect,
          correctAnswerText: correct?.text ?? '—',
        };
      }),
    });
  }

  async function handleDownloadHistoricPdf(attemptId: string) {
    if (!lesson?.quiz) return;
    setDownloadingAttemptId(attemptId);
    try {
      const detail = await coursesApi.getAttemptDetail(lesson.quiz.id, attemptId);
      generateQuizPdf({
        courseTitle: course?.title ?? '',
        schoolYearLabel: course?.schoolYear?.label,
        lessonTitle: lesson.title,
        score: detail.score,
        completedAt: new Date(detail.completedAt),
        corrections: detail.corrections,
      });
    } finally {
      setDownloadingAttemptId(null);
    }
  }

  if (isError) return <div style={S.error}>Error al cargar la lección.</div>;

  if (isLoading || !lesson) {
    return (
      <div style={{ maxWidth: 820, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ ...S.skeleton, height: 24, width: '40%', marginBottom: 4 }} />
        <div style={{ ...S.skeleton, height: 36, width: '70%', marginBottom: 4 }} />
        <div style={{ ...S.skeleton, height: 240, width: '100%', borderRadius: 16 }} />
      </div>
    );
  }

  const isInteractiveType = [LessonType.MATCH, LessonType.SORT, LessonType.FILL_BLANK]
    .includes(lesson.type as LessonType);
  // El botón solo se bloquea si la lección es interactiva Y tiene contenido configurado
  // Si content es null ("Actividad no configurada"), se permite completar igualmente
  const hasInteractiveContent = isInteractiveType && !!lesson.content;

  return (
    <div style={S.page}>
      {/* Navegación superior */}
      <div style={S.nav}>
        <button
          style={S.backBtn}
          onClick={() => navigate(`/courses/${courseId}`)}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-primary)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-muted)'; }}
        >
          ← Volver al curso
          {course && (
            <span style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>
              · {course.title}
            </span>
          )}
        </button>
        <div style={S.prevNextWrap}>
          {prevLesson && (
            <button
              style={S.prevNextBtn}
              onClick={() => navigate(`/courses/${courseId}/lessons/${prevLesson.id}`)}
              onMouseEnter={(e) => {
                const btn = e.currentTarget as HTMLButtonElement;
                btn.style.borderColor = 'rgba(234,88,12,0.35)';
                btn.style.background = 'rgba(234,88,12,0.04)';
              }}
              onMouseLeave={(e) => {
                const btn = e.currentTarget as HTMLButtonElement;
                btn.style.borderColor = 'var(--color-border)';
                btn.style.background = 'var(--color-surface)';
              }}
            >
              ← Anterior
            </button>
          )}
          {nextLesson && (
            <button
              style={S.prevNextBtn}
              onClick={() => navigate(`/courses/${courseId}/lessons/${nextLesson.id}`)}
              onMouseEnter={(e) => {
                const btn = e.currentTarget as HTMLButtonElement;
                btn.style.borderColor = 'rgba(234,88,12,0.35)';
                btn.style.background = 'rgba(234,88,12,0.04)';
              }}
              onMouseLeave={(e) => {
                const btn = e.currentTarget as HTMLButtonElement;
                btn.style.borderColor = 'var(--color-border)';
                btn.style.background = 'var(--color-surface)';
              }}
            >
              Siguiente →
            </button>
          )}
        </div>
      </div>

      {/* Tipo de lección badge + título */}
      <div style={S.lessonTypeBadge}>
        {LESSON_TYPE_LABELS[lesson.type as LessonType] ?? lesson.type}
      </div>
      <h1 style={S.heading}>{lesson.title}</h1>

      {/* Contenido según tipo */}

      {/* VIDEO */}
      {lesson.type === 'VIDEO' && (
        <div style={S.contentFrame}>
          <div style={S.iframeWrapper}>
            {lesson.youtubeId ? (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${lesson.youtubeId}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={S.iframe}
                title={lesson.title}
              />
            ) : (
              <div style={S.noVideo}>Vídeo no disponible</div>
            )}
          </div>
        </div>
      )}

      {/* QUIZ */}
      {lesson.type === 'QUIZ' && lesson.quiz && (
        <div style={S.quizSection}>
          {!quizResult ? (
            <>
              {lesson.quiz.questions.map((question, qIdx) => (
                <div key={question.id} style={S.questionBlock}>
                  <div style={S.questionText}>
                    {qIdx + 1}. {question.text}
                  </div>
                  {question.answers.map((answer) => (
                    <label
                      key={answer.id}
                      style={{
                        ...S.answerLabel,
                        borderColor:
                          selectedAnswers[question.id] === answer.id
                            ? 'var(--color-primary)'
                            : 'var(--color-border)',
                        background:
                          selectedAnswers[question.id] === answer.id
                            ? 'rgba(234,88,12,0.06)'
                            : 'transparent',
                      }}
                    >
                      <input
                        type="radio"
                        name={question.id}
                        value={answer.id}
                        checked={selectedAnswers[question.id] === answer.id}
                        onChange={() => handleSelectAnswer(question.id, answer.id)}
                        style={{ accentColor: 'var(--color-primary)' }}
                      />
                      {answer.text}
                    </label>
                  ))}
                </div>
              ))}
              <button
                style={S.submitBtn}
                onClick={handleSubmitQuiz}
                disabled={submitQuiz.isPending}
              >
                {submitQuiz.isPending ? 'Enviando...' : 'Enviar respuestas'}
              </button>
            </>
          ) : (
            <div style={S.resultBox}>
              <div style={S.score}>{quizResult.score.toFixed(1)}%</div>
              <p style={S.scoreSubtext}>
                {quizResult.correctCount} de {quizResult.totalCount} preguntas correctas
              </p>

              {/* Revisión pregunta a pregunta */}
              <div style={{ marginTop: '1.25rem' }}>
                <div style={{ fontWeight: 700, marginBottom: '0.75rem', color: 'var(--color-text)', fontSize: '0.875rem' }}>
                  Revisión:
                </div>
                {quizResult.corrections.map((correction) => {
                  const question = quizSnapshot?.questions.find((q) => q.id === correction.questionId);
                  const selectedAnswer = question?.answers.find((a) => a.id === correction.selectedAnswerId);
                  const correctAnswer = question?.answers.find((a) => a.id === correction.correctAnswerId);
                  return (
                    <div key={correction.questionId} style={S.correctionItem}>
                      <div style={S.correctionRow}>
                        <span style={{ flexShrink: 0, fontSize: '1rem' }}>{correction.isCorrect ? '✅' : '❌'}</span>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '0.875rem' }}>
                            {question?.text}
                          </div>
                          <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                            Tu respuesta: &ldquo;{selectedAnswer?.text ?? '—'}&rdquo;
                          </div>
                          {!correction.isCorrect && (
                            <div style={{ fontSize: '0.82rem', color: '#059669', marginTop: 2, fontWeight: 600 }}>
                              Correcta: &ldquo;{correctAnswer?.text ?? '—'}&rdquo;
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' as const }}>
                <button
                  style={S.submitBtn}
                  onClick={() => {
                    setQuizResult(null);
                    setSelectedAnswers({});
                    setQuizSnapshot(null);
                  }}
                >
                  Intentar de nuevo
                </button>
                <button style={S.downloadBtn} onClick={handleDownloadCurrentPdf}>
                  ⬇️ Descargar PDF
                </button>
              </div>

              {/* Historial de intentos */}
              {quizAttempts && quizAttempts.length > 0 && (
                <div style={S.historySection}>
                  <div style={S.historyTitle}>Historial de intentos:</div>
                  {quizAttempts.map((attempt) => (
                    <div key={attempt.id} style={S.historyRow}>
                      <span style={S.historyText}>
                        · {attempt.score.toFixed(1)}% —{' '}
                        {new Date(attempt.completedAt).toLocaleDateString('es-ES', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                      <button
                        style={S.downloadBtn}
                        onClick={() => handleDownloadHistoricPdf(attempt.id)}
                        disabled={downloadingAttemptId === attempt.id}
                      >
                        {downloadingAttemptId === attempt.id ? '...' : 'PDF'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* EXERCISE */}
      {lesson.type === 'EXERCISE' && (
        <div style={S.placeholder}>
          <span style={{ fontSize: 40 }}>💪</span>
          <p style={{ marginTop: 12, fontWeight: 700, color: 'var(--color-text)' }}>Próximamente</p>
          <p style={{ fontSize: '0.875rem', marginTop: 6 }}>Los ejercicios estarán disponibles pronto.</p>
        </div>
      )}

      {/* MATCH */}
      {lesson.type === LessonType.MATCH && lesson.content && (
        <div style={S.contentFrame}>
          <div style={S.activityFrame}>
            <MatchLesson
              content={lesson.content as MatchContent}
              onComplete={() => setInteractiveCompleted(true)}
            />
          </div>
        </div>
      )}

      {/* SORT */}
      {lesson.type === LessonType.SORT && lesson.content && (
        <div style={S.contentFrame}>
          <div style={S.activityFrame}>
            <SortLesson
              content={lesson.content as SortContent}
              onComplete={() => setInteractiveCompleted(true)}
            />
          </div>
        </div>
      )}

      {/* FILL_BLANK */}
      {lesson.type === LessonType.FILL_BLANK && lesson.content && (
        <div style={S.contentFrame}>
          <div style={S.activityFrame}>
            <FillBlankLesson
              content={lesson.content as FillBlankContent}
              onComplete={() => setInteractiveCompleted(true)}
            />
          </div>
        </div>
      )}

      {/* Lección interactiva sin contenido configurado todavía */}
      {isInteractiveType && !lesson.content && (
        <div style={S.placeholder}>
          <span style={{ fontSize: 40 }}>⚡</span>
          <p style={{ marginTop: 12, fontWeight: 700, color: 'var(--color-text)' }}>Actividad no configurada</p>
          <p style={{ fontSize: '0.875rem', marginTop: 6 }}>El administrador aún no ha añadido el contenido.</p>
        </div>
      )}

      {/* Botón completar */}
      <div style={{ marginTop: 8, marginBottom: 16 }}>
        {isCompleted ? (
          <div style={S.completedBadge}>
            <span>✓</span> Lección completada
          </div>
        ) : (
          <button
            className="btn btn-primary"
            onClick={() => completeLesson.mutate(lessonId)}
            disabled={completeLesson.isPending || (hasInteractiveContent && !interactiveCompleted)}
          >
            {completeLesson.isPending ? 'Guardando...' : 'Marcar como completada'}
          </button>
        )}
      </div>
    </div>
  );
}
