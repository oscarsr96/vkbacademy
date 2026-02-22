import { useNavigate } from 'react-router-dom';

// Creadores de VKB Academy
const FOUNDERS = [
  {
    name: 'Óscar Sánchez Rueda',
    role: 'Co-fundador & Tech Lead',
    initials: 'OS',
    color: '#ea580c',
    linkedin: 'https://www.linkedin.com/in/%C3%B3scar-s%C3%A1nchez-rueda-8573a4162/',
  },
  {
    name: 'Javier Sánchez Rueda',
    role: 'Co-fundador & Director Deportivo',
    initials: 'JS',
    color: '#6366f1',
    linkedin: 'https://www.linkedin.com/in/javier-s%C3%A1nchez-rueda-8a4117ba/',
  },
  {
    name: 'M. Houghton',
    role: 'Co-fundador',
    initials: 'MH',
    color: '#0891b2',
    linkedin: 'https://www.linkedin.com/in/mhoughtonl/',
  },
];

// Valores del club
const VALUES = [
  {
    icon: '🎯',
    title: 'Excelencia deportiva',
    description: 'Metodología avalada por técnicos federados, ahora también en formato digital para que tu hijo/a siga aprendiendo en casa.',
  },
  {
    icon: '🤝',
    title: 'Familia y comunidad',
    description: 'El barrio como base, la cancha como hogar y los padres como parte del equipo. VKB Academy mantiene ese vínculo.',
  },
  {
    icon: '📚',
    title: 'Formación integral',
    description: 'Combinamos el deporte con herramientas digitales para que tú, como tutor, tengas siempre una visión completa del progreso.',
  },
];

// Puntos de la sección "Por qué creamos VKB Academy"
const WHY_POINTS = [
  'Para que tu hijo/a no pierda ritmo entre entrenamientos',
  'Para que puedas ver su progreso en tiempo real, sin esperar al profe',
  'Para que tú gestiones sus clases particulares cuando mejor te venga',
];

// Merchandising del club
const MERCH = [
  { icon: '🎨', name: 'Pack de stickers VKB', pts: 100 },
  { icon: '💧', name: 'Botella termo del club', pts: 200 },
  { icon: '🧢', name: 'Gorra oficial VKB', pts: 350 },
  { icon: '👕', name: 'Camiseta oficial del club', pts: 500 },
  { icon: '🏀', name: 'Balón firmado por el equipo', pts: 1000 },
];

export default function AboutPage() {
  const navigate = useNavigate();

  return (
    <div style={styles.page}>
      {/* ════════════════════════════════════════
          SECCIÓN 1 — HERO
      ════════════════════════════════════════ */}
      <section style={styles.hero}>
        <div style={styles.heroGlow} />
        <div style={styles.heroGlowBottom} />
        <div style={styles.heroContent}>
          <span style={styles.heroBadge}>🏀 Sobre nosotros</span>
          <h1 style={styles.heroTitle}>
            Vallekas Basket,{' '}
            <span style={styles.heroTitleAccent}>un club para toda la familia</span>
          </h1>
          <p style={styles.heroSubtitle}>
            Más de 30 años formando jugadores y personas en Vallecas. VKB Academy es el paso digital para que el aprendizaje no se quede solo en la cancha.
          </p>
        </div>
      </section>

      {/* ════════════════════════════════════════
          SECCIÓN 2 — HISTORIA
      ════════════════════════════════════════ */}
      <section style={styles.storySection}>
        <div style={styles.storyContent}>
          <h2 style={styles.sectionTitle}>Nuestra historia</h2>

          <div style={styles.storyDivider} />

          <p style={styles.storyParagraph}>
            Vallekas Basket nació en el corazón del barrio de Vallecas a principios de los
            años 90, fundado por un grupo de vecinos apasionados por el baloncesto que
            querían dar a los jóvenes del barrio un espacio donde crecer, tanto dentro como
            fuera de la cancha. Lo que comenzó con una sola canasta y un puñado de
            chavales se convirtió en uno de los clubes de formación más activos del sur
            de Madrid.
          </p>

          <p style={styles.storyParagraph}>
            Hoy, el club cuenta con más de veinte equipos que abarcan todas las categorías,
            desde los más pequeños en benjamín y alevín, pasando por infantil, cadete y
            junior, hasta el equipo sénior que compite en ligas federadas de la Comunidad
            de Madrid. Cada año, más de trescientos jugadores y jugadoras se forman con
            nosotros, guiados por un cuerpo técnico comprometido con su desarrollo
            personal y deportivo.
          </p>

          <p style={styles.storyParagraph}>
            Con más de treinta años de historia, hemos aprendido que el deporte es una
            herramienta poderosa para construir personas íntegras. Y que detrás de cada
            jugador hay una familia que merece estar informada y sentirse parte del proceso.
            Por eso creamos VKB Academy: para llevar la metodología del club a cualquier
            dispositivo y dar a padres y tutores las herramientas para acompañar el
            crecimiento de sus hijos más allá de la cancha.
          </p>
        </div>
      </section>

      {/* ════════════════════════════════════════
          SECCIÓN 3 — MISIÓN Y VALORES
      ════════════════════════════════════════ */}
      <section style={styles.valuesSection}>
        <div style={styles.sectionContainer}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitleCentered}>Misión y valores</h2>
          </div>

          <div style={styles.valuesGrid}>
            {VALUES.map((val, idx) => (
              <ValueCard key={idx} {...val} />
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          SECCIÓN 4 — POR QUÉ VKB ACADEMY
      ════════════════════════════════════════ */}
      <section style={styles.whySection}>
        <div style={styles.whyInner}>
          {/* Columna izquierda — texto */}
          <div style={styles.whyLeft}>
            <h2 style={styles.whyTitle}>Por qué creamos VKB Academy</h2>
            <ul style={styles.whyList}>
              {WHY_POINTS.map((point, idx) => (
                <li key={idx} style={styles.whyItem}>
                  <span style={styles.whyCheck}>✅</span>
                  <span style={styles.whyItemText}>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Columna derecha — cita destacada */}
          <div style={styles.whyRight}>
            <blockquote style={styles.quoteBox}>
              <div style={styles.quoteGlow} />
              <div style={styles.quoteAccent} />
              <p style={styles.quoteText}>
                "La tecnología al servicio del baloncesto de base."
              </p>
              <footer style={styles.quoteAuthor}>— Vallekas Basket, 2026</footer>
            </blockquote>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          SECCIÓN 5 — EL EQUIPO
      ════════════════════════════════════════ */}
      <section style={styles.teamSection}>
        <div style={styles.sectionContainer}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitleCentered}>El equipo fundador</h2>
            <p style={styles.teamSubtitle}>
              Las personas que convirtieron una idea del barrio en una plataforma digital.
            </p>
          </div>
          <div style={styles.teamGrid}>
            {FOUNDERS.map((founder) => (
              <FounderCard key={founder.linkedin} {...founder} />
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          SECCIÓN 6 — MERCHANDISING
      ════════════════════════════════════════ */}
      <section style={styles.merchSection}>
        <div style={styles.sectionContainer}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitleCentered}>🏆 El esfuerzo tiene premio</h2>
            <p style={styles.merchSubtitle}>
              Tu hijo/a acumula puntos completando lecciones y retos. Tú eliges cuándo canjearlos por merchandising exclusivo del club.
            </p>
          </div>
          <div style={styles.merchGrid}>
            {MERCH.map((item) => (
              <MerchCard key={item.name} item={item} />
            ))}
          </div>
          <p style={styles.merchNote}>
            Los puntos se obtienen completando lecciones, módulos, exámenes y manteniendo la racha semanal de estudio.
          </p>
        </div>
      </section>

      {/* ════════════════════════════════════════
          SECCIÓN 7 — CTA FINAL
      ════════════════════════════════════════ */}
      <section style={styles.ctaSection}>
        <div style={styles.ctaGlow} />
        <div style={styles.ctaContent}>
          <h2 style={styles.ctaTitle}>¿Formas parte del club?</h2>
          <p style={styles.ctaSubtitle}>
            Accede a VKB Academy con las credenciales que te ha proporcionado tu tutor o profesor.
          </p>
          <button
            onClick={() => navigate('/login')}
            style={styles.ctaButton}
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
            Acceder a la plataforma
          </button>
        </div>
      </section>
    </div>
  );
}

// ── Componente de tarjeta de fundador ──
function FounderCard({
  name,
  role,
  initials,
  color,
  linkedin,
}: {
  name: string;
  role: string;
  initials: string;
  color: string;
  linkedin: string;
}) {
  return (
    <div
      style={founderCardStyle.card}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = 'translateY(-6px)';
        el.style.boxShadow = '0 16px 48px rgba(234,88,12,0.18)';
        el.style.borderColor = 'rgba(234,88,12,0.25)';
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = 'translateY(0)';
        el.style.boxShadow = '0 4px 24px rgba(0,0,0,0.08)';
        el.style.borderColor = '#e2e8f0';
      }}
    >
      {/* Avatar con anillo de gradiente */}
      <div style={{ padding: 3, borderRadius: '50%', background: `linear-gradient(135deg, ${color} 0%, ${color}99 100%)`, boxShadow: `0 0 20px ${color}55`, marginBottom: '0.5rem' }}>
        <div style={{ ...founderCardStyle.avatar, background: color }}>
          {initials}
        </div>
      </div>

      {/* Nombre y rol */}
      <h3 style={founderCardStyle.name}>{name}</h3>
      <p style={founderCardStyle.role}>{role}</p>

      {/* Botón LinkedIn */}
      <a
        href={linkedin}
        target="_blank"
        rel="noopener noreferrer"
        style={founderCardStyle.linkedinBtn}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLAnchorElement).style.background = '#0077b5';
          (e.currentTarget as HTMLAnchorElement).style.color = '#fff';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
          (e.currentTarget as HTMLAnchorElement).style.color = '#0077b5';
        }}
      >
        in LinkedIn
      </a>
    </div>
  );
}

const founderCardStyle: Record<string, React.CSSProperties> = {
  card: {
    background: '#ffffff',
    border: '1.5px solid #e2e8f0',
    borderRadius: 20,
    padding: '2.25rem 2rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.75rem',
    transition: 'transform 0.22s, box-shadow 0.22s, border-color 0.22s',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    flex: '1 1 240px',
    textAlign: 'center',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.5rem',
    fontWeight: 800,
    color: '#fff',
    letterSpacing: '-0.02em',
  },
  name: {
    fontSize: '1.0625rem',
    fontWeight: 700,
    color: '#0d1b2a',
    margin: 0,
  },
  role: {
    fontSize: '0.875rem',
    color: '#64748b',
    margin: 0,
    lineHeight: 1.4,
  },
  linkedinBtn: {
    marginTop: '0.5rem',
    padding: '7px 18px',
    borderRadius: 8,
    border: '1.5px solid #0077b5',
    background: 'transparent',
    color: '#0077b5',
    fontWeight: 700,
    fontSize: '0.8rem',
    cursor: 'pointer',
    textDecoration: 'none',
    letterSpacing: '0.01em',
    transition: 'background 0.15s, color 0.15s',
  },
};

// ── Componente de tarjeta de valor ──
function ValueCard({
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
      style={valueCardStyle.card}
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
      <div style={valueCardStyle.iconWrap}>
        <span style={valueCardStyle.icon}>{icon}</span>
      </div>
      <h3 style={valueCardStyle.title}>{title}</h3>
      <p style={valueCardStyle.description}>{description}</p>
    </div>
  );
}

const valueCardStyle: Record<string, React.CSSProperties> = {
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
    flex: '1 1 240px',
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    background: 'rgba(234,88,12,0.10)',
    border: '1px solid rgba(234,88,12,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: '1.75rem',
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

// ── Componente de tarjeta merch ──
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
    background: 'linear-gradient(135deg, #080e1a 0%, #0d1b2a 60%, #152233 100%)',
    padding: '6rem 2rem 5rem',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    top: '-80px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 700,
    height: 700,
    background: 'radial-gradient(circle, rgba(234,88,12,0.16) 0%, transparent 65%)',
    pointerEvents: 'none',
    borderRadius: '50%',
  },
  heroGlowBottom: {
    position: 'absolute',
    bottom: '-100px',
    right: '-80px',
    width: 400,
    height: 400,
    background: 'radial-gradient(circle, rgba(234,88,12,0.08) 0%, transparent 70%)',
    pointerEvents: 'none',
    borderRadius: '50%',
  },
  heroContent: {
    maxWidth: 740,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '1.25rem',
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
  heroTitle: {
    fontSize: 'clamp(2rem, 4vw, 3.25rem)',
    fontWeight: 900,
    color: '#ffffff',
    letterSpacing: '-0.03em',
    lineHeight: 1.08,
    margin: 0,
  },
  heroTitleAccent: {
    background: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: '1.1rem',
    lineHeight: 1.7,
    maxWidth: 580,
    margin: 0,
  },

  // Historia
  storySection: {
    background: '#ffffff',
    padding: '6rem 2rem',
    display: 'flex',
    justifyContent: 'center',
  },
  storyContent: {
    maxWidth: 800,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  sectionTitle: {
    fontSize: 'clamp(1.5rem, 3vw, 2.1rem)',
    fontWeight: 800,
    color: '#0d1b2a',
    letterSpacing: '-0.025em',
    margin: 0,
  },
  storyDivider: {
    width: 52,
    height: 4,
    background: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
    borderRadius: 2,
  },
  storyParagraph: {
    fontSize: '1rem',
    color: '#374151',
    lineHeight: 1.8,
    margin: 0,
  },

  // Valores
  valuesSection: {
    background: '#f8fafc',
    padding: '6rem 2rem',
  },
  sectionContainer: {
    maxWidth: 1000,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '3rem',
  },
  sectionHeader: {
    textAlign: 'center',
  },
  sectionTitleCentered: {
    fontSize: 'clamp(1.5rem, 3vw, 2.1rem)',
    fontWeight: 800,
    color: '#0d1b2a',
    letterSpacing: '-0.025em',
    margin: 0,
  },
  valuesGrid: {
    display: 'flex',
    gap: '1.5rem',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },

  // Por qué VKB Academy
  whySection: {
    background: '#ffffff',
    padding: '6rem 2rem',
  },
  whyInner: {
    maxWidth: 1000,
    margin: '0 auto',
    display: 'flex',
    gap: '4rem',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  whyLeft: {
    flex: '1 1 320px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  whyTitle: {
    fontSize: 'clamp(1.5rem, 3vw, 2.1rem)',
    fontWeight: 800,
    color: '#0d1b2a',
    letterSpacing: '-0.025em',
    margin: 0,
  },
  whyList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  whyItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
  },
  whyCheck: {
    fontSize: '1.1rem',
    flexShrink: 0,
    marginTop: '0.1rem',
  },
  whyItemText: {
    fontSize: '1rem',
    color: '#374151',
    lineHeight: 1.6,
  },
  whyRight: {
    flex: '1 1 280px',
  },
  quoteBox: {
    background: 'linear-gradient(135deg, #080e1a 0%, #0d1b2a 60%, #152233 100%)',
    borderRadius: 20,
    padding: '2.75rem',
    position: 'relative',
    overflow: 'hidden',
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    boxShadow: '0 8px 32px rgba(8,14,26,0.25)',
  },
  quoteGlow: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 250,
    height: 250,
    background: 'radial-gradient(circle, rgba(234,88,12,0.2) 0%, transparent 70%)',
    pointerEvents: 'none',
    borderRadius: '50%',
  },
  quoteAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    background: 'linear-gradient(180deg, #ea580c 0%, #f97316 100%)',
    borderRadius: '20px 0 0 20px',
  },
  quoteText: {
    fontSize: '1.3rem',
    fontWeight: 700,
    color: '#ffffff',
    lineHeight: 1.5,
    margin: 0,
    fontStyle: 'italic',
    position: 'relative',
    zIndex: 1,
  },
  quoteAuthor: {
    fontSize: '0.85rem',
    color: 'rgba(255,255,255,0.42)',
    margin: 0,
    fontStyle: 'normal',
    position: 'relative',
    zIndex: 1,
  },

  // Equipo fundador
  teamSection: {
    background: '#f8fafc',
    padding: '6rem 2rem',
  },
  teamSubtitle: {
    color: '#64748b',
    fontSize: '1rem',
    margin: '0.75rem auto 0',
    maxWidth: 480,
    lineHeight: 1.6,
    textAlign: 'center' as const,
  },
  teamGrid: {
    display: 'flex',
    gap: '1.5rem',
    flexWrap: 'wrap' as const,
    justifyContent: 'center',
  },

  // Merchandising
  merchSection: {
    background: '#fff',
    padding: '6rem 2rem',
  },
  merchSubtitle: {
    color: '#64748b',
    fontSize: '1rem',
    margin: '0.75rem auto 0',
    maxWidth: 520,
    lineHeight: 1.6,
    textAlign: 'center' as const,
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

  // CTA final
  ctaSection: {
    background: 'linear-gradient(135deg, #080e1a 0%, #0d1b2a 60%, #152233 100%)',
    padding: '7rem 2rem',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  ctaGlow: {
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
  ctaContent: {
    maxWidth: 600,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '1.5rem',
    position: 'relative',
    zIndex: 1,
  },
  ctaTitle: {
    fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
    fontWeight: 900,
    color: '#ffffff',
    letterSpacing: '-0.025em',
    margin: 0,
    lineHeight: 1.12,
  },
  ctaSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: '1.0625rem',
    margin: 0,
    lineHeight: 1.6,
  },
  ctaButton: {
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
