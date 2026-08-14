import { Link } from 'react-router-dom';
import { LP_SHARED_CSS, MERCH, SectionHead } from './LpSystem';

// ─── Datos de la página ────────────────────────────────────────────────────────

// Creadores de VKB Academy. Sin iniciales ni color por fundador (el sistema
// no usa avatares): solo nombre, rol y enlace a LinkedIn.
const FOUNDERS = [
  {
    name: 'Óscar Sánchez Rueda',
    role: 'Co-fundador & Tech Lead',
    linkedin: 'https://www.linkedin.com/in/%C3%B3scar-s%C3%A1nchez-rueda-8573a4162/',
  },
  {
    name: 'Javier Sánchez Rueda',
    role: 'Co-fundador & Director Deportivo',
    linkedin: 'https://www.linkedin.com/in/javier-s%C3%A1nchez-rueda-8a4117ba/',
  },
  {
    name: 'M. Houghton',
    role: 'Co-fundador',
    linkedin: 'https://www.linkedin.com/in/mhoughtonl/',
  },
];

// Valores del club, sin iconos
const VALUES = [
  {
    title: 'Excelencia deportiva',
    description:
      'Metodología avalada por técnicos federados, ahora también en formato digital para que tu hijo/a siga aprendiendo en casa.',
  },
  {
    title: 'Familia y comunidad',
    description:
      'El barrio como base, la cancha como hogar y los padres como parte del equipo. VKB Academy mantiene ese vínculo.',
  },
  {
    title: 'Formación integral',
    description:
      'Combinamos el deporte con herramientas digitales fáciles de dar de alta, para que cada familia decida cuándo empieza su hijo/a.',
  },
];

// Puntos de la sección "Por qué creamos VKB Academy"
const WHY_POINTS = [
  'Para que tu hijo/a no pierda ritmo entre entrenamientos',
  'Para que puedas apuntarle en minutos, sin depender de la administración',
  'Para que tenga un tutor de IA disponible siempre que se atasque',
];

// ─── Página ────────────────────────────────────────────────────────────────────

export default function AboutPage() {
  return (
    <div className="lp-page">
      <style>{LP_SHARED_CSS + CSS}</style>

      {/* ═══ HERO ═══ */}
      <section className="lp-block ab-hero">
        <div className="lp-shell ab-hero-inner">
          <h1 className="lp-display">
            Vallekas Basket.
            <br />
            <em>Un club para toda la familia.</em>
          </h1>
          <p className="lp-lead">
            Más de 30 años formando jugadores y personas en Vallecas. VKB Academy es el paso
            digital para que el aprendizaje no se quede solo en la cancha.
          </p>
        </div>
      </section>

      {/* ═══ 01 · HISTORIA ═══ */}
      <section className="lp-block lp-block-alt">
        <div className="lp-shell">
          <SectionHead
            index="01"
            kicker="Nuestra historia"
            title="Una canasta y un puñado de chavales."
            accent="Así empezó todo."
          />

          <div className="ab-story lp-reveal">
            <p className="lp-lead">
              Vallekas Basket nació en el corazón del barrio de Vallecas a principios de los años
              90, fundado por un grupo de vecinos apasionados por el baloncesto que querían dar a
              los jóvenes del barrio un espacio donde crecer, tanto dentro como fuera de la
              cancha. Lo que comenzó con una sola canasta y un puñado de chavales se convirtió en
              uno de los clubes de formación más activos del sur de Madrid.
            </p>

            <p className="lp-text">
              Hoy, el club cuenta con más de veinte equipos que abarcan todas las categorías,
              desde los más pequeños en benjamín y alevín, pasando por infantil, cadete y junior,
              hasta el equipo sénior que compite en ligas federadas de la Comunidad de Madrid.
              Cada año, más de trescientos jugadores y jugadoras se forman con nosotros, guiados
              por un cuerpo técnico comprometido con su desarrollo personal y deportivo.
            </p>

            <p className="lp-text">
              Con más de treinta años de historia, hemos aprendido que el deporte es una
              herramienta poderosa para construir personas íntegras. Y que detrás de cada jugador
              hay una familia que merece estar informada y sentirse parte del proceso. Por eso
              creamos VKB Academy: para llevar la metodología del club a cualquier dispositivo,
              para que cada familia pueda dar de alta a sus hijos en minutos y acompañar su
              crecimiento más allá de la cancha.
            </p>
          </div>
        </div>
      </section>

      {/* ═══ 02 · MISION Y VALORES ═══ */}
      <section className="lp-block">
        <div className="lp-shell">
          <SectionHead
            index="02"
            kicker="Misión y valores"
            title="Lo que enseñamos."
            accent="Dentro y fuera de la cancha."
          />

          <div className="lp-grid-3 lp-reveal">
            {VALUES.map((value) => (
              <div key={value.title}>
                <h3 className="lp-item-title">{value.title}</h3>
                <p className="lp-text">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 03 · POR QUE VKB ACADEMY ═══ */}
      <section className="lp-block lp-block-alt">
        <div className="lp-shell">
          <SectionHead
            index="03"
            kicker="El porqué"
            title="Por qué creamos"
            accent="VKB Academy."
          />

          <div className="lp-split lp-reveal">
            <ul className="lp-bullets">
              {WHY_POINTS.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>

            <figure className="ab-quote-figure">
              <blockquote className="ab-quote">
                «La tecnología al servicio del baloncesto de base».
              </blockquote>
              <figcaption className="lp-note">Vallekas Basket, 2026</figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* ═══ 04 · EQUIPO FUNDADOR ═══ */}
      <section className="lp-block">
        <div className="lp-shell">
          <SectionHead
            index="04"
            kicker="Quiénes somos"
            title="Una idea del barrio."
            accent="Tres personas detrás."
          />

          <ul className="lp-list lp-reveal">
            {FOUNDERS.map((founder, i) => (
              <li className="lp-list-row" key={founder.linkedin}>
                <span className="lp-list-num">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="lp-list-title">{founder.name}</h3>
                <div className="ab-founder-meta">
                  <p className="lp-text">{founder.role}</p>
                  <a
                    className="lp-btn lp-btn-ghost lp-btn-inline"
                    href={founder.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    LinkedIn
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ═══ 05 · RECOMPENSAS ═══ */}
      <section className="lp-block lp-block-alt">
        <div className="lp-shell">
          <SectionHead
            index="05"
            kicker="Recompensas"
            title="El esfuerzo tiene premio."
            accent="Y se canjea en el club."
          />

          <div className="lp-reveal">
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
              Los puntos se obtienen completando lecciones, módulos, exámenes y manteniendo la
              racha semanal de estudio.
            </p>
          </div>
        </div>
      </section>

      {/* ═══ CTA FINAL ═══ */}
      <section className="lp-block ab-final">
        <div className="lp-shell ab-final-inner">
          <h2 className="lp-display">
            ¿Formas parte del club?
            <br />
            <em>Empieza hoy.</em>
          </h2>
          <p className="lp-lead">
            Un adulto de la familia da de alta a cada alumno en el formulario de registro y
            recibe su usuario al terminar. La cuenta es del alumno.
          </p>
          <div className="lp-cta-row">
            <Link className="lp-btn lp-btn-primary lp-btn-lg" to="/register">
              Dar de alta a un alumno
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
// Bloque local mínimo con prefijo `ab-`: los halos del hero y del cierre
// reutilizan los mismos radial-gradient rgba(245,145,30,α) de la landing; el
// resto son envoltorios de espaciado que el sistema compartido no cubre.

const CSS = `
/* Halos */

.ab-hero {
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(120% 70% at 50% -20%, rgba(245, 145, 30, 0.18), transparent 62%),
    var(--lp-bg);
}

.ab-hero-inner {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: clamp(1.5rem, 4vw, 2rem);
}

.ab-final {
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(90% 70% at 50% 120%, rgba(245, 145, 30, 0.2), transparent 62%),
    var(--lp-bg);
}

.ab-final-inner {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1.5rem;
}

/* Historia: separación vertical entre los tres párrafos */

.ab-story {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin-top: clamp(2rem, 5vw, 3rem);
}

/* Cita de "Por qué VKB Academy": tamaño de .lp-manifesto-lead,
   sin caja, sin borde izquierdo, sin glow */

/* figure y blockquote traen margen propio del navegador: se anula aquí */
.ab-quote-figure {
  margin: 0;
}

.ab-quote {
  margin: 0 0 1rem;
  font-family: var(--lp-display);
  font-size: clamp(1.375rem, 3.4vw, 2.125rem);
  font-weight: 600;
  line-height: 1.22;
  letter-spacing: -0.02em;
  color: var(--lp-fg);
}

/* Equipo fundador: rol + enlace de LinkedIn en la misma celda de la fila */

.ab-founder-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.6rem;
}
`;
