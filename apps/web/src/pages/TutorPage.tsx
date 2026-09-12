import TutorChat from '../components/tutor/TutorChat';
import PageHeader from '../components/ui/PageHeader';

/**
 * Dudas: el tutor IA a pantalla completa. Mismo historial y mismo cupo que la
 * burbuja; aquí además cabe la foto de un ejercicio con comodidad.
 */
export default function TutorPage() {
  return (
    <div style={styles.page}>
      <PageHeader
        variant="light"
        title="Dudas"
        subtitle="Pregunta lo que no entiendas de cualquier asignatura o sube la foto de un ejercicio y te guío paso a paso."
      />

      <div className="vkb-card" style={styles.chatCard}>
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
    // Altura fija en viewport: el hilo hace scroll dentro, no la página
    height: 'min(70vh, 720px)',
    minHeight: 420,
    padding: 0,
    overflow: 'hidden',
    background: 'var(--navy-800)',
    display: 'flex',
    flexDirection: 'column',
  },
};
