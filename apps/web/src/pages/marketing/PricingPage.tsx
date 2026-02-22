import { useState } from 'react';
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
      <span style={S.featureCheckmark}>✓</span>
      <span style={S.featureIcon}>{icon}</span>
      <span style={S.featureText}>{text}</span>
    </li>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        ...S.faqItem,
        ...(open ? S.faqItemOpen : {}),
      }}
    >
      <button
        style={S.faqQ}
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = ORANGE;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = NAVY;
        }}
      >
        <span>{q}</span>
        <span style={{ fontSize: '1rem', color: open ? ORANGE : '#94a3b8', transition: 'color 0.15s' }}>
          {open ? '▲' : '▼'}
        </span>
      </button>
      {open && <p style={S.faqA}>{a}</p>}
    </div>
  );
}

function MerchCard({ item }: { item: { icon: string; name: string; pts: number } }) {
  return (
    <div
      style={S.merchCard}
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
      <span style={S.merchIcon}>{item.icon}</span>
      <span style={S.merchName}>{item.name}</span>
      <span style={S.merchPts}>{item.pts.toLocaleString('es-ES')} pts</span>
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
        <div style={S.heroGlow} />
        <div style={S.heroGlowSide} />
        <div style={S.heroInner}>
          <span style={S.heroBadge}>🏀 Para familias de Vallekas Basket</span>
          <h1 style={S.heroTitle}>
            Dale a tu hijo/a acceso a{' '}
            <span style={S.heroTitleAccent}>la mejor formación del club</span>
          </h1>
          <p style={S.heroSub}>
            Por solo <strong style={{ color: '#fb923c' }}>15 € al mes</strong>, tu hijo/a
            accede a todos los cursos, lecciones interactivas y exámenes del club.
            Tú sigues su progreso en tiempo real.
          </p>
        </div>
      </section>

      {/* ════════ PRECIO ════════ */}
      <section style={S.pricingSection}>
        <div style={S.pricingWrap}>

          {/* Tarjeta de precio */}
          <div style={S.planCard}>
            {/* Badge "Más popular" */}
            <div style={S.popularBadge}>Más popular</div>

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
                  <span style={S.planCheckmark}>✓</span>
                  {item}
                </li>
              ))}
            </ul>
            <button
              style={S.planCta}
              onClick={() => navigate('/login')}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.transform = 'translateY(-2px)';
                el.style.boxShadow = '0 12px 36px rgba(234,88,12,0.5)';
                el.style.filter = 'brightness(1.08)';
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.transform = 'translateY(0)';
                el.style.boxShadow = '0 8px 28px rgba(234,88,12,0.35)';
                el.style.filter = 'none';
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
            <div style={S.infoPanelGlow} />
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
              <span style={S.featureColIconWrap}>🎒</span>
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
              <span style={S.featureColIconWrap}>👀</span>
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
              <MerchCard key={item.name} item={item} />
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
        <div style={S.ctaGlow} />
        <h2 style={S.ctaTitle}>¿Formas parte de Vallekas Basket?</h2>
        <p style={S.ctaSub}>
          Accede con las credenciales que te ha proporcionado el club y empieza hoy.
        </p>
        <button
          style={S.ctaBtn}
          onClick={() => navigate('/login')}
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
  heroGlowSide: {
    position: 'absolute',
    bottom: '-80px',
    right: '-80px',
    width: 400,
    height: 400,
    background: 'radial-gradient(circle, rgba(234,88,12,0.08) 0%, transparent 70%)',
    pointerEvents: 'none',
    borderRadius: '50%',
  },
  heroInner: {
    maxWidth: 720,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '1.35rem',
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
    fontSize: 'clamp(1.875rem, 4vw, 3.25rem)',
    fontWeight: 900,
    color: '#fff',
    letterSpacing: '-0.035em',
    lineHeight: 1.08,
    margin: 0,
    maxWidth: 700,
  },
  heroTitleAccent: {
    background: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  heroSub: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: '1.1rem',
    lineHeight: 1.7,
    maxWidth: 540,
    margin: 0,
  },

  // Precio
  pricingSection: {
    background: '#f8fafc',
    padding: '6rem 2rem',
  },
  pricingWrap: {
    maxWidth: 920,
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
    borderRadius: 24,
    padding: '2.75rem',
    flex: '1 1 340px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
    boxShadow: '0 8px 40px rgba(234,88,12,0.18)',
    position: 'relative',
    overflow: 'hidden',
  },
  popularBadge: {
    position: 'absolute',
    top: 20,
    right: 20,
    background: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
    color: '#fff',
    borderRadius: 999,
    padding: '4px 14px',
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    boxShadow: '0 4px 12px rgba(234,88,12,0.4)',
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
    fontSize: '4.5rem',
    fontWeight: 900,
    color: NAVY,
    letterSpacing: '-0.04em',
    lineHeight: 1,
    background: 'linear-gradient(135deg, #0d1b2a 0%, #152233 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
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
    gap: '0.7rem',
  },
  planCheck: {
    fontSize: '0.9rem',
    color: '#374151',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  planCheckmark: {
    width: 20,
    height: 20,
    borderRadius: '50%',
    background: 'rgba(234,88,12,0.12)',
    color: ORANGE,
    fontWeight: 800,
    fontSize: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    border: '1.5px solid rgba(234,88,12,0.25)',
  },
  planCta: {
    background: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    padding: '15px 28px',
    fontSize: '1rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s, filter 0.2s',
    marginTop: '0.25rem',
    boxShadow: '0 8px 28px rgba(234,88,12,0.35)',
    letterSpacing: '-0.01em',
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
    background: 'linear-gradient(135deg, #080e1a 0%, #0d1b2a 60%, #152233 100%)',
    borderRadius: 24,
    padding: '2.75rem',
    flex: '1 1 300px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
    position: 'relative',
    overflow: 'hidden',
    boxShadow: '0 8px 32px rgba(8,14,26,0.3)',
  },
  infoPanelGlow: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 280,
    height: 280,
    background: 'radial-gradient(circle, rgba(234,88,12,0.16) 0%, transparent 70%)',
    pointerEvents: 'none',
    borderRadius: '50%',
  },
  infoPanelItem: {
    display: 'flex',
    gap: '1rem',
    alignItems: 'flex-start',
    position: 'relative',
    zIndex: 1,
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
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 1.6,
    margin: 0,
  },
  infoDivider: {
    height: 1,
    background: 'rgba(255,255,255,0.07)',
    position: 'relative',
    zIndex: 1,
  },

  // Qué obtiene
  featuresSection: {
    background: '#ffffff',
    padding: '6rem 2rem',
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
  featureColIconWrap: {
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
    gap: '0.6rem',
  },
  featureItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    background: '#f8fafc',
    border: '1.5px solid #e2e8f0',
    borderRadius: 12,
    padding: '0.875rem 1rem',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  featureCheckmark: {
    width: 20,
    height: 20,
    borderRadius: '50%',
    background: 'rgba(234,88,12,0.12)',
    color: ORANGE,
    fontWeight: 800,
    fontSize: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    border: '1.5px solid rgba(234,88,12,0.25)',
  },
  featureIcon: {
    fontSize: '1.1rem',
    flexShrink: 0,
  },
  featureText: {
    fontSize: '0.9rem',
    color: '#374151',
    lineHeight: 1.5,
  },

  // Cómo funciona
  howSection: {
    background: '#f8fafc',
    padding: '6rem 2rem',
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
    fontSize: 'clamp(1.5rem, 3vw, 2.25rem)',
    fontWeight: 800,
    color: NAVY,
    letterSpacing: '-0.025em',
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
    width: 52,
    height: 52,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
    color: '#fff',
    fontWeight: 900,
    fontSize: '1.35rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 6px 20px rgba(234,88,12,0.38)',
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
    padding: '6rem 2rem',
  },
  merchGrid: {
    display: 'flex',
    gap: '1rem',
    flexWrap: 'wrap' as const,
    justifyContent: 'center',
  },
  merchCard: {
    background: '#fff',
    border: '1.5px solid #e2e8f0',
    borderRadius: 16,
    padding: '1.5rem 1.25rem',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '0.6rem',
    minWidth: 148,
    textAlign: 'center' as const,
    transition: 'transform 0.22s, box-shadow 0.22s, border-color 0.22s',
    cursor: 'default',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  },
  merchIcon: {
    fontSize: '2.25rem',
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
    background: 'rgba(234,88,12,0.10)',
    padding: '3px 12px',
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
    background: '#f8fafc',
    padding: '6rem 2rem',
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
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    width: '100%',
    textAlign: 'left',
  },
  faqItem: {
    background: '#fff',
    borderRadius: 14,
    border: '1.5px solid #e2e8f0',
    overflow: 'hidden',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
  },
  faqItemOpen: {
    borderColor: 'rgba(234,88,12,0.3)',
    boxShadow: '0 4px 20px rgba(234,88,12,0.12)',
  },
  faqQ: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.25rem 1.5rem',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.95rem',
    fontWeight: 700,
    color: NAVY,
    textAlign: 'left',
    transition: 'color 0.15s',
    gap: 12,
  },
  faqA: {
    fontSize: '0.875rem',
    color: '#374151',
    lineHeight: 1.7,
    margin: 0,
    padding: '0 1.5rem 1.25rem',
  },

  // CTA final
  cta: {
    background: 'linear-gradient(135deg, #080e1a 0%, #0d1b2a 60%, #152233 100%)',
    padding: '7rem 2rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1.5rem',
    textAlign: 'center',
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
  ctaTitle: {
    fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
    fontWeight: 900,
    color: '#fff',
    letterSpacing: '-0.025em',
    margin: 0,
    lineHeight: 1.12,
    position: 'relative',
    zIndex: 1,
  },
  ctaSub: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: '1.0625rem',
    margin: 0,
    lineHeight: 1.6,
    maxWidth: 440,
    position: 'relative',
    zIndex: 1,
  },
  ctaBtn: {
    background: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    padding: '17px 40px',
    fontSize: '1.0625rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s, filter 0.2s',
    boxShadow: '0 8px 32px rgba(234,88,12,0.4)',
    letterSpacing: '-0.01em',
    position: 'relative',
    zIndex: 1,
  },
};
