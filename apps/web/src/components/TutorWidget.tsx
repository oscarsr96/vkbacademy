import { useState } from 'react';
import { matchPath, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import TutorChat, { TutorContext } from './tutor/TutorChat';

/**
 * Burbuja flotante del tutor. Solo aporta el panel y el contexto de la ruta
 * (curso/lección); el chat en sí vive en TutorChat, que también monta la
 * página Dudas.
 */
export default function TutorWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const queryClient = useQueryClient();

  // En la página Dudas el mismo hilo ya ocupa la pantalla: la burbuja se
  // oculta (no se desmonta, para no perder lo que hubiera escrito en ella).
  const onTutorPage = matchPath('/tutor', location.pathname) !== null;

  // Detectar contexto de la página actual
  const courseMatch = matchPath('/courses/:id', location.pathname);
  const lessonMatch = matchPath('/lessons/:id', location.pathname);
  const courseId = courseMatch?.params?.id ?? undefined;
  const lessonId = lessonMatch?.params?.id ?? undefined;

  // Intentar obtener nombre del curso desde el caché de React Query
  const cachedCourse = courseId
    ? (queryClient.getQueryData(['courses', courseId]) as
        | { title?: string; schoolYear?: { label?: string } }
        | undefined)
    : undefined;
  const courseName = cachedCourse?.title;
  const schoolYear = cachedCourse?.schoolYear?.label;

  const context: TutorContext = { courseId, lessonId, courseName, schoolYear };

  return (
    <>
      {!isOpen && !onTutorPage && (
        <button
          onClick={() => setIsOpen(true)}
          style={styles.fab}
          title="Tutor Virtual VKB"
          aria-label="Abrir tutor virtual"
        >
          💬
        </button>
      )}

      {/*
        TutorChat se mantiene montado durante toda la vida del widget: si se
        desmontara al cerrar la burbuja, perdería el hilo en memoria y
        cualquier streaming en curso. En su lugar se oculta el panel con
        `display: none` — el atributo `hidden` no serviría porque el `display:
        flex` inline de abajo lo pisaría.
      */}
      <div
        className="zone-dark"
        style={{ ...styles.panel, display: isOpen && !onTutorPage ? 'flex' : 'none' }}
      >
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <span style={styles.headerIcon}>🤖</span>
            <div>
              <div style={styles.headerTitle}>Tutor VKB</div>
              {(courseName || schoolYear) && (
                <div style={styles.contextBadge}>
                  {courseName ?? ''}
                  {schoolYear ? ` · ${schoolYear}` : ''}
                </div>
              )}
            </div>
          </div>
          <div style={styles.headerActions}>
            <button
              onClick={() => setIsOpen(false)}
              style={styles.headerBtn}
              title="Cerrar"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>
        </div>

        {/* El panel fija la altura; TutorChat la rellena. `zone-dark` en el
            panel: el chat usa tokens semánticos, así que aquí sale oscuro y
            en la página Dudas, claro, con el mismo componente. */}
        <div style={styles.body}>
          <TutorChat context={context} autoFocus={isOpen} />
        </div>
      </div>
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
  headerLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  headerIcon: { fontSize: '1.5rem' },
  headerTitle: { color: '#fff', fontWeight: 700, fontSize: '0.9375rem' },
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
  headerActions: { display: 'flex', gap: 4 },
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
  body: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' },
};
