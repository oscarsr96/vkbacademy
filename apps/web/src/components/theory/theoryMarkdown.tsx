// Render de markdown didáctico del temario: GFM + matemáticas (KaTeX) + callouts
// pedagógicos (tip / recuerda / cuidado / pregunta) detectados a partir de
// blockquotes con emoji al inicio. Compartido por la vista artículo
// (StudyUnitPage) y el modo presentación (TheorySlides).

import type { ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

type CalloutKind = 'tip' | 'remember' | 'warning' | 'question' | 'fence' | 'default';

const CALLOUT_RULES: Array<{ test: RegExp; kind: CalloutKind }> = [
  { test: /^\s*💡/, kind: 'tip' },
  { test: /^\s*🧠/, kind: 'remember' },
  { test: /^\s*⚠️|^\s*⚠/, kind: 'warning' },
  { test: /^\s*❓/, kind: 'question' },
  { test: /^\s*🚧/, kind: 'fence' },
];

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
      {children}
    </ReactMarkdown>
  );
}

/** Estilos de los callouts; se inyectan tanto en el artículo como en el deck. */
export const THEORY_CALLOUT_CSS = `
  .theory-callout {
    margin: 1.1rem 0;
    padding: 14px 16px 14px 52px;
    border-radius: 12px;
    border-left: 4px solid;
    position: relative;
    line-height: 1.55;
    animation: theory-callout-pop 0.45s ease-out backwards;
  }
  .theory-callout > p:first-child { margin-top: 0; }
  .theory-callout > p:last-child  { margin-bottom: 0; }
  .theory-callout::before {
    position: absolute;
    left: 14px;
    top: 12px;
    font-size: 1.4rem;
    line-height: 1;
  }
  .theory-callout-tip       { background: rgba(234,179,8,0.10);  border-left-color: #eab308; }
  .theory-callout-tip::before       { content: '💡'; }
  .theory-callout-remember  { background: rgba(99,102,241,0.10); border-left-color: #6366f1; }
  .theory-callout-remember::before  { content: '🧠'; }
  .theory-callout-warning   { background: rgba(220,38,38,0.10);  border-left-color: #dc2626; }
  .theory-callout-warning::before   { content: '⚠️'; }
  .theory-callout-question  { background: rgba(20,184,166,0.10); border-left-color: #14b8a6; }
  .theory-callout-question::before  { content: '❓'; }
  .theory-callout-fence     { background: var(--brand-soft); border-left-color: var(--brand); }
  .theory-callout-fence::before     { content: '🚧'; }
  .theory-callout-default   {
    background: var(--color-bg);
    border-left-color: var(--color-border);
    padding-left: 16px;
  }
  .theory-callout-default::before { content: ''; }
  @keyframes theory-callout-pop {
    0%   { opacity: 0; transform: scale(0.96); }
    60%  { opacity: 1; transform: scale(1.01); }
    100% { transform: scale(1); }
  }
  @media (prefers-reduced-motion: reduce) {
    .theory-callout { animation: none; }
  }
`;
