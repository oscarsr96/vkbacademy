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

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '2rem', maxWidth: 800, margin: '0 auto' },
  nav: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' },
  backBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--color-text-muted)', fontSize: '0.875rem', padding: 0,
  },
  prevNextBtn: {
    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
    borderRadius: 8, padding: '0.4rem 0.9rem', cursor: 'pointer',
    fontSize: '0.875rem', color: 'var(--color-text)',
  },
  heading: { fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '1.25rem' },
  iframeWrapper: {
    aspectRatio: '16/9', borderRadius: 10, overflow: 'hidden',
    marginBottom: '1.25rem', background: '#000',
  },
  iframe: { width: '100%', height: '100%', border: 'none' },
  noVideo: {
    background: 'var(--color-border)', borderRadius: 10, height: 220,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--color-text-muted)', marginBottom: '1.25rem',
  },
  completeBtn: {
    background: 'var(--color-primary)', color: '#fff', border: 'none',
    borderRadius: 8, padding: '0.6rem 1.25rem', cursor: 'pointer',
    fontSize: '0.875rem', fontWeight: 600, marginBottom: '2rem',
  },
  completedBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: '#d1fae5', color: '#065f46', borderRadius: 8,
    padding: '0.4rem 0.9rem', fontSize: '0.875rem', fontWeight: 600,
    marginBottom: '2rem',
  },
  quizSection: { marginTop: '1rem' },
  questionBlock: { marginBottom: '1.5rem' },
  questionText: { fontWeight: 600, marginBottom: '0.5rem', color: 'var(--color-text)' },
  answerLabel: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '0.5rem 0.75rem', borderRadius: 8, cursor: 'pointer',
    border: '1px solid var(--color-border)', marginBottom: '0.4rem',
    fontSize: '0.875rem', color: 'var(--color-text)',
  },
  submitBtn: {
    background: 'var(--color-primary)', color: '#fff', border: 'none',
    borderRadius: 8, padding: '0.6rem 1.5rem', cursor: 'pointer',
    fontSize: '0.875rem', fontWeight: 600, marginTop: '0.5rem',
  },
  resultBox: {
    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
    borderRadius: 10, padding: '1.25rem', marginTop: '1rem',
  },
  score: { fontSize: '2rem', fontWeight: 700, color: 'var(--color-primary)' },
  placeholder: {
    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
    borderRadius: 10, padding: '2rem', textAlign: 'center',
    color: 'var(--color-text-muted)',
  },
  error: { color: 'var(--color-error)', padding: '1rem' },
  skeleton: { background: 'var(--color-border)', borderRadius: 8 },
  downloadBtn: {
    background: 'none',
    border: '1px solid var(--color-border)',
    borderRadius: 6,
    padding: '0.25rem 0.6rem',
    cursor: 'pointer',
    fontSize: '0.75rem',
    color: 'var(--color-text-muted)',
  },
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

  if (isError) return <div style={styles.error}>Error al cargar la lección.</div>;

  if (isLoading || !lesson) {
    return (
      <div style={styles.page}>
        <div style={{ ...styles.skeleton, height: 24, width: '40%', marginBottom: 20 }} />
        <div style={{ ...styles.skeleton, height: 36, width: '70%', marginBottom: 20 }} />
        <div style={{ ...styles.skeleton, height: 220, width: '100%', marginBottom: 16 }} />
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* Navegación superior */}
      <div style={styles.nav}>
        <button style={styles.backBtn} onClick={() => navigate(`/courses/${courseId}`)}>
          ← Volver al curso
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          {prevLesson && (
            <button
              style={styles.prevNextBtn}
              onClick={() => navigate(`/courses/${courseId}/lessons/${prevLesson.id}`)}
            >
              ← Anterior
            </button>
          )}
          {nextLesson && (
            <button
              style={styles.prevNextBtn}
              onClick={() => navigate(`/courses/${courseId}/lessons/${nextLesson.id}`)}
            >
              Siguiente →
            </button>
          )}
        </div>
      </div>

      <h1 style={styles.heading}>{lesson.title}</h1>

      {/* Contenido según tipo */}
      {lesson.type === 'VIDEO' && (
        lesson.youtubeId ? (
          <div style={styles.iframeWrapper}>
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${lesson.youtubeId}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={styles.iframe}
              title={lesson.title}
            />
          </div>
        ) : (
          <div style={styles.noVideo}>Vídeo no disponible</div>
        )
      )}

      {lesson.type === 'QUIZ' && lesson.quiz && (
        <div style={styles.quizSection}>
          {!quizResult ? (
            <>
              {lesson.quiz.questions.map((question) => (
                <div key={question.id} style={styles.questionBlock}>
                  <div style={styles.questionText}>{question.text}</div>
                  {question.answers.map((answer) => (
                    <label
                      key={answer.id}
                      style={{
                        ...styles.answerLabel,
                        borderColor:
                          selectedAnswers[question.id] === answer.id
                            ? 'var(--color-primary)'
                            : 'var(--color-border)',
                        background:
                          selectedAnswers[question.id] === answer.id
                            ? 'var(--color-primary-subtle, rgba(var(--color-primary-rgb, 99,102,241), 0.08))'
                            : 'transparent',
                      }}
                    >
                      <input
                        type="radio"
                        name={question.id}
                        value={answer.id}
                        checked={selectedAnswers[question.id] === answer.id}
                        onChange={() => handleSelectAnswer(question.id, answer.id)}
                      />
                      {answer.text}
                    </label>
                  ))}
                </div>
              ))}
              <button
                style={styles.submitBtn}
                onClick={handleSubmitQuiz}
                disabled={submitQuiz.isPending}
              >
                {submitQuiz.isPending ? 'Enviando...' : 'Enviar respuestas'}
              </button>
            </>
          ) : (
            <div style={styles.resultBox}>
              <div style={styles.score}>{quizResult.score.toFixed(1)}%</div>
              <p style={{ color: 'var(--color-text-muted)', marginTop: 4 }}>
                {quizResult.correctCount} de {quizResult.totalCount} preguntas correctas
              </p>

              {/* Revisión pregunta a pregunta */}
              <div style={{ marginTop: '1.25rem' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.75rem', color: 'var(--color-text)' }}>
                  Revisión:
                </div>
                {quizResult.corrections.map((correction) => {
                  const question = quizSnapshot?.questions.find((q) => q.id === correction.questionId);
                  const selectedAnswer = question?.answers.find((a) => a.id === correction.selectedAnswerId);
                  const correctAnswer = question?.answers.find((a) => a.id === correction.correctAnswerId);
                  return (
                    <div key={correction.questionId} style={{ marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <span style={{ flexShrink: 0 }}>{correction.isCorrect ? '✅' : '❌'}</span>
                        <div>
                          <div style={{ fontWeight: 500, color: 'var(--color-text)' }}>
                            {question?.text}
                          </div>
                          <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                            Tu respuesta: &ldquo;{selectedAnswer?.text ?? '—'}&rdquo;
                          </div>
                          {!correction.isCorrect && (
                            <div style={{ fontSize: '0.875rem', color: '#059669', marginTop: 2 }}>
                              Correcta: &ldquo;{correctAnswer?.text ?? '—'}&rdquo;
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button
                  style={styles.submitBtn}
                  onClick={() => {
                    setQuizResult(null);
                    setSelectedAnswers({});
                    setQuizSnapshot(null);
                  }}
                >
                  Intentar de nuevo
                </button>
                <button style={styles.downloadBtn} onClick={handleDownloadCurrentPdf}>
                  Descargar PDF
                </button>
              </div>

              {/* Historial de intentos */}
              {quizAttempts && quizAttempts.length > 0 && (
                <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
                  <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: 'var(--color-text)' }}>
                    Historial de intentos:
                  </div>
                  {quizAttempts.map((attempt) => (
                    <div
                      key={attempt.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '0.4rem',
                      }}
                    >
                      <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                        • {attempt.score.toFixed(1)}% —{' '}
                        {new Date(attempt.completedAt).toLocaleDateString('es-ES', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                      <button
                        style={styles.downloadBtn}
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

      {lesson.type === 'EXERCISE' && (
        <div style={styles.placeholder}>
          <span style={{ fontSize: 40 }}>💪</span>
          <p style={{ marginTop: 8, fontWeight: 600 }}>Próximamente</p>
          <p style={{ fontSize: '0.875rem', marginTop: 4 }}>Los ejercicios estarán disponibles pronto.</p>
        </div>
      )}

      {lesson.type === LessonType.MATCH && lesson.content && (
        <MatchLesson
          content={lesson.content as MatchContent}
          onComplete={() => setInteractiveCompleted(true)}
        />
      )}

      {lesson.type === LessonType.SORT && lesson.content && (
        <SortLesson
          content={lesson.content as SortContent}
          onComplete={() => setInteractiveCompleted(true)}
        />
      )}

      {lesson.type === LessonType.FILL_BLANK && lesson.content && (
        <FillBlankLesson
          content={lesson.content as FillBlankContent}
          onComplete={() => setInteractiveCompleted(true)}
        />
      )}

      {/* Lección interactiva sin contenido configurado todavía */}
      {[LessonType.MATCH, LessonType.SORT, LessonType.FILL_BLANK].includes(lesson.type as LessonType) && !lesson.content && (
        <div style={styles.placeholder}>
          <span style={{ fontSize: 40 }}>⚡</span>
          <p style={{ marginTop: 8, fontWeight: 600 }}>Actividad no configurada</p>
          <p style={{ fontSize: '0.875rem', marginTop: 4 }}>El administrador aún no ha añadido el contenido.</p>
        </div>
      )}

      {/* Botón completar */}
      {(() => {
        const isInteractiveType = [LessonType.MATCH, LessonType.SORT, LessonType.FILL_BLANK]
          .includes(lesson.type as LessonType);
        // El botón solo se bloquea si la lección es interactiva Y tiene contenido configurado
        // Si content es null ("Actividad no configurada"), se permite completar igualmente
        const hasInteractiveContent = isInteractiveType && !!lesson.content;
        return (
          <div style={{ marginTop: '1.5rem' }}>
            {isCompleted ? (
              <div style={styles.completedBadge}>
                <span>✓</span> Lección completada
              </div>
            ) : (
              <button
                style={styles.completeBtn}
                onClick={() => completeLesson.mutate(lessonId)}
                disabled={completeLesson.isPending || (hasInteractiveContent && !interactiveCompleted)}
              >
                {completeLesson.isPending ? 'Guardando...' : 'Marcar como completada'}
              </button>
            )}
          </div>
        );
      })()}
    </div>
  );
}
