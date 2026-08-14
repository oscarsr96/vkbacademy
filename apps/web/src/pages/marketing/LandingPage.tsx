import { Link } from 'react-router-dom';
import { LP_SHARED_CSS, SectionHead } from './LpSystem';

// ── Datos de la página ────────────────────────────────────────────────────────

// Cifras reales del catálogo curricular (apps/api/prisma/data/curriculum/).
const SCOREBOARD = [
  { value: '6', label: 'Niveles' },
  { value: '104', label: 'Cursos' },
  { value: '1.225', label: 'Unidades de temario' },
];

const STEPS = [
  {
    number: '01',
    title: 'Eliges los temas',
    description:
      'Los seleccionas del temario oficial de tu curso, uno solo o varios a la vez. Si falta alguno, lo pides y se añade.',
  },
  {
    number: '02',
    title: 'Repites hasta que sale',
    description:
      'Actividades con corrección inmediata. Vuelves sobre el tema las veces que haga falta y nadie te mira mientras.',
  },
  {
    number: '03',
    title: 'Lo demuestras',
    description: 'Superas el examen del club y te llevas un certificado que acredita lo que sabes.',
  },
];

// Reciben el nombre del club porque la misma landing sirve a cualquier academia:
// el dominio principal la muestra con Vallekas y un dominio de academia con el suyo.
const FEATURES = (club: string) => [
  {
    title: 'Actividades, no fichas',
    description:
      'Emparejar, ordenar, rellenar huecos, test. Se hacen con el pulgar y se acaban en cinco minutos.',
  },
  {
    title: 'Vídeos elegidos, no buscados',
    description:
      'Cada tema llega con los vídeos que mejor lo explican. Sin caer en el agujero de YouTube.',
  },
  {
    title: 'Corrección en el momento',
    description:
      'Marcas la respuesta y sabes al instante si va bien, con la explicación de por qué fallaste.',
  },
  {
    title: 'Un entrenador de IA que no se cansa',
    description:
      'Cuando te atascas, preguntas y te contesta. Las veces que haga falta, sin juzgar y sin prisa.',
  },
  {
    title: 'Exámenes con certificado',
    description: `Los exámenes del club generan un PDF verificable con el sello de ${club}.`,
  },
  {
    title: 'Puntos por cada sesión',
    description: 'Lo que estudias suma. Lo que suma se canjea por material del club.',
  },
];

// Los tres pilares de la generación: velocidad, calidad del material y marca del club.
const PILLARS = (club: string) => [
  {
    title: 'Tarda segundos, no días',
    text: 'El tiempo que se tarda en leer esta frase. Ni fichas fotocopiadas ni esperar a la próxima clase.',
  },
  {
    title: 'Apuntes que se leen',
    text: 'En web y en PDF, ordenados por ideas y no por ladrillos de texto, con una metodología de comunicación pensada para que un chaval de quince años los abra por gusto.',
  },
  {
    title: 'Con el escudo del club',
    text: `El material lleva los colores y el escudo de ${club}. Estudiar con la camiseta puesta no es lo mismo.`,
  },
];

const MERCH = [
  { name: 'Pack de stickers', pts: 100 },
  { name: 'Botella termo', pts: 200 },
  { name: 'Gorra oficial', pts: 350 },
  { name: 'Camiseta oficial', pts: 500 },
  { name: 'Balón firmado por el equipo', pts: 1000 },
];

const PLANS = [
  {
    name: 'Básico',
    price: '10',
    featured: false,
    items: [
      'Todos los cursos de su nivel',
      'Vídeos y actividades interactivas',
      'Exámenes del club con certificado',
      'Puntos, retos y recompensas',
    ],
  },
  {
    name: 'Avanzado',
    price: '20',
    featured: true,
    items: [
      'Todo lo del plan Básico',
      'Ejercicios generados al instante de cualquier tema',
      'Actividades interactivas avanzadas',
      'Entrenador de IA disponible 24/7',
      'Acceso prioritario al contenido nuevo',
    ],
  },
];

const FAMILY = [
  {
    title: 'Temario oficial',
    text: 'El currículo de la Comunidad de Madrid, curso por curso. No es contenido genérico de internet.',
  },
  {
    title: 'Certificados que acreditan',
    text: 'Cada examen superado genera un PDF verificable con el sello del club.',
  },
  {
    title: 'Menos que una clase suelta',
    text: 'Una hora de clase particular cuesta 20-30 €. Aquí es un mes entero de acceso ilimitado.',
  },
];

// ── Página ────────────────────────────────────────────────────────────────────

/**
 * Landing pública. La sirve tanto el dominio principal (Vallekas por defecto)
 * como el de cualquier academia, que pasa su propio nombre. El color no se pasa
 * por props: `applyBrand()` ya inyecta `--brand*` desde `academy.primaryColor`.
 */
export default function LandingPage({ clubName = 'Vallekas Basket' }: { clubName?: string }) {
  return (
    <div className="lp-page">
      <style>{LP_SHARED_CSS + CSS}</style>

      {/* ═══ HERO ═══ */}
      <section className="lp-hero">
        <CourtLines />

        <div className="lp-shell lp-hero-inner">
          {/* Solo el nombre: los registros de academia lo traen ya con su sufijo
              ("Vallekas Basket Academy"), y cualquier artículo delante duplicaba
              la palabra o fallaba de género según el club. */}
          <p className="lp-tag">
            <span className="lp-tag-dot" />
            {clubName}
          </p>

          <h1 className="lp-display">
            Ya es hora de dejar
            <br />
            de preguntar por las notas.
            <br />
            <em>Y de empezar a subirlas.</em>
          </h1>

          <div className="lp-hero-grid">
            <div className="lp-hero-copy">
              <p className="lp-lead">
                Temario, ejercicios y exámenes de tu curso, generados al instante y con el escudo
                del club detrás. De 1º de la ESO a 2º de Bachillerato.
              </p>

              <div className="lp-cta-row">
                <Link className="lp-btn lp-btn-primary" to="/register">
                  Empezar ahora
                </Link>
                <Link className="lp-btn lp-btn-ghost" to="/login">
                  Ya tengo cuenta
                </Link>
              </div>

              <p className="lp-note">
                Un adulto de la familia da de alta a cada alumno con su curso y recibe sus
                usuarios al terminar. La cuenta es del alumno.
              </p>
            </div>

            <div className="lp-hero-mock">
              <ExerciseMock />
            </div>
          </div>

          <div className="lp-scoreboard">
            {SCOREBOARD.map((item) => (
              <div className="lp-score" key={item.label}>
                <span className="lp-score-value">{item.value}</span>
                <span className="lp-score-label">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ MANIFIESTO ═══ */}
      <section className="lp-block lp-manifesto">
        <div className="lp-shell">
          <SectionHead
            index="01"
            kicker="Por qué existe esto"
            title="Todos los clubes preguntan."
            accent="Casi ninguno ayuda."
          />

          <div className="lp-manifesto-grid">
            <p className="lp-manifesto-lead">
              «¿Cómo llevas los estudios?». Esa es toda la ayuda académica que da el 99 % de los
              clubes deportivos: una pregunta en el entrenamiento y una charla cuando ya es tarde.
            </p>

            <div className="lp-manifesto-body">
              <p className="lp-text">
                {clubName} dejó de preguntar. Ahora entrega: el temario oficial de tu curso,
                ejercicios ilimitados de cualquier tema y exámenes que acreditan lo que sabes. Con el
                escudo del club, no en una app cualquiera.
              </p>
              <Link className="lp-btn lp-btn-primary" to="/register">
                Empezar ahora
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ PROCESO ═══ */}
      <section className="lp-block lp-block-alt">
        <div className="lp-shell">
          <SectionHead index="02" kicker="Cómo va" title="Tres pasos." accent="Cero excusas." />

          <ol className="lp-steps">
            {STEPS.map((step) => (
              <li className="lp-step" key={step.number}>
                <span className="lp-step-num">{step.number}</span>
                <h3 className="lp-step-title">{step.title}</h3>
                <p className="lp-text">{step.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ═══ PRODUCTO ═══ */}
      <section className="lp-block">
        <div className="lp-shell">
          <SectionHead
            index="03"
            kicker="Lo que ningún club te ha dado"
            title="Cualquier tema."
            accent="Al instante."
          />

          <div className="lp-showcase-grid">
            <div className="lp-showcase-copy">
              <p className="lp-showcase-lead">
                Eliges los temas y el material aparece: apuntes, ejercicios y examen.
              </p>
              <p className="lp-text">
                Un tema suelto o el curso entero, lo que necesites esa semana. Y si el tema que
                buscas no está en el catálogo, lo pides y se añade.
              </p>
              <Link className="lp-btn lp-btn-ghost lp-btn-inline" to="/register">
                Probarlo con mi temario
              </Link>
            </div>

            <GenerationMock />
          </div>

          <div className="lp-pillars">
            {PILLARS(clubName).map((pillar) => (
              <article className="lp-pillar" key={pillar.title}>
                <h3 className="lp-pillar-title">{pillar.title}</h3>
                <p className="lp-text">{pillar.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CLAIM ═══ */}
      <section className="lp-claim">
        <div className="lp-shell">
          <p className="lp-claim-text">
            El talento no se hereda.
            <br />
            <em>Se entrena.</em>
          </p>
          <p className="lp-claim-foot">
            En la pista nadie espera a que llegue el talento: se repite el gesto hasta que sale. Con
            el temario, exactamente igual.
          </p>
        </div>
      </section>

      {/* ═══ PRESTACIONES ═══ */}
      <section className="lp-block lp-block-alt" id="features">
        <div className="lp-shell">
          <SectionHead
            index="04"
            kicker="La plataforma"
            title="Esto es lo que tienes."
            accent="Desde el primer día."
          />

          <ul className="lp-list">
            {FEATURES(clubName).map((feature, i) => (
              <li className="lp-list-row" key={feature.title}>
                <span className="lp-list-num">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="lp-list-title">{feature.title}</h3>
                <p className="lp-text">{feature.description}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ═══ RECOMPENSAS ═══ */}
      <section className="lp-block lp-merch">
        <div className="lp-shell">
          <SectionHead
            index="05"
            kicker="Recompensas"
            title="El esfuerzo suma."
            accent="Y se canjea."
          />

          <table className="lp-table">
            <tbody>
              {MERCH.map((item) => (
                <tr key={item.name}>
                  <th scope="row">{item.name}</th>
                  <td>{item.pts.toLocaleString('es-ES')} pts</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="lp-table-note">
            Los puntos se ganan completando sesiones, exámenes y rachas semanales.
          </p>
        </div>
      </section>

      {/* ═══ FAMILIAS Y PRECIO ═══ */}
      <section className="lp-block lp-block-alt">
        <div className="lp-shell">
          <SectionHead
            index="06"
            kicker="Para las familias"
            title="Lo que estás pagando."
            accent="Y lo que recibes."
          />

          <div className="lp-family">
            {FAMILY.map((item) => (
              <div className="lp-family-item" key={item.title}>
                <h3 className="lp-family-title">{item.title}</h3>
                <p className="lp-text">{item.text}</p>
              </div>
            ))}
          </div>

          <div className="lp-plans">
            {PLANS.map((plan) => (
              <article
                className={plan.featured ? 'lp-plan lp-plan-featured' : 'lp-plan'}
                key={plan.name}
              >
                <div className="lp-plan-head">
                  <span className="lp-plan-name">{plan.name}</span>
                  {plan.featured && <span className="lp-plan-badge">Más elegido</span>}
                </div>

                <p className="lp-plan-price">
                  <span className="lp-plan-amount">{plan.price}</span>
                  <span className="lp-plan-unit">€ al mes</span>
                </p>

                <ul className="lp-plan-list">
                  {plan.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>

                <Link
                  className={
                    plan.featured
                      ? 'lp-btn lp-btn-primary lp-btn-full'
                      : 'lp-btn lp-btn-ghost lp-btn-full'
                  }
                  to="/register"
                >
                  Elegir {plan.name}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CIERRE ═══ */}
      <section className="lp-final">
        <CourtLines />
        <div className="lp-shell lp-final-inner">
          <h2 className="lp-display lp-final-title">
            ¿Empezamos?
          </h2>
          <p className="lp-lead">
            Crea la cuenta y haz el primer ejercicio antes de que acabe el descanso.
          </p>
          <Link className="lp-btn lp-btn-primary lp-btn-lg" to="/register">
            Crear la cuenta ahora
          </Link>
        </div>
      </section>
    </div>
  );
}

// ── Piezas ────────────────────────────────────────────────────────────────────

/**
 * Media cancha FIBA a escala real. El viewBox son centímetros: 1500 de ancho
 * (15 m) por 1400 de largo (media pista de 28 m), con la línea de fondo abajo.
 *
 * Cotas oficiales usadas:
 *   centro del aro     1,575 m de la línea de fondo
 *   tablero            1,20 m de la línea de fondo, 1,80 m de ancho
 *   zona               4,90 m de ancho × 5,80 m (1,20 + 4,60 hasta tiros libres)
 *   círculo de tiros libres  r 1,80 m
 *   triple             r 6,75 m desde el aro; rectas a 0,90 m de la banda
 *   semicírculo de no carga  r 1,25 m
 *   círculo central    r 1,80 m
 *
 * El arranque del arco sale de la propia geometría: √(675² − 660²) ≈ 141,5,
 * así que las rectas miden 2,99 m, que es la medida oficial.
 */
function CourtLines() {
  const line = 'rgba(245,145,30,0.24)';
  const lineSoft = 'rgba(245,145,30,0.15)';

  return (
    <svg
      className="lp-court"
      viewBox="0 0 1500 1400"
      preserveAspectRatio="xMidYMax slice"
      fill="none"
      strokeWidth="4"
      aria-hidden="true"
    >
      {/* Línea de fondo y bandas */}
      <path d="M 0 1400 H 1500 M 4 1400 V 0 M 1496 1400 V 0" stroke={line} />

      {/* Línea de triple: rectas a 0,90 m de cada banda + arco de 6,75 m */}
      <path d="M 90 1400 V 1101 A 675 675 0 0 1 1410 1101 V 1400" stroke={line} />

      {/* Zona y línea de tiros libres */}
      <path d="M 505 1400 V 820 H 995 V 1400" stroke={lineSoft} />
      <circle cx="750" cy="820" r="180" stroke={lineSoft} />

      {/* Tablero, aro y semicírculo de no carga */}
      <path d="M 660 1280 H 840" stroke={line} />
      <circle cx="750" cy="1242.5" r="22.5" stroke={line} />
      <path d="M 625 1242.5 A 125 125 0 0 1 875 1242.5" stroke={lineSoft} />

      {/* Medio campo */}
      <path d="M 0 0 H 1500 M 570 0 A 180 180 0 0 0 930 0" stroke={lineSoft} />
    </svg>
  );
}

// ── Maquetas de producto ──────────────────────────────────────────────────────

function ExerciseMock() {
  return (
    <div
      className="lp-mock"
      role="img"
      aria-label="Ejemplo de la plataforma: un ejercicio de matemáticas de 3º de la ESO con la respuesta correcta marcada y diez puntos ganados"
    >
      <div aria-hidden="true">
        <div className="lp-mock-head">
          <span className="lp-mock-course">Matemáticas · 3º ESO</span>
          <span className="lp-mock-count">3/10</span>
        </div>

        <p className="lp-mock-question">Resuelve la ecuación</p>
        <p className="lp-mock-formula">x² − 5x + 6 = 0</p>

        <div className="lp-mock-options">
          <span className="lp-mock-option lp-mock-option-ok">x = 2 y x = 3</span>
          <span className="lp-mock-option">x = −2 y x = −3</span>
          <span className="lp-mock-option">x = 1 y x = 6</span>
        </div>

        <div className="lp-mock-foot">
          <span className="lp-mock-points">+10 puntos</span>
          <span className="lp-mock-streak">Racha de 4 días</span>
        </div>
      </div>
    </div>
  );
}

function GenerationMock() {
  return (
    <div
      className="lp-gen"
      role="img"
      aria-label="Ejemplo de generación: al escribir el tema ecuaciones de segundo grado, la plataforma prepara diez actividades, tres vídeos y un examen con certificado"
    >
      <div aria-hidden="true">
        <span className="lp-gen-label">Escribe el tema</span>
        <p className="lp-gen-input">
          Ecuaciones de segundo grado<span className="lp-gen-caret" />
        </p>

        <ul className="lp-gen-out">
          <li>
            <span className="lp-gen-num">10</span> actividades interactivas
          </li>
          <li>
            <span className="lp-gen-num">03</span> vídeos que lo explican bien
          </li>
          <li>
            <span className="lp-gen-num">01</span> examen con certificado
          </li>
        </ul>
      </div>
    </div>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
// Atmósfera monocroma: navy de arriba abajo, sin zonas claras. El naranja es
// acento (acción, cifras, segunda frase de cada titular). Sin cyan.

const CSS = `
.lp-page {
  /* El SplashScreen tapa la landing 3,6 s (sale a los 2,8 s). La entrada del
     hero arranca a los 3,2 s para encadenar con esa salida en vez de aparecer
     de golpe. Si algún día se retira el splash, hay que bajar este valor a 0. */
  --lp-enter: 3200ms;
}

/* ── Líneas de cancha ── */

.lp-court {
  position: absolute;
  left: 50%;
  bottom: 0;
  /* Ancho contenido para que la escala del slice deje ver el arco de triple
     completo y no solo la franja del aro */
  width: min(1180px, 100%);
  height: 78%;
  transform: translateX(-50%);
  pointer-events: none;
}

/* ── Hero ── */

.lp-hero {
  position: relative;
  overflow: hidden;
  padding: clamp(2.5rem, 7vw, 4.5rem) 0 0;
  background:
    radial-gradient(120% 70% at 50% -20%, rgba(245, 145, 30, 0.18), transparent 62%),
    var(--lp-bg);
}

.lp-hero-inner {
  position: relative;
}

.lp-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  margin: 0 0 clamp(1.25rem, 3.5vw, 2rem);
  font-family: var(--lp-display);
  font-size: clamp(1rem, 2.4vw, 1.3125rem);
  font-weight: 600;
  letter-spacing: -0.015em;
  color: var(--lp-fg-mid);
}

.lp-tag-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--brand);
}

.lp-hero-grid {
  display: grid;
  gap: clamp(2rem, 5vw, 3.5rem);
  margin-top: clamp(1.75rem, 4vw, 2.75rem);
  align-items: start;
}

.lp-hero-copy {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  align-items: flex-start;
}

/* Marcador: única aparición del ámbar, reservado a cifras */
.lp-scoreboard {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  margin-top: clamp(2.5rem, 6vw, 4rem);
  border-top: 1px solid var(--lp-rule);
}

.lp-score {
  padding: 1.5rem 0 1.75rem;
  border-right: 1px solid var(--lp-rule);
}

.lp-score:last-child {
  border-right: none;
}

.lp-score-value {
  display: block;
  font-family: var(--lp-display);
  font-size: clamp(2.25rem, 6vw, 3.5rem);
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.03em;
  color: var(--amber-led);
  text-shadow: var(--amber-glow);
  font-variant-numeric: tabular-nums;
}

.lp-score-label {
  display: block;
  margin-top: 0.4rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--lp-fg-low);
}

/* ── Maqueta de ejercicio ── */

.lp-mock {
  border: 1px solid var(--lp-rule);
  border-radius: 16px;
  background: rgba(4, 8, 16, 0.66);
  padding: 1.5rem;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.lp-mock-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 0.9rem;
  border-bottom: 1px solid var(--lp-rule-soft);
}

.lp-mock-course {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--lp-fg-low);
}

.lp-mock-count {
  font-family: var(--lp-display);
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--amber-led);
  font-variant-numeric: tabular-nums;
}

.lp-mock-question {
  margin: 1.25rem 0 0.35rem;
  font-size: 0.8125rem;
  color: var(--lp-fg-low);
}

/* La fórmula va en Inter: la incógnita debe ir en minúscula */
.lp-mock-formula {
  margin: 0 0 1.25rem;
  font-size: clamp(1.375rem, 4vw, 1.75rem);
  font-weight: 600;
  color: var(--lp-fg);
}

.lp-mock-options {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.lp-mock-option {
  padding: 0.8rem 1rem;
  border: 1px solid var(--lp-rule);
  border-radius: 10px;
  font-size: 0.9375rem;
  color: var(--lp-fg-mid);
}

.lp-mock-option-ok {
  border-color: var(--brand);
  background: rgba(245, 145, 30, 0.14);
  color: var(--lp-fg);
  font-weight: 600;
}

.lp-mock-foot {
  display: flex;
  align-items: baseline;
  gap: 1.25rem;
  margin-top: 1.25rem;
  padding-top: 0.9rem;
  border-top: 1px solid var(--lp-rule-soft);
}

.lp-mock-points {
  font-family: var(--lp-display);
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--brand);
}

.lp-mock-streak {
  font-size: 0.8125rem;
  color: var(--lp-fg-low);
}

/* ── Manifiesto ── */

.lp-manifesto-grid {
  display: grid;
  gap: clamp(1.75rem, 4vw, 3rem);
  margin-top: clamp(2rem, 5vw, 3rem);
}

.lp-manifesto-lead {
  margin: 0;
  font-family: var(--lp-display);
  font-size: clamp(1.375rem, 3.4vw, 2.125rem);
  font-weight: 600;
  line-height: 1.22;
  letter-spacing: -0.02em;
  color: var(--lp-fg);
}

.lp-manifesto-body {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1.5rem;
}

/* ── Pilares del producto ── */

.lp-pillars {
  display: grid;
  gap: 1.25rem;
  margin-top: clamp(2.25rem, 5vw, 3rem);
  padding-top: clamp(1.75rem, 4vw, 2.25rem);
  border-top: 1px solid var(--lp-rule-soft);
}

.lp-pillar-title {
  margin: 0 0 0.5rem;
  font-family: var(--lp-display);
  font-size: 1.125rem;
  font-weight: 700;
  letter-spacing: -0.015em;
  color: var(--brand);
}

/* ── Producto ── */

.lp-showcase-grid {
  display: grid;
  gap: clamp(2rem, 5vw, 3.5rem);
  margin-top: clamp(2rem, 5vw, 3rem);
  align-items: center;
}

.lp-showcase-copy {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.lp-showcase-lead {
  margin: 0;
  font-family: var(--lp-display);
  font-size: clamp(1.25rem, 3vw, 1.75rem);
  font-weight: 600;
  line-height: 1.25;
  letter-spacing: -0.02em;
  color: var(--lp-fg);
  max-width: 24ch;
}

.lp-gen {
  border: 1px solid var(--lp-rule);
  border-radius: 16px;
  background: var(--lp-surface);
  padding: clamp(1.35rem, 4vw, 1.85rem);
}

.lp-gen-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--lp-fg-low);
}

.lp-gen-input {
  display: flex;
  align-items: center;
  margin: 0.6rem 0 1.5rem;
  padding: 0.9rem 1.1rem;
  border: 1px solid rgba(245, 145, 30, 0.45);
  border-radius: 999px;
  background: rgba(245, 145, 30, 0.08);
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--lp-fg);
}

.lp-gen-caret {
  display: inline-block;
  width: 2px;
  height: 1.05em;
  margin-left: 3px;
  background: var(--brand);
}

.lp-gen-out {
  margin: 0;
  padding: 0;
  list-style: none;
}

.lp-gen-out li {
  display: flex;
  align-items: baseline;
  gap: 0.85rem;
  padding: 0.85rem 0;
  border-top: 1px solid var(--lp-rule-soft);
  font-size: 0.9375rem;
  color: var(--lp-fg-mid);
}

.lp-gen-num {
  font-family: var(--lp-display);
  font-size: 1.35rem;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.03em;
  color: var(--amber-led);
  font-variant-numeric: tabular-nums;
  min-width: 2.2ch;
}

/* ── Claim ── */

.lp-claim {
  padding: clamp(4rem, 11vw, 7.5rem) 0;
  background:
    radial-gradient(80% 90% at 20% 50%, rgba(245, 145, 30, 0.14), transparent 60%),
    var(--lp-bg);
  border-top: 1px solid var(--lp-rule-soft);
  border-bottom: 1px solid var(--lp-rule-soft);
}

.lp-claim-text {
  margin: 0;
  font-family: var(--lp-display);
  font-weight: 800;
  font-size: clamp(2.25rem, 6.5vw, 5rem);
  line-height: 1.02;
  letter-spacing: -0.03em;
  color: var(--lp-fg);
}

.lp-claim-text em {
  font-style: normal;
  color: var(--brand);
}

.lp-claim-foot {
  margin: clamp(1.25rem, 3vw, 1.75rem) 0 0;
  font-size: 1rem;
  line-height: 1.6;
  color: var(--lp-fg-mid);
  max-width: 46ch;
}

/* ── Familias ── */

.lp-family {
  display: grid;
  gap: 1.5rem 2.5rem;
  margin-top: clamp(2rem, 5vw, 2.75rem);
}

.lp-family-title {
  margin: 0 0 0.4rem;
  font-family: var(--lp-display);
  font-size: 1.0625rem;
  font-weight: 700;
  letter-spacing: -0.015em;
  color: var(--lp-fg);
}

/* ── Planes ── */

.lp-plans {
  display: grid;
  gap: 1.25rem;
  margin-top: clamp(2.25rem, 5vw, 3.25rem);
}

/* ── Cierre ── */

.lp-final {
  position: relative;
  overflow: hidden;
  padding: clamp(4rem, 11vw, 7.5rem) 0;
  background:
    radial-gradient(90% 70% at 50% 120%, rgba(245, 145, 30, 0.2), transparent 62%),
    var(--lp-bg);
  border-top: 1px solid var(--lp-rule-soft);
}

.lp-final-inner {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1.5rem;
}

.lp-final-title {
  font-size: clamp(2.75rem, 8vw, 6rem);
}

@media (min-width: 700px) {
  .lp-family,
  .lp-pillars {
    grid-template-columns: repeat(3, 1fr);
    gap: 2.5rem;
  }

  .lp-plans {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 960px) {
  .lp-hero-grid {
    grid-template-columns: 1fr minmax(0, 420px);
    gap: 4rem;
  }

  .lp-showcase-grid {
    grid-template-columns: 1fr minmax(0, 460px);
    gap: 4rem;
  }

  .lp-manifesto-grid {
    grid-template-columns: 1.1fr 1fr;
    align-items: start;
    gap: 4rem;
  }
}

/* ══════════════════════════════════════════════════════════════════
   MOVIMIENTO
   1. Entrada del hero: encadena con la salida del splash.
   2. Revelado por scroll: scroll-driven, sin JS ni observers.
   3. Feedback: solo en lo que de verdad es interactivo.
   ══════════════════════════════════════════════════════════════════ */

@keyframes lp-caret {
  50% {
    opacity: 0;
  }
}

/* 1 · Entrada del hero, escalonada 70 ms entre bloques */
.lp-hero-inner > * {
  animation: lp-rise 520ms var(--lp-ease-out) both;
}

.lp-hero-inner > *:nth-child(1) {
  animation-delay: var(--lp-enter);
}
.lp-hero-inner > *:nth-child(2) {
  animation-delay: calc(var(--lp-enter) + 70ms);
}
.lp-hero-inner > *:nth-child(3) {
  animation-delay: calc(var(--lp-enter) + 140ms);
}
.lp-hero-inner > *:nth-child(4) {
  animation-delay: calc(var(--lp-enter) + 210ms);
}

/* El cursor del campo de ejemplo: parpadea porque es lo que hace un cursor */
.lp-gen-caret {
  animation: lp-caret 1.1s step-end infinite;
}

/* 2 · Revelado por scroll. Dentro de @supports: si el navegador no lo
   soporta, el contenido se ve sin más en vez de quedarse invisible. */
@supports (animation-timeline: view()) {
  @media (prefers-reduced-motion: no-preference) {
    .lp-block .lp-head,
    .lp-steps,
    .lp-showcase-grid,
    .lp-list,
    .lp-table,
    .lp-family,
    .lp-plans,
    .lp-claim-text,
    .lp-claim-foot,
    .lp-final-inner {
      animation: lp-rise linear both;
      animation-timeline: view();
      animation-range: entry 8% cover 24%;
    }
  }
}

/* 3 · Feedback. El movimiento de hover solo con ratón; el de pulsación
   también en táctil, que ahí es donde más se agradece. */
@media (hover: hover) and (pointer: fine) {
  .lp-mock-option {
    transition: border-color 150ms ease;
  }
}

/* Sin movimiento: contenido visible de inmediato, sin esperas ni desplazamientos */
@media (prefers-reduced-motion: reduce) {
  .lp-hero-inner > *,
  .lp-gen-caret {
    animation: none;
    opacity: 1;
    transform: none;
  }
}

@media (max-width: 420px) {
  .lp-scoreboard {
    grid-template-columns: 1fr;
  }

  .lp-score {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.9rem 0;
    border-right: none;
    border-bottom: 1px solid var(--lp-rule-soft);
  }

  .lp-score-label {
    margin-top: 0;
  }
}
`;
