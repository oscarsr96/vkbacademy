import { useNavigate } from 'react-router-dom';

// ─── Constantes ────────────────────────────────────────────────────────────────

const ORANGE = '#ea580c';
const NAVY   = '#0d1b2a';

// Merchandising del club
const MERCH = [
  { icon: '🎨', name: 'Pack de stickers VKB', pts: 100 },
  { icon: '💧', name: 'Botella termo del club', pts: 200 },
  { icon: '🧢', name: 'Gorra oficial VKB', pts: 350 },
  { icon: '👕', name: 'Camiseta oficial del club', pts: 500 },
  { icon: '🏀', name: 'Balón firmado por el equipo', pts: 1000 },
];

// Lo que obtiene el alumno
const STUDENT_FEATURES = [
  { icon: '📹', text: 'Vídeos técnicos y tácticos organizados por nivel' },
  { icon: '✏️', text: 'Lecciones interactivas: emparejar, ordenar y rellenar huecos' },
  { icon: '🧠', text: 'Tests y quizzes con corrección automática' },
  { icon: '🎓', text: 'Exámenes oficiales por módulo y curso completo' },
  { icon: '📜', text: 'Certificados digitales descargables en PDF al superar cada examen' },
  { icon: '🏆', text: 'Retos y puntos canjeables por merchandising del club' },
];

// Lo que obtiene el tutor/padre
const TUTOR_FEATURES = [
  { icon: '📊', text: 'Seguimiento en tiempo real del progreso de tu hijo/a' },
  { icon: '📅', text: 'Reserva de clases particulares con los profesores del club' },
  { icon: '📋', text: 'Historial completo de intentos, exámenes y certificados' },
  { icon: '🔔', text: 'Notificaciones de avance y recordatorios de clases' },
];

const FAQS = [
  {
    q: '¿Cómo apunto a mi hijo/a?',
    a: 'Contacta con la administración del club. Ellos crearán la cuenta de tu hijo/a y te asignarán como tutor. A partir de ahí, tú gestionas las reservas y sigues su progreso.',
  },
  {
    q: '¿Qué necesita mi hijo/a para acceder?',
    a: 'Solo un navegador web (ordenador, tablet o móvil) y las credenciales que le proporcionará el club. No hace falta instalar ninguna aplicación.',
  },
  {
    q: '¿Puedo ver lo que estudia mi hijo/a?',
    a: 'Sí. Como tutor tienes acceso a su progreso: lecciones completadas, resultados de tests y exámenes, y certificados obtenidos.',
  },
  {
    q: '¿Las clases particulares tienen coste adicional?',
    a: 'El sistema de reservas está incluido. El precio de las sesiones con los profesores lo fija el club de forma independiente a la suscripción de la plataforma.',
  },
  {
    q: '¿Se adapta al nivel educativo de mi hijo/a?',
    a: 'Sí. Al crear la cuenta se asigna el nivel correspondiente (1º ESO a 2º Bachillerato). El alumno solo verá los cursos de su nivel, sin distracciones.',
  },
  {
    q: '¿Qué pasa si mi hijo/a deja el club?',
    a: 'La cuenta se desactiva desde la administración. Los certificados y el historial quedan guardados y pueden exportarse en PDF en cualquier momento.',
  },
];

// ─── Subcomponentes ────────────────────────────────────────────────────────────

function FeatureItem({ icon, text }: { icon: string; text: string }) {
  return (
    <li style={S.featureItem}>
      <span style={S.featureIcon}>{icon}</span>
      <span style={S.featureText}>{text}</span>
    </li>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <div style={S.faqItem}>
      <p style={S.faqQ}>{q}</p>
      <p style={S.faqA}>{a}</p>
    </div>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────────

export default function PricingPage() {
  const navigate = useNavigate();

  return (
    <div style={S.page}>

      {/* ════════ HERO ════════ */}
      <section style={S.hero}>
        <span style={S.heroBadge}>🏀 Para familias de Vallekas Basket</span>
        <h1 style={S.heroTitle}>
          Dale a tu hijo/a acceso a la mejor formación del club
        </h1>
        <p style={S.heroSub}>
          Por solo <strong style={{ color: '#fb923c' }}>15 € al mes</strong>, tu hijo/a
          accede a todos los cursos, lecciones interactivas y exámenes del club.
          Tú sigues su progreso en tiempo real.
        </p>
      </section>

      {/* ════════ PRECIO ════════ */}
      <section style={S.pricingSection}>
        <div style={S.pricingWrap}>

          {/* Tarjeta de precio */}
          <div style={S.planCard}>
            <p style={S.planLabel}>Suscripción mensual</p>
            <div style={S.priceRow}>
              <span style={S.priceCurrency}>€</span>
              <span style={S.priceAmount}>15</span>
              <span style={S.pricePer}>/ mes<br />por alumno</span>
            </div>
            <p style={S.planDesc}>
              Acceso completo a toda la plataforma. Sin permanencia, cancela cuando quieras.
            </p>
            <ul style={S.planChecks}>
              {['Todos los cursos de su nivel', 'Lecciones interactivas y tests', 'Exámenes y certificados PDF', 'Sistema de retos y puntos', 'Reservas de clases particulares'].map((item) => (
                <li key={item} style={S.planCheck}>
                  <span style={{ color: ORANGE, fontWeight: 700, marginRight: 8 }}>✓</span>
                  {item}
                </li>
              ))}
            </ul>
            <button
              style={S.planCta}
              onClick={() => navigate('/login')}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = '#c94e00';
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = ORANGE;
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
              }}
            >
              Acceder a la plataforma
            </button>
            <p style={S.planNote}>
              ¿Aún no tienes cuenta? Contacta con el club para que te den de alta.
            </p>
          </div>

          {/* Panel informativo lateral */}
          <div style={S.infoPanel}>
            <div style={S.infoPanelItem}>
              <span style={S.infoPanelIcon}>👨‍👩‍👧</span>
              <div>
                <p style={S.infoPanelTitle}>Tu rol como tutor</p>
                <p style={S.infoPanelText}>
                  Tienes tu propio acceso para ver el progreso de tu hijo/a, reservar clases con los profesores del club y recibir notificaciones de avance.
                </p>
              </div>
            </div>
            <div style={S.infoDivider} />
            <div style={S.infoPanelItem}>
              <span style={S.infoPanelIcon}>🏀</span>
              <div>
                <p style={S.infoPanelTitle}>Contenido del club</p>
                <p style={S.infoPanelText}>
                  Todo el contenido lo crean y actualizan los propios profesores de Vallekas Basket. No es material genérico — es la metodología real del club.
                </p>
              </div>
            </div>
            <div style={S.infoDivider} />
            <div style={S.infoPanelItem}>
              <span style={S.infoPanelIcon}>📱</span>
              <div>
                <p style={S.infoPanelTitle}>Disponible siempre</p>
                <p style={S.infoPanelText}>
                  Desde cualquier dispositivo, en cualquier momento. Sin descargas ni instalaciones.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════ QUÉ OBTIENE ════════ */}
      <section style={S.featuresSection}>
        <div style={S.featuresInner}>

          {/* Columna alumno */}
          <div style={S.featureCol}>
            <div style={S.featureColHeader}>
              <span style={S.featureColIcon}>🎒</span>
              <h2 style={S.featureColTitle}>Tu hijo/a accede a…</h2>
            </div>
            <ul style={S.featureList}>
              {STUDENT_FEATURES.map((f) => (
                <FeatureItem key={f.text} {...f} />
              ))}
            </ul>
          </div>

          {/* Columna tutor */}
          <div style={S.featureCol}>
            <div style={S.featureColHeader}>
              <span style={S.featureColIcon}>👀</span>
              <h2 style={S.featureColTitle}>Tú como tutor puedes…</h2>
            </div>
            <ul style={S.featureList}>
              {TUTOR_FEATURES.map((f) => (
                <FeatureItem key={f.text} {...f} />
              ))}
            </ul>
          </div>

        </div>
      </section>

      {/* ════════ CÓMO FUNCIONA ════════ */}
      <section style={S.howSection}>
        <div style={S.howInner}>
          <h2 style={S.sectionTitle}>¿Cómo empiezo?</h2>
          <p style={S.sectionSub}>Solo tres pasos y tu hijo/a ya puede aprender.</p>
          <div style={S.stepsRow}>
            {[
              { n: '1', title: 'Contacta con el club', desc: 'Habla con la administración de Vallekas Basket para que creen la cuenta de tu hijo/a.' },
              { n: '2', title: 'Recibe tus credenciales', desc: 'El club te facilita el acceso. Tú como tutor también recibes tu propio usuario.' },
              { n: '3', title: '¡Listo para aprender!', desc: 'Tu hijo/a puede empezar los cursos de inmediato desde cualquier dispositivo.' },
            ].map(({ n, title, desc }) => (
              <div key={n} style={S.step}>
                <div style={S.stepNumber}>{n}</div>
                <h3 style={S.stepTitle}>{title}</h3>
                <p style={S.stepDesc}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ MERCHANDISING ════════ */}
      <section style={S.merchSection}>
        <div style={S.howInner}>
          <h2 style={S.sectionTitle}>🏆 Incluido: sistema de puntos y premios</h2>
          <p style={S.sectionSub}>
            Tu hijo/a acumula puntos completando lecciones y retos. Los puntos se canjean por merchandising exclusivo del club, sin coste adicional.
          </p>
          <div style={S.merchGrid}>
            {MERCH.map((item) => (
              <div key={item.name} style={S.merchCard}>
                <span style={S.merchIcon}>{item.icon}</span>
                <span style={S.merchName}>{item.name}</span>
                <span style={S.merchPts}>{item.pts.toLocaleString('es-ES')} pts</span>
              </div>
            ))}
          </div>
          <p style={S.merchNote}>
            El sistema de puntos es una forma de motivar el estudio y premiar la constancia — sin coste adicional para las familias.
          </p>
        </div>
      </section>

      {/* ════════ FAQ ════════ */}
      <section style={S.faqSection}>
        <div style={S.faqInner}>
          <h2 style={S.sectionTitle}>Preguntas frecuentes</h2>
          <p style={S.sectionSub}>Todo lo que necesitas saber antes de empezar.</p>
          <div style={S.faqGrid}>
            {FAQS.map((faq) => (
              <FaqItem key={faq.q} {...faq} />
            ))}
          </div>
        </div>
      </section>

      {/* ════════ CTA FINAL ════════ */}
      <section style={S.cta}>
        <h2 style={S.ctaTitle}>¿Formas parte de Vallekas Basket?</h2>
        <p style={S.ctaSub}>
          Accede con las credenciales que te ha proporcionado el club y empieza hoy.
        </p>
        <button
          style={S.ctaBtn}
          onClick={() => navigate('/login')}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = '#c94e00';
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 12px 32px rgba(234,88,12,0.5)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = ORANGE;
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(234,88,12,0.3)';
          }}
        >
          Entrar a la plataforma
        </button>
      </section>
    </div>
  );
}

// ─── Estilos ───────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  page: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    overflowX: 'hidden',
  },

  // Hero
  hero: {
    background: NAVY,
    padding: '5rem 2rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '1.25rem',
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
  },
  heroTitle: {
    fontSize: 'clamp(1.875rem, 4vw, 3rem)',
    fontWeight: 900,
    color: '#fff',
    letterSpacing: '-0.03em',
    lineHeight: 1.1,
    margin: 0,
    maxWidth: 680,
  },
  heroSub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: '1.1rem',
    lineHeight: 1.7,
    maxWidth: 520,
    margin: 0,
  },

  // Precio
  pricingSection: {
    background: '#f8fafc',
    padding: '5rem 2rem',
  },
  pricingWrap: {
    maxWidth: 900,
    margin: '0 auto',
    display: 'flex',
    gap: '2rem',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  planCard: {
    background: '#fff',
    border: `2px solid ${ORANGE}`,
    borderRadius: 20,
    padding: '2.5rem',
    flex: '1 1 340px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
    boxShadow: '0 8px 32px rgba(234,88,12,0.10)',
  },
  planLabel: {
    fontSize: '0.75rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: ORANGE,
    margin: 0,
  },
  priceRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 6,
  },
  priceCurrency: {
    fontSize: '1.5rem',
    fontWeight: 800,
    color: NAVY,
    marginTop: 8,
  },
  priceAmount: {
    fontSize: '4rem',
    fontWeight: 900,
    color: NAVY,
    letterSpacing: '-0.04em',
    lineHeight: 1,
  },
  pricePer: {
    fontSize: '0.85rem',
    color: '#64748b',
    lineHeight: 1.5,
    paddingBottom: 6,
    alignSelf: 'flex-end',
  },
  planDesc: {
    fontSize: '0.925rem',
    color: '#374151',
    lineHeight: 1.7,
    margin: 0,
  },
  planChecks: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
  },
  planCheck: {
    fontSize: '0.9rem',
    color: '#374151',
    display: 'flex',
    alignItems: 'flex-start',
  },
  planCta: {
    background: ORANGE,
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '14px 28px',
    fontSize: '1rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'background 0.2s, transform 0.2s',
    marginTop: '0.25rem',
  },
  planNote: {
    fontSize: '0.8rem',
    color: '#94a3b8',
    margin: 0,
    textAlign: 'center',
    lineHeight: 1.5,
  },

  // Panel lateral
  infoPanel: {
    background: NAVY,
    borderRadius: 20,
    padding: '2.5rem',
    flex: '1 1 300px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  infoPanelItem: {
    display: 'flex',
    gap: '1rem',
    alignItems: 'flex-start',
  },
  infoPanelIcon: {
    fontSize: '1.75rem',
    flexShrink: 0,
    lineHeight: 1,
  },
  infoPanelTitle: {
    fontSize: '0.95rem',
    fontWeight: 700,
    color: '#fff',
    margin: '0 0 0.35rem',
  },
  infoPanelText: {
    fontSize: '0.85rem',
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 1.6,
    margin: 0,
  },
  infoDivider: {
    height: 1,
    background: 'rgba(255,255,255,0.08)',
  },

  // Qué obtiene
  featuresSection: {
    background: '#fff',
    padding: '5rem 2rem',
  },
  featuresInner: {
    maxWidth: 960,
    margin: '0 auto',
    display: 'flex',
    gap: '3rem',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  featureCol: {
    flex: '1 1 380px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  featureColHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  featureColIcon: {
    fontSize: '2rem',
    lineHeight: 1,
  },
  featureColTitle: {
    fontSize: '1.25rem',
    fontWeight: 800,
    color: NAVY,
    margin: 0,
    letterSpacing: '-0.02em',
  },
  featureList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  featureItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
    background: '#f8fafc',
    borderRadius: 10,
    padding: '0.875rem 1rem',
  },
  featureIcon: {
    fontSize: '1.1rem',
    flexShrink: 0,
    marginTop: 1,
  },
  featureText: {
    fontSize: '0.9rem',
    color: '#374151',
    lineHeight: 1.5,
  },

  // Cómo funciona
  howSection: {
    background: '#f8fafc',
    padding: '5rem 2rem',
  },
  howInner: {
    maxWidth: 860,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '3rem',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 'clamp(1.5rem, 3vw, 2rem)',
    fontWeight: 800,
    color: NAVY,
    letterSpacing: '-0.02em',
    margin: 0,
  },
  sectionSub: {
    color: '#64748b',
    fontSize: '1rem',
    margin: '-1.5rem 0 0',
    lineHeight: 1.6,
    maxWidth: 480,
  },
  stepsRow: {
    display: 'flex',
    gap: '2rem',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  step: {
    flex: '1 1 220px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.75rem',
  },
  stepNumber: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    background: ORANGE,
    color: '#fff',
    fontWeight: 900,
    fontSize: '1.25rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTitle: {
    fontSize: '1rem',
    fontWeight: 700,
    color: NAVY,
    margin: 0,
  },
  stepDesc: {
    fontSize: '0.875rem',
    color: '#64748b',
    lineHeight: 1.6,
    margin: 0,
  },

  // Merchandising
  merchSection: {
    background: '#fff',
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
    color: NAVY,
    lineHeight: 1.3,
  },
  merchPts: {
    fontSize: '0.8rem',
    fontWeight: 700,
    color: ORANGE,
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

  // FAQ
  faqSection: {
    background: '#fff',
    padding: '5rem 2rem',
  },
  faqInner: {
    maxWidth: 860,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '2.5rem',
    alignItems: 'center',
    textAlign: 'center',
  },
  faqGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
    gap: '1.25rem',
    width: '100%',
    textAlign: 'left',
  },
  faqItem: {
    background: '#f8fafc',
    borderRadius: 12,
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  faqQ: {
    fontSize: '0.95rem',
    fontWeight: 700,
    color: NAVY,
    margin: 0,
  },
  faqA: {
    fontSize: '0.875rem',
    color: '#374151',
    lineHeight: 1.6,
    margin: 0,
  },

  // CTA final
  cta: {
    background: NAVY,
    padding: '6rem 2rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1.25rem',
    textAlign: 'center',
  },
  ctaTitle: {
    fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
    fontWeight: 900,
    color: '#fff',
    letterSpacing: '-0.02em',
    margin: 0,
    lineHeight: 1.15,
  },
  ctaSub: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: '1rem',
    margin: 0,
    lineHeight: 1.6,
    maxWidth: 440,
  },
  ctaBtn: {
    background: ORANGE,
    color: '#fff',
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
