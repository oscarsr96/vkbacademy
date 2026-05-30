import { useNavigate } from 'react-router-dom';

// Paleta oficial Vallekas Basket — naranja primario, cyan como acento puntual
const C = {
  orange: '#f5911e',
  orangeLight: '#fbb04a',
  orangeDeep: '#e07b06',
  cyan: '#13aff0',
  cyanLight: '#46d4fe',
  red: '#cb2027',
  navy: '#0a1628',
  navyMid: '#0d1b2a',
  navyDeep: '#080e1a',
};

// Gradientes reutilizables
const G = {
  primary: `linear-gradient(135deg, ${C.orange} 0%, ${C.orangeLight} 100%)`,
  primaryDeep: `linear-gradient(135deg, ${C.orangeDeep} 0%, ${C.orange} 100%)`,
  // Multicolor "firma" del club — naranja domina, cyan toque final
  signature: `linear-gradient(135deg, ${C.orange} 0%, ${C.orangeLight} 55%, ${C.cyan} 100%)`,
  hero: `linear-gradient(135deg, ${C.navyDeep} 0%, ${C.navyMid} 55%, ${C.navy} 100%)`,
};

// Tipografía
const F = {
  display: "'Bebas Neue', 'Unbounded', Impact, sans-serif",
  brand: "'Unbounded', 'Inter', sans-serif",
  body: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

// Merchandising del club — `icon` referencia una clave del registro SVG (ver ICONS)
const MERCH = [
  { icon: 'sticker', name: 'Pack de stickers VKB', pts: 100 },
  { icon: 'bottle', name: 'Botella termo del club', pts: 200 },
  { icon: 'cap', name: 'Gorra oficial VKB', pts: 350 },
  { icon: 'shirt', name: 'Camiseta oficial del club', pts: 500 },
  { icon: 'basketball', name: 'Balón firmado por el equipo', pts: 1000 },
];

// Datos de las tarjetas de características — enfocadas en el padre/tutor.
// `icon` referencia una clave del registro de iconos SVG (ver ICONS abajo).
const FEATURES = [
  {
    icon: 'target',
    title: 'Ejercicios bajo demanda',
    description:
      'Tu hijo/a genera ejercicios al instante de cualquier tema: polinomios, sintaxis, el Renacimiento… La IA crea actividades a su medida, justo cuando las necesita.',
  },
  {
    icon: 'shapes',
    title: 'Aprende jugando',
    description:
      'Cada ejercicio es interactivo: emparejar, ordenar, rellenar huecos o test. Más entretenido que un libro y mil veces más rápido que una ficha.',
  },
  {
    icon: 'video',
    title: 'Vídeos curados automáticamente',
    description:
      'Cada práctica se acompaña de los mejores vídeos sobre el tema, seleccionados por la IA. Sin perder horas buscando en YouTube.',
  },
  {
    icon: 'check',
    title: 'Corrección automática',
    description:
      'Tu hijo/a comprueba lo que ha aprendido en el momento, con explicación al fallar. Sin esperar a la próxima clase.',
  },
  {
    icon: 'graduation',
    title: 'Exámenes y certificados',
    description:
      'Al superar los exámenes del club, recibe un certificado digital descargable en PDF que acredita su progreso.',
  },
  {
    icon: 'calendar',
    title: 'Reserva clases con sus profes',
    description:
      'Tú gestionas las clases particulares directamente desde la plataforma, tanto presenciales como online.',
  },
  {
    icon: 'chart',
    title: 'Tú siempre al tanto',
    description:
      'Como tutor, ves en tiempo real qué ejercicios ha completado, sus resultados y los certificados que ha obtenido.',
  },
];

// Registro de iconos SVG (estilo línea, 24×24, heredan color vía currentColor).
// Sustituyen a los emojis para un acabado profesional y consistente en todas
// las plataformas (los emojis dependen de la fuente del sistema).
const ICONS: Record<string, string> = {
  target:
    '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4"/>',
  shapes:
    '<path d="M8.3 10a.7.7 0 0 1-.62-1.05l3.7-6.36a.7.7 0 0 1 1.2 0l3.7 6.36A.7.7 0 0 1 15.7 10Z"/><rect x="3" y="14" width="7" height="7" rx="1.4"/><circle cx="17.5" cy="17.5" r="3.5"/>',
  video: '<path d="m22 8-6 4 6 4V8Z"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
  check: '<path d="M21.8 10A10 10 0 1 1 17 3.34"/><path d="m9 11 3 3L22 4"/>',
  graduation:
    '<path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12v5c0 1 2.7 2.5 6 2.5s6-1.5 6-2.5v-5"/><path d="M22 10v6"/>',
  calendar:
    '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/><path d="M8 2v4"/><path d="M16 2v4"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/>',
  chart:
    '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  trophy:
    '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  sticker:
    '<path d="M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9.5l6.5-6.5V5a2 2 0 0 0-2-2Z"/><path d="M15 21v-4a2 2 0 0 1 2-2h4"/><path d="M9 11h.01"/><path d="M14 11h.01"/><path d="M9.5 14.5s1 1.2 2.5 1.2 2.5-1.2 2.5-1.2"/>',
  bottle:
    '<path d="M9 2h6"/><path d="M9.5 2v2.4a3 3 0 0 1-.55 1.73l-.9 1.27A3 3 0 0 0 7.5 9.1V20a2 2 0 0 0 2 2h5a2 2 0 0 0 2-2V9.1a3 3 0 0 0-.55-1.7l-.9-1.27A3 3 0 0 1 14.5 4.4V2"/><path d="M7.5 13h9"/>',
  cap: '<path d="M4 15a8 6 0 0 1 16 0H4Z"/><path d="M20 15c2.2 0 4 .7 4 1.7 0 .7-.8 1-1.8 1H14"/><path d="M12 9V7"/>',
  shirt:
    '<path d="M20.4 3.5 16 2a4 4 0 0 1-8 0L3.6 3.5a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V10h2.17a1 1 0 0 0 .99-.84l.58-3.47A2 2 0 0 0 20.4 3.5Z"/>',
  basketball:
    '<circle cx="12" cy="12" r="10"/><path d="M4.9 4.9C8 8 8 16 4.9 19.1"/><path d="M19.1 4.9C16 8 16 16 19.1 19.1"/><path d="M2 12h20"/><path d="M12 2v20"/>',
};

// ── Icono SVG de línea reutilizable ──
function Icon({
  name,
  size = 26,
  color = 'currentColor',
  strokeWidth = 1.85,
}: {
  name: string;
  size?: number | string;
  color?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: ICONS[name] ?? '' }}
    />
  );
}

const STATS = [
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
      {/* Animaciones + responsive overrides — no se pueden hacer con inline styles */}
      <style>{`
        @keyframes lp-glow-pulse {
          0%, 100% { opacity: 0.65; transform: translate(-50%, 0) scale(1); }
          50%      { opacity: 1;    transform: translate(-50%, 0) scale(1.06); }
        }
        @keyframes lp-glow-pulse-side {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50%      { opacity: 0.9;  transform: scale(1.08); }
        }
        @keyframes lp-shimmer {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        .lp-shimmer-text {
          background: linear-gradient(
            90deg,
            ${C.orange} 0%,
            ${C.orangeLight} 25%,
            ${C.cyan} 50%,
            ${C.orangeLight} 75%,
            ${C.orange} 100%
          );
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
          animation: lp-shimmer 6s linear infinite;
        }
        .lp-glow-center { animation: lp-glow-pulse 7s ease-in-out infinite; }
        .lp-glow-side   { animation: lp-glow-pulse-side 9s ease-in-out infinite; }

        /* Foco visible para navegación por teclado (accesibilidad) */
        .lp-focusable:focus-visible {
          outline: 3px solid ${C.cyanLight};
          outline-offset: 3px;
          border-radius: 14px;
        }

        /* Respeta la preferencia de movimiento reducido del sistema */
        @media (prefers-reduced-motion: reduce) {
          .lp-shimmer-text,
          .lp-glow-center,
          .lp-glow-side {
            animation: none !important;
          }
        }

        @media (max-width: 768px) {
          .lp-hero { min-height: auto !important; padding: 3rem 1.25rem !important; }
          .lp-pricing-hl { padding: 3rem 1.25rem !important; }
          .lp-pricing-cards { flex-direction: column !important; align-items: center !important; }
          .lp-pricing-card { width: 100% !important; max-width: 360px !important; }
          .lp-stats-inner { gap: 1.5rem !important; padding: 1.75rem 1.25rem !important; }
          .lp-stat-value { font-size: 2.75rem !important; }
          .lp-features { padding: 3.5rem 1.25rem !important; }
          .lp-features-grid { grid-template-columns: 1fr !important; }
          .lp-merch { padding: 3.5rem 1.25rem !important; }
          .lp-merch-grid { gap: 0.75rem !important; }
          .lp-merch-card { min-width: 120px !important; padding: 1rem 0.75rem !important; }
          .lp-how { padding: 3.5rem 1.25rem !important; }
          .lp-steps-row { flex-direction: column !important; align-items: center !important; gap: 2rem !important; }
          .lp-step-connector { display: none !important; }
          .lp-step-wrapper { max-width: 100% !important; padding: 0 !important; }
          .lp-cta-bottom { padding: 4rem 1.25rem !important; }
        }
      `}</style>

      {/* ════════════════════════════════════════
          SECCIÓN 1 — HERO
      ════════════════════════════════════════ */}
      <section className="lp-hero" style={styles.hero}>
        {/* Líneas de cancha decorativas (SVG) */}
        <svg style={styles.heroCourt} viewBox="0 0 1200 800" preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id="court-line" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={C.orange} stopOpacity="0" />
              <stop offset="50%" stopColor={C.orange} stopOpacity="0.55" />
              <stop offset="100%" stopColor={C.orange} stopOpacity="0" />
            </linearGradient>
          </defs>
          <line x1="0" y1="400" x2="1200" y2="400" stroke="url(#court-line)" strokeWidth="1" />
          <circle
            cx="600"
            cy="400"
            r="120"
            fill="none"
            stroke={C.orange}
            strokeOpacity="0.22"
            strokeWidth="1.2"
          />
          <circle
            cx="600"
            cy="400"
            r="40"
            fill="none"
            stroke={C.cyan}
            strokeOpacity="0.20"
            strokeWidth="1"
          />
        </svg>

        {/* Glow central naranja grande */}
        <div className="lp-glow-center" style={styles.heroGlowCenter} />
        {/* Glow lateral naranja secundario */}
        <div className="lp-glow-side" style={styles.heroGlowSide} />
        {/* Glow esquina superior izquierda — cyan acento */}
        <div className="lp-glow-side" style={styles.heroGlowTopLeft} />

        <div style={styles.heroContent}>
          {/* Badge naranja */}
          <span style={styles.heroBadge}>
            <span style={styles.heroBadgeDot} />
            Para familias de Vallekas Basket
          </span>

          {/* Titular principal en Bebas Neue */}
          <h1 style={styles.heroHeadline}>
            METODOLOGÍA VKB
            <br />
            <span className="lp-shimmer-text" style={styles.heroHeadlineAccent}>
              PARA EL RENDIMIENTO ACADÉMICO
            </span>
          </h1>

          {/* Subtítulo */}
          <p style={styles.heroSubtitle}>
            La metodología real de Vallekas Basket en formato digital. Ejercicios personalizados de
            cualquier tema, exámenes con certificado y clases particulares — todo en un solo lugar,
            supervisado por ti.
          </p>

          {/* Botones CTA */}
          <div style={styles.heroCtas}>
            <button
              onClick={() => navigate('/login')}
              className="lp-focusable"
              style={styles.ctaPrimary}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.transform = 'translateY(-3px)';
                el.style.boxShadow = `0 16px 48px rgba(245,145,30,0.60), 0 0 24px rgba(19,175,240,0.22)`;
                el.style.filter = 'brightness(1.08)';
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.transform = 'translateY(0)';
                el.style.boxShadow = `0 8px 32px rgba(245,145,30,0.50)`;
                el.style.filter = 'none';
              }}
            >
              Acceder a la plataforma
            </button>

            <a
              href="#features"
              onClick={handleScrollToFeatures}
              className="lp-focusable"
              style={styles.ctaSecondary}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(245,145,30,0.14)';
                (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(251,176,74,0.7)';
                (e.currentTarget as HTMLAnchorElement).style.color = C.orangeLight;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
                (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.35)';
                (e.currentTarget as HTMLAnchorElement).style.color = '#ffffff';
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
      <section className="lp-pricing-hl" style={styles.pricingHighlight}>
        <div style={styles.pricingGlowMain} />
        <div style={styles.pricingGlowAccent} />
        <div style={styles.pricingInner}>
          <p style={styles.pricingEyebrow}>Menos de lo que cuesta una clase particular</p>
          <h2 style={styles.pricingHeadline}>
            Todo esto, desde{' '}
            <span style={styles.pricingAmount}>
              10 €<span style={styles.pricingPeriod}>/mes</span>
            </span>
          </h2>

          <div className="lp-pricing-cards" style={styles.pricingCards}>
            {/* Plan Básico */}
            <div
              className="lp-pricing-card"
              style={styles.pricingCard}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.transform = 'translateY(-6px)';
                el.style.boxShadow = `0 20px 50px rgba(245,145,30,0.25)`;
                el.style.borderColor = 'rgba(245,145,30,0.5)';
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
              className="lp-pricing-card"
              style={{ ...styles.pricingCard, ...styles.pricingCardFeatured }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.transform = 'translateY(-6px) scale(1.02)';
                el.style.boxShadow = `0 24px 60px rgba(245,145,30,0.50), 0 0 24px rgba(19,175,240,0.18)`;
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.transform = 'translateY(0) scale(1)';
                el.style.boxShadow = `0 12px 40px rgba(245,145,30,0.35)`;
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
            <strong style={{ color: C.orangeLight }}>acceso ilimitado todo el mes</strong> por menos
            que eso.
          </p>
        </div>
      </section>

      {/* ════════════════════════════════════════
          SECCIÓN 2 — BARRA DE ESTADÍSTICAS
      ════════════════════════════════════════ */}
      <section style={styles.statsBar}>
        {/* Banda multicolor naranja-dominante */}
        <div style={styles.statsAccentLine} />
        <div className="lp-stats-inner" style={styles.statsInner}>
          {STATS.map((stat, idx) => (
            <div key={idx} style={styles.statItem}>
              <span className="lp-stat-value" style={styles.statValue}>
                {stat.value}
              </span>
              <span style={styles.statLabel}>{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════
          SECCIÓN 3 — CARACTERÍSTICAS
      ════════════════════════════════════════ */}
      <section id="features" className="lp-features" style={styles.features}>
        <div style={styles.sectionContainer}>
          <div style={styles.sectionHeader}>
            <span style={styles.sectionEyebrow}>Plataforma</span>
            <h2 style={styles.sectionTitle}>
              TODO LO QUE TU HIJO/A NECESITA{' '}
              <span style={styles.sectionTitleAccent}>PARA MEJORAR</span>
            </h2>
            <p style={styles.sectionSubtitle}>
              Una plataforma pensada para optimizar el rendimiento escolar, con acceso y seguimiento
              para padres y tutores
            </p>
          </div>

          <div className="lp-features-grid" style={styles.featuresGrid}>
            {FEATURES.map((feat, idx) => (
              <FeatureCard key={idx} {...feat} index={idx} />
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          SECCIÓN 3b — MERCHANDISING
      ════════════════════════════════════════ */}
      <section className="lp-merch" style={styles.merchSection}>
        <div style={styles.sectionContainer}>
          <div style={styles.sectionHeader}>
            <span style={styles.sectionEyebrow}>Recompensas</span>
            <h2 style={styles.sectionTitle}>
              <span
                style={{
                  display: 'inline-flex',
                  verticalAlign: '-0.12em',
                  marginRight: '0.35em',
                  color: C.orange,
                }}
              >
                <Icon name="trophy" size="0.85em" color={C.orange} strokeWidth={1.75} />
              </span>
              EL ESFUERZO <span style={styles.sectionTitleAccent}>TIENE PREMIO</span>
            </h2>
            <p style={styles.sectionSubtitle}>
              Tu hijo/a gana puntos completando lecciones y retos. Canjéalos por merchandising
              exclusivo de Vallekas Basket.
            </p>
          </div>
          <div className="lp-merch-grid" style={styles.merchGrid}>
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
      <section className="lp-how" style={styles.howItWorks}>
        <div style={styles.sectionContainer}>
          <div style={styles.sectionHeader}>
            <span style={styles.sectionEyebrow}>Proceso</span>
            <h2 style={styles.sectionTitle}>
              ¿CÓMO <span style={styles.sectionTitleAccent}>FUNCIONA?</span>
            </h2>
          </div>

          <div className="lp-steps-row" style={styles.stepsRow}>
            {STEPS.map((step, idx) => (
              <div key={idx} className="lp-step-wrapper" style={styles.stepWrapper}>
                <div style={styles.stepCircle}>
                  <span style={styles.stepCircleNumber}>{step.number}</span>
                </div>

                {idx < STEPS.length - 1 && (
                  <div className="lp-step-connector" style={styles.stepConnector} />
                )}

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
      <section className="lp-cta-bottom" style={styles.ctaBottom}>
        <div className="lp-glow-center" style={styles.ctaBottomGlow} />
        <div className="lp-glow-side" style={styles.ctaBottomGlowAccent} />
        <div style={styles.ctaBottomContent}>
          <h2 style={styles.ctaBottomTitle}>
            ¿TU HIJO/A YA ES DE{' '}
            <span className="lp-shimmer-text" style={styles.ctaBottomTitleAccent}>
              VALLEKAS BASKET
            </span>
            ?
          </h2>
          <p style={styles.ctaBottomSubtitle}>
            Entra con las credenciales que te ha facilitado el club y empieza hoy.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="lp-focusable"
            style={styles.ctaBottomButton}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.transform = 'translateY(-3px)';
              el.style.boxShadow = `0 20px 56px rgba(245,145,30,0.65), 0 0 32px rgba(19,175,240,0.22)`;
              el.style.filter = 'brightness(1.08)';
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.transform = 'translateY(0)';
              el.style.boxShadow = `0 8px 32px rgba(245,145,30,0.50)`;
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
  index,
}: {
  icon: string;
  title: string;
  description: string;
  index: number;
}) {
  // Naranja domina; cyan aparece como 1 de cada 3 para variedad visual
  const useCyan = index % 3 === 1;
  const accent = useCyan ? C.cyan : C.orange;
  const accentRgb = useCyan ? '19,175,240' : '245,145,30';

  return (
    <div
      style={{
        ...featureCardStyle.card,
        // Borde superior con color de acento
        borderTop: `3px solid ${accent}`,
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = 'translateY(-6px)';
        el.style.boxShadow = `0 18px 48px rgba(${accentRgb},0.24)`;
        el.style.borderColor = `rgba(${accentRgb},0.40)`;
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = 'translateY(0)';
        el.style.boxShadow = '0 4px 24px rgba(0,0,0,0.08)';
        el.style.borderColor = '#e2e8f0';
      }}
    >
      <span
        style={{
          ...featureCardStyle.iconChip,
          background: `rgba(${accentRgb},0.10)`,
          color: accent,
        }}
      >
        <Icon name={icon} size={26} color={accent} strokeWidth={1.9} />
      </span>
      <h3 style={featureCardStyle.title}>{title}</h3>
      <p style={featureCardStyle.description}>{description}</p>
    </div>
  );
}

// ── Componente de tarjeta de merch ──
function MerchCard({ item }: { item: { icon: string; name: string; pts: number } }) {
  return (
    <div
      className="lp-merch-card"
      style={merchCardStyle.card}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = 'translateY(-5px)';
        el.style.boxShadow = `0 12px 32px rgba(245,145,30,0.24)`;
        el.style.borderColor = 'rgba(245,145,30,0.45)';
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = 'translateY(0)';
        el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
        el.style.borderColor = '#e2e8f0';
      }}
    >
      <span style={merchCardStyle.iconChip}>
        <Icon name={item.icon} size={30} color={C.orange} strokeWidth={1.75} />
      </span>
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
  iconChip: {
    width: 54,
    height: 54,
    borderRadius: 15,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  title: {
    fontSize: '1.0625rem',
    fontWeight: 700,
    color: C.navy,
    margin: 0,
    fontFamily: F.body,
  },
  description: {
    fontSize: '0.9rem',
    color: '#64748b',
    lineHeight: 1.6,
    margin: 0,
    fontFamily: F.body,
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
  iconChip: {
    width: 56,
    height: 56,
    borderRadius: '50%',
    background: 'rgba(245,145,30,0.10)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  name: {
    fontSize: '0.825rem',
    fontWeight: 600,
    color: C.navy,
    lineHeight: 1.3,
    fontFamily: F.body,
  },
  pts: {
    fontSize: '0.78rem',
    fontWeight: 800,
    color: '#ffffff',
    background: G.signature,
    padding: '4px 14px',
    borderRadius: 999,
    letterSpacing: '0.04em',
    fontFamily: F.brand,
  },
};

// ── Estilos principales ──
const styles: Record<string, React.CSSProperties> = {
  page: {
    fontFamily: F.body,
    overflowX: 'hidden',
  },

  // Hero
  hero: {
    minHeight: '100vh',
    background: G.hero,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '5rem 2rem',
    position: 'relative',
    overflow: 'hidden',
  },
  heroCourt: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    opacity: 0.55,
  },
  heroGlowCenter: {
    position: 'absolute',
    top: '15%',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 900,
    height: 900,
    background: `radial-gradient(circle, rgba(245,145,30,0.22) 0%, transparent 60%)`,
    pointerEvents: 'none',
    borderRadius: '50%',
    filter: 'blur(8px)',
  },
  heroGlowSide: {
    position: 'absolute',
    bottom: '-120px',
    right: '-120px',
    width: 520,
    height: 520,
    background: `radial-gradient(circle, rgba(245,145,30,0.18) 0%, transparent 70%)`,
    pointerEvents: 'none',
    borderRadius: '50%',
  },
  heroGlowTopLeft: {
    position: 'absolute',
    top: '-160px',
    left: '-160px',
    width: 460,
    height: 460,
    background: `radial-gradient(circle, rgba(19,175,240,0.13) 0%, transparent 70%)`,
    pointerEvents: 'none',
    borderRadius: '50%',
  },
  heroContent: {
    maxWidth: '100%',
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
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    background: 'rgba(245,145,30,0.16)',
    border: '1px solid rgba(245,145,30,0.50)',
    color: C.orangeLight,
    borderRadius: 999,
    padding: '0.45rem 1.2rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    letterSpacing: '0.02em',
    fontFamily: F.body,
    backdropFilter: 'blur(6px)',
  },
  heroBadgeDot: {
    display: 'inline-block',
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: C.orange,
    boxShadow: `0 0 12px ${C.orange}`,
  },
  heroHeadline: {
    fontFamily: F.display,
    fontSize: 'clamp(3rem, 7.5vw, 6.25rem)',
    fontWeight: 400,
    color: '#ffffff',
    letterSpacing: '0.005em',
    lineHeight: 0.92,
    margin: 0,
    textTransform: 'uppercase',
  },
  heroHeadlineAccent: {
    fontFamily: F.display,
    display: 'inline-block',
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: '1.125rem',
    lineHeight: 1.7,
    maxWidth: 600,
    margin: '0.5rem 0 0',
    fontFamily: F.body,
  },
  heroCtas: {
    display: 'flex',
    gap: '1rem',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: '0.75rem',
  },
  ctaPrimary: {
    background: G.primary,
    color: '#ffffff',
    border: 'none',
    borderRadius: 12,
    padding: '15px 34px',
    fontSize: '1.0625rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s, filter 0.2s',
    boxShadow: `0 8px 32px rgba(245,145,30,0.50)`,
    letterSpacing: '0.005em',
    fontFamily: F.body,
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
    transition: 'background 0.2s, border-color 0.2s, color 0.2s',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: F.body,
  },
  heroFootnote: {
    color: 'rgba(255,255,255,0.38)',
    fontSize: '0.8rem',
    margin: 0,
    letterSpacing: '0.01em',
    fontFamily: F.body,
  },

  // Pricing highlight
  pricingHighlight: {
    background: `linear-gradient(180deg, ${C.navyMid} 0%, ${C.navy} 100%)`,
    padding: '5rem 2rem',
    position: 'relative',
    overflow: 'hidden',
  },
  pricingGlowMain: {
    position: 'absolute',
    top: '50%',
    left: '40%',
    transform: 'translate(-50%, -50%)',
    width: 720,
    height: 720,
    background: `radial-gradient(circle, rgba(245,145,30,0.14) 0%, transparent 65%)`,
    pointerEvents: 'none',
    borderRadius: '50%',
  },
  pricingGlowAccent: {
    position: 'absolute',
    top: '50%',
    right: '-100px',
    transform: 'translateY(-50%)',
    width: 460,
    height: 460,
    background: `radial-gradient(circle, rgba(19,175,240,0.10) 0%, transparent 65%)`,
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
    color: C.orangeLight,
    fontSize: '0.85rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.18em',
    margin: 0,
    fontFamily: F.brand,
  },
  pricingHeadline: {
    fontFamily: F.display,
    fontSize: 'clamp(2rem, 4.5vw, 3.25rem)',
    fontWeight: 400,
    color: '#ffffff',
    letterSpacing: '0.005em',
    lineHeight: 1.05,
    margin: 0,
    textTransform: 'uppercase',
  },
  pricingAmount: {
    fontFamily: F.display,
    background: G.signature,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  pricingPeriod: {
    fontSize: '0.55em',
    fontWeight: 400,
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
    background: `linear-gradient(135deg, rgba(245,145,30,0.18) 0%, rgba(19,175,240,0.06) 100%)`,
    border: '2px solid rgba(245,145,30,0.55)',
    boxShadow: `0 12px 40px rgba(245,145,30,0.35)`,
  },
  pricingCardBadge: {
    position: 'absolute',
    top: -12,
    background: G.signature,
    color: '#fff',
    fontSize: '0.72rem',
    fontWeight: 800,
    padding: '5px 18px',
    borderRadius: 999,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    fontFamily: F.brand,
    boxShadow: `0 4px 16px rgba(245,145,30,0.50)`,
  },
  pricingCardLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: '0.85rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
    fontFamily: F.brand,
  },
  pricingCardLabelFeatured: {
    color: C.orangeLight,
    fontSize: '0.85rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
    fontFamily: F.brand,
  },
  pricingCardPrice: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '2px',
  },
  pricingCardAmount: {
    fontFamily: F.display,
    fontSize: '3.75rem',
    fontWeight: 400,
    color: '#ffffff',
    lineHeight: 1,
    letterSpacing: '0.005em',
  },
  pricingCardPeriod: {
    fontSize: '1rem',
    color: 'rgba(255,255,255,0.55)',
    fontWeight: 600,
    fontFamily: F.body,
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
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 1.5,
    fontFamily: F.body,
  },
  pricingCompare: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '0.95rem',
    margin: 0,
    maxWidth: 520,
    lineHeight: 1.6,
    fontFamily: F.body,
  },

  // Stats bar
  statsBar: {
    background: '#ffffff',
    borderBottom: '1px solid #e2e8f0',
    position: 'relative',
  },
  statsAccentLine: {
    height: 4,
    background: `linear-gradient(90deg, ${C.orange} 0%, ${C.orangeLight} 30%, ${C.red} 65%, ${C.cyan} 100%)`,
  },
  statsInner: {
    maxWidth: 900,
    margin: '0 auto',
    padding: '3rem 2rem',
    display: 'flex',
    justifyContent: 'center',
    gap: '4rem',
    flexWrap: 'wrap',
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.4rem',
  },
  statValue: {
    fontFamily: F.display,
    fontSize: '4rem',
    fontWeight: 400,
    background: G.signature,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    lineHeight: 1,
    letterSpacing: '0.005em',
  },
  statLabel: {
    fontSize: '0.78rem',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
    fontWeight: 700,
    fontFamily: F.brand,
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
    alignItems: 'center',
  },
  sectionEyebrow: {
    color: C.orange,
    fontSize: '0.78rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.18em',
    fontFamily: F.brand,
  },
  sectionTitle: {
    fontFamily: F.display,
    fontSize: 'clamp(2rem, 4.5vw, 3.5rem)',
    fontWeight: 400,
    color: C.navy,
    letterSpacing: '0.005em',
    lineHeight: 1.0,
    margin: 0,
    textTransform: 'uppercase',
  },
  sectionTitleAccent: {
    fontFamily: F.display,
    background: G.signature,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  sectionSubtitle: {
    fontSize: '1rem',
    color: '#64748b',
    maxWidth: 580,
    margin: '0.25rem auto 0',
    lineHeight: 1.6,
    fontFamily: F.body,
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
    fontFamily: F.body,
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
    width: 68,
    height: 68,
    borderRadius: '50%',
    background: G.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '1.25rem',
    flexShrink: 0,
    boxShadow: `0 8px 24px rgba(245,145,30,0.55), inset 0 0 0 2px rgba(255,255,255,0.18)`,
    position: 'relative',
    zIndex: 1,
  },
  stepCircleNumber: {
    fontFamily: F.display,
    color: '#ffffff',
    fontSize: '1.85rem',
    fontWeight: 400,
    letterSpacing: '0.005em',
    lineHeight: 1,
  },
  stepConnector: {
    position: 'absolute',
    top: 34,
    left: 'calc(50% + 34px)',
    right: 'calc(-50% + 34px)',
    height: 2,
    borderTop: `2px dashed ${C.orange}`,
    opacity: 0.4,
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
    color: C.navy,
    margin: 0,
    fontFamily: F.body,
  },
  stepDescription: {
    fontSize: '0.9rem',
    color: '#64748b',
    lineHeight: 1.6,
    margin: 0,
    fontFamily: F.body,
  },

  // CTA final
  ctaBottom: {
    background: G.hero,
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
    width: 720,
    height: 720,
    background: `radial-gradient(circle, rgba(245,145,30,0.22) 0%, transparent 65%)`,
    pointerEvents: 'none',
    borderRadius: '50%',
  },
  ctaBottomGlowAccent: {
    position: 'absolute',
    bottom: '-100px',
    left: '-100px',
    width: 440,
    height: 440,
    background: `radial-gradient(circle, rgba(19,175,240,0.14) 0%, transparent 70%)`,
    pointerEvents: 'none',
    borderRadius: '50%',
  },
  ctaBottomContent: {
    maxWidth: 720,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '1.5rem',
    position: 'relative',
    zIndex: 1,
  },
  ctaBottomTitle: {
    fontFamily: F.display,
    fontSize: 'clamp(2.25rem, 5vw, 4rem)',
    fontWeight: 400,
    color: '#ffffff',
    letterSpacing: '0.005em',
    margin: 0,
    lineHeight: 1.0,
    textTransform: 'uppercase',
  },
  ctaBottomTitleAccent: {
    fontFamily: F.display,
  },
  ctaBottomSubtitle: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: '1.0625rem',
    margin: 0,
    lineHeight: 1.6,
    fontFamily: F.body,
  },
  ctaBottomButton: {
    background: G.primary,
    color: '#ffffff',
    border: 'none',
    borderRadius: 12,
    padding: '17px 42px',
    fontSize: '1.0625rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s, filter 0.2s',
    boxShadow: `0 8px 32px rgba(245,145,30,0.50)`,
    letterSpacing: '0.01em',
    fontFamily: F.body,
  },
};
