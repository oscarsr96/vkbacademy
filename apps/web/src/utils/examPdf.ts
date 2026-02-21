import jsPDF from 'jspdf';
import type { ExamAttemptResult } from '@vkbacademy/shared';

// Paleta del club
const PURPLE = { r: 99, g: 102, b: 241 } as const;  // #6366f1 — color primario
const DARK   = { r: 30,  g: 27,  b: 24  } as const;
const MUTED  = { r: 120, g: 113, b: 108 } as const;
const GREEN  = { r: 5,   g: 150, b: 105 } as const;
const RED    = { r: 220, g: 38,  b: 38  } as const;
const PAGE_W = 210;
const PAGE_H = 297;

function setColor(
  doc: jsPDF,
  target: 'text' | 'draw' | 'fill',
  color: { r: number; g: number; b: number },
) {
  if (target === 'text') doc.setTextColor(color.r, color.g, color.b);
  else if (target === 'draw') doc.setDrawColor(color.r, color.g, color.b);
  else doc.setFillColor(color.r, color.g, color.b);
}

export function downloadExamPdf(
  result: ExamAttemptResult,
  scopeTitle: string,
) {
  const doc = new jsPDF();
  const margin = 20;
  const contentW = PAGE_W - margin * 2;
  const completedAt = new Date(result.submittedAt);

  // ── Banda morada superior ─────────────────────────────────────────────────
  setColor(doc, 'fill', PURPLE);
  doc.rect(0, 0, PAGE_W, 48, 'F');

  // Etiqueta superior
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('VKB ACADEMY', margin, 11);

  // Chip "EXAMEN" (esquina derecha)
  const chipText = 'EXAMEN';
  doc.setFontSize(8);
  const chipW = doc.getTextWidth(chipText) + 10;
  const chipX = PAGE_W - margin;
  setColor(doc, 'fill', { r: 255, g: 255, b: 255 });
  doc.roundedRect(chipX - chipW, 5, chipW, 10, 2, 2, 'F');
  setColor(doc, 'text', PURPLE);
  doc.setFont('helvetica', 'bold');
  doc.text(chipText, chipX - chipW / 2, 11.5, { align: 'center' });

  // Subtítulo (scope)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(199, 210, 254); // índigo claro
  const scopeLines = doc.splitTextToSize(scopeTitle, contentW);
  doc.text(scopeLines[0], margin, 24);

  // Título
  doc.setFontSize(17);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Resultado del Examen', margin, 36);

  let y = 62;

  // ── Tarjeta de score ───────────────────────────────────────────────────────
  const isPass = result.score >= 50;
  const scoreColor = isPass ? GREEN : RED;
  const scoreBg = isPass
    ? { r: 209, g: 250, b: 229 }  // verde muy claro
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
  doc.text(`${result.score.toFixed(1)}%`, margin + 8, y + 18);

  // Etiqueta resultado
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(isPass ? 'APROBADO' : 'SUSPENSO', margin + 8, y + 25.5);

  // Correctas / total (alineado derecha)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  setColor(doc, 'text', MUTED);
  doc.text(
    `${result.correctCount} de ${result.numQuestions} preguntas correctas`,
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

  // ── Separador fino ─────────────────────────────────────────────────────────
  setColor(doc, 'draw', PURPLE);
  doc.setLineWidth(1);
  doc.line(margin, y, PAGE_W - margin, y);
  y += 8;

  // ── Cabecera sección correcciones ──────────────────────────────────────────
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  setColor(doc, 'text', PURPLE);
  doc.text('Revisión pregunta a pregunta', margin, y);
  y += 10;

  // ── Correcciones ───────────────────────────────────────────────────────────
  result.corrections.forEach((c, i) => {
    const questionLines = doc.splitTextToSize(`${i + 1}. ${c.questionText}`, contentW - 14);
    const blockH = questionLines.length * 6 + (c.isCorrect ? 14 : 20);

    if (y + blockH > PAGE_H - 16) {
      doc.addPage();
      y = margin;
    }

    // Fondo del bloque
    const bgColor = c.isCorrect
      ? { r: 240, g: 253, b: 244 }
      : { r: 255, g: 241, b: 242 };
    setColor(doc, 'fill', bgColor);
    doc.roundedRect(margin, y - 4, contentW, blockH, 3, 3, 'F');

    // Barra lateral de color
    setColor(doc, 'fill', c.isCorrect ? GREEN : RED);
    doc.rect(margin, y - 4, 3, blockH, 'F');

    // Icono
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    setColor(doc, 'text', c.isCorrect ? GREEN : RED);
    doc.text(c.isCorrect ? '✓' : '✗', margin + 6, y + 2);

    // Texto pregunta
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    setColor(doc, 'text', DARK);
    doc.text(questionLines, margin + 14, y + 2);
    y += questionLines.length * 6 + 3;

    // Tu respuesta
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    setColor(doc, 'text', MUTED);
    const selectedText = c.selectedAnswerText ?? '(sin respuesta)';
    doc.text(`Tu respuesta: "${selectedText}"`, margin + 14, y);
    y += 5.5;

    // Respuesta correcta (solo si falló)
    if (!c.isCorrect) {
      setColor(doc, 'text', GREEN);
      doc.setFont('helvetica', 'bold');
      doc.text(`Correcta: "${c.correctAnswerText}"`, margin + 14, y);
      y += 5.5;
    }

    y += 7;
  });

  // ── Pie de página ──────────────────────────────────────────────────────────
  const totalPages = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    setColor(doc, 'fill', { r: 245, g: 245, b: 244 });
    doc.rect(0, PAGE_H - 12, PAGE_W, 12, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    setColor(doc, 'text', MUTED);
    doc.text('VKB Academy — Informe de examen', margin, PAGE_H - 4.5);
    doc.text(`Página ${p} de ${totalPages}`, PAGE_W - margin, PAGE_H - 4.5, { align: 'right' });
  }

  const filename = `examen-${scopeTitle.replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9-]/g, '')}-${completedAt.toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
