// Exportación del temario a PDF (una imagen por diapositiva, fidelidad visual
// total: fórmulas KaTeX, colores y diseño VKB) y compartición por WhatsApp.
//
// Estrategia: se renderiza un árbol React con TODAS las slides a tamaño fijo en
// un contenedor fuera de pantalla, se captura cada página con html2canvas y se
// componen en un jsPDF con páginas 16:9. Reutiliza SlideView (mismo render que
// el deck) para no duplicar el diseño.

import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type JsPdf from 'jspdf';
import type { TheoryModuleWithLessons } from '@vkbacademy/shared';
import { buildSlides, type Slide } from './theorySlides';
import { SlideView } from '../components/theory/SlideView';
import { TSLIDES_CSS } from '../components/theory/TheorySlides';
import { THEORY_CALLOUT_CSS } from '../components/theory/theoryMarkdown';

const PAGE_W = 1280;
const PAGE_H = 720;

// Footer de marca VKB, dibujado con jsPDF sobre cada página (independiente del
// escalado del contenido, así aparece siempre y sin recortes).
const FOOTER_MARGIN = 64;
const FOOTER_BASELINE = PAGE_H - 26; // línea de texto del pie
const ORANGE = { r: 245, g: 145, b: 30 } as const; // #f5911e
const FOOTER_MUTED = { r: 148, g: 163, b: 184 } as const; // slate-400, legible sobre fondo oscuro

function drawFooter(doc: JsPdf, pageNum: number, totalPages: number): void {
  // Línea fina naranja separando el pie del contenido
  doc.setDrawColor(ORANGE.r, ORANGE.g, ORANGE.b);
  doc.setLineWidth(1.5);
  doc.line(FOOTER_MARGIN, PAGE_H - 46, PAGE_W - FOOTER_MARGIN, PAGE_H - 46);

  // Marca (izquierda)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(ORANGE.r, ORANGE.g, ORANGE.b);
  doc.text('VKB ACADEMY', FOOTER_MARGIN, FOOTER_BASELINE);

  const brandW = doc.getTextWidth('VKB ACADEMY');
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(FOOTER_MUTED.r, FOOTER_MUTED.g, FOOTER_MUTED.b);
  doc.text('· Temario', FOOTER_MARGIN + brandW + 10, FOOTER_BASELINE);

  // Numeración de página (derecha)
  doc.text(`${pageNum} / ${totalPages}`, PAGE_W - FOOTER_MARGIN, FOOTER_BASELINE, {
    align: 'right',
  });
}

const PAGE_STYLE: React.CSSProperties = {
  width: PAGE_W,
  height: PAGE_H,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '56px 80px',
  boxSizing: 'border-box',
  overflow: 'hidden',
  color: '#fff',
  background:
    'radial-gradient(120% 80% at 50% -10%, rgba(245,145,30,0.22), transparent 60%), linear-gradient(180deg, #080e1a 0%, #0d1b2a 60%, #152233 100%)',
};

// html2canvas no ejecuta animaciones CSS y no soporta background-clip:text.
// Para el PDF: desactivamos animaciones/transiciones (callouts y fragmentos
// quedarían en opacidad 0), forzamos todo visible y damos color sólido al
// título de portada (el degradado-sobre-texto saldría como una caja).
const PDF_OVERRIDE_CSS = `
  .tslides-pdf-page *,
  .tslides-pdf-page *::before,
  .tslides-pdf-page *::after {
    animation: none !important;
    transition: none !important;
  }
  .tslides-pdf-page .theory-callout,
  .tslides-pdf-page .tslides-frag {
    opacity: 1 !important;
    transform: none !important;
  }
  .tslides-pdf-page .tsl-cover-title {
    background: none !important;
    -webkit-text-fill-color: #fff !important;
    color: #fff !important;
  }
`;

function PdfPages({ slides }: { slides: Slide[] }) {
  return createElement(
    'div',
    null,
    createElement('style', null, TSLIDES_CSS + THEORY_CALLOUT_CSS + PDF_OVERRIDE_CSS),
    ...slides.map((slide) =>
      createElement(
        'div',
        { key: slide.id, className: 'tslides-pdf-page', style: PAGE_STYLE },
        createElement(
          'div',
          { className: 'tslides-inner', style: { width: '100%', maxWidth: 1080 } },
          createElement(SlideView, { slide, revealed: Number.MAX_SAFE_INTEGER, forPdf: true }),
        ),
      ),
    ),
  );
}

/** Renderiza las slides fuera de pantalla y genera el documento PDF. */
async function generateTheoryPdf(module: TheoryModuleWithLessons): Promise<JsPdf> {
  // Carga diferida: html2canvas/jsPDF solo se descargan al exportar (no en el bundle inicial).
  const [{ default: JsPDFCtor }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);

  const slides = buildSlides(module);

  const host = document.createElement('div');
  host.className = 'tslides';
  host.setAttribute('aria-hidden', 'true');
  Object.assign(host.style, {
    position: 'fixed',
    left: '-99999px',
    top: '0',
    width: `${PAGE_W}px`,
    display: 'block',
    background: '#0d1b2a',
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.appendChild(host);

  const root = createRoot(host);
  root.render(createElement(PdfPages, { slides }));

  // Esperar a que carguen fuentes (incl. KaTeX) y a que React pinte el markdown.
  try {
    await document.fonts.ready;
  } catch {
    /* fonts.ready no soportado: continuar */
  }
  await new Promise((resolve) => setTimeout(resolve, 400));

  const pages = Array.from(host.querySelectorAll<HTMLElement>('.tslides-pdf-page'));
  const doc = new JsPDFCtor({ orientation: 'landscape', unit: 'px', format: [PAGE_W, PAGE_H] });

  try {
    for (let i = 0; i < pages.length; i++) {
      // Escalar el contenido para que no se recorte en la página (no hay scroll en PDF).
      const inner = pages[i].querySelector<HTMLElement>('.tslides-inner');
      if (inner) {
        const availH = PAGE_H - 112; // padding vertical (56 × 2)
        const availW = PAGE_W - 160; // padding horizontal (80 × 2)
        const scale = Math.min(1, availH / inner.scrollHeight, availW / inner.scrollWidth);
        inner.style.transform = scale < 1 ? `scale(${scale})` : '';
      }
      const canvas = await html2canvas(pages[i], {
        scale: 2,
        backgroundColor: '#0d1b2a',
        useCORS: true,
        logging: false,
        windowWidth: PAGE_W,
        windowHeight: PAGE_H,
      });
      const img = canvas.toDataURL('image/jpeg', 0.92);
      if (i > 0) doc.addPage([PAGE_W, PAGE_H], 'landscape');
      doc.addImage(img, 'JPEG', 0, 0, PAGE_W, PAGE_H);
      drawFooter(doc, i + 1, pages.length);
    }
  } finally {
    root.unmount();
    host.remove();
  }

  return doc;
}

/** Nombre de fichero seguro a partir del título del temario. */
export function theoryPdfFilename(module: TheoryModuleWithLessons): string {
  const base =
    (module.title || module.topic || 'temario')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'temario';
  return `temario-${base}.pdf`;
}

/** Genera y descarga el PDF del temario. */
export async function downloadTheoryPdf(module: TheoryModuleWithLessons): Promise<void> {
  const doc = await generateTheoryPdf(module);
  doc.save(theoryPdfFilename(module));
}

type ShareResult = 'shared' | 'downloaded';

/**
 * Comparte el PDF. En móvil usa la Web Share API con el archivo adjunto (el
 * usuario elige WhatsApp y se envía el PDF real). En desktop u otros casos cae
 * a descargar el PDF y abrir WhatsApp con un mensaje para adjuntarlo a mano.
 */
export async function shareTheoryPdf(module: TheoryModuleWithLessons): Promise<ShareResult> {
  const doc = await generateTheoryPdf(module);
  const filename = theoryPdfFilename(module);
  const blob = doc.output('blob');
  const file = new File([blob], filename, { type: 'application/pdf' });

  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
  };

  if (nav.canShare?.({ files: [file] }) && typeof nav.share === 'function') {
    try {
      await nav.share({
        files: [file],
        title: module.title,
        text: `Temario VKB: ${module.title}`,
      });
      return 'shared';
    } catch (err) {
      // El usuario canceló el diálogo de compartir: no es un error.
      if (err instanceof DOMException && err.name === 'AbortError') return 'shared';
      // Cualquier otro fallo: caer a descarga.
    }
  }

  doc.save(filename);
  window.open(
    `https://wa.me/?text=${encodeURIComponent(`Temario VKB: ${module.title}`)}`,
    '_blank',
    'noopener',
  );
  return 'downloaded';
}
