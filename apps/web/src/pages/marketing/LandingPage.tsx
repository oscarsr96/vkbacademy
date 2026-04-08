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
    title: 'Lecciones en vídeo',
    description: 'Contenido actualizado con los mejores vídeos de cada una de las temáticas.',
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
  { value: '+50', label: 'Cursos disponibles' },
  { value: '+500', label: 'Lecciones interactivas' },
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
        {/* Glow central grande */}
        <div style={styles.heroGlowCenter} />
        {/* Glow lateral */}
        <div style={styles.heroGlowSide} />

        <div style={styles.heroContent}>
          {/* Badge naranja */}
          <span style={styles.heroBadge}>🏀 Para familias de Vallekas Basket</span>

          {/* Titular principal */}
          <h1 style={styles.heroHeadline}>
            Metodología VKB para el{' '}
            <span style={styles.heroHeadlineAccent}>rendimiento académico</span>
          </h1>

          {/* Subtítulo */}
          <p style={styles.heroSubtitle}>
            La metodología real de Vallekas Basket en formato digital. Cursos, lecciones
            interactivas, exámenes con certificado y clases particulares — todo en un solo lugar,
            supervisado por ti.
          </p>

          {/* Botones CTA */}
          <div style={styles.heroCtas}>
            <button
              onClick={() => navigate('/login')}
              style={styles.ctaPrimary}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.transform = 'translateY(-3px)';
                el.style.boxShadow = '0 12px 40px rgba(234,88,12,0.55)';
                el.style.filter = 'brightness(1.08)';
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.transform = 'translateY(0)';
                el.style.boxShadow = '0 8px 32px rgba(234,88,12,0.4)';
                el.style.filter = 'none';
              }}
            >
              Acceder a la plataforma
            </button>

            <a
              href="#features"
              onClick={handleScrollToFeatures}
              style={styles.ctaSecondary}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.12)';
                (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.55)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
                (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.35)';
              }}
            >
              Qué incluye ↓
            </a>
          </div>

          {/* Texto informativo sutil */}
          <p style={styles.heroFootnote}>Disponible de 1º ESO a 2º Bachillerato</p>
        </div>
      </section>

      {/* ════════════════════════════════════════
          SECCIÓN 1b — PRICING HIGHLIGHT
      ════════════════════════════════════════ */}
      <section style={styles.pricingHighlight}>
        <div style={styles.pricingGlow} />
        <div style={styles.pricingInner}>
          <p style={styles.pricingEyebrow}>Menos de lo que cuesta una clase particular</p>
          <h2 style={styles.pricingHeadline}>
            Todo esto, desde{' '}
            <span style={styles.pricingAmount}>
              10 €<span style={styles.pricingPeriod}>/mes</span>
            </span>
          </h2>

          <div style={styles.pricingCards}>
            {/* Plan Básico */}
            <div
              style={styles.pricingCard}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.transform = 'translateY(-6px)';
                el.style.boxShadow = '0 20px 50px rgba(234,88,12,0.2)';
                el.style.borderColor = 'rgba(234,88,12,0.4)';
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.transform = 'translateY(0)';
                el.style.boxShadow = '0 4px 24px rgba(0,0,0,0.3)';
                el.style.borderColor = 'rgba(255,255,255,0.1)';
              }}
            >
              <span style={styles.pricingCardLabel}>Básico</span>
              <div style={styles.pricingCardPrice}>
                <span style={styles.pricingCardAmount}>10€</span>
                <span style={styles.pricingCardPeriod}>/mes</span>
              </div>
              <ul style={styles.pricingCardList}>
                <li>✓ Todos los cursos de su nivel</li>
                <li>✓ Lecciones en vídeo ilimitadas</li>
                <li>✓ Tests y exámenes con certificado</li>
                <li>✓ Seguimiento de progreso para tutores</li>
                <li>✓ Retos y puntos canjeables</li>
              </ul>
            </div>

            {/* Plan Avanzado */}
            <div
              style={{ ...styles.pricingCard, ...styles.pricingCardFeatured }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.transform = 'translateY(-6px) scale(1.02)';
                el.style.boxShadow = '0 24px 60px rgba(234,88,12,0.35)';
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.transform = 'translateY(0) scale(1)';
                el.style.boxShadow = '0 8px 40px rgba(234,88,12,0.25)';
              }}
            >
              <span style={styles.pricingCardBadge}>Popular</span>
              <span style={styles.pricingCardLabelFeatured}>Avanzado</span>
              <div style={styles.pricingCardPrice}>
                <span style={styles.pricingCardAmount}>20€</span>
                <span style={styles.pricingCardPeriod}>/mes</span>
              </div>
              <ul style={styles.pricingCardList}>
                <li>✓ Todo lo del plan Básico</li>
                <li>✓ Clases particulares online y presenciales</li>
                <li>✓ Actividades interactivas avanzadas</li>
                <li>✓ Tutor virtual con IA 24/7</li>
                <li>✓ Acceso prioritario a nuevo contenido</li>
              </ul>
            </div>
          </div>

          <p style={styles.pricingCompare}>
            Una clase particular = 20-30 €/hora. Aquí tu hijo/a tiene{' '}
            <strong style={{ color: '#fb923c' }}>acceso ilimitado todo el mes</strong> por menos que
            eso.
          </p>
        </div>
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
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Todo lo que tu hijo/a necesita para mejorar</h2>
            <p style={styles.sectionSubtitle}>
              Una plataforma pensada para optimizar el rendimiento escolar, con acceso y seguimiento
              para padres y tutores
            </p>
          </div>

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
              Tu hijo/a gana puntos completando lecciones y retos. Canjéalos por merchandising
              exclusivo de Vallekas Basket.
            </p>
          </div>
          <div style={styles.merchGrid}>
            {MERCH.map((item) => (
              <MerchCard key={item.name} item={item} />
            ))}
          </div>
          <p style={styles.merchNote}>
            Puntos acumulables completando lecciones, módulos, exámenes y manteniendo la racha
            semanal de estudio.
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
                <div style={styles.stepCircle}>{step.number}</div>

                {idx < STEPS.length - 1 && <div style={styles.stepConnector} />}

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
        <div style={styles.ctaBottomGlow} />
        <div style={styles.ctaBottomContent}>
          <h2 style={styles.ctaBottomTitle}>¿Tu hijo/a ya es de Vallekas Basket?</h2>
          <p style={styles.ctaBottomSubtitle}>
            Entra con las credenciales que te ha facilitado el club y empieza hoy.
          </p>
          <button
            onClick={() => navigate('/login')}
            style={styles.ctaBottomButton}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.transform = 'translateY(-3px)';
              el.style.boxShadow = '0 16px 48px rgba(234,88,12,0.55)';
              el.style.filter = 'brightness(1.08)';
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.transform = 'translateY(0)';
              el.style.boxShadow = '0 8px 32px rgba(234,88,12,0.4)';
              el.style.filter = 'none';
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
        el.style.boxShadow = '0 16px 48px rgba(234,88,12,0.18)';
        el.style.borderColor = 'rgba(234,88,12,0.3)';
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = 'translateY(0)';
        el.style.boxShadow = '0 4px 24px rgba(0,0,0,0.08)';
        el.style.borderColor = '#e2e8f0';
      }}
    >
      <span style={featureCardStyle.icon}>{icon}</span>
      <h3 style={featureCardStyle.title}>{title}</h3>
      <p style={featureCardStyle.description}>{description}</p>
    </div>
  );
}

// ── Componente de tarjeta de merch ──
function MerchCard({ item }: { item: { icon: string; name: string; pts: number } }) {
  return (
    <div
      style={merchCardStyle.card}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = 'translateY(-5px)';
        el.style.boxShadow = '0 12px 32px rgba(234,88,12,0.18)';
        el.style.borderColor = 'rgba(234,88,12,0.3)';
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = 'translateY(0)';
        el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
        el.style.borderColor = '#e2e8f0';
      }}
    >
      <span style={merchCardStyle.icon}>{item.icon}</span>
      <span style={merchCardStyle.name}>{item.name}</span>
      <span style={merchCardStyle.pts}>{item.pts.toLocaleString('es-ES')} pts</span>
    </div>
  );
}

const featureCardStyle: Record<string, React.CSSProperties> = {
  card: {
    background: '#ffffff',
    border: '1.5px solid #e2e8f0',
    borderRadius: 18,
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    transition: 'transform 0.22s, box-shadow 0.22s, border-color 0.22s',
    cursor: 'default',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
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

const merchCardStyle: Record<string, React.CSSProperties> = {
  card: {
    background: '#fff',
    border: '1.5px solid #e2e8f0',
    borderRadius: 16,
    padding: '1.5rem 1.25rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.6rem',
    minWidth: 148,
    textAlign: 'center',
    transition: 'transform 0.22s, box-shadow 0.22s, border-color 0.22s',
    cursor: 'default',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  },
  icon: {
    fontSize: '2.25rem',
    lineHeight: 1,
  },
  name: {
    fontSize: '0.825rem',
    fontWeight: 600,
    color: '#0d1b2a',
    lineHeight: 1.3,
  },
  pts: {
    fontSize: '0.8rem',
    fontWeight: 700,
    color: '#ea580c',
    background: 'rgba(234,88,12,0.10)',
    padding: '3px 12px',
    borderRadius: 999,
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
    background: 'linear-gradient(135deg, #080e1a 0%, #0d1b2a 60%, #152233 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '5rem 2rem',
    position: 'relative',
    overflow: 'hidden',
  },
  heroGlowCenter: {
    position: 'absolute',
    top: '15%',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 800,
    height: 800,
    background: 'radial-gradient(circle, rgba(234,88,12,0.14) 0%, transparent 65%)',
    pointerEvents: 'none',
    borderRadius: '50%',
  },
  heroGlowSide: {
    position: 'absolute',
    bottom: '-100px',
    right: '-100px',
    width: 500,
    height: 500,
    background: 'radial-gradient(circle, rgba(234,88,12,0.08) 0%, transparent 70%)',
    pointerEvents: 'none',
    borderRadius: '50%',
  },
  heroContent: {
    maxWidth: 800,
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
    background: 'rgba(234,88,12,0.16)',
    border: '1px solid rgba(234,88,12,0.45)',
    color: '#fb923c',
    borderRadius: 999,
    padding: '0.45rem 1.2rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    letterSpacing: '0.02em',
  },
  heroHeadline: {
    fontSize: 'clamp(2.5rem, 5vw, 4.25rem)',
    fontWeight: 900,
    color: '#ffffff',
    letterSpacing: '-0.035em',
    lineHeight: 1.08,
    margin: 0,
  },
  heroHeadlineAccent: {
    background: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: '1.125rem',
    lineHeight: 1.7,
    maxWidth: 580,
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
    background: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: 12,
    padding: '15px 32px',
    fontSize: '1.0625rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s, filter 0.2s',
    boxShadow: '0 8px 32px rgba(234,88,12,0.4)',
    letterSpacing: '-0.01em',
  },
  ctaSecondary: {
    background: 'transparent',
    color: '#ffffff',
    border: '1.5px solid rgba(255,255,255,0.35)',
    borderRadius: 12,
    padding: '15px 32px',
    fontSize: '1.0625rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.2s, border-color 0.2s',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroFootnote: {
    color: 'rgba(255,255,255,0.32)',
    fontSize: '0.8rem',
    margin: 0,
    letterSpacing: '0.01em',
  },

  // Pricing highlight
  pricingHighlight: {
    background: 'linear-gradient(180deg, #0d1b2a 0%, #111d2e 100%)',
    padding: '5rem 2rem',
    position: 'relative',
    overflow: 'hidden',
  },
  pricingGlow: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 700,
    height: 700,
    background: 'radial-gradient(circle, rgba(234,88,12,0.08) 0%, transparent 65%)',
    pointerEvents: 'none',
    borderRadius: '50%',
  },
  pricingInner: {
    maxWidth: 820,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '2rem',
    position: 'relative',
    zIndex: 1,
  },
  pricingEyebrow: {
    color: '#fb923c',
    fontSize: '0.9rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    margin: 0,
  },
  pricingHeadline: {
    fontSize: 'clamp(1.6rem, 3.5vw, 2.5rem)',
    fontWeight: 900,
    color: '#ffffff',
    letterSpacing: '-0.03em',
    lineHeight: 1.15,
    margin: 0,
  },
  pricingAmount: {
    background: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  pricingPeriod: {
    fontSize: '0.5em',
    fontWeight: 600,
  },
  pricingCards: {
    display: 'flex',
    gap: '1.5rem',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: '0.5rem',
  },
  pricingCard: {
    background: 'rgba(255,255,255,0.04)',
    border: '1.5px solid rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: '2.5rem 2rem',
    width: 300,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
    transition: 'transform 0.25s, box-shadow 0.25s, border-color 0.25s',
    boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
    position: 'relative',
  },
  pricingCardFeatured: {
    background: 'linear-gradient(135deg, rgba(234,88,12,0.12) 0%, rgba(249,115,22,0.06) 100%)',
    border: '2px solid rgba(234,88,12,0.4)',
    boxShadow: '0 8px 40px rgba(234,88,12,0.25)',
  },
  pricingCardBadge: {
    position: 'absolute',
    top: -12,
    background: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
    color: '#fff',
    fontSize: '0.75rem',
    fontWeight: 700,
    padding: '4px 16px',
    borderRadius: 999,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  pricingCardLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: '0.85rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  pricingCardLabelFeatured: {
    color: '#fb923c',
    fontSize: '0.85rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  pricingCardPrice: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '2px',
  },
  pricingCardAmount: {
    fontSize: '3rem',
    fontWeight: 900,
    color: '#ffffff',
    lineHeight: 1,
  },
  pricingCardPeriod: {
    fontSize: '1rem',
    color: 'rgba(255,255,255,0.5)',
    fontWeight: 600,
  },
  pricingCardList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
    textAlign: 'left',
    fontSize: '0.9rem',
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 1.5,
  },
  pricingCompare: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: '0.95rem',
    margin: 0,
    maxWidth: 520,
    lineHeight: 1.6,
  },

  // Stats bar
  statsBar: {
    background: '#ffffff',
    borderBottom: '1px solid #e2e8f0',
    borderTop: '1px solid #e2e8f0',
  },
  statsInner: {
    maxWidth: 900,
    margin: '0 auto',
    padding: '2.5rem 2rem',
    display: 'flex',
    justifyContent: 'center',
    gap: '3rem',
    flexWrap: 'wrap',
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.3rem',
  },
  statValue: {
    fontSize: '2.25rem',
    fontWeight: 900,
    background: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
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
    padding: '6rem 2rem',
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
    fontSize: 'clamp(1.65rem, 3vw, 2.4rem)',
    fontWeight: 800,
    color: '#0d1b2a',
    letterSpacing: '-0.025em',
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
    gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
    gap: '1.5rem',
  },

  // Merchandising section
  merchSection: {
    background: '#ffffff',
    padding: '6rem 2rem',
  },
  merchGrid: {
    display: 'flex',
    gap: '1rem',
    flexWrap: 'wrap' as const,
    justifyContent: 'center',
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
    background: '#f8fafc',
    padding: '6rem 2rem',
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
    width: 60,
    height: 60,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
    color: '#ffffff',
    fontSize: '1.5rem',
    fontWeight: 900,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '1.25rem',
    flexShrink: 0,
    boxShadow: '0 6px 20px rgba(234,88,12,0.38)',
    position: 'relative',
    zIndex: 1,
  },
  stepConnector: {
    position: 'absolute',
    top: 30,
    left: 'calc(50% + 30px)',
    right: 'calc(-50% + 30px)',
    height: 2,
    borderTop: '2px dashed rgba(234,88,12,0.25)',
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
    background: 'linear-gradient(135deg, #080e1a 0%, #0d1b2a 60%, #152233 100%)',
    padding: '7rem 2rem',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  ctaBottomGlow: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 600,
    height: 600,
    background: 'radial-gradient(circle, rgba(234,88,12,0.14) 0%, transparent 65%)',
    pointerEvents: 'none',
    borderRadius: '50%',
  },
  ctaBottomContent: {
    maxWidth: 640,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '1.5rem',
    position: 'relative',
    zIndex: 1,
  },
  ctaBottomTitle: {
    fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
    fontWeight: 900,
    color: '#ffffff',
    letterSpacing: '-0.025em',
    margin: 0,
    lineHeight: 1.12,
  },
  ctaBottomSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: '1.0625rem',
    margin: 0,
    lineHeight: 1.6,
  },
  ctaBottomButton: {
    background: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: 12,
    padding: '17px 40px',
    fontSize: '1.0625rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s, filter 0.2s',
    boxShadow: '0 8px 32px rgba(234,88,12,0.4)',
    letterSpacing: '-0.01em',
  },
};
