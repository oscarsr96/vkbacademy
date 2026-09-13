import TutorChat from '../components/tutor/TutorChat';
import PageHeader from '../components/ui/PageHeader';

/**
 * Dudas: el tutor IA. Única puerta al tutor desde que se retiró la burbuja
 * flotante; el alumno pregunta por texto o con la foto de un ejercicio.
 */
export default function TutorPage() {
  return (
    <div style={styles.page}>
      <PageHeader
        variant="light"
        title="Dudas"
        subtitle="Pregunta lo que no entiendas de cualquier asignatura o sube la foto de un ejercicio y te guío paso a paso."
      />

      <div style={styles.chatCard}>
        <TutorChat autoFocus />
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 900,
    margin: '0 auto',
    padding: '32px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  chatCard: {
    // Altura fija en viewport: el hilo hace scroll dentro, no la página.
    // Misma superficie que el resto de tarjetas, sin el hover que las eleva.
    height: 'min(70vh, 720px)',
    minHeight: 420,
    overflow: 'hidden',
    background: 'var(--color-surface)',
    border: '1.5px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-card)',
    display: 'flex',
    flexDirection: 'column',
  },
};
