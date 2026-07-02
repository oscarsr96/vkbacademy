import { useEffect, useRef, useState } from 'react';
import { matchPath, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { TutorMessageDto } from '@vkbacademy/shared';
import { chatStream } from '../api/tutor.api';
import { useClearHistory, useTutorHistory } from '../hooks/useTutor';

// ─── Tipos locales ────────────────────────────────────────────────────────────

interface LocalMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toLocalMessage(m: TutorMessageDto): LocalMessage {
  return { id: m.id, role: m.role, content: m.content };
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function TutorWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const location = useLocation();
  const queryClient = useQueryClient();

  // Detectar contexto de la página actual
  const courseMatch = matchPath('/courses/:id', location.pathname);
  const lessonMatch = matchPath('/lessons/:id', location.pathname);
  const courseId = courseMatch?.params?.id ?? undefined;
  const lessonId = lessonMatch?.params?.id ?? undefined;

  // Intentar obtener nombre del curso desde el caché de React Query
  const cachedCourse = courseId
    ? (queryClient.getQueryData(['courses', courseId]) as { title?: string; schoolYear?: { label?: string } } | undefined)
    : undefined;
  const courseName = cachedCourse?.title;
  const schoolYear = cachedCourse?.schoolYear?.label;

  // ─── Cargar historial cuando el widget se abre ──────────────────────────────

  const { data: history, isSuccess: historyReady } = useTutorHistory();
  const { mutate: clearHistory, isPending: isClearing } = useClearHistory();

  useEffect(() => {
    if (isOpen && historyReady && !historyLoaded && history) {
      setMessages(history.map(toLocalMessage));
      setHistoryLoaded(true);
    }
  }, [isOpen, historyReady, historyLoaded, history]);

  // ─── Auto-scroll al último mensaje ─────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  // ─── Foco al abrir ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // ─── Enviar mensaje ─────────────────────────────────────────────────────────

  async function handleSend() {
    const text = inputValue.trim();
    if (!text || isStreaming) return;

    const userMsg: LocalMessage = {
      id: `local-${Date.now()}`,
      role: 'user',
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsStreaming(true);
    setStreamingText('');

    try {
      const response = await chatStream({
        message: text,
        courseId,
        lessonId,
        courseName,
        schoolYear,
      });

      if (!response.ok || !response.body) {
        throw new Error('Error en la respuesta del servidor');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6)) as {
              text?: string;
              done?: boolean;
              error?: string;
            };

            if (data.text) {
              accumulated += data.text;
              setStreamingText(accumulated);
            }

            if (data.done) {
              // Convertir el texto acumulado en mensaje permanente
              setMessages((prev) => [
                ...prev,
                {
                  id: `assistant-${Date.now()}`,
                  role: 'assistant',
                  content: accumulated,
                },
              ]);
              setStreamingText('');
              setIsStreaming(false);
            }

            if (data.error) {
              setMessages((prev) => [
                ...prev,
                {
                  id: `error-${Date.now()}`,
                  role: 'assistant',
                  content: '❌ Lo siento, ha ocurrido un error. Inténtalo de nuevo.',
                },
              ]);
              setStreamingText('');
              setIsStreaming(false);
            }
          } catch {
            // ignorar líneas mal formadas
          }
        }
      }
    } catch (err) {
      console.error('Tutor stream error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: '❌ No pude conectar con el tutor. Comprueba tu conexión.',
        },
      ]);
      setStreamingText('');
      setIsStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  function handleClearHistory() {
    clearHistory(undefined, {
      onSuccess: () => setMessages([]),
    });
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Botón flotante */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={styles.fab}
          title="Tutor Virtual VKB"
          aria-label="Abrir tutor virtual"
        >
          💬
        </button>
      )}

      {/* Panel del widget */}
      {isOpen && (
        <div style={styles.panel}>
          {/* Header */}
          <div style={styles.header}>
            <div style={styles.headerLeft}>
              <span style={styles.headerIcon}>🤖</span>
              <div>
                <div style={styles.headerTitle}>Tutor VKB</div>
                {(courseName || schoolYear) && (
                  <div style={styles.contextBadge}>
                    {courseName ?? ''}{schoolYear ? ` · ${schoolYear}` : ''}
                  </div>
                )}
              </div>
            </div>
            <div style={styles.headerActions}>
              <button
                onClick={() => setIsOpen(false)}
                style={styles.headerBtn}
                title="Minimizar"
                aria-label="Minimizar"
              >
                −
              </button>
              <button
                onClick={() => { setIsOpen(false); }}
                style={styles.headerBtn}
                title="Cerrar"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Mensajes */}
          <div style={styles.messages}>
            {messages.length === 0 && !isStreaming && (
              <div style={styles.emptyState}>
                <div style={styles.emptyIcon}>🎓</div>
                <p style={styles.emptyText}>
                  ¡Hola! Soy tu tutor virtual de VKB Academy.
                  Pregúntame cualquier duda sobre tus estudios.
                </p>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  ...styles.bubble,
                  ...(msg.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant),
                }}
              >
                <span style={styles.bubbleText}>{msg.content}</span>
              </div>
            ))}

            {/* Burbuja en streaming */}
            {isStreaming && streamingText && (
              <div style={{ ...styles.bubble, ...styles.bubbleAssistant }}>
                <span style={styles.bubbleText}>
                  {streamingText}
                  <span style={styles.cursor}>▌</span>
                </span>
              </div>
            )}

            {/* Indicador de espera antes de que llegue el primer chunk */}
            {isStreaming && !streamingText && (
              <div style={{ ...styles.bubble, ...styles.bubbleAssistant }}>
                <span style={styles.typingDots}>···</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={styles.inputArea}>
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu pregunta..."
              disabled={isStreaming}
              rows={2}
              style={{
                ...styles.textarea,
                ...(isStreaming ? styles.textareaDisabled : {}),
              }}
            />
            <button
              onClick={() => void handleSend()}
              disabled={isStreaming || !inputValue.trim()}
              style={{
                ...styles.sendBtn,
                ...((isStreaming || !inputValue.trim()) ? styles.sendBtnDisabled : {}),
              }}
              aria-label="Enviar"
            >
              ▶
            </button>
          </div>

          {/* Limpiar historial */}
          <div style={styles.footer}>
            <button
              onClick={handleClearHistory}
              disabled={isClearing || isStreaming || messages.length === 0}
              style={styles.clearBtn}
            >
              🗑 Limpiar historial
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  fab: {
    position: 'fixed',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: '50%',
    background: 'var(--gradient-orange)',
    border: 'none',
    cursor: 'pointer',
    fontSize: '1.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 18px var(--brand-glow)',
    zIndex: 1000,
    transition: 'transform 0.18s, box-shadow 0.18s',
  },
  panel: {
    position: 'fixed',
    bottom: 88,
    right: 24,
    width: 380,
    height: 520,
    background: 'var(--navy-800)',
    border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: 16,
    boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    zIndex: 1000,
    animation: 'tutorSlideUp 0.2s ease-out',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 14px',
    background: 'linear-gradient(90deg, #080e1a 0%, #0d1b2a 100%)',
    borderBottom: '1px solid rgba(255,255,255,0.09)',
    flexShrink: 0,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  headerIcon: {
    fontSize: '1.5rem',
  },
  headerTitle: {
    color: '#fff',
    fontWeight: 700,
    fontSize: '0.9375rem',
  },
  contextBadge: {
    color: 'var(--brand-light)',
    fontSize: '0.6875rem',
    fontWeight: 500,
    marginTop: 1,
    maxWidth: 220,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  headerActions: {
    display: 'flex',
    gap: 4,
  },
  headerBtn: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.45)',
    cursor: 'pointer',
    fontSize: '1rem',
    padding: '4px 8px',
    borderRadius: 6,
    lineHeight: 1,
    transition: 'color 0.15s',
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: 12,
    padding: '0 16px',
  },
  emptyIcon: {
    fontSize: '2.5rem',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    fontSize: '0.875rem',
    lineHeight: 1.5,
    margin: 0,
  },
  bubble: {
    maxWidth: '85%',
    padding: '8px 12px',
    borderRadius: 12,
    fontSize: '0.875rem',
    lineHeight: 1.5,
    wordBreak: 'break-word',
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    background: 'var(--gradient-orange)',
    color: 'var(--brand-contrast)',
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    alignSelf: 'flex-start',
    background: 'rgba(255,255,255,0.07)',
    color: 'rgba(255,255,255,0.88)',
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    whiteSpace: 'pre-wrap',
  },
  cursor: {
    display: 'inline-block',
    animation: 'tutorBlink 0.8s step-end infinite',
    marginLeft: 1,
    color: 'var(--brand-light)',
  },
  typingDots: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: '1.25rem',
    letterSpacing: 4,
    animation: 'tutorBlink 1s step-end infinite',
  },
  inputArea: {
    display: 'flex',
    gap: 8,
    padding: '8px 14px',
    borderTop: '1px solid rgba(255,255,255,0.09)',
    flexShrink: 0,
  },
  textarea: {
    flex: 1,
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid var(--brand-soft)',
    borderRadius: 10,
    color: '#fff',
    fontSize: '0.875rem',
    padding: '8px 10px',
    resize: 'none',
    outline: 'none',
    fontFamily: 'inherit',
    lineHeight: 1.4,
    transition: 'border-color 0.15s',
  },
  textareaDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  sendBtn: {
    width: 40,
    height: 40,
    alignSelf: 'flex-end',
    borderRadius: 10,
    background: 'var(--gradient-orange)',
    border: 'none',
    color: 'var(--brand-contrast)',
    fontSize: '0.875rem',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'opacity 0.15s',
  },
  sendBtnDisabled: {
    opacity: 0.35,
    cursor: 'not-allowed',
  },
  footer: {
    padding: '4px 14px 10px',
    flexShrink: 0,
  },
  clearBtn: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.3)',
    cursor: 'pointer',
    fontSize: '0.75rem',
    padding: '2px 4px',
    borderRadius: 4,
    transition: 'color 0.15s',
  },
};
