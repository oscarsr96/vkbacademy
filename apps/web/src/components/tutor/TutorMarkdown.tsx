import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

/**
 * Render de una respuesta del tutor: Markdown ligero (negritas, listas) y
 * fórmulas LaTeX entre $…$. Mismo stack que la teoría, sin callouts. Sirve
 * también para el texto en streaming: un `$` sin cerrar se pinta literal.
 */
export default function TutorMarkdown({ children }: { children: string }) {
  return (
    <div className="tutor-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
