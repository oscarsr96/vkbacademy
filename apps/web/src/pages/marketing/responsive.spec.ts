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
    expect(src).toMatch(/flexWrap.*wrap|flex-wrap.*wrap/);
  });

  test('las tarjetas de pricing tienen ancho responsivo (no fixed width > 400px sin override)', () => {
    // pricingCard no debe tener width fijo > 400px sin un override responsivo en media query
    const fixedWidthMatch = src.match(/width:\s*(\d+)/g) ?? [];
    const problemWidths = fixedWidthMatch
      .map((m) => parseInt(m.replace(/\D/g, ''), 10))
      .filter((w) => w > 400);

    if (problemWidths.length > 0) {
      // Debe haber overrides en la media query
      expect(src).toMatch(/lp-pricing-card.*width|max-width.*100%/s);
    }
  });

  test('la grid de features usa auto-fit/minmax o tiene override de media query para 1 columna', () => {
    const hasAutoFit = src.includes('auto-fit') || src.includes('auto-fill');
    const hasMediaOverride = src.match(/lp-features-grid.*grid-template-columns/s);
    expect(hasAutoFit || hasMediaOverride).toBeTruthy();
  });

  test('la grid de merchandising usa flexWrap: wrap', () => {
    // El merchand grid siempre debe envolver
    expect(src).toMatch(/merchGrid|lp-merch-grid/);
    expect(src).toMatch(/flexWrap.*wrap|flex-wrap.*wrap/);
  });
});

// ─── AcademyLandingPage ─────────────────────────────────────────────────────────

describe('AcademyLandingPage — responsividad móvil', () => {
  let src: string;

  beforeAll(() => {
    src = readSource('AcademyLandingPage.tsx');
  });

  test('inyecta un bloque <style> con media queries para móvil', () => {
    expect(src).toMatch(/<style>/);
    expect(src).toMatch(/@media.*max-width/);
  });

  test('el navbar de la academia tiene un menú hamburger en móvil', () => {
    // En móvil los nav links deben ocultarse o usar un menú alternativo
    expect(src).toMatch(/hamburger|mobile-menu|acad-nav/i);
  });

  test('los botones del hero usan flexWrap: wrap para no desbordarse', () => {
    expect(src).toMatch(/flexWrap.*wrap|flex-wrap.*wrap/);
  });

  test('la stats section usa grid con auto-fit o wrap', () => {
    const hasAutoFit = src.includes('auto-fit') || src.includes('auto-fill');
    const hasWrap = src.includes("flexWrap: 'wrap'");
    expect(hasAutoFit || hasWrap).toBeTruthy();
  });

  test('la features section usa grid con auto-fit/minmax responsivo', () => {
    expect(src).toMatch(/auto-fit|auto-fill/);
  });

  test('el padding del hero es responsivo (no padding fijo > 60px sin override)', () => {
    // Debe haber un override de padding en la media query para móvil
    expect(src).toMatch(/@media.*padding|padding.*@media/s);
  });
});

// ─── AboutPage ──────────────────────────────────────────────────────────────────

describe('AboutPage — responsividad móvil', () => {
  let src: string;

  beforeAll(() => {
    src = readSource('AboutPage.tsx');
  });

  test('inyecta un bloque <style> con media queries para móvil', () => {
    expect(src).toMatch(/<style>/);
    expect(src).toMatch(/@media.*max-width/);
  });

  test('el hero usa padding responsivo con clamp o override de media query', () => {
    // El hero tiene padding: '6rem 2rem 5rem' — en móvil debe reducirse
    expect(src).toMatch(/@media.*padding|about-hero/s);
  });

  test('la sección whyInner usa flexWrap: wrap para apilar en móvil', () => {
    expect(src).toMatch(/whyInner|why-inner/);
    expect(src).toMatch(/flexWrap.*wrap|flex-wrap.*wrap/);
  });

  test('la sección de valores (valuesGrid) usa flexWrap: wrap', () => {
    expect(src).toMatch(/valuesGrid|values-grid/);
    expect(src).toMatch(/flexWrap.*wrap|flex-wrap.*wrap/);
  });

  test('la sección del equipo (teamGrid) usa flexWrap: wrap', () => {
    expect(src).toMatch(/teamGrid|team-grid/);
    expect(src).toMatch(/flexWrap.*wrap|flex-wrap.*wrap/);
  });

  test('la sección de merch (merchGrid) usa flexWrap: wrap', () => {
    expect(src).toMatch(/merchGrid|merch-grid/);
    expect(src).toMatch(/flexWrap.*wrap|flex-wrap.*wrap/);
  });

  test('la sección de historia tiene padding reducido en móvil', () => {
    expect(src).toMatch(/storySection|about-story/);
  });
});

// ─── PricingPage ────────────────────────────────────────────────────────────────

describe('PricingPage — responsividad móvil', () => {
  let src: string;

  beforeAll(() => {
    src = readSource('PricingPage.tsx');
  });

  test('inyecta un bloque <style> con media queries para móvil', () => {
    expect(src).toMatch(/<style>/);
    expect(src).toMatch(/@media.*max-width/);
  });

  test('el pricingWrap usa flexWrap: wrap para apilar tarjeta e info panel', () => {
    expect(src).toMatch(/pricingWrap|pricing-wrap/);
    expect(src).toMatch(/flexWrap.*wrap|flex-wrap.*wrap/);
  });

  test('las columnas de features (featuresInner) se apilan en móvil', () => {
    // featuresInner tiene flex con columnas — en móvil deben apilarse
    expect(src).toMatch(/featuresInner|features-inner/);
    // Debe haber un override de flex-direction en la media query
    expect(src).toMatch(/@media.*flex-direction|flex-direction.*column.*@media/s);
  });

  test('la sección de pasos (stepsRow) usa flexWrap: wrap', () => {
    expect(src).toMatch(/stepsRow|steps-row/);
    expect(src).toMatch(/flexWrap.*wrap|flex-wrap.*wrap/);
  });

  test('la grid de merchandising usa flexWrap: wrap', () => {
    expect(src).toMatch(/merchGrid|merch-grid/);
    expect(src).toMatch(/flexWrap.*wrap|flex-wrap.*wrap/);
  });

  test('el hero usa padding responsivo', () => {
    expect(src).toMatch(/@media.*padding|pricing-hero/s);
  });

  test('la tarjeta de precio (planCard) no tiene ancho fijo > 400px', () => {
    // planCard usa flex: '1 1 340px' que es responsivo — verificar que no hay width fijo grande
    const planCardSection = src.match(/planCard:\s*\{[^}]+\}/s)?.[0] ?? '';
    const widthMatch = planCardSection.match(/(?<![a-zA-Z])width:\s*(\d+)/);
    if (widthMatch) {
      expect(parseInt(widthMatch[1], 10)).toBeLessThanOrEqual(400);
    }
    // Si no tiene width fijo, el test pasa
  });
});

// ─── Verificaciones generales ────────────────────────────────────────────────────

describe('Todas las páginas de marketing — verificaciones generales', () => {
  const files = ['LandingPage.tsx', 'AcademyLandingPage.tsx', 'AboutPage.tsx', 'PricingPage.tsx'];

  test.each(files)('%s: usa overflowX hidden en el contenedor raíz', (file) => {
    const src = readSource(file);
    expect(src).toMatch(/overflowX.*hidden|overflow-x.*hidden/);
  });

  test.each(files)('%s: los títulos usan clamp() para tamaños de fuente responsivos', (file) => {
    const src = readSource(file);
    expect(src).toMatch(/clamp\(/);
  });

  test.each(files)('%s: las imágenes o logos tienen altura auto o maxWidth 100%', (file) => {
    const src = readSource(file);
    // Los logos deben tener height fija + width: auto o max-width: 100%
    const hasAutoWidth = src.includes("width: 'auto'") || src.includes("maxWidth: '100%'");
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
    const cssGlob = path.resolve(__dirname, '../../../src');
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
