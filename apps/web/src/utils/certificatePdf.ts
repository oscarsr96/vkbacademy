import jsPDF from 'jspdf';
import type { Certificate } from '@vkbacademy/shared';

// Paleta del club (mismas constantes que examPdf.ts)
const PURPLE = { r: 99, g: 102, b: 241 } as const;  // #6366f1 — color primario
const GOLD   = { r: 202, g: 138, b: 4   } as const;  // dorado para certificados
const DARK   = { r: 30,  g: 27,  b: 24  } as const;
const MUTED  = { r: 120, g: 113, b: 108 } as const;
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

const TYPE_LABELS: Record<string, string> = {
  MODULE_COMPLETION: 'Certificado de Módulo Completado',
  COURSE_COMPLETION: 'Certificado de Curso Completado',
  MODULE_EXAM:  'Certificado de Examen de Módulo',
  COURSE_EXAM:  'Certificado de Examen de Curso',
};

export function downloadCertificatePdf(cert: Certificate) {
  const doc = new jsPDF();
  const margin = 20;
  const contentW = PAGE_W - margin * 2;
  const issuedAt = new Date(cert.issuedAt);

  // ── Banda morada superior ──────────────────────────────────────────────────
  setColor(doc, 'fill', PURPLE);
  doc.rect(0, 0, PAGE_W, 52, 'F');

  // Logo / marca
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('VKB ACADEMY', margin, 11);

  // Chip tipo de certificado (esquina derecha)
  const chipText = '📜 CERTIFICADO';
  doc.setFontSize(8);
  const chipW = doc.getTextWidth(chipText) + 12;
  const chipX = PAGE_W - margin;
  setColor(doc, 'fill', { r: 255, g: 255, b: 255 });
  doc.roundedRect(chipX - chipW, 5, chipW, 10, 2, 2, 'F');
  setColor(doc, 'text', PURPLE);
  doc.setFont('helvetica', 'bold');
  doc.text(chipText, chipX - chipW / 2, 11.5, { align: 'center' });

  // Subtítulo
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(199, 210, 254);
  doc.text(TYPE_LABELS[cert.type] ?? cert.type, margin, 24);

  // Título principal
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Certificado Digital', margin, 40);

  // ── Cuerpo del certificado ─────────────────────────────────────────────────
  let y = 72;

  // "Se certifica que"
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  setColor(doc, 'text', MUTED);
  doc.text('Se certifica que', PAGE_W / 2, y, { align: 'center' });
  y += 12;

  // Nombre del alumno en grande
  doc.setFontSize(26);
  doc.setFont('helvetica', 'bold');
  setColor(doc, 'text', DARK);
  doc.text(cert.recipientName, PAGE_W / 2, y, { align: 'center' });
  y += 14;

  // Línea decorativa debajo del nombre
  setColor(doc, 'draw', GOLD);
  doc.setLineWidth(1.5);
  const nameW = Math.min(doc.getTextWidth(cert.recipientName), contentW);
  doc.line(PAGE_W / 2 - nameW / 2, y, PAGE_W / 2 + nameW / 2, y);
  y += 14;

  // Texto del logro
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  setColor(doc, 'text', MUTED);

  let achievementText = '';
  if (cert.type === 'MODULE_COMPLETION') {
    achievementText = 'ha completado satisfactoriamente todas las lecciones del módulo';
  } else if (cert.type === 'COURSE_COMPLETION') {
    achievementText = 'ha completado satisfactoriamente todas las lecciones del curso';
  } else if (cert.type === 'MODULE_EXAM') {
    achievementText = 'ha superado el examen del módulo con una puntuación de';
  } else if (cert.type === 'COURSE_EXAM') {
    achievementText = 'ha superado el examen del curso con una puntuación de';
  }

  doc.text(achievementText, PAGE_W / 2, y, { align: 'center' });
  y += 12;

  // Score (si aplica)
  if (cert.examScore !== null && cert.examScore !== undefined) {
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    setColor(doc, 'text', PURPLE);
    doc.text(`${cert.examScore.toFixed(1)}%`, PAGE_W / 2, y, { align: 'center' });
    y += 16;
  }

  // ── Nombre del módulo/curso ─────────────────────────────────────────────────
  const scopeLines = doc.splitTextToSize(`"${cert.scopeTitle}"`, contentW - 20);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  setColor(doc, 'text', DARK);
  doc.text(scopeLines, PAGE_W / 2, y, { align: 'center' });
  y += scopeLines.length * 9;

  // Curso padre (si el certificado es de módulo)
  if (cert.courseTitle) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    setColor(doc, 'text', MUTED);
    doc.text(`Parte del curso: ${cert.courseTitle}`, PAGE_W / 2, y, { align: 'center' });
    y += 10;
  }

  y += 10;

  // ── Fecha de emisión ────────────────────────────────────────────────────────
  const fechaStr = issuedAt.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  setColor(doc, 'text', MUTED);
  doc.text(`Emitido el ${fechaStr}`, PAGE_W / 2, y, { align: 'center' });
  y += 24;

  // ── Sello decorativo (círculo dorado) ──────────────────────────────────────
  setColor(doc, 'draw', GOLD);
  doc.setLineWidth(2);
  doc.circle(PAGE_W / 2, y, 18, 'D');
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  setColor(doc, 'text', GOLD);
  doc.text('🏅', PAGE_W / 2, y + 4, { align: 'center' });
  y += 28;

  // ── Código de verificación ─────────────────────────────────────────────────
  setColor(doc, 'fill', { r: 245, g: 243, b: 255 });
  doc.roundedRect(margin, y, contentW, 22, 4, 4, 'F');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  setColor(doc, 'text', MUTED);
  doc.text('Código de verificación', margin + contentW / 2, y + 7, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  setColor(doc, 'text', PURPLE);
  doc.text(cert.verifyCode, margin + contentW / 2, y + 16, { align: 'center' });

  // ── Pie de página ──────────────────────────────────────────────────────────
  setColor(doc, 'fill', { r: 245, g: 245, b: 244 });
  doc.rect(0, PAGE_H - 12, PAGE_W, 12, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  setColor(doc, 'text', MUTED);
  doc.text('VKB Academy — Certificado Digital', margin, PAGE_H - 4.5);
  doc.text('Verifica en vkbacademy.com/verify', PAGE_W - margin, PAGE_H - 4.5, { align: 'right' });

  // ── Guardar ────────────────────────────────────────────────────────────────
  const slug = cert.scopeTitle.replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9-]/g, '');
  const filename = `certificado-${slug}-${issuedAt.toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
