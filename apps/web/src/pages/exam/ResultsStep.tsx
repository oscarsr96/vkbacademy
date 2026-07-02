import { useEffect } from 'react';
import { useMyCertificates } from '../../hooks/useCertificates';
import { usePageZone } from '../../hooks/usePageZone';
import { downloadCertificatePdf } from '../../utils/certificatePdf';
import { downloadExamPdf } from '../../utils/examPdf';
import { launchConfetti } from '../../utils/confetti';
import Icon from '../../components/ui/Icon';
import type { ExamAttemptResult } from '@vkbacademy/shared';
import { scoreColor } from './examShared';

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
  usePageZone('dark');

  const { data: certs } = useMyCertificates();
  const examCertType = courseId ? 'COURSE_EXAM' : 'MODULE_EXAM';
  const examScopeId = courseId ?? moduleId;
  const examCert = certs?.find((c) => c.scopeId === examScopeId && c.type === examCertType);

  const passed = result.score >= 50;

  // Confeti de celebración: una sola vez al montar el resultado si esta aprobado.
  useEffect(() => {
    if (passed) launchConfetti();
  }, [passed]);

  return (
    <div>
      {/* Marcador de estadio */}
      <div
        className="panel-glass animate-in"
        style={{
          padding: '44px 36px',
          textAlign: 'center' as const,
          marginBottom: 24,
          position: 'relative' as const,
          overflow: 'hidden',
          border: passed ? '1px solid rgba(255,210,77,0.28)' : '1px solid rgba(239,68,68,0.28)',
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
            background: `radial-gradient(circle, ${passed ? 'rgba(255,210,77,0.18)' : 'rgba(239,68,68,0.14)'} 0%, transparent 70%)`,
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase' as const,
            color: 'rgba(255,255,255,0.45)',
            marginBottom: 14,
          }}
        >
          Resultado final
        </div>

        {/* Nota: decimal, se compone manualmente con .score-number */}
        <div
          className={`score-number${passed ? ' pulse' : ''}`}
          style={{
            fontSize: '4.5rem',
            lineHeight: 1,
            color: passed ? 'var(--amber-led)' : '#ef4444',
            textShadow: passed ? 'var(--amber-glow)' : 'none',
          }}
        >
          {result.score.toFixed(1)}%
        </div>

        <div style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.65)', marginTop: 10, marginBottom: 18 }}>
          {result.correctCount} de {result.numQuestions} respuestas correctas
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' as const }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 20px',
              borderRadius: 999,
              background: passed ? 'rgba(255,210,77,0.14)' : 'rgba(239,68,68,0.14)',
              border: passed ? '1px solid rgba(255,210,77,0.4)' : '1px solid rgba(239,68,68,0.4)',
              color: passed ? 'var(--amber-led)' : '#ef4444',
              fontWeight: 700,
              fontSize: '0.875rem',
            }}
          >
            <Icon name={passed ? 'trophy' : 'close'} size={16} />
            {passed ? 'Aprobado' : 'Suspendido'}
          </div>

          {passed && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 18px',
                borderRadius: 999,
                background: 'rgba(22,163,74,0.15)',
                border: '1px solid rgba(22,163,74,0.35)',
                color: '#4ade80',
                fontWeight: 700,
                fontSize: '0.875rem',
              }}
            >
              <Icon name="award" size={14} />
              Certificado emitido
            </div>
          )}
        </div>
      </div>

      {/* Correcciones */}
      <div className="panel-glass" style={{ padding: '24px', marginBottom: 20 }}>
        <h3 className="section-label" style={{ marginBottom: 16 }}>
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
                background: c.isCorrect ? 'rgba(22,163,74,0.08)' : 'rgba(220,38,38,0.08)',
                border: `1px solid ${c.isCorrect ? 'rgba(22,163,74,0.25)' : 'rgba(220,38,38,0.25)'}`,
                borderLeftWidth: 4,
                animation: `riseIn 0.4s cubic-bezier(0.18, 0.72, 0.24, 1.12) ${i * 40}ms both`,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  fontWeight: 600,
                  marginBottom: 6,
                  fontSize: '0.9rem',
                  color: 'var(--color-text)',
                  lineHeight: 1.4,
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    marginTop: 2,
                    color: c.isCorrect ? '#4ade80' : '#f87171',
                    flexShrink: 0,
                  }}
                >
                  <Icon name={c.isCorrect ? 'check' : 'close'} size={14} />
                </span>
                <span>
                  {i + 1}. {c.questionText}
                </span>
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
                          color: c.isCorrect ? 'var(--color-text-muted)' : '#f87171',
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
                          color: '#4ade80',
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
        <div className="panel-glass" style={{ padding: '24px', marginBottom: 24 }}>
          <h4 className="section-label" style={{ marginBottom: 14 }}>
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
                <span style={{ color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {h.numQuestions} preguntas
                </span>
                <span
                  style={{
                    fontWeight: 800,
                    color: scoreColor(h.score ?? 0),
                    fontVariantNumeric: 'tabular-nums',
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
          <Icon name="chevron-left" size={16} />
          Volver al curso
        </button>
        <button className="btn btn-primary" onClick={onRepeat}>
          <Icon name="play" size={16} />
          Repetir examen
        </button>
        <button className="btn btn-ghost" onClick={() => downloadExamPdf(result, scopeTitle)}>
          <Icon name="download" size={16} />
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
            <Icon name="award" size={16} />
            Descargar certificado
          </button>
        )}
      </div>
    </div>
  );
}
