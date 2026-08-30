import jsPDF from 'jspdf';

// Paleta desde los tokens de la app (global.css). El naranja ya era el de
// marca, pero el texto salía de una rama de grises cálidos ajena al producto.
const ORANGE = { r: 245, g: 145, b: 30 } as const; // --brand #f5911e
const NAVY = { r: 10, g: 22, b: 40 } as const; // --navy-900 #0a1628
const INK = { r: 22, g: 33, b: 58 } as const; // --color-text #16213a
const MUTED = { r: 100, g: 116, b: 139 } as const; // --color-text-muted #64748b
const SURFACE = { r: 244, g: 245, b: 247 } as const; // --color-bg #f4f5f7
const GREEN = { r: 5, g: 150, b: 105 } as const; // acierto (semántico)
const RED = { r: 220, g: 38, b: 38 } as const; // --color-error #dc2626
const LOGO_URL = '/brand/vkb-logo.png';
const PAGE_W = 210;
const PAGE_H = 297;

interface PdfData {
  courseTitle: string;
  schoolYearLabel: string | null | undefined;
  lessonTitle: string;
  score: number;
  completedAt: Date;
  corrections: {
    questionText: string;
    selectedAnswerText: string;
    isCorrect: boolean;
    correctAnswerText: string;
  }[];
}

function setColor(
  doc: jsPDF,
  target: 'text' | 'draw' | 'fill',
  color: { r: number; g: number; b: number },
) {
  if (target === 'text') doc.setTextColor(color.r, color.g, color.b);
  else if (target === 'draw') doc.setDrawColor(color.r, color.g, color.b);
  else doc.setFillColor(color.r, color.g, color.b);
}

/**
 * Logo del club como data URL. Null si no se puede cargar: el informe sin logo
 * sigue sirviendo, perder la descarga no.
 */
async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch(LOGO_URL);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return `data:image/png;base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}

/**
 * Marca de acierto/fallo dibujada con líneas: '✓' y '✗' no existen en las
 * fuentes estándar de jsPDF y salían impresos como una comilla suelta.
 */
function drawMark(doc: jsPDF, correct: boolean, cx: number, cy: number): void {
  setColor(doc, 'draw', correct ? GREEN : RED);
  doc.setLineWidth(0.9);
  if (correct) {
    doc.line(cx - 2, cy, cx - 0.6, cy + 1.6);
    doc.line(cx - 0.6, cy + 1.6, cx + 2.2, cy - 1.8);
  } else {
    doc.line(cx - 1.8, cy - 1.8, cx + 1.8, cy + 1.8);
    doc.line(cx + 1.8, cy - 1.8, cx - 1.8, cy + 1.8);
  }
}

export async function generateQuizPdf({
  courseTitle,
  schoolYearLabel,
  lessonTitle,
  score,
  completedAt,
  corrections,
}: PdfData) {
  const doc = new jsPDF();
  const margin = 20;
  const contentW = PAGE_W - margin * 2;
  const logo = await loadLogoDataUrl();

  // ── Banda superior ──────────────────────────────────────────────────────────
  setColor(doc, 'fill', NAVY);
  doc.rect(0, 0, PAGE_W, 48, 'F');
  setColor(doc, 'fill', ORANGE);
  doc.rect(0, 48, PAGE_W, 2.5, 'F');

  // Marca: el logo va sobre navy, que es donde se lee
  let brandX = margin;
  if (logo) {
    doc.addImage(logo, 'PNG', margin, 5, 17, 17);
    brandX = margin + 20;
  }
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('VKB ACADEMY', brandX, 15);

  // Nivel educativo (chip redondeado simulado con rect + texto)
  if (schoolYearLabel) {
    const chipX = PAGE_W - margin;
    const chipText = schoolYearLabel.toUpperCase();
    doc.setFontSize(8);
    const chipW = doc.getTextWidth(chipText) + 10;
    setColor(doc, 'fill', ORANGE);
    doc.roundedRect(chipX - chipW, 6, chipW, 10, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(chipText, chipX - chipW / 2, 12.5, { align: 'center' });
  }

  // Nombre del curso (línea 1)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255, 210, 165);
  const courseLine = doc.splitTextToSize(courseTitle, contentW);
  doc.text(courseLine[0], margin, 30);

  // Título lección (línea 2, blanco, grande)
  doc.setFontSize(17);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  const lessonLines = doc.splitTextToSize(lessonTitle, contentW);
  doc.text(lessonLines[0], margin, 41);

  let y = 62;

  // ── Tarjeta de score ────────────────────────────────────────────────────────
  const isPass = score >= 50;
  const scoreColor = isPass ? GREEN : RED;
  const scoreBg = isPass
    ? { r: 209, g: 250, b: 229 } // verde muy claro
    : { r: 254, g: 226, b: 226 }; // rojo muy claro

  setColor(doc, 'fill', scoreBg);
  doc.roundedRect(margin, y, contentW, 28, 4, 4, 'F');
  setColor(doc, 'draw', scoreColor);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, y, contentW, 28, 4, 4, 'D');

  // Puntuación grande
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  setColor(doc, 'text', scoreColor);
  doc.text(`${score.toFixed(1)}%`, margin + 8, y + 18);

  // Etiqueta resultado
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(isPass ? 'APROBADO' : 'SUSPENSO', margin + 8, y + 25.5);

  // Correctas / total (alineado derecha)
  const correct = corrections.filter((c) => c.isCorrect).length;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  setColor(doc, 'text', MUTED);
  doc.text(
    `${correct} de ${corrections.length} preguntas correctas`,
    PAGE_W - margin - 4,
    y + 18,
    { align: 'right' },
  );

  // Fecha (alineada derecha, debajo)
  doc.setFontSize(9);
  doc.text(
    completedAt.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }),
    PAGE_W - margin - 4,
    y + 25.5,
    { align: 'right' },
  );

  y += 38;

  // ── Separador naranja fino ──────────────────────────────────────────────────
  setColor(doc, 'draw', ORANGE);
  doc.setLineWidth(1);
  doc.line(margin, y, PAGE_W - margin, y);
  y += 8;

  // ── Cabecera sección correcciones ───────────────────────────────────────────
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  setColor(doc, 'text', ORANGE);
  doc.text('Revisión pregunta a pregunta', margin, y);
  y += 10;

  // ── Correcciones ────────────────────────────────────────────────────────────
  corrections.forEach((c, i) => {
    // Estimación de altura necesaria (mínimo 28 px por bloque)
    const questionLines = doc.splitTextToSize(`${i + 1}. ${c.questionText}`, contentW - 14);
    const blockH = questionLines.length * 6 + (c.isCorrect ? 14 : 20);

    if (y + blockH > PAGE_H - 16) {
      doc.addPage();
      y = margin;
    }

    // Fondo de la pregunta
    // El fallo iba en naranja claro: con la paleta nueva el naranja es el color
    // de marca, así que un error parecía destacado en vez de erróneo. Rojo, como
    // en el informe de examen.
    const bgColor = c.isCorrect ? { r: 240, g: 253, b: 244 } : { r: 255, g: 241, b: 242 };
    setColor(doc, 'fill', bgColor);
    doc.roundedRect(margin, y - 4, contentW, blockH, 3, 3, 'F');

    // Indicador de color izquierdo
    setColor(doc, 'fill', c.isCorrect ? GREEN : RED);
    doc.rect(margin, y - 4, 3, blockH, 'F');

    // Marca de acierto/fallo, dibujada (ver drawMark)
    drawMark(doc, c.isCorrect, margin + 8, y);

    // Texto pregunta
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    setColor(doc, 'text', INK);
    doc.text(questionLines, margin + 14, y + 2);
    y += questionLines.length * 6 + 3;

    // Tu respuesta
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    setColor(doc, 'text', MUTED);
    doc.text(`Tu respuesta: "${c.selectedAnswerText}"`, margin + 14, y);
    y += 5.5;

    // Respuesta correcta (solo si falló)
    if (!c.isCorrect) {
      setColor(doc, 'text', GREEN);
      doc.setFont('helvetica', 'bold');
      doc.text(`Correcta: "${c.correctAnswerText}"`, margin + 14, y);
      y += 5.5;
    }

    y += 7; // separación entre bloques
  });

  // ── Pie de página ───────────────────────────────────────────────────────────
  const totalPages = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    setColor(doc, 'fill', SURFACE);
    doc.rect(0, PAGE_H - 12, PAGE_W, 12, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    setColor(doc, 'text', MUTED);
    doc.text('VKB Academy — Informe de test', margin, PAGE_H - 4.5);
    doc.text(`Página ${p} de ${totalPages}`, PAGE_W - margin, PAGE_H - 4.5, { align: 'right' });
  }

  const filename = `quiz-${lessonTitle.replace(/\s+/g, '-').toLowerCase()}-${completedAt.toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
