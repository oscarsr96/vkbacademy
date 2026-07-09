// Renderiza un string que puede mezclar texto normal con fórmulas LaTeX:
// $...$ (inline) y $$...$$ (bloque). Los enunciados, opciones y explicaciones
// generados por la IA llegan como strings planos con esa notación.
// Un "$" sin pareja NO es matemática: se muestra literal. No se soporta el
// escape "\$" (los generadores no lo emiten). El inline usa la convención
// estándar de LaTeX (p. ej. Markdown/MathJax): el contenido no puede empezar
// ni terminar en espacio y el "$" de cierre no puede ir seguido de un dígito,
// para no confundir precios como "cuesta $5 y $10" con una fórmula.

import { Fragment } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

type Segment =
  | { type: 'text'; value: string }
  | { type: 'math'; tex: string; display: boolean; raw: string };

// Primero se extraen los bloques $$...$$; después, los $...$ inline dentro de
// los tramos de texto restantes (sin cruzar saltos de línea).
const BLOCK_RE = /\$\$([^$]+)\$\$/;
const INLINE_RE = /\$([^\s$\n](?:[^$\n]*[^\s$\n])?)\$(?!\d)/;

function splitBy(input: string, pattern: RegExp, display: boolean): Segment[] {
  const re = new RegExp(pattern.source, 'g');
  const segments: Segment[] = [];
  let last = 0;
  for (let m = re.exec(input); m !== null; m = re.exec(input)) {
    if (m.index > last) segments.push({ type: 'text', value: input.slice(last, m.index) });
    segments.push({ type: 'math', tex: m[1], display, raw: m[0] });
    last = m.index + m[0].length;
  }
  if (last < input.length) segments.push({ type: 'text', value: input.slice(last) });
  return segments;
}

function parseSegments(input: string): Segment[] {
  return splitBy(input, BLOCK_RE, true).flatMap((seg) =>
    seg.type === 'text' ? splitBy(seg.value, INLINE_RE, false) : [seg],
  );
}

// La salida de katex.renderToString con la configuración por defecto
// (trust: false) es HTML seguro; el innerHTML se limita a estos spans y el
// texto normal nunca pasa por él.
function MathSpan({ seg }: { seg: Extract<Segment, { type: 'math' }> }) {
  try {
    const html = katex.renderToString(seg.tex, {
      throwOnError: false,
      displayMode: seg.display,
    });
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  } catch {
    return <>{seg.raw}</>;
  }
}

export default function MathText({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  // Sin "$" el render es idéntico al texto plano de siempre (passthrough).
  if (!children.includes('$')) {
    return className ? <span className={className}>{children}</span> : <>{children}</>;
  }
  const nodes = parseSegments(children).map((seg, i) =>
    seg.type === 'text' ? <Fragment key={i}>{seg.value}</Fragment> : <MathSpan key={i} seg={seg} />,
  );
  return className ? <span className={className}>{nodes}</span> : <>{nodes}</>;
}
