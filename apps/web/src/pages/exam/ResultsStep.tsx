import { useMyCertificates } from '../../hooks/useCertificates';
import { downloadCertificatePdf } from '../../utils/certificatePdf';
import { downloadExamPdf } from '../../utils/examPdf';
import type { ExamAttemptResult } from '@vkbacademy/shared';
import { scoreColor, scoreGradient } from './examShared';

// ─── Componente: Resultados ───────────────────────────────────────────────────

export function ResultsStep({
  result,
  scopeTitle,
  courseId,
  moduleId,
  onRepeat,
  onBack,
  historyItems,
}: {
  result: ExamAttemptResult;
  scopeTitle: string;
  courseId?: string;
  moduleId?: string;
  onRepeat: () => void;
  onBack: () => void;
  historyItems: {
    attemptId: string;
    score: number | null;
    numQuestions: number;
    submittedAt: string | null;
  }[];
}) {
  const { data: certs } = useMyCertificates();
  const examCertType = courseId ? 'COURSE_EXAM' : 'MODULE_EXAM';
  const examScopeId = courseId ?? moduleId;
  const examCert = certs?.find((c) => c.scopeId === examScopeId && c.type === examCertType);

  const passed = result.score >= 50;

  return (
    <div>
      {/* Score grande */}
      <div
        style={{
          background: 'var(--gradient-hero)',
          borderRadius: 'var(--radius-xl)',
          padding: '40px 36px',
          textAlign: 'center' as const,
          marginBottom: 24,
          position: 'relative' as const,
          overflow: 'hidden',
        }}
      >
        {/* Glow decorativo */}
        <div
          style={{
            position: 'absolute' as const,
            top: -80,
            right: -80,
            width: 280,
            height: 280,
            background: `radial-gradient(circle, ${scoreColor(result.score)}22 0%, transparent 70%)`,
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            fontSize: '5rem',
            fontWeight: 900,
            background: scoreGradient(result.score),
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            lineHeight: 1,
            letterSpacing: '-0.03em',
            marginBottom: 8,
          }}
        >
          {result.score.toFixed(1)}%
        </div>

        <div style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.65)', marginBottom: 16 }}>
          {result.correctCount} de {result.numQuestions} respuestas correctas
        </div>

        {passed && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 18px',
              borderRadius: 999,
              background: 'rgba(22,163,74,0.15)',
              border: '1px solid rgba(22,163,74,0.35)',
              color: '#4ade80',
              fontWeight: 700,
              fontSize: '0.875rem',
            }}
          >
            Certificado emitido
          </div>
        )}
      </div>

      {/* Correcciones */}
      <div className="vkb-card" style={{ padding: '24px', marginBottom: 20 }}>
        <h3
          style={{
            fontWeight: 700,
            marginBottom: 16,
            fontSize: '0.95rem',
            color: 'var(--color-text)',
          }}
        >
          Correcciones
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
          {result.corrections.map((c, i) => (
            <div
              key={c.questionId}
              style={{
                borderRadius: 'var(--radius-sm)',
                padding: '14px 16px',
                borderLeft: `4px solid ${c.isCorrect ? '#16a34a' : '#dc2626'}`,
                background: c.isCorrect ? 'rgba(22,163,74,0.05)' : 'rgba(220,38,38,0.04)',
                border: `1px solid ${c.isCorrect ? 'rgba(22,163,74,0.20)' : 'rgba(220,38,38,0.18)'}`,
                borderLeftWidth: 4,
              }}
            >
              <div
                style={{
                  fontWeight: 600,
                  marginBottom: 6,
                  fontSize: '0.9rem',
                  color: 'var(--color-text)',
                  lineHeight: 1.4,
                }}
              >
                <span style={{ marginRight: 6, fontSize: '0.85rem' }}>
                  {c.isCorrect ? '✓' : '✗'}
                </span>
                {i + 1}. {c.questionText}
              </div>

              {(() => {
                // Para MULTIPLE muestra todas las seleccionadas/correctas; para
                // SINGLE/TRUE_FALSE cae en los campos legacy con un único valor.
                const selectedTexts =
                  c.selectedAnswerTexts && c.selectedAnswerTexts.length > 0
                    ? c.selectedAnswerTexts
                    : c.selectedAnswerText
                      ? [c.selectedAnswerText]
                      : [];
                const correctTexts =
                  c.correctAnswerTexts && c.correctAnswerTexts.length > 0
                    ? c.correctAnswerTexts
                    : c.correctAnswerText
                      ? [c.correctAnswerText]
                      : [];
                return (
                  <>
                    {selectedTexts.length > 0 ? (
                      <div
                        style={{
                          fontSize: '0.82rem',
                          color: c.isCorrect ? 'var(--color-text-muted)' : '#dc2626',
                          marginBottom: c.isCorrect ? 0 : 4,
                        }}
                      >
                        {selectedTexts.length === 1 ? 'Tu respuesta' : 'Tus respuestas'}:{' '}
                        {selectedTexts.join(' · ')}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                        Sin respuesta
                      </div>
                    )}

                    {!c.isCorrect && correctTexts.length > 0 && (
                      <div
                        style={{
                          fontSize: '0.82rem',
                          color: '#16a34a',
                          fontWeight: 600,
                          marginTop: 4,
                        }}
                      >
                        {correctTexts.length === 1 ? 'Respuesta correcta' : 'Respuestas correctas'}:{' '}
                        {correctTexts.join(' · ')}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          ))}
        </div>
      </div>

      {/* Historial */}
      {historyItems.filter((h) => h.submittedAt).length > 1 && (
        <div className="vkb-card" style={{ padding: '24px', marginBottom: 24 }}>
          <h4
            style={{
              fontWeight: 700,
              marginBottom: 14,
              fontSize: '0.9rem',
              color: 'var(--color-text)',
            }}
          >
            Historial de intentos
          </h4>
          {historyItems
            .filter((h) => h.submittedAt)
            .map((h) => (
              <div
                key={h.attemptId}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '9px 0',
                  borderBottom: '1px solid var(--color-border)',
                  fontSize: '0.875rem',
                  gap: 12,
                }}
              >
                <span style={{ color: 'var(--color-text-muted)' }}>
                  {new Date(h.submittedAt!).toLocaleDateString('es-ES')}
                </span>
                <span style={{ color: 'var(--color-text-muted)' }}>{h.numQuestions} preguntas</span>
                <span
                  style={{
                    fontWeight: 800,
                    color: scoreColor(h.score ?? 0),
                  }}
                >
                  {h.score?.toFixed(1)}%
                </span>
              </div>
            ))}
        </div>
      )}

      {/* Acciones */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' as const }}>
        <button className="btn btn-ghost" onClick={onBack}>
          Volver al curso
        </button>
        <button className="btn btn-primary" onClick={onRepeat}>
          Repetir examen
        </button>
        <button className="btn btn-ghost" onClick={() => downloadExamPdf(result, scopeTitle)}>
          Descargar PDF examen
        </button>
        {examCert && (
          <button
            className="btn"
            style={{
              background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
              color: '#fff',
              boxShadow: '0 4px 16px rgba(22,163,74,0.30)',
            }}
            onClick={() => downloadCertificatePdf(examCert)}
          >
            Descargar certificado
          </button>
        )}
      </div>
    </div>
  );
}
