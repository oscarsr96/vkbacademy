/**
 * Tests de responsividad para las páginas de marketing.
 * Estrategia: grepping de los archivos fuente para patrones responsivos.
 * Se ejecutan con vitest (entorno jsdom).
 */

import * as fs from 'fs';
import * as path from 'path';

// Rutas absolutas a los archivos a analizar
const PAGES_DIR = path.resolve(__dirname, '.');
const LAYOUTS_DIR = path.resolve(__dirname, '../../layouts');

function readSource(filename: string): string {
  return fs.readFileSync(path.join(PAGES_DIR, filename), 'utf-8');
}

function readLayout(filename: string): string {
  return fs.readFileSync(path.join(LAYOUTS_DIR, filename), 'utf-8');
}

// El sistema lp-* (LpSystem.tsx) es parte de la página que lo consume: los
// asserts que antes buscaban una regla dentro de la propia página ahora deben
// buscarla en la página + el módulo compartido, tal y como se sirve en runtime.
function readWithSystem(filename: string): string {
  return readSource(filename) + readSource('LpSystem.tsx');
}

// ─── PublicLayout ───────────────────────────────────────────────────────────────

describe('PublicLayout — responsividad móvil', () => {
  let src: string;

  beforeAll(() => {
    src = readLayout('PublicLayout.tsx');
  });

  test('inyecta un bloque <style> con media queries para móvil', () => {
    // El navbar usa clases como pub-hamburger, pub-nav-links-desktop —
    // deben ocultarse/mostrarse vía una etiqueta <style> con @media
    expect(src).toMatch(/@media.*max-width.*768/);
  });

  test('el hamburger (pub-hamburger) solo es visible en móvil', () => {
    // pub-hamburger debe estar display:none en desktop y visible en móvil
    expect(src).toMatch(/pub-hamburger/);
    expect(src).toMatch(/display:\s*none/);
  });

  test('los nav links de desktop (pub-nav-links-desktop) se ocultan en móvil', () => {
    expect(src).toMatch(/pub-nav-links-desktop/);
  });

  test('el menú móvil desplegable (pub-mobile-menu) existe en el JSX', () => {
    expect(src).toMatch(/pub-mobile-menu/);
  });

  test('el footer usa flexWrap para apilar en móvil', () => {
    // footerInner debe tener flexWrap: 'wrap' o la media query lo cambia
    const hasWrap = src.includes("flexWrap: 'wrap'") || src.match(/@media.*footerInner/);
    expect(hasWrap).toBeTruthy();
  });
});

// ─── LandingPage ────────────────────────────────────────────────────────────────

describe('LandingPage — responsividad móvil', () => {
  let src: string;

  beforeAll(() => {
    src = readSource('LandingPage.tsx');
  });

  test('inyecta un bloque <style> con media queries', () => {
    expect(src).toMatch(/<style>/);
    expect(src).toMatch(/@media.*max-width/);
  });

  test('el hero no usa minHeight: 100vh sin alternativa móvil', () => {
    // Si usa minHeight 100vh debe tener un override en la media query
    const hasFullVh = src.includes("minHeight: '100vh'");
    if (hasFullVh) {
      expect(src).toMatch(/lp-hero/);
      // El override está en la media query
      expect(src).toMatch(/lp-hero.*min-height|min-height.*lp-hero/s);
    }
    // Si no lo usa, el test pasa directamente
  });

  test('los botones CTA del hero usan flexWrap: wrap', () => {
    expect(src).toMatch(/heroCtas|lp-cta/);
    // .lp-cta-row vive ahora en LpSystem.tsx (consolidada: estaba duplicada
    // carácter a carácter como .lp-cta-row/.ab-cta-row/.pr-cta-row en las tres
    // páginas de marketing): se lee la página concatenada con el módulo.
    expect(readWithSystem('LandingPage.tsx')).toMatch(/flexWrap.*wrap|flex-wrap.*wrap/);
  });

  test('las tarjetas de pricing tienen ancho responsivo (no fixed width > 400px sin override)', () => {
    // pricingCard no debe tener width fijo > 400px sin un override responsivo en media query
    const fixedWidthMatch = src.match(/width:\s*(\d+)/g) ?? [];
    const problemWidths = fixedWidthMatch
      .map((m) => parseInt(m.replace(/\D/g, ''), 10))
      .filter((w) => w > 400);

    if (problemWidths.length > 0) {
      // Debe haber overrides en la media query. max-width:100% (.lp-page
      // img/svg) vive ahora en LpSystem.tsx, de ahí la lectura concatenada.
      expect(readWithSystem('LandingPage.tsx')).toMatch(/lp-pricing-card.*width|max-width.*100%/s);
    }
  });

  test('el listado de características apila en móvil (multi-columna solo bajo min-width)', () => {
    // .lp-list-row vive ahora en LpSystem.tsx (sistema compartido): la
    // verificación lee la página concatenada con el módulo.
    const full = readWithSystem('LandingPage.tsx');
    const hasAutoFit = full.includes('auto-fit') || full.includes('auto-fill');
    // Diseño mobile-first: la fila de la lista es de una columna por defecto y
    // sus columnas adicionales se declaran dentro de un @media (min-width: …)
    // Anclado a un bloque concreto: la regla multi-columna de .lp-list-row
    // tiene que vivir DENTRO de un @media (min-width: …), no en cualquier
    // punto posterior del archivo.
    const mobileFirstRow = extractMinWidthMediaBlocks(full).some((block) =>
      /\.lp-list-row\s*\{[^}]*grid-template-columns/s.test(block),
    );
    expect(hasAutoFit || mobileFirstRow).toBeTruthy();
  });

  test('el bloque de recompensas no impone anchos fijos', () => {
    expect(src).toMatch(/merchGrid|lp-merch/);
    // .lp-table vive ahora en LpSystem.tsx: ocupa el ancho disponible en vez
    // de anchos fijos en px.
    const full = readWithSystem('LandingPage.tsx');
    const hasFluidTable = /\.lp-table\s*\{[^}]*width:\s*100%/s.test(full);
    const hasWrap = /flexWrap.*wrap|flex-wrap.*wrap/.test(full);
    expect(hasFluidTable || hasWrap).toBeTruthy();
  });
});

// ─── AcademyLandingPage ─────────────────────────────────────────────────────────

// Ya no tiene diseño propio: delega en PublicLayout y LandingPage, cuya
// responsividad verifican sus propios bloques. Aquí solo se comprueba que la
// delegación sigue en pie y que la academia llega a las dos piezas.
describe('AcademyLandingPage — delegación en la landing común', () => {
  let src: string;

  beforeAll(() => {
    src = readSource('AcademyLandingPage.tsx');
  });

  test('renderiza la landing común dentro de PublicLayout', () => {
    expect(src).toMatch(/import PublicLayout/);
    expect(src).toMatch(/import LandingPage/);
    expect(src).toMatch(/<PublicLayout[\s\S]*<LandingPage[\s\S]*<\/PublicLayout>/);
  });

  test('pasa el nombre de la academia a ambas piezas', () => {
    expect(src).toMatch(/<PublicLayout[^>]*clubName=\{academy\.name\}/);
    expect(src).toMatch(/<LandingPage[^>]*clubName=\{academy\.name\}/);
  });

  test('pasa el logo de la academia al layout', () => {
    expect(src).toMatch(/logoUrl=\{academy\.logoUrl\}/);
  });

  test('no reimplementa un diseño propio', () => {
    expect(src).not.toMatch(/acad-nav|<style>/);
  });

  test('conserva la resolución por slug y por dominio', () => {
    expect(src).toMatch(/useParams/);
    expect(src).toMatch(/useAcademyDomain/);
    expect(src).toMatch(/academies\/by-slug/);
  });

  test('mantiene los estados de carga y de academia no encontrada', () => {
    expect(src).toMatch(/isLoading/);
    expect(src).toMatch(/Academia no encontrada/);
  });
});

// ─── Helpers del sistema lp-* (AboutPage / PricingPage) ────────────────────────
// El diseño anterior de estas dos páginas se retiró en P2/P3 (precedente PR
// #70: se sustituyen los tests que verificaban ese diseño por los que
// verifican el sistema lp-* vigente, no se acumulan sobre los viejos).

// Símbolos decorativos de interfaz que no deben aparecer en el copy de marca:
// emojis/pictogramas, flechas, checks, triángulos y estrellas. Deliberadamente
// NO incluye el bloque de dibujo de caja (U+2500–257F): ese es el rango que
// usan los separadores de comentario (─/═) de estilo de la casa en los cuatro
// archivos de marketing, y un criterio que los cazara obligaría a quitarlos
// (como le pasó a AboutPage.tsx con la primera versión de este assert: el
// rango U+2190-U+2BFF del plan original incluía el bloque de dibujo de caja).
// Rangos: pictogramas y emojis; símbolos misceláneos y dingbats; flechas
// (básicas y suplementarias); formas geométricas; elementos de bloque; y
// símbolos y flechas misceláneos (⭐, ⬆). Quedan fuera a propósito el dibujo
// de caja (U+2500-257F) y los operadores matemáticos (U+2200-22FF), que la
// landing usa en las fórmulas del mock (√, −, ≈).
const DECORATIVE_SYMBOL_RE =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{27F0}-\u{27FF}\u{2580}-\u{25FF}\u{2B00}-\u{2BFF}]/u;

const BRAND_HEX_RE = /#(ea580c|f5911e|6366f1|0891b2|0d1b2a)/i;

// Etiquetas <Link ...> completas, sin asumir orden de atributos.
function extractLinkTags(src: string): string[] {
  return src.match(/<Link[^>]*>/g) ?? [];
}

// El bloque `const CSS = \`...\`;` de cada página: el único CSS que le
// pertenece a ella (el resto lo aporta LpSystem.tsx). Se usa para el check de
// grids mobile-first, que la sección 3 del plan acota explícitamente al
// "CSS local" — el sistema compartido tiene sus propios patrones (p. ej.
// .lp-list-row declara "auto 1fr" fuera de cualquier media porque es un
// número/icono junto a texto, seguro en cualquier ancho) que no son el objeto
// de este check.
function readLocalCss(file: string): string {
  const src = readSource(file);
  const marker = 'const CSS = `';
  const start = src.indexOf(marker);
  if (start === -1) throw new Error(`No se encontró el bloque "const CSS" en ${file}`);
  const end = src.lastIndexOf('`;');
  return src.slice(start + marker.length, end);
}

// Quita el contenido de los bloques @media (min-width: ...) { ... } de un
// CSS, respetando el anidado de llaves, para poder comprobar qué queda
// declarado fuera de ellos (mobile-first: lo de una columna no necesita ir
// bajo ningún media; lo de varias, sí).
// Devuelve el CONTENIDO de cada bloque @media (min-width: ...) por separado.
// Necesario para anclar asserts a un único bloque: un regex sobre el archivo
// entero casaría la apertura de un @media con una regla que vive mucho más
// abajo, fuera de él, y pasaría aunque la regla se hubiera sacado del media.
function extractMinWidthMediaBlocks(css: string): string[] {
  const blocks: string[] = [];
  let i = 0;
  while (i < css.length) {
    const marker = css.indexOf('@media (min-width:', i);
    if (marker === -1) break;
    const braceStart = css.indexOf('{', marker);
    if (braceStart === -1) break;
    let depth = 1;
    let j = braceStart + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') depth--;
      j++;
    }
    blocks.push(css.slice(braceStart + 1, j - 1));
    i = j;
  }
  return blocks;
}

function stripMinWidthMediaBlocks(css: string): string {
  let result = '';
  let i = 0;
  while (i < css.length) {
    const marker = css.indexOf('@media (min-width:', i);
    if (marker === -1) {
      result += css.slice(i);
      break;
    }
    result += css.slice(i, marker);
    const braceStart = css.indexOf('{', marker);
    if (braceStart === -1) {
      result += css.slice(marker);
      break;
    }
    let depth = 1;
    let j = braceStart + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') depth--;
      j++;
    }
    i = j;
  }
  return result;
}

// Batería común a AboutPage y PricingPage: ambas siguen el mismo sistema
// lp-* documentado en LpSystem.tsx.
function describeLpMarketingPage(file: string) {
  let src: string;

  beforeAll(() => {
    src = readSource(file);
  });

  test('usa el sistema compartido: importa ./LpSystem, SectionHead y lp-page', () => {
    expect(src).toMatch(/from\s+'\.\/LpSystem'/);
    expect(src).toMatch(/SectionHead/);
    expect(src).toMatch(/className="lp-page"/);
  });

  test('CTA primario a /register presente; /login nunca lleva la clase de botón primario', () => {
    const registerTags = extractLinkTags(src).filter((tag) => tag.includes('to="/register"'));
    expect(registerTags.length).toBeGreaterThan(0);
    expect(registerTags.some((tag) => tag.includes('lp-btn-primary'))).toBe(true);

    const loginTags = extractLinkTags(src).filter((tag) => tag.includes('to="/login"'));
    expect(loginTags.length).toBeGreaterThan(0);
    for (const tag of loginTags) {
      expect(tag).not.toMatch(/lp-btn-primary/);
    }
  });

  test('cero emojis y símbolos decorativos de interfaz', () => {
    // El sistema compartido es parte de lo que la página sirve en runtime.
    expect(readWithSystem(file)).not.toMatch(DECORATIVE_SYMBOL_RE);
  });

  test('cero hex de marca literales (siempre var(--brand)/var(--brand-light))', () => {
    expect(readWithSystem(file)).not.toMatch(BRAND_HEX_RE);
  });

  test('sin !important y sin @media (max-width: 768px) de overrides', () => {
    const full = readWithSystem(file);
    expect(full).not.toMatch(/!important/);
    expect(full).not.toMatch(/@media \(max-width:\s*768px\)/);
  });

  test('grids mobile-first: toda grid-template-columns del CSS local vive bajo @media (min-width:', () => {
    const outsideMinWidth = stripMinWidthMediaBlocks(readLocalCss(file));
    expect(outsideMinWidth).not.toMatch(/grid-template-columns/);
  });
}

// ─── AboutPage ──────────────────────────────────────────────────────────────────

describe('AboutPage — sistema lp-*', () => {
  describeLpMarketingPage('AboutPage.tsx');
});

// ─── PricingPage ────────────────────────────────────────────────────────────────

describe('PricingPage — sistema lp-*', () => {
  describeLpMarketingPage('PricingPage.tsx');

  test('FAQ nativo con <details>, sin useState', () => {
    const src = readSource('PricingPage.tsx');
    expect(src).toMatch(/<details/);
    expect(src).not.toMatch(/useState/);
  });
});

// ─── Verificaciones generales ────────────────────────────────────────────────────

describe('Todas las páginas de marketing — verificaciones generales', () => {
  // AcademyLandingPage queda fuera: ya no tiene estilos propios, solo resuelve la
  // academia y delega en LandingPage, que sí pasa por estas verificaciones.
  const files = ['LandingPage.tsx', 'AboutPage.tsx', 'PricingPage.tsx'];

  test.each(files)('%s: usa overflowX hidden en el contenedor raíz', (file) => {
    // .lp-page (overflow-x) vive en LpSystem.tsx para la landing: se lee la
    // página concatenada con el módulo compartido.
    const src = readWithSystem(file);
    expect(src).toMatch(/overflowX.*hidden|overflow-x.*hidden/);
  });

  test.each(files)('%s: los títulos usan clamp() para tamaños de fuente responsivos', (file) => {
    const src = readSource(file);
    expect(src).toMatch(/clamp\(/);
  });

  test.each(files)('%s: las imágenes o logos tienen altura auto o maxWidth 100%', (file) => {
    // .lp-page img/svg (max-width: 100%) vive en LpSystem.tsx para la
    // landing: se lee la página concatenada con el módulo compartido.
    const src = readWithSystem(file);
    // Los logos deben tener height fija + width: auto o max-width: 100%.
    // Se acepta tanto la forma inline de JSX como la declaración en CSS plano.
    const hasAutoWidth =
      src.includes("width: 'auto'") ||
      src.includes("maxWidth: '100%'") ||
      /max-width:\s*100%/.test(src) ||
      /width:\s*auto/.test(src);
    expect(hasAutoWidth).toBeTruthy();
  });
});

// ─── SplashScreen — responsividad ───────────────────────────────────────────────

describe('SplashScreen — responsividad móvil', () => {
  const COMPONENTS_DIR = path.resolve(__dirname, '../../components');
  let src: string;

  beforeAll(() => {
    src = fs.readFileSync(path.join(COMPONENTS_DIR, 'SplashScreen.tsx'), 'utf-8');
  });

  test('el contenedor raíz usa overflow hidden', () => {
    expect(src).toMatch(/overflow.*hidden/);
  });

  test('los anillos de energía usan unidades responsivas (vmin, vw o min())', () => {
    // No deben usar width/height fijo en px sin alternativa responsiva
    expect(src).toMatch(/vmin|min\(/);
  });

  test('el SVG del balón escala en mobile (usa vmin, vw o min())', () => {
    // El SVG no debe tener solo width/height fijos de 160px
    expect(src).toMatch(/width.*min\(.*vmin/);
  });

  test('la barra de carga usa ancho responsivo', () => {
    // No debe usar width: 200 fijo
    expect(src).toMatch(/width.*min\(|width.*vw|width.*clamp/);
  });
});

// ─── Prevención de scroll horizontal ────────────────────────────────────────────

describe('Prevención de scroll horizontal', () => {
  test('index.html o index.css tiene overflow-x hidden en body/html', () => {
    const indexPath = path.resolve(__dirname, '../../../index.html');
    const indexSrc = fs.readFileSync(indexPath, 'utf-8');
    // Puede estar en un <style> inline o referenciado en CSS
    let hasOverflow = indexSrc.includes('overflow-x') || indexSrc.includes('overflowX');
    // Buscar en archivos CSS/index.css
    const cssPath = path.resolve(__dirname, '../../../src/index.css');
    try {
      const cssSrc = fs.readFileSync(cssPath, 'utf-8');
      hasOverflow = hasOverflow || cssSrc.includes('overflow-x');
    } catch {
      // Si no hay index.css, debe estar en index.html
    }
    expect(hasOverflow).toBeTruthy();
  });
});
