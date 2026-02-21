import { useNavigate } from 'react-router-dom';

// Merchandising del club
const MERCH = [
  { icon: '🎨', name: 'Pack de stickers VKB', pts: 100 },
  { icon: '💧', name: 'Botella termo del club', pts: 200 },
  { icon: '🧢', name: 'Gorra oficial VKB', pts: 350 },
  { icon: '👕', name: 'Camiseta oficial del club', pts: 500 },
  { icon: '🏀', name: 'Balón firmado por el equipo', pts: 1000 },
];

// Datos de las tarjetas de características — enfocadas en el padre/tutor
const FEATURES = [
  {
    icon: '📹',
    title: 'Vídeos del club, en casa',
    description:
      'Los propios entrenadores de Vallekas Basket crean y actualizan los vídeos técnicos y tácticos. No es contenido genérico.',
  },
  {
    icon: '✏️',
    title: 'Aprende jugando',
    description:
      'Lecciones interactivas con ejercicios de emparejamiento, ordenación y rellenar huecos. Más entretenido que un libro.',
  },
  {
    icon: '🧠',
    title: 'Tests con corrección automática',
    description:
      'Tu hijo/a comprueba lo que ha aprendido en el momento, sin esperar a la próxima clase.',
  },
  {
    icon: '🎓',
    title: 'Exámenes y certificados',
    description:
      'Al superar los exámenes del club, recibe un certificado digital descargable en PDF que acredita su progreso.',
  },
  {
    icon: '📅',
    title: 'Reserva clases con sus profes',
    description:
      'Tú gestionas las clases particulares directamente desde la plataforma, tanto presenciales como online.',
  },
  {
    icon: '📊',
    title: 'Tú siempre al tanto',
    description:
      'Como tutor, ves en tiempo real qué lecciones ha completado, sus resultados y los certificados que ha obtenido.',
  },
];

const STATS = [
  { value: '+30', label: 'Años del club' },
  { value: '+300', label: 'Jugadores al año' },
  { value: '6', label: 'Niveles educativos' },
  { value: '24/7', label: 'Disponible siempre' },
];

const STEPS = [
  {
    number: '1',
    title: 'Contacta con el club',
    description:
      'La administración de Vallekas Basket crea la cuenta de tu hijo/a y te asigna como tutor.',
  },
  {
    number: '2',
    title: 'Tu hijo/a empieza a aprender',
    description:
      'Accede a los cursos de su nivel, completa lecciones y realiza los tests a su ritmo, desde cualquier dispositivo.',
  },
  {
    number: '3',
    title: 'Tú lo ves todo',
    description:
      'Consulta su progreso, sus certificados y reserva clases con los profesores del club desde tu propio panel.',
  },
];

export default function LandingPage() {
  const navigate = useNavigate();

  // Scroll suave a la sección de características
  function handleScrollToFeatures(e: React.MouseEvent) {
    e.preventDefault();
    const el = document.getElementById('features');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <div style={styles.page}>
      {/* ════════════════════════════════════════
          SECCIÓN 1 — HERO
      ════════════════════════════════════════ */}
      <section style={styles.hero}>
        <div style={styles.heroContent}>
          {/* Badge naranja */}
          <span style={styles.heroBadge}>🏀 Para familias de Vallekas Basket</span>

          {/* Titular principal */}
          <h1 style={styles.heroHeadline}>
            El entrenamiento de tu hijo/a, también en casa
          </h1>

          {/* Subtítulo */}
          <p style={styles.heroSubtitle}>
            La metodología real de Vallekas Basket en formato digital. Cursos,
            lecciones interactivas, exámenes con certificado y clases particulares
            — todo en un solo lugar, supervisado por ti.
          </p>

          {/* Botones CTA */}
          <div style={styles.heroCtas}>
            <button
              onClick={() => navigate('/login')}
              style={styles.ctaPrimary}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = '#c94e00';
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 24px rgba(234,88,12,0.4)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = '#ea580c';
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(234,88,12,0.3)';
              }}
            >
              Acceder a la plataforma
            </button>

            <a
              href="#features"
              onClick={handleScrollToFeatures}
              style={styles.ctaSecondary}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.1)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
              }}
            >
              Qué incluye ↓
            </a>
          </div>

          {/* Texto informativo sutil */}
          <p style={styles.heroFootnote}>
            Solo 15 € al mes por alumno · Disponible de 1º ESO a 2º Bachillerato
          </p>
        </div>

        {/* Decoración de fondo */}
        <div style={styles.heroGlow} />
      </section>

      {/* ════════════════════════════════════════
          SECCIÓN 2 — BARRA DE ESTADÍSTICAS
      ════════════════════════════════════════ */}
      <section style={styles.statsBar}>
        <div style={styles.statsInner}>
          {STATS.map((stat, idx) => (
            <div key={idx} style={styles.statItem}>
              <span style={styles.statValue}>{stat.value}</span>
              <span style={styles.statLabel}>{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════
          SECCIÓN 3 — CARACTERÍSTICAS
      ════════════════════════════════════════ */}
      <section id="features" style={styles.features}>
        <div style={styles.sectionContainer}>
          {/* Cabecera */}
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>
              Todo lo que tu hijo/a necesita para mejorar
            </h2>
            <p style={styles.sectionSubtitle}>
              Una plataforma pensada para jugadores de baloncesto en edad escolar, con acceso y seguimiento para padres y tutores
            </p>
          </div>

          {/* Grid de tarjetas */}
          <div style={styles.featuresGrid}>
            {FEATURES.map((feat, idx) => (
              <FeatureCard key={idx} {...feat} />
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          SECCIÓN 3b — MERCHANDISING
      ════════════════════════════════════════ */}
      <section style={styles.merchSection}>
        <div style={styles.sectionContainer}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>🏆 El esfuerzo tiene premio</h2>
            <p style={styles.sectionSubtitle}>
              Tu hijo/a gana puntos completando lecciones y retos. Canjéalos por merchandising exclusivo de Vallekas Basket.
            </p>
          </div>
          <div style={styles.merchGrid}>
            {MERCH.map((item) => (
              <div key={item.name} style={styles.merchCard}>
                <span style={styles.merchIcon}>{item.icon}</span>
                <span style={styles.merchName}>{item.name}</span>
                <span style={styles.merchPts}>{item.pts.toLocaleString('es-ES')} pts</span>
              </div>
            ))}
          </div>
          <p style={styles.merchNote}>
            Puntos acumulables completando lecciones, módulos, exámenes y manteniendo la racha semanal de estudio.
          </p>
        </div>
      </section>

      {/* ════════════════════════════════════════
          SECCIÓN 4 — CÓMO FUNCIONA
      ════════════════════════════════════════ */}
      <section style={styles.howItWorks}>
        <div style={styles.sectionContainer}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>¿Cómo funciona?</h2>
          </div>

          <div style={styles.stepsRow}>
            {STEPS.map((step, idx) => (
              <div key={idx} style={styles.stepWrapper}>
                {/* Círculo numerado */}
                <div style={styles.stepCircle}>{step.number}</div>

                {/* Línea de conexión (entre pasos, no en el último) */}
                {idx < STEPS.length - 1 && (
                  <div style={styles.stepConnector} />
                )}

                {/* Texto del paso */}
                <div style={styles.stepContent}>
                  <h3 style={styles.stepTitle}>{step.title}</h3>
                  <p style={styles.stepDescription}>{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          SECCIÓN 5 — CTA FINAL
      ════════════════════════════════════════ */}
      <section style={styles.ctaBottom}>
        <div style={styles.ctaBottomContent}>
          <h2 style={styles.ctaBottomTitle}>
            ¿Tu hijo/a ya es de Vallekas Basket?
          </h2>
          <p style={styles.ctaBottomSubtitle}>
            Entra con las credenciales que te ha facilitado el club y empieza hoy.
          </p>
          <button
            onClick={() => navigate('/login')}
            style={styles.ctaBottomButton}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = '#c94e00';
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 12px 32px rgba(234,88,12,0.5)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = '#ea580c';
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(234,88,12,0.3)';
            }}
          >
            Entrar a la plataforma
          </button>
        </div>
      </section>
    </div>
  );
}

// ── Componente de tarjeta de característica ──
function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div
      style={featureCardStyle.card}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = 'translateY(-6px)';
        el.style.boxShadow = '0 16px 48px rgba(0,0,0,0.12)';
        el.style.borderColor = '#ea580c';
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = 'translateY(0)';
        el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)';
        el.style.borderColor = '#e2e8f0';
      }}
    >
      <span style={featureCardStyle.icon}>{icon}</span>
      <h3 style={featureCardStyle.title}>{title}</h3>
      <p style={featureCardStyle.description}>{description}</p>
    </div>
  );
}

const featureCardStyle: Record<string, React.CSSProperties> = {
  card: {
    background: '#ffffff',
    border: '1.5px solid #e2e8f0',
    borderRadius: 16,
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
    cursor: 'default',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  icon: {
    fontSize: '2.5rem',
    lineHeight: 1,
  },
  title: {
    fontSize: '1.0625rem',
    fontWeight: 700,
    color: '#0d1b2a',
    margin: 0,
  },
  description: {
    fontSize: '0.9rem',
    color: '#64748b',
    lineHeight: 1.6,
    margin: 0,
  },
};

// ── Estilos principales ──
const styles: Record<string, React.CSSProperties> = {
  page: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    overflowX: 'hidden',
  },

  // Hero
  hero: {
    minHeight: '100vh',
    background: '#0d1b2a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '5rem 2rem',
    position: 'relative',
    overflow: 'hidden',
  },
  heroContent: {
    maxWidth: 780,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '1.5rem',
    position: 'relative',
    zIndex: 1,
  },
  heroBadge: {
    display: 'inline-block',
    background: 'rgba(234,88,12,0.15)',
    border: '1px solid rgba(234,88,12,0.4)',
    color: '#fb923c',
    borderRadius: 999,
    padding: '0.4rem 1.1rem',
    fontSize: '0.85rem',
    fontWeight: 600,
    letterSpacing: '0.01em',
  },
  heroHeadline: {
    fontSize: 'clamp(2.5rem, 5vw, 4rem)',
    fontWeight: 900,
    color: '#ffffff',
    letterSpacing: '-0.03em',
    lineHeight: 1.1,
    margin: 0,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: '1.1rem',
    lineHeight: 1.7,
    maxWidth: 560,
    margin: 0,
  },
  heroCtas: {
    display: 'flex',
    gap: '1rem',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: '0.5rem',
  },
  ctaPrimary: {
    background: '#ea580c',
    color: '#ffffff',
    border: 'none',
    borderRadius: 10,
    padding: '14px 28px',
    fontSize: '1rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'background 0.2s, transform 0.2s, box-shadow 0.2s',
    boxShadow: '0 4px 16px rgba(234,88,12,0.3)',
    letterSpacing: '-0.01em',
  },
  ctaSecondary: {
    background: 'transparent',
    color: '#ffffff',
    border: '1.5px solid rgba(255,255,255,0.35)',
    borderRadius: 10,
    padding: '14px 28px',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.2s',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroFootnote: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: '0.8rem',
    margin: 0,
    letterSpacing: '0.01em',
  },
  heroGlow: {
    position: 'absolute',
    top: '20%',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 600,
    height: 600,
    background: 'radial-gradient(circle, rgba(234,88,12,0.08) 0%, transparent 70%)',
    pointerEvents: 'none',
    borderRadius: '50%',
  },

  // Stats bar
  statsBar: {
    background: '#ffffff',
    borderBottom: '1px solid #e2e8f0',
  },
  statsInner: {
    maxWidth: 900,
    margin: '0 auto',
    padding: '2rem',
    display: 'flex',
    justifyContent: 'center',
    gap: '3rem',
    flexWrap: 'wrap',
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.25rem',
  },
  statValue: {
    fontSize: '2rem',
    fontWeight: 900,
    color: '#ea580c',
    lineHeight: 1,
  },
  statLabel: {
    fontSize: '0.75rem',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    fontWeight: 600,
  },

  // Features section
  features: {
    background: '#f8fafc',
    padding: '5rem 2rem',
  },
  sectionContainer: {
    maxWidth: 1100,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '3rem',
  },
  sectionHeader: {
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  sectionTitle: {
    fontSize: 'clamp(1.6rem, 3vw, 2.25rem)',
    fontWeight: 800,
    color: '#0d1b2a',
    letterSpacing: '-0.02em',
    margin: 0,
  },
  sectionSubtitle: {
    fontSize: '1rem',
    color: '#64748b',
    maxWidth: 560,
    margin: '0 auto',
    lineHeight: 1.6,
  },
  featuresGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '1.5rem',
  },

  // Merchandising section
  merchSection: {
    background: '#ffffff',
    padding: '5rem 2rem',
  },
  merchGrid: {
    display: 'flex',
    gap: '1rem',
    flexWrap: 'wrap' as const,
    justifyContent: 'center',
  },
  merchCard: {
    background: '#f8fafc',
    border: '1.5px solid #e2e8f0',
    borderRadius: 14,
    padding: '1.25rem 1.5rem',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '0.5rem',
    minWidth: 140,
    textAlign: 'center' as const,
  },
  merchIcon: {
    fontSize: '2rem',
    lineHeight: 1,
  },
  merchName: {
    fontSize: '0.825rem',
    fontWeight: 600,
    color: '#0d1b2a',
    lineHeight: 1.3,
  },
  merchPts: {
    fontSize: '0.8rem',
    fontWeight: 700,
    color: '#ea580c',
    background: 'rgba(234,88,12,0.09)',
    padding: '2px 10px',
    borderRadius: 999,
  },
  merchNote: {
    textAlign: 'center' as const,
    fontSize: '0.825rem',
    color: '#94a3b8',
    margin: '0.5rem auto 0',
    maxWidth: 480,
    lineHeight: 1.5,
  },

  // How it works section
  howItWorks: {
    background: '#ffffff',
    padding: '5rem 2rem',
  },
  stepsRow: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 0,
    flexWrap: 'wrap',
    position: 'relative',
  },
  stepWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    flex: '1 1 240px',
    maxWidth: 300,
    position: 'relative',
    padding: '0 1.5rem',
  },
  stepCircle: {
    width: 56,
    height: 56,
    borderRadius: '50%',
    background: '#ea580c',
    color: '#ffffff',
    fontSize: '1.5rem',
    fontWeight: 900,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '1.25rem',
    flexShrink: 0,
    boxShadow: '0 4px 16px rgba(234,88,12,0.3)',
    position: 'relative',
    zIndex: 1,
  },
  stepConnector: {
    position: 'absolute',
    top: 28,
    left: 'calc(50% + 28px)',
    right: 'calc(-50% + 28px)',
    height: 2,
    background: 'transparent',
    borderTop: '2px dashed #e2e8f0',
    zIndex: 0,
  },
  stepContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  stepTitle: {
    fontSize: '1.0625rem',
    fontWeight: 700,
    color: '#0d1b2a',
    margin: 0,
  },
  stepDescription: {
    fontSize: '0.9rem',
    color: '#64748b',
    lineHeight: 1.6,
    margin: 0,
  },

  // CTA final
  ctaBottom: {
    background: '#0d1b2a',
    padding: '6rem 2rem',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaBottomContent: {
    maxWidth: 640,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '1.25rem',
  },
  ctaBottomTitle: {
    fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
    fontWeight: 900,
    color: '#ffffff',
    letterSpacing: '-0.02em',
    margin: 0,
    lineHeight: 1.15,
  },
  ctaBottomSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: '1rem',
    margin: 0,
    lineHeight: 1.6,
  },
  ctaBottomButton: {
    background: '#ea580c',
    color: '#ffffff',
    border: 'none',
    borderRadius: 10,
    padding: '16px 36px',
    fontSize: '1.0625rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'background 0.2s, transform 0.2s, box-shadow 0.2s',
    boxShadow: '0 4px 16px rgba(234,88,12,0.3)',
    marginTop: '0.5rem',
    letterSpacing: '-0.01em',
  },
};
