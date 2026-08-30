import jsPDF from 'jspdf';
import type { Certificate } from '@vkbacademy/shared';

// Paleta del club, tomada de los tokens de la app (global.css). Antes esto era
// una rama cálida de grises y un dorado mostaza que no salían de ningún sitio:
// el PDF no se parecía al producto del que sale.
const ORANGE = { r: 245, g: 145, b: 30 } as const; // --brand #f5911e
const ORANGE_DEEP = { r: 224, g: 123, b: 6 } as const; // --brand-deep #e07b06
const NAVY = { r: 10, g: 22, b: 40 } as const; // --navy-900 #0a1628
const INK = { r: 22, g: 33, b: 58 } as const; // --color-text #16213a
const MUTED = { r: 100, g: 116, b: 139 } as const; // --color-text-muted #64748b
const SURFACE = { r: 244, g: 245, b: 247 } as const; // --color-bg #f4f5f7
const ORANGE_TINT = { r: 254, g: 244, b: 234 } as const; // --brand-soft sobre blanco
const PAGE_W = 210;
const PAGE_H = 297;
const LOGO_URL = '/brand/vkb-logo.png';

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
 * Logo del club como data URL, para `addImage`.
 *
 * Devuelve null si no se puede cargar: el certificado sin logo sigue siendo
 * válido, y quedarse sin descarga por un fallo al pedir un PNG sería peor que
 * la falta del sello.
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

const TYPE_LABELS: Record<string, string> = {
  MODULE_COMPLETION: 'Certificado de Módulo Completado',
  COURSE_COMPLETION: 'Certificado de Curso Completado',
  MODULE_EXAM: 'Certificado de Examen de Módulo',
  COURSE_EXAM: 'Certificado de Examen de Curso',
  STUDY_EXAM: 'Certificado de Curso de Estudio',
};

export async function downloadCertificatePdf(cert: Certificate) {
  const doc = new jsPDF();
  const margin = 20;
  const contentW = PAGE_W - margin * 2;
  const issuedAt = new Date(cert.issuedAt);
  const logo = await loadLogoDataUrl();

  // ── Banda superior ─────────────────────────────────────────────────────────
  // Navy con acento naranja, como el hero de la app: el naranja plano de antes
  // no se parecía a ninguna pantalla del producto.
  setColor(doc, 'fill', NAVY);
  doc.rect(0, 0, PAGE_W, 52, 'F');
  setColor(doc, 'fill', ORANGE);
  doc.rect(0, 52, PAGE_W, 2.5, 'F');

  // Marca. El logo va sobre la banda navy, que es donde se lee: es un emblema
  // con trazos oscuros, así que sobre naranja se emborrona.
  let brandX = margin;
  if (logo) {
    doc.addImage(logo, 'PNG', margin, 5, 17, 17);
    brandX = margin + 20;
  }
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('VKB ACADEMY', brandX, 15);

  // Chip tipo de certificado (esquina derecha). Sin emoji: jsPDF solo tiene las
  // fuentes estándar y el 📜 salía como "ø=Üü", además de desbordar la caja.
  const chipText = 'CERTIFICADO';
  doc.setFontSize(8);
  const chipW = doc.getTextWidth(chipText) + 12;
  const chipX = PAGE_W - margin;
  setColor(doc, 'fill', ORANGE);
  doc.roundedRect(chipX - chipW, 6, chipW, 10, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text(chipText, chipX - chipW / 2, 12.5, { align: 'center' });

  // Subtítulo sobre la banda
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255, 210, 165);
  doc.text(TYPE_LABELS[cert.type] ?? cert.type, margin, 30);

  // Título principal
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Certificado Digital', margin, 43);

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
  setColor(doc, 'text', INK);
  doc.text(cert.recipientName, PAGE_W / 2, y, { align: 'center' });
  y += 14;

  // Línea decorativa debajo del nombre
  setColor(doc, 'draw', ORANGE);
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
    setColor(doc, 'text', ORANGE);
    doc.text(`${cert.examScore.toFixed(1)}%`, PAGE_W / 2, y, { align: 'center' });
    y += 16;
  }

  // ── Nombre del módulo/curso ─────────────────────────────────────────────────
  const scopeLines = doc.splitTextToSize(`"${cert.scopeTitle}"`, contentW - 20);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  setColor(doc, 'text', INK);
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

  // ── Sello ──────────────────────────────────────────────────────────────────
  // El logo del club hace de sello. Antes había un 🏅 dentro de un círculo
  // mostaza que jsPDF pintaba como "Ø<ßÅ": un emoji roto en el centro del
  // documento que el alumno se descarga y enseña.
  setColor(doc, 'draw', ORANGE_DEEP);
  doc.setLineWidth(0.8);
  doc.circle(PAGE_W / 2, y, 18, 'D');
  if (logo) {
    doc.addImage(logo, 'PNG', PAGE_W / 2 - 13, y - 13, 26, 26);
  }
  y += 28;

  // ── Código de verificación ─────────────────────────────────────────────────
  setColor(doc, 'fill', ORANGE_TINT);
  setColor(doc, 'draw', ORANGE);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentW, 22, 4, 4, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  setColor(doc, 'text', MUTED);
  doc.text('Código de verificación', margin + contentW / 2, y + 7, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  setColor(doc, 'text', ORANGE_DEEP);
  doc.text(cert.verifyCode, margin + contentW / 2, y + 16, { align: 'center' });

  // ── Pie de página ──────────────────────────────────────────────────────────
  setColor(doc, 'fill', SURFACE);
  doc.rect(0, PAGE_H - 12, PAGE_W, 12, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  setColor(doc, 'text', MUTED);
  doc.text('VKB Academy — Certificado Digital', margin, PAGE_H - 4.5);
  doc.text('Verifica en vkbacademy.com/verify', PAGE_W - margin, PAGE_H - 4.5, { align: 'right' });

  // ── Guardar ────────────────────────────────────────────────────────────────
  const slug = cert.scopeTitle
    .replace(/\s+/g, '-')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '');
  const filename = `certificado-${slug}-${issuedAt.toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
