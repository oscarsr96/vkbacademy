// Tests del render mixto texto + LaTeX de MathText: passthrough sin "$",
// inline $...$, bloque $$...$$, "$" suelto literal y degradación a texto
// crudo si katex lanza.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import katex from 'katex';
import MathText from './MathText';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('MathText', () => {
  it('texto sin "$" se renderiza tal cual (passthrough)', () => {
    const { container } = render(
      <p>
        <MathText>Resuelve la ecuación de segundo grado</MathText>
      </p>,
    );
    expect(container.textContent).toBe('Resuelve la ecuación de segundo grado');
    expect(container.querySelector('.katex')).toBeNull();
  });

  it('renderiza $...$ inline con KaTeX y conserva el texto de alrededor', () => {
    const { container } = render(
      <MathText>{'Calcula $\\frac{1}{2} + \\frac{1}{3}$ y simplifica'}</MathText>,
    );
    expect(container.querySelector('.katex')).not.toBeNull();
    expect(container.textContent).toContain('Calcula ');
    expect(container.textContent).toContain(' y simplifica');
  });

  it('renderiza $$...$$ como bloque (katex-display)', () => {
    const { container } = render(<MathText>{'Fórmula general: $$x = \\frac{-b}{2a}$$'}</MathText>);
    expect(container.querySelector('.katex-display')).not.toBeNull();
    expect(container.textContent).toContain('Fórmula general: ');
  });

  it('un "$" sin pareja se muestra literal', () => {
    const { container } = render(<MathText>El billete cuesta 5$ en total</MathText>);
    expect(container.textContent).toBe('El billete cuesta 5$ en total');
    expect(container.querySelector('.katex')).toBeNull();
  });

  it('LaTeX inválido no lanza (throwOnError: false)', () => {
    expect(() => render(<MathText>{'Mal formado: $\\frac{$'}</MathText>)).not.toThrow();
  });

  it('si katex lanza pese a todo, degrada al texto crudo con sus "$"', () => {
    vi.spyOn(katex, 'renderToString').mockImplementation(() => {
      throw new Error('boom');
    });
    const { container } = render(<MathText>{'Antes $\\frac{1}{2}$ después'}</MathText>);
    expect(container.textContent).toBe('Antes $\\frac{1}{2}$ después');
  });
});
