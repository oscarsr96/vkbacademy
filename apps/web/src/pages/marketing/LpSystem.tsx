// Sistema visual `lp-*` compartido por las páginas de marketing (landing,
// /nosotros, /precios). El CSS genérico y el encabezado de sección vivían
// hasta ahora duplicados en cada página; este módulo los centraliza. Cada
// página los consume con `<style>{LP_SHARED_CSS + CSS}</style>` (compartido
// primero, CSS local después) dentro de un `<div className="lp-page">`.

// ── Encabezado de sección ────────────────────────────────────────────────────
// Título en dos tiempos: la primera frase en blanco, la segunda en naranja.
export function SectionHead({
  index,
  kicker,
  title,
  accent,
}: {
  index: string;
  kicker: string;
  title: string;
  accent: string;
}) {
  return (
    <header className="lp-head">
      <p className="lp-head-kicker">
        <span className="lp-head-index" aria-hidden="true">
          {index}
        </span>
        {kicker}
      </p>
      <h2 className="lp-head-title">
        {title}
        <em>{accent}</em>
      </h2>
    </header>
  );
}

// ── Catálogo de canje ────────────────────────────────────────────────────────
// Mismos ítems y puntos que la tabla de merchandising del club, sin emojis.
// La landing conserva su propia copia local (no se toca su markup); About y
// Pricing consumen esta.
export const MERCH: { name: string; pts: number }[] = [
  { name: 'Pack de stickers VKB', pts: 100 },
  { name: 'Botella termo del club', pts: 200 },
  { name: 'Gorra oficial VKB', pts: 350 },
  { name: 'Camiseta oficial del club', pts: 500 },
  { name: 'Balón firmado por el equipo', pts: 1000 },
];

// ── CSS genérico del sistema ──────────────────────────────────────────────────
// Copiado literal desde el CSS de LandingPage.tsx (sin --lp-enter, que sigue
// siendo local a la landing). Las primitivas nuevas van al final, separadas.
export const LP_SHARED_CSS = `
.lp-page {
  --lp-bg: #070d18;
  --lp-bg-alt: #0a1322;
  --lp-surface: rgba(255, 255, 255, 0.03);
  --lp-rule: rgba(255, 255, 255, 0.1);
  --lp-rule-soft: rgba(255, 255, 255, 0.07);
  --lp-fg: #ffffff;
  --lp-fg-mid: rgba(255, 255, 255, 0.74);
  --lp-fg-low: rgba(255, 255, 255, 0.56);
  --lp-display: 'Gabarito', 'Unbounded', var(--font-sans);
  --lp-ease-out: cubic-bezier(0.23, 1, 0.32, 1);

  /* clip recorta sin crear contenedor de scroll; hidden sí lo crea y eso deja
     sin scroller de referencia a las animaciones view(). El hidden queda como
     respaldo para navegadores sin soporte de clip. */
  overflow-x: hidden;
  overflow-x: clip;
  background: var(--lp-bg);
  color: var(--lp-fg);
  font-family: var(--font-sans);
}

.lp-page img,
.lp-page svg {
  max-width: 100%;
}

.lp-page :focus-visible {
  outline: 3px solid var(--brand);
  outline-offset: 3px;
}

.lp-shell {
  width: min(1200px, 100% - 2.5rem);
  margin-inline: auto;
}

/* ── Tipografía ── */

.lp-display {
  margin: 0;
  font-family: var(--lp-display);
  font-weight: 800;
  font-size: clamp(2.25rem, 5.6vw, 4.25rem);
  line-height: 1.02;
  letter-spacing: -0.025em;
  color: var(--lp-fg);
}

.lp-display em {
  font-style: normal;
  color: var(--brand);
}

.lp-lead {
  margin: 0;
  font-size: clamp(1rem, 2.2vw, 1.125rem);
  line-height: 1.62;
  color: var(--lp-fg-mid);
  max-width: 44ch;
}

.lp-text {
  margin: 0;
  font-size: 0.9375rem;
  line-height: 1.65;
  color: var(--lp-fg-mid);
  max-width: 52ch;
}

.lp-note {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--lp-fg-low);
  max-width: 38ch;
}

/* ── Botones ── */

.lp-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 52px;
  padding: 0 1.85rem;
  border: none;
  border-radius: 999px;
  font-family: var(--lp-display);
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  text-decoration: none;
  cursor: pointer;
}

.lp-btn-primary {
  background: var(--brand);
  color: var(--brand-contrast);
}

.lp-btn-primary:hover {
  background: var(--brand-light);
}

.lp-btn-ghost {
  background: transparent;
  color: var(--lp-fg);
  box-shadow: inset 0 0 0 1.5px rgba(255, 255, 255, 0.26);
}

.lp-btn-ghost:hover {
  box-shadow: inset 0 0 0 1.5px var(--brand);
  color: var(--brand);
}

.lp-btn-full {
  width: 100%;
}

.lp-btn-lg {
  min-height: 60px;
  padding: 0 2.5rem;
  font-size: 1.0625rem;
}

/* CTA que acompaña a un párrafo, sin robarle el protagonismo al principal */
.lp-btn-inline {
  align-self: flex-start;
  min-height: 46px;
  padding: 0 1.4rem;
  font-size: 0.9375rem;
}

/* Fila de botones CTA (primario + ghost). Estaba duplicada carácter a
   carácter como .lp-cta-row/.ab-cta-row/.pr-cta-row en las tres páginas;
   vive aquí una sola vez. */
.lp-cta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

/* ── Encabezado de sección ── */

.lp-head {
  padding-top: 1.25rem;
  border-top: 1px solid var(--lp-rule);
}

.lp-head-kicker {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  margin: 0 0 0.7rem;
  font-family: var(--lp-display);
  font-size: clamp(1rem, 2.2vw, 1.25rem);
  font-weight: 600;
  letter-spacing: -0.015em;
  color: var(--lp-fg-mid);
}

.lp-head-index {
  font-family: var(--lp-display);
  font-size: clamp(1rem, 2.2vw, 1.25rem);
  font-weight: 800;
  color: var(--brand);
  font-variant-numeric: tabular-nums;
}

.lp-head-title {
  margin: 0;
  font-family: var(--lp-display);
  font-weight: 800;
  font-size: clamp(1.875rem, 4.6vw, 3.25rem);
  line-height: 1.05;
  letter-spacing: -0.025em;
  color: var(--lp-fg);
}

/* La segunda frase siempre en línea propia: el titular es una sentencia
   en dos tiempos, no un párrafo que se parte donde caiga */
.lp-head-title em {
  display: block;
  font-style: normal;
  color: var(--brand);
}

/* ── Bloques ── */

.lp-block {
  padding: clamp(3rem, 8vw, 5.5rem) 0;
  background: var(--lp-bg);
}

.lp-block-alt {
  background: var(--lp-bg-alt);
}

/* ── Proceso ── */

.lp-steps {
  display: grid;
  gap: 0;
  margin: clamp(2rem, 5vw, 3rem) 0 0;
  padding: 0;
  list-style: none;
}

.lp-step {
  padding: 1.5rem 0;
  border-bottom: 1px solid var(--lp-rule-soft);
}

.lp-step:first-child {
  border-top: 1px solid var(--lp-rule-soft);
}

.lp-step-num {
  display: block;
  font-family: var(--lp-display);
  font-size: 1.25rem;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.02em;
  color: var(--brand);
}

.lp-step-title {
  margin: 0.6rem 0 0.45rem;
  font-family: var(--lp-display);
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: -0.015em;
  color: var(--lp-fg);
}

/* ── Lista de prestaciones ── */

.lp-list {
  margin: clamp(2rem, 5vw, 3rem) 0 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--lp-rule-soft);
}

.lp-list-row {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.35rem 1rem;
  padding: 1.35rem 0;
  border-bottom: 1px solid var(--lp-rule-soft);
}

.lp-list-num {
  grid-row: span 2;
  font-family: var(--lp-display);
  font-size: 1rem;
  font-weight: 800;
  line-height: 1.5;
  color: var(--brand);
  font-variant-numeric: tabular-nums;
}

.lp-list-title {
  margin: 0;
  font-family: var(--lp-display);
  font-size: 1.125rem;
  font-weight: 700;
  letter-spacing: -0.015em;
  color: var(--lp-fg);
}

/* ── Recompensas ── */

.lp-table {
  width: 100%;
  margin-top: clamp(2rem, 5vw, 3rem);
  border-collapse: collapse;
}

.lp-table th {
  padding: 1rem 0;
  text-align: left;
  font-size: 1rem;
  font-weight: 500;
  color: var(--lp-fg-mid);
  border-bottom: 1px solid var(--lp-rule-soft);
}

.lp-table tr:first-child th,
.lp-table tr:first-child td {
  border-top: 1px solid var(--lp-rule-soft);
}

.lp-table td {
  padding: 1rem 0;
  text-align: right;
  font-family: var(--lp-display);
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--amber-led);
  font-variant-numeric: tabular-nums;
  border-bottom: 1px solid var(--lp-rule-soft);
  white-space: nowrap;
}

.lp-table-note {
  margin: 1.1rem 0 0;
  font-size: 0.8125rem;
  color: var(--lp-fg-low);
}

.lp-plan {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
  padding: 1.85rem 1.6rem;
  border: 1px solid var(--lp-rule);
  border-radius: 18px;
  background: var(--lp-surface);
}

.lp-plan-featured {
  border-color: var(--brand);
  background: rgba(245, 145, 30, 0.07);
}

.lp-plan-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.lp-plan-name {
  font-family: var(--lp-display);
  font-size: 1.0625rem;
  font-weight: 700;
  letter-spacing: -0.015em;
  color: var(--lp-fg);
}

.lp-plan-badge {
  padding: 0.3rem 0.8rem;
  border-radius: 999px;
  background: var(--brand);
  color: var(--brand-contrast);
  font-size: 0.6875rem;
  font-weight: 700;
}

.lp-plan-price {
  display: flex;
  align-items: baseline;
  gap: 0.45rem;
  margin: 0;
  padding-bottom: 1.1rem;
  border-bottom: 1px solid var(--lp-rule-soft);
}

.lp-plan-amount {
  font-family: var(--lp-display);
  font-size: clamp(3rem, 8vw, 3.75rem);
  font-weight: 800;
  line-height: 0.95;
  letter-spacing: -0.04em;
  color: var(--lp-fg);
}

.lp-plan-unit {
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--lp-fg-low);
}

.lp-plan-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 0.9375rem;
  line-height: 1.5;
  color: var(--lp-fg-mid);
  flex: 1;
}

.lp-plan-list li {
  position: relative;
  padding-left: 1.1rem;
}

.lp-plan-list li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.5em;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--brand);
}

/* ── Estructura a partir de tablet ── */

@media (min-width: 700px) {
  .lp-steps {
    grid-template-columns: repeat(3, 1fr);
    gap: 0 2.5rem;
    border-top: 1px solid var(--lp-rule-soft);
  }

  .lp-step,
  .lp-step:first-child {
    border-top: none;
    border-bottom: none;
    padding: 1.75rem 0 0;
  }

  .lp-list-row {
    grid-template-columns: auto 1fr 1.4fr;
    align-items: baseline;
    gap: 1.5rem;
  }

  .lp-list-num {
    grid-row: auto;
  }
}

@media (min-width: 960px) {
  .lp-plan {
    padding: 2.25rem 2rem;
  }
}

@keyframes lp-rise {
  from {
    opacity: 0;
    transform: translateY(18px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.lp-btn {
  transition:
    background-color 150ms ease,
    color 150ms ease,
    box-shadow 150ms ease,
    transform 100ms var(--lp-ease-out);
}

.lp-btn:active {
  transform: scale(0.97);
}

@media (hover: hover) and (pointer: fine) {
  .lp-plan {
    transition: border-color 150ms ease;
  }
}

@media (max-width: 420px) {
  .lp-btn {
    width: 100%;
  }
}

/* ══════════════════════════════════════════════════════════════════
   PRIMITIVAS NUEVAS — no existen en la landing original. Las usan
   About y Pricing (P2/P3) para montar secciones con el sistema lp-*
   sin reinventar revelado por scroll, grids ni listas de bullets.
   ══════════════════════════════════════════════════════════════════ */

/* Revelado por scroll genérico: mismas curvas que la landing, opt-in por clase */
@supports (animation-timeline: view()) {
  @media (prefers-reduced-motion: no-preference) {
    .lp-reveal {
      animation: lp-rise linear both;
      animation-timeline: view();
      animation-range: entry 8% cover 24%;
    }
  }
}

/* Trío de ítems: de 1 columna a 3 en 700px (equivale a .lp-pillars/.lp-family de la landing) */
.lp-grid-3 {
  display: grid;
  gap: 1.5rem;
  margin-top: clamp(2rem, 5vw, 3rem);
}

/* Dos columnas asimétricas en 960px (equivale a .lp-hero-grid/.lp-showcase-grid) */
.lp-split {
  display: grid;
  gap: clamp(2rem, 5vw, 3rem);
  margin-top: clamp(2rem, 5vw, 3rem);
  align-items: start;
}

/* Título de ítem (equivale a .lp-family-title) */
.lp-item-title {
  margin: 0 0 0.4rem;
  font-family: var(--lp-display);
  font-size: 1.0625rem;
  font-weight: 700;
  letter-spacing: -0.015em;
  color: var(--lp-fg);
}

/* Lista de bullets círculo 6px (equivale a .lp-plan-list fuera de una tarjeta) */
.lp-bullets {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 0.9375rem;
  line-height: 1.5;
  color: var(--lp-fg-mid);
}

.lp-bullets li {
  position: relative;
  padding-left: 1.1rem;
}

.lp-bullets li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.5em;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--brand);
}

@media (min-width: 700px) {
  .lp-grid-3 {
    grid-template-columns: repeat(3, 1fr);
    gap: 2.5rem;
  }
}

@media (min-width: 960px) {
  .lp-split {
    grid-template-columns: 1fr minmax(0, 420px);
    gap: 4rem;
  }
}
`;
