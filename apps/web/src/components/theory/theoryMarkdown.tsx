// Render de markdown didáctico del temario: GFM + matemáticas (KaTeX) + callouts
// pedagógicos (tip / recuerda / cuidado / pregunta) detectados a partir de
// blockquotes con emoji al inicio. Compartido por la vista artículo
// (TheoryView) y el modo presentación (TheorySlides).

import type { ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

type CalloutKind = 'tip' | 'remember' | 'warning' | 'question' | 'fence' | 'default';

// La IA marca cada callout con un emoji inicial; el emoji se elimina del render
// (las slides van sin emoticonos) y el tipo se detecta por la etiqueta en texto.
// Se conservan las reglas por emoji como respaldo (p. ej. emojis en medio de frase).
const CALLOUT_RULES: Array<{ test: RegExp; kind: CalloutKind }> = [
  { test: /^\s*💡/, kind: 'tip' },
  { test: /^\s*🧠/, kind: 'remember' },
  { test: /^\s*⚠️|^\s*⚠/, kind: 'warning' },
  { test: /^\s*❓/, kind: 'question' },
  { test: /^\s*🚧/, kind: 'fence' },
  { test: /^\s*Tip\b/i, kind: 'tip' },
  { test: /^\s*Recuerda/i, kind: 'remember' },
  { test: /^\s*Cuidado/i, kind: 'warning' },
  { test: /^\s*Pregunta/i, kind: 'question' },
  { test: /^\s*Esto S[IÍ]/i, kind: 'fence' },
];

/** Quita los emojis con los que la IA abre los callouts (líneas "> 💡 ..."). */
const CALLOUT_EMOJI_RE = /^(\s*>\s*)(?:[\p{Extended_Pictographic}\u{FE0F}\u{200D}]+\s*)/gmu;

function stripCalloutEmojis(md: string): string {
  return md.replace(CALLOUT_EMOJI_RE, '$1');
}

function flattenText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join('');
  if (typeof node === 'object' && 'props' in node) {
    return flattenText((node as { props: { children?: ReactNode } }).props.children);
  }
  return '';
}

function detectCalloutKind(text: string): CalloutKind {
  for (const rule of CALLOUT_RULES) {
    if (rule.test.test(text)) return rule.kind;
  }
  return 'default';
}

export const MARKDOWN_COMPONENTS: Components = {
  blockquote: ({ children }) => {
    const kind = detectCalloutKind(flattenText(children));
    return <aside className={`theory-callout theory-callout-${kind}`}>{children}</aside>;
  },
};

/** Render de un fragmento de markdown del temario (negritas, listas, LaTeX, callouts). */
export function TheoryMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={MARKDOWN_COMPONENTS}
    >
      {stripCalloutEmojis(children)}
    </ReactMarkdown>
  );
}

/** Estilos de los callouts; se inyectan tanto en el artículo como en el deck. */
export const THEORY_CALLOUT_CSS = `
  .theory-callout {
    margin: 1.1rem 0;
    padding: 14px 18px;
    border-radius: 12px;
    border-left: 4px solid;
    line-height: 1.55;
    animation: theory-callout-pop 0.45s ease-out backwards;
  }
  .theory-callout > p:first-child { margin-top: 0; }
  .theory-callout > p:last-child  { margin-bottom: 0; }
  .theory-callout-tip       { background: rgba(234,179,8,0.10);  border-left-color: #eab308; }
  .theory-callout-remember  { background: rgba(99,102,241,0.10); border-left-color: #6366f1; }
  .theory-callout-warning   { background: rgba(220,38,38,0.10);  border-left-color: #dc2626; }
  .theory-callout-question  { background: rgba(20,184,166,0.10); border-left-color: #14b8a6; }
  .theory-callout-fence     { background: var(--brand-soft); border-left-color: var(--brand); }
  .theory-callout-default   {
    background: var(--color-bg);
    border-left-color: var(--color-border);
  }
  @keyframes theory-callout-pop {
    0%   { opacity: 0; transform: scale(0.96); }
    60%  { opacity: 1; transform: scale(1.01); }
    100% { transform: scale(1); }
  }
  @media (prefers-reduced-motion: reduce) {
    .theory-callout { animation: none; }
  }
`;
