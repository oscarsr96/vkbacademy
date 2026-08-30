import { Link } from 'react-router-dom';
import { LP_SHARED_CSS, MERCH, SectionHead } from './LpSystem';

// ─── Datos de la página ────────────────────────────────────────────────────────

// Lo que obtiene el alumno
const STUDENT_FEATURES = [
  'Vídeos técnicos y tácticos organizados por nivel',
  'Lecciones interactivas: emparejar, ordenar y rellenar huecos',
  'Tests y quizzes con corrección automática',
  'Exámenes de cada curso de estudio en tres niveles: básico, medio y difícil',
  'Certificado digital en PDF al superar los tres niveles de un curso',
  'Retos y puntos canjeables por merchandising del club',
];

// Lo que gestiona el padre, madre o tutor legal
const GUARDIAN_FEATURES = [
  'Da de alta a todos sus hijos/as en un único formulario',
  'Elige la contraseña de cada hijo/a en el momento de inscribirlo',
  'Si pierde los datos de acceso, la academia se los facilita',
];

const PLAN_CHECKS = [
  'Todos los cursos de su nivel',
  'Lecciones interactivas y tests',
  'Exámenes y certificados PDF',
  'Sistema de retos y puntos',
];

const STEPS = [
  {
    number: '01',
    title: 'Rellena el formulario',
    description:
      'Inscribe a tu hijo/a con sus datos y elige su contraseña. No hace falta llamar ni esperar a que te den de alta.',
  },
  {
    number: '02',
    title: 'Recibe su usuario',
    description:
      'Al terminar, verás en pantalla el nombre de usuario de tu hijo/a. Apúntalo: es la única vez que se muestra.',
  },
  {
    number: '03',
    title: 'Listo para aprender',
    description: 'Tu hijo/a puede empezar los cursos de inmediato desde cualquier dispositivo.',
  },
];

const FAQS = [
  {
    q: '¿Cómo apunto a mi hijo/a?',
    a: 'Rellena el formulario de inscripción con tu email de contacto y los datos de tu hijo/a, eligiendo su contraseña. Al terminar verás su nombre de usuario en pantalla: apúntalo, porque no se vuelve a mostrar.',
  },
  {
    q: '¿Qué necesita mi hijo/a para acceder?',
    a: 'Solo un navegador web (ordenador, tablet o móvil) y el usuario y contraseña que elegiste al inscribirlo. No hace falta instalar ninguna aplicación.',
  },
  {
    q: '¿Puedo ver lo que estudia mi hijo/a?',
    a: 'No hay un panel de seguimiento para padres o tutores: el progreso lo ve tu hijo/a desde su propia cuenta. Si quieres saber cómo le va, pregúntale directamente a él/ella o a la academia.',
  },
  {
    q: '¿Se adapta al nivel educativo de mi hijo/a?',
    a: 'Sí. Al crear la cuenta se asigna el nivel correspondiente (1º ESO a 2º Bachillerato). El alumno solo verá los cursos de su nivel, sin distracciones.',
  },
  {
    q: '¿Qué pasa si mi hijo/a deja el club?',
    a: 'Al dar de baja la cuenta, se elimina de forma permanente junto con sus certificados e historial de exámenes. Te recomendamos descargar los certificados en PDF desde la cuenta antes de solicitar la baja.',
  },
];

// ─── Página ────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  return (
    <div className="lp-page">
      <style>{LP_SHARED_CSS + CSS}</style>

      {/* ═══ HERO ═══ */}
      <section className="lp-block pr-hero">
        <div className="lp-shell">
          <h1 className="lp-display">
            La mejor formación del club.
            <br />
            <em>Por 15 € al mes.</em>
          </h1>
          <p className="lp-lead">
            Tu hijo/a accede a todos los cursos, lecciones interactivas y exámenes del club. Tú lo
            das de alta y eliges su contraseña en un momento.
          </p>
        </div>
      </section>

      {/* ═══ 01 · EL PLAN ═══ */}
      <section className="lp-block lp-block-alt">
        <div className="lp-shell">
          <SectionHead
            index="01"
            kicker="Suscripción mensual"
            title="Un único plan."
            accent="Sin permanencia."
          />

          <div className="lp-split lp-reveal">
            <article className="lp-plan lp-plan-featured">
              <div className="lp-plan-head">
                <span className="lp-plan-name">Plan único</span>
                <span className="lp-plan-badge">Más popular</span>
              </div>

              <p className="lp-plan-price">
                <span className="lp-plan-amount">15</span>
                <span className="lp-plan-unit">€ al mes por alumno</span>
              </p>

              <p className="lp-text">
                Acceso completo a toda la plataforma. Sin permanencia, cancela cuando quieras.
              </p>

              <ul className="lp-plan-list">
                {PLAN_CHECKS.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>

              <Link className="lp-btn lp-btn-primary lp-btn-full" to="/register">
                Dar de alta a mi hijo/a
              </Link>
              <p className="lp-note">
                ¿Ya está dado de alta? <Link to="/login">Inicia sesión.</Link>
              </p>
            </article>

            <aside className="pr-aside">
              <div className="pr-aside-item">
                <h3 className="lp-item-title">Tu papel como familia</h3>
                <p className="lp-text">
                  Inscribes a tu hijo/a y eliges su contraseña. Al terminar recibes su nombre de
                  usuario en pantalla: apúntalo, porque no vuelve a mostrarse.
                </p>
              </div>
              <div className="pr-aside-item">
                <h3 className="lp-item-title">Contenido del club</h3>
                <p className="lp-text">
                  Todo el contenido lo crean y actualizan los propios profesores de Vallekas
                  Basket. No es material genérico: es la metodología real del club.
                </p>
              </div>
              <div className="pr-aside-item">
                <h3 className="lp-item-title">Disponible siempre</h3>
                <p className="lp-text">
                  Desde cualquier dispositivo, en cualquier momento. Sin descargas ni
                  instalaciones.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* ═══ 02 · QUÉ INCLUYE ═══ */}
      <section className="lp-block">
        <div className="lp-shell">
          <SectionHead
            index="02"
            kicker="Lo que incluye"
            title="Tu hijo/a accede a todo esto."
            accent="Tú solo lo das de alta."
          />

          <div className="pr-cols lp-reveal">
            <div>
              <h3 className="lp-item-title">Tu hijo/a accede a…</h3>
              <ul className="lp-bullets">
                {STUDENT_FEATURES.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="lp-item-title">Tú te encargas de…</h3>
              <ul className="lp-bullets">
                {GUARDIAN_FEATURES.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 03 · CÓMO EMPIEZO ═══ */}
      <section className="lp-block lp-block-alt">
        <div className="lp-shell">
          <SectionHead
            index="03"
            kicker="Cómo empiezo"
            title="Solo tres pasos."
            accent="Y ya puede aprender."
          />

          <ol className="lp-steps lp-reveal">
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

      {/* ═══ 04 · RECOMPENSAS ═══ */}
      <section className="lp-block">
        <div className="lp-shell">
          <SectionHead
            index="04"
            kicker="Recompensas"
            title="Puntos y premios incluidos."
            accent="Sin coste adicional."
          />

          <table className="lp-table lp-reveal">
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
            Tu hijo/a acumula puntos completando lecciones y retos. Los puntos se canjean por
            merchandising exclusivo del club, sin coste adicional para las familias.
          </p>
        </div>
      </section>

      {/* ═══ 05 · FAQ ═══ */}
      <section className="lp-block lp-block-alt">
        <div className="lp-shell">
          <SectionHead
            index="05"
            kicker="Preguntas frecuentes"
            title="Las dudas de las familias."
            accent="Resueltas antes de empezar."
          />

          <div className="pr-faq lp-reveal">
            {FAQS.map((faq) => (
              <details className="pr-faq-item" key={faq.q}>
                <summary className="pr-faq-q">
                  <span>{faq.q}</span>
                  <span className="pr-faq-indicator" aria-hidden="true" />
                </summary>
                <p className="lp-text pr-faq-a">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CIERRE ═══ */}
      <section className="lp-block pr-final">
        <div className="lp-shell">
          <h2 className="lp-display">
            ¿Formas parte de Vallekas Basket?
            <br />
            <em>Tu hijo/a puede empezar hoy.</em>
          </h2>
          <p className="lp-lead">
            Dale de alta en unos minutos: eliges su contraseña, recibes su usuario al terminar y
            la cuenta es suya.
          </p>
          <div className="lp-cta-row">
            <Link className="lp-btn lp-btn-primary lp-btn-lg" to="/register">
              Dar de alta ahora
            </Link>
            <Link className="lp-btn lp-btn-ghost" to="/login">
              Ya tengo cuenta
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

// ─── Estilos ───────────────────────────────────────────────────────────────────
// Bloque local mínimo: halos del hero y del cierre (mismos tintes que la
// landing), panel lateral, dos columnas y el acordeón FAQ nativo.

const CSS = `
.pr-hero {
  position: relative;
  background:
    radial-gradient(120% 70% at 50% -20%, rgba(245, 145, 30, 0.18), transparent 62%),
    var(--lp-bg);
}

.pr-final {
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(90% 70% at 50% 120%, rgba(245, 145, 30, 0.2), transparent 62%),
    var(--lp-bg);
  border-top: 1px solid var(--lp-rule-soft);
  display: flex;
  flex-direction: column;
}

.pr-final .lp-shell {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1.5rem;
}

/* ── Panel lateral de la tarjeta de plan ── */

.pr-aside {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.pr-aside-item {
  padding-top: 1.5rem;
  border-top: 1px solid var(--lp-rule-soft);
}

.pr-aside-item:first-child {
  padding-top: 0;
  border-top: none;
}

/* ── Dos columnas de prestaciones ── */

.pr-cols {
  display: grid;
  gap: 2.5rem;
  margin-top: clamp(2rem, 5vw, 3rem);
}

/* ── Acordeón FAQ nativo ── */

.pr-faq {
  margin-top: clamp(2rem, 5vw, 3rem);
  border-top: 1px solid var(--lp-rule-soft);
}

.pr-faq-item {
  border-bottom: 1px solid var(--lp-rule-soft);
}

.pr-faq-q {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.35rem 0;
  font-family: var(--lp-display);
  font-size: 1.0625rem;
  font-weight: 700;
  letter-spacing: -0.015em;
  color: var(--lp-fg);
  cursor: pointer;
  list-style: none;
}

.pr-faq-q::-webkit-details-marker {
  display: none;
}

/* Indicador textual de apertura: "+" en reposo, "−" con el details abierto */
.pr-faq-indicator {
  position: relative;
  flex-shrink: 0;
  width: 1em;
  height: 1em;
  font-family: var(--lp-display);
  color: var(--brand);
}

.pr-faq-indicator::before {
  content: '+';
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  font-weight: 700;
}

details[open] .pr-faq-indicator::before {
  content: '\\2212';
}

.pr-faq-a {
  margin: 0 0 1.35rem;
  max-width: 60ch;
}

@media (min-width: 700px) {
  .pr-cols {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 960px) {
  .pr-final .lp-shell {
    max-width: 60ch;
  }
}
`;
