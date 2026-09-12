import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { TUTOR_DEFAULT_IMAGE_PROMPT, TutorMessageDto } from '@vkbacademy/shared';
import { chatStream } from '../../api/tutor.api';
import { HISTORY_KEY, useClearHistory, useTutorHistory } from '../../hooks/useTutor';
import { downscaleImage } from '../../utils/downscaleImage';
import Icon from '../ui/Icon';

// ─── Tipos ────────────────────────────────────────────────────────────────────

/** Curso/lección desde donde se pregunta. Lo aporta quien monta el chat. */
export interface TutorContext {
  courseId?: string;
  lessonId?: string;
  courseName?: string;
  schoolYear?: string;
}

interface TutorChatProps {
  context?: TutorContext;
  autoFocus?: boolean;
}

interface LocalMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  hasImage: boolean;
}

/** Foto lista para enviar: el blob reducido y su preview. */
interface Attachment {
  blob: Blob;
  previewUrl: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toLocalMessage(m: TutorMessageDto): LocalMessage {
  return { id: m.id, role: m.role, content: m.content, hasImage: m.hasImage };
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function TutorChat({ context, autoFocus = false }: TutorChatProps) {
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [isPreparingImage, setIsPreparingImage] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // ─── Historial ──────────────────────────────────────────────────────────────

  // La caché de React Query es la única fuente de verdad: la burbuja y la
  // página Dudas montan cada una su propio TutorChat, y sin esto cada
  // instancia llevaba su copia de `messages` que se desincronizaba de la otra
  // hasta recargar. Enviar y limpiar escriben aquí, nunca en estado local.
  const { data: history } = useTutorHistory();
  const { mutate: clearHistory, isPending: isClearing } = useClearHistory();
  const messages: LocalMessage[] = (history ?? []).map(toLocalMessage);

  // ─── Auto-scroll al último mensaje ─────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  // ─── Foco al montar ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (autoFocus) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);

  // ─── Foto ───────────────────────────────────────────────────────────────────

  // Espejo en ref del adjunto actual: si el componente se desmonta con una
  // foto pendiente de enviar, el cleanup de abajo necesita el valor vigente
  // sin depender del cierre de un useEffect que ya no se re-ejecutará.
  const attachmentRef = useRef<Attachment | null>(null);

  function releaseAttachment(att: Attachment | null) {
    if (att) URL.revokeObjectURL(att.previewUrl);
  }

  useEffect(() => {
    return () => releaseAttachment(attachmentRef.current);
  }, []);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Permite volver a elegir el mismo fichero tras quitarlo
    e.target.value = '';
    if (!file) return;

    setAttachError(null);
    setIsPreparingImage(true);
    try {
      const blob = await downscaleImage(file);
      releaseAttachment(attachmentRef.current);
      const next = { blob, previewUrl: URL.createObjectURL(blob) };
      attachmentRef.current = next;
      setAttachment(next);
    } catch {
      setAttachError('No se pudo leer la foto. Prueba con otra.');
    } finally {
      setIsPreparingImage(false);
    }
  }

  function handleRemoveAttachment() {
    releaseAttachment(attachmentRef.current);
    attachmentRef.current = null;
    setAttachment(null);
  }

  // ─── Enviar mensaje ─────────────────────────────────────────────────────────

  const canSend =
    !isStreaming && !isPreparingImage && (inputValue.trim() !== '' || attachment !== null);

  /**
   * Añade un mensaje a la caché de React Query, la única fuente de verdad del
   * hilo: así lo ve al instante cualquier otra instancia de TutorChat montada
   * (burbuja + página Dudas comparten el mismo QueryClient).
   */
  function appendToHistory(msg: LocalMessage) {
    const dto: TutorMessageDto = {
      id: msg.id,
      role: msg.role,
      content: msg.content,
      hasImage: msg.hasImage,
      courseId: null,
      lessonId: null,
      createdAt: new Date().toISOString(),
    };
    queryClient.setQueryData<TutorMessageDto[]>(HISTORY_KEY, (prev) => [...(prev ?? []), dto]);
  }

  async function handleSend() {
    if (!canSend) return;
    const text = inputValue.trim();
    const image = attachmentRef.current?.blob;

    const userMsg: LocalMessage = {
      id: `local-${Date.now()}`,
      role: 'user',
      // Mismo texto por defecto que pone el servidor cuando solo va la foto
      content: text || TUTOR_DEFAULT_IMAGE_PROMPT,
      hasImage: Boolean(image),
    };
    appendToHistory(userMsg);
    setInputValue('');
    releaseAttachment(attachmentRef.current);
    attachmentRef.current = null;
    setAttachment(null);
    setIsStreaming(true);
    setStreamingText('');

    try {
      const response = await chatStream(
        {
          message: text || undefined,
          courseId: context?.courseId,
          lessonId: context?.lessonId,
          courseName: context?.courseName,
          schoolYear: context?.schoolYear,
        },
        image,
      );

      if (!response.ok || !response.body) {
        // Un 429 es cupo agotado, no un fallo de red: decirle "comprueba tu
        // conexión" a quien ha gastado sus preguntas del día es mentirle.
        const motivo = await response
          .json()
          .then((body: { message?: string }) => body.message)
          .catch(() => undefined);
        throw new Error(motivo ?? 'Error en la respuesta del servidor');
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
              appendToHistory({
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: accumulated,
                hasImage: false,
              });
              setStreamingText('');
              setIsStreaming(false);
            }

            if (data.error) {
              appendToHistory({
                id: `error-${Date.now()}`,
                role: 'assistant',
                content: '❌ Lo siento, ha ocurrido un error. Inténtalo de nuevo.',
                hasImage: false,
              });
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
      const motivo = err instanceof Error ? err.message : '';
      appendToHistory({
        id: `error-${Date.now()}`,
        role: 'assistant',
        content:
          motivo.includes('preguntas') || motivo.includes('foto')
            ? `⏳ ${motivo}`
            : '❌ No pude conectar con el tutor. Comprueba tu conexión.',
        hasImage: false,
      });
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
    // useClearHistory ya deja la caché en [] al terminar; no hay estado local
    // propio que limpiar.
    clearHistory();
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={styles.root}>
      {/* Mensajes */}
      <div style={styles.messages}>
        {messages.length === 0 && !isStreaming && (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>🎓</div>
            <p style={styles.emptyText}>
              ¡Hola! Soy tu tutor virtual de VKB Academy. Pregúntame cualquier duda o súbeme la foto
              de un ejercicio.
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
            {msg.hasImage && <span style={styles.imageChip}>📷 Foto adjunta</span>}
            <span style={styles.bubbleText}>{msg.content}</span>
          </div>
        ))}

        {isStreaming && streamingText && (
          <div style={{ ...styles.bubble, ...styles.bubbleAssistant }}>
            <span style={styles.bubbleText}>
              {streamingText}
              <span style={styles.cursor}>▌</span>
            </span>
          </div>
        )}

        {isStreaming && !streamingText && (
          <div style={{ ...styles.bubble, ...styles.bubbleAssistant }}>
            <span style={styles.typingDots}>···</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Foto pendiente de enviar */}
      {attachment && (
        <div style={styles.attachmentRow}>
          <img src={attachment.previewUrl} alt="Foto adjunta" style={styles.thumb} />
          <button
            type="button"
            onClick={handleRemoveAttachment}
            style={styles.removeBtn}
            aria-label="Quitar foto"
            disabled={isStreaming}
          >
            <Icon name="close" size={14} />
            Quitar
          </button>
        </div>
      )}
      {attachError && <div style={styles.attachError}>{attachError}</div>}

      {/* Input */}
      <div style={styles.inputArea}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          // Sin `capture`: en móvil el sistema ofrece cámara o galería, así
          // sirve también una captura de pantalla o una foto ya hecha.
          onChange={(e) => void handleFileChange(e)}
          style={{ display: 'none' }}
          aria-label="Adjuntar foto"
          disabled={isStreaming}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isStreaming || isPreparingImage}
          style={styles.cameraBtn}
          title="Adjuntar foto de un ejercicio"
          aria-label="Abrir selector de foto"
        >
          <Icon name="camera" size={18} />
        </button>
        <textarea
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe tu pregunta..."
          disabled={isStreaming}
          rows={2}
          style={{ ...styles.textarea, ...(isStreaming ? styles.textareaDisabled : {}) }}
        />
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={!canSend}
          style={{ ...styles.sendBtn, ...(!canSend ? styles.sendBtnDisabled : {}) }}
          aria-label="Enviar"
        >
          ▶
        </button>
      </div>

      {/* Limpiar historial */}
      <div style={styles.footer}>
        <button
          type="button"
          onClick={handleClearHistory}
          disabled={isClearing || isStreaming || messages.length === 0}
          style={styles.clearBtn}
        >
          🗑 Limpiar historial
        </button>
      </div>
    </div>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0,
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
  emptyIcon: { fontSize: '2.5rem' },
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
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
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
  bubbleText: { whiteSpace: 'pre-wrap' },
  imageChip: {
    fontSize: '0.75rem',
    opacity: 0.85,
    fontWeight: 600,
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
  attachmentRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '6px 14px',
    borderTop: '1px solid rgba(255,255,255,0.09)',
    flexShrink: 0,
  },
  thumb: {
    width: 56,
    height: 56,
    objectFit: 'cover',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.15)',
  },
  removeBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.2)',
    color: 'rgba(255,255,255,0.7)',
    borderRadius: 8,
    padding: '4px 8px',
    fontSize: '0.75rem',
    cursor: 'pointer',
  },
  attachError: {
    color: '#ff8a80',
    fontSize: '0.75rem',
    padding: '4px 14px',
  },
  inputArea: {
    display: 'flex',
    gap: 8,
    padding: '8px 14px',
    borderTop: '1px solid rgba(255,255,255,0.09)',
    flexShrink: 0,
  },
  cameraBtn: {
    width: 40,
    height: 40,
    alignSelf: 'flex-end',
    borderRadius: 10,
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid var(--brand-soft)',
    color: 'rgba(255,255,255,0.8)',
    cursor: 'pointer',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
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
  textareaDisabled: { opacity: 0.5, cursor: 'not-allowed' },
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
  sendBtnDisabled: { opacity: 0.35, cursor: 'not-allowed' },
  footer: { padding: '4px 14px 10px', flexShrink: 0 },
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
