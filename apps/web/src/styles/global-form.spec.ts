/**
 * Tests de UX móvil para los selects (`<select>`) del formulario común
 * `.field select` declarado en `global.css`.
 *
 * Bug evitado: en iOS Safari, cualquier input/select con `font-size < 16px`
 * provoca un zoom automático cuando el usuario hace focus. Esto rompe la
 * experiencia en móvil cuando el alumno elige curso en Teoría/Ejercicios/Examen.
 * Ver: https://stackoverflow.com/q/2989263 (zoom on focus de iOS).
 *
 * Estrategia: parsear `global.css` y comprobar que el font-size efectivo del
 * `.field select` cumple `>= 16px` (universal o vía media query móvil).
 */

import * as fs from 'fs';
import * as path from 'path';

const CSS_PATH = path.resolve(__dirname, './global.css');

function readCss(): string {
  return fs.readFileSync(CSS_PATH, 'utf-8');
}

function pxFromValue(value: string): number | null {
  // Acepta "16px" → 16, "1rem" → 16, "0.9375rem" → 15
  const trimmed = value.trim();
  const px = trimmed.match(/^(\d+(?:\.\d+)?)\s*px$/);
  if (px) return parseFloat(px[1]);
  const rem = trimmed.match(/^(\d+(?:\.\d+)?)\s*rem$/);
  if (rem) return parseFloat(rem[1]) * 16;
  return null;
}

function findRuleFontSize(css: string, selectorRegex: RegExp): number | null {
  const ruleMatch = css.match(new RegExp(`${selectorRegex.source}\\s*\\{([^}]*)\\}`, 'm'));
  if (!ruleMatch) return null;
  const body = ruleMatch[1];
  const fs = body.match(/font-size:\s*([^;]+);/);
  if (!fs) return null;
  return pxFromValue(fs[1]);
}

describe('global.css — UX de `<select>` en móvil', () => {
  let css: string;

  beforeAll(() => {
    css = readCss();
  });

  test('el `.field select` tiene font-size >= 16px (evita zoom de iOS al hacer focus)', () => {
    // Tomamos el font-size declarado en la regla compartida
    // `.field input, .field select, .field textarea`
    // o en una regla más específica para `.field select`.
    const sharedFs = findRuleFontSize(
      css,
      /\.field\s+input,\s*\.field\s+select,\s*\.field\s+textarea/,
    );
    const selectFs = findRuleFontSize(css, /\.field\s+select/);

    // El `<select>` puede heredar de la regla compartida o tener una propia.
    // Cogemos el más específico si existe.
    const effectiveFs = selectFs ?? sharedFs;

    expect(effectiveFs).not.toBeNull();
    expect(effectiveFs!).toBeGreaterThanOrEqual(16);
  });
});
