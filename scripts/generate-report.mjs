/**
 * Genera el informe interno de VKBacademy en PDF.
 * Uso: node scripts/generate-report.mjs
 *
 * Requiere jsPDF disponible en apps/web/node_modules/jspdf/dist/jspdf.node.js
 */

import { createRequire } from 'module';
import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Usar el build específico de Node.js
const { jsPDF } = require(join(__dirname, '../apps/web/node_modules/jspdf/dist/jspdf.node.js'));

// ─── Paleta de colores ────────────────────────────────────────────────────────
const PURPLE = { r: 99,  g: 102, b: 241 };  // #6366f1 — primario
const DARK   = { r: 30,  g: 27,  b: 24  };
const MUTED  = { r: 100, g: 100, b: 110 };
const GREEN  = { r: 5,   g: 150, b: 105 };
const RED    = { r: 220, g: 38,  b: 38  };
const ORANGE = { r: 234, g: 88,  b: 12  };
const LIGHT  = { r: 248, g: 248, b: 250 };
const BORDER = { r: 220, g: 220, b: 228 };

const PAGE_W  = 210;
const PAGE_H  = 297;
const MARGIN  = 18;
const COL_W   = PAGE_W - MARGIN * 2;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rgb(doc, target, { r, g, b }) {
  if (target === 'text') doc.setTextColor(r, g, b);
  else if (target === 'draw') doc.setDrawColor(r, g, b);
  else doc.setFillColor(r, g, b);
}

function newPage(doc) {
  doc.addPage();
  return MARGIN;
}

function checkPageBreak(doc, y, needed = 20) {
  if (y + needed > PAGE_H - 16) return newPage(doc);
  return y;
}

// Texto normal con posible salto de página
function text(doc, str, x, y, opts = {}) {
  rgb(doc, 'text', opts.color ?? DARK);
  doc.setFontSize(opts.size ?? 10);
  doc.setFont('helvetica', opts.style ?? 'normal');
  const lines = doc.splitTextToSize(str, opts.maxW ?? COL_W);
  doc.text(lines, x, y, opts.align ? { align: opts.align } : undefined);
  return y + lines.length * (opts.lineH ?? (opts.size ?? 10) * 0.45 + 1);
}

// Sección principal con banda de color
function sectionHeader(doc, y, title, icon = '') {
  y = checkPageBreak(doc, y, 22);
  rgb(doc, 'fill', PURPLE);
  doc.rect(MARGIN, y, COL_W, 9, 'F');
  rgb(doc, 'text', { r: 255, g: 255, b: 255 });
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`${icon}  ${title}`, MARGIN + 4, y + 6.2);
  return y + 14;
}

// Subtítulo de sección
function subHeader(doc, y, title) {
  y = checkPageBreak(doc, y, 14);
  rgb(doc, 'text', PURPLE);
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.text(title, MARGIN, y);
  rgb(doc, 'draw', PURPLE);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y + 2, MARGIN + COL_W, y + 2);
  return y + 8;
}

// Fila de tabla (clave | valor)
function tableRow(doc, y, key, value, isAlt = false, keyW = 60) {
  const lines = doc.splitTextToSize(value, COL_W - keyW - 4);
  const rowH = Math.max(8, lines.length * 5.5);
  y = checkPageBreak(doc, y, rowH + 2);

  if (isAlt) {
    rgb(doc, 'fill', LIGHT);
    doc.rect(MARGIN, y - 4, COL_W, rowH, 'F');
  }
  rgb(doc, 'draw', BORDER);
  doc.setLineWidth(0.2);
  doc.rect(MARGIN, y - 4, COL_W, rowH, 'D');

  rgb(doc, 'text', DARK);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(key, MARGIN + 2, y + 0.5);

  doc.setFont('helvetica', 'normal');
  rgb(doc, 'text', { r: 50, g: 50, b: 70 });
  doc.text(lines, MARGIN + keyW, y + 0.5);

  return y + rowH;
}

// Cabecera de tabla
function tableHeader(doc, y, cols, widths) {
  y = checkPageBreak(doc, y, 10);
  rgb(doc, 'fill', { r: 230, g: 230, b: 245 });
  doc.rect(MARGIN, y - 4, COL_W, 8, 'F');
  let x = MARGIN + 2;
  rgb(doc, 'text', PURPLE);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  cols.forEach((col, i) => {
    doc.text(col, x, y + 0.5);
    x += widths[i];
  });
  return y + 7;
}

// Fila multi-columna
function multiColRow(doc, y, cells, widths, isAlt = false) {
  const maxLines = cells.reduce((max, cell, i) => {
    const lines = doc.splitTextToSize(String(cell), widths[i] - 3);
    return Math.max(max, lines.length);
  }, 1);
  const rowH = Math.max(7, maxLines * 5.2);
  y = checkPageBreak(doc, y, rowH + 2);

  if (isAlt) {
    rgb(doc, 'fill', LIGHT);
    doc.rect(MARGIN, y - 3.5, COL_W, rowH, 'F');
  }
  rgb(doc, 'draw', BORDER);
  doc.setLineWidth(0.15);
  doc.rect(MARGIN, y - 3.5, COL_W, rowH, 'D');

  let x = MARGIN + 2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  cells.forEach((cell, i) => {
    const lines = doc.splitTextToSize(String(cell), widths[i] - 3);
    rgb(doc, 'text', DARK);
    doc.text(lines, x, y);
    x += widths[i];
  });
  return y + rowH;
}

// Bullet point
function bullet(doc, y, txt, indent = 0) {
  y = checkPageBreak(doc, y, 8);
  const maxW = COL_W - 8 - indent;
  const lines = doc.splitTextToSize(txt, maxW);
  rgb(doc, 'fill', PURPLE);
  doc.circle(MARGIN + 3 + indent, y - 1, 1, 'F');
  rgb(doc, 'text', DARK);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(lines, MARGIN + 7 + indent, y);
  return y + lines.length * 5;
}

// Bloque de recomendación (letra + título + descripción + propuesta)
function recBlock(doc, y, letra, titulo, porQue, propuesta) {
  y = checkPageBreak(doc, y, 24);

  // Indicador lateral
  rgb(doc, 'fill', PURPLE);
  doc.roundedRect(MARGIN, y - 2, 8, 8, 1, 1, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(letra, MARGIN + 4, y + 3.5, { align: 'center' });

  // Título de la rec
  rgb(doc, 'text', DARK);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(titulo, MARGIN + 11, y + 3);
  y += 10;

  // Por qué
  rgb(doc, 'text', { r: 80, g: 60, b: 150 });
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bolditalic');
  doc.text('Por que:', MARGIN + 4, y);
  rgb(doc, 'text', DARK);
  doc.setFont('helvetica', 'normal');
  const wLines = doc.splitTextToSize(porQue, COL_W - 22);
  doc.text(wLines, MARGIN + 22, y);
  y += wLines.length * 5 + 3;

  // Propuesta
  rgb(doc, 'text', GREEN);
  doc.setFont('helvetica', 'bolditalic');
  doc.text('Propuesta:', MARGIN + 4, y);
  rgb(doc, 'text', DARK);
  doc.setFont('helvetica', 'normal');
  const pLines = doc.splitTextToSize(propuesta, COL_W - 22);
  doc.text(pLines, MARGIN + 22, y);
  y += pLines.length * 5 + 6;

  // Separador
  rgb(doc, 'draw', BORDER);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, MARGIN + COL_W, y);
  return y + 6;
}

// Pie de página
function addFooters(doc, date) {
  const total = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    rgb(doc, 'fill', { r: 240, g: 240, b: 248 });
    doc.rect(0, PAGE_H - 11, PAGE_W, 11, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    rgb(doc, 'text', MUTED);
    doc.text('VKBacademy — Informe interno de producto · Confidencial', MARGIN, PAGE_H - 4);
    doc.text(`Pág. ${p} / ${total}  ·  ${date}`, PAGE_W - MARGIN, PAGE_H - 4, { align: 'right' });
  }
}

// ─── DOCUMENTO ────────────────────────────────────────────────────────────────

function generate() {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const date = 'Febrero 2026';

  // ══════════════════════════════════════════════════════════════════════════
  // PORTADA
  // ══════════════════════════════════════════════════════════════════════════

  rgb(doc, 'fill', PURPLE);
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F');

  // Logotipo textual
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(199, 210, 254);
  doc.text('VKB ACADEMY', MARGIN, 28);

  // Título principal
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  const titleLines = doc.splitTextToSize('Informe Interno de Producto', COL_W);
  doc.text(titleLines, MARGIN, 70);

  // Subtítulo
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(199, 210, 254);
  doc.text('Análisis de Fortalezas, Debilidades', MARGIN, 100);
  doc.text('y Oportunidades de Mejora', MARGIN, 108);

  // Chips de info
  const chips = ['Vallekas Basket', 'Público objetivo: clubes deportivos', date];
  let chipY = 130;
  chips.forEach((chip) => {
    const chipW = doc.getTextWidth(chip) + 8;
    rgb(doc, 'fill', { r: 79, g: 82, b: 200 });
    doc.roundedRect(MARGIN, chipY, chipW, 8, 2, 2, 'F');
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(chip, MARGIN + 4, chipY + 5.5);
    chipY += 12;
  });

  // Banda inferior
  rgb(doc, 'fill', { r: 79, g: 82, b: 200 });
  doc.rect(0, PAGE_H - 50, PAGE_W, 50, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(199, 210, 254);
  doc.text('Documento confidencial — uso interno exclusivo', MARGIN, PAGE_H - 24);
  doc.setFontSize(8);
  doc.text('Este informe está sujeto a revisión y actualización periódica.', MARGIN, PAGE_H - 18);

  // ══════════════════════════════════════════════════════════════════════════
  // PÁGINA 2 — ÍNDICE + RESUMEN EJECUTIVO
  // ══════════════════════════════════════════════════════════════════════════

  let y = newPage(doc);

  // Cabecera de contenido
  rgb(doc, 'fill', PURPLE);
  doc.rect(0, 0, PAGE_W, 18, 'F');
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('VKBacademy — Informe Interno de Producto', MARGIN, 12);
  y = 26;

  // Índice
  y = subHeader(doc, y, 'Índice');
  const index = [
    ['1.', 'Resumen ejecutivo'],
    ['2.', 'Fortalezas técnicas'],
    ['3.', 'Fortalezas de producto'],
    ['4.', 'Debilidades técnicas'],
    ['5.', 'Debilidades de producto'],
    ['6.', 'Recomendaciones prioritarias (A–L)'],
    ['7.', 'Ideas de diferenciación a largo plazo'],
    ['8.', 'Conclusión'],
  ];
  index.forEach(([num, title]) => {
    rgb(doc, 'text', PURPLE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(num, MARGIN + 4, y);
    rgb(doc, 'text', DARK);
    doc.setFont('helvetica', 'normal');
    doc.text(title, MARGIN + 12, y);
    y += 6;
  });
  y += 4;

  // Resumen ejecutivo
  y = sectionHeader(doc, y, '1. Resumen Ejecutivo', '📋');

  const execText = `VKBacademy es una plataforma LMS de dominio específico construida para el club Vallekas Basket. Su propuesta diferencial respecto a plataformas genéricas (Moodle, Google Classroom) es la integración nativa del contexto deportivo: niveles por año escolar (ESO/Bachillerato), reservas de clases con entrenadores, gamificación con mecánicas de racha, contenido generado con IA adaptado al deporte, y exámenes por curso y módulo descargables en PDF.`;
  y = text(doc, execText, MARGIN, y, { size: 9.5, lineH: 5.5, maxW: COL_W });
  y += 6;

  // Tabla de resumen ejecutivo
  y = tableHeader(doc, y, ['Dimensión', 'Estado', 'Nota'], [60, 40, COL_W - 100]);
  const execRows = [
    ['Arquitectura técnica', '✅ Sólida', 'Monorepo TypeScript estricto, corrección server-side, rate limiting'],
    ['Cobertura de tests', '🔴 Crítico', '0% — cero archivos .spec.ts en toda la API'],
    ['App móvil', '🔴 Pendiente', 'Fase 9 no iniciada; audiencia consume principalmente en móvil'],
    ['Engagement alumno', '🟠 Parcial', 'Gamificación implementada pero sin leaderboard ni retos de equipo'],
    ['Herramientas admin', '✅ Completo', 'Analytics, IA, CRUD completo, bancos de examen'],
    ['Notificaciones', '🟡 Email only', 'Resend activo; push notifications no implementadas'],
    ['Documentación API', '🟠 Manual', 'Sin Swagger; solo CLAUDE.md como referencia interna'],
    ['Diferenciación vs Moodle', '✅ Alta', 'Reservas, Daily.co, IA contextualizada, lecciones interactivas'],
  ];
  execRows.forEach(([a, b, c], i) => {
    y = multiColRow(doc, y, [a, b, c], [60, 40, COL_W - 100], i % 2 === 1);
  });
  y += 6;

  // ══════════════════════════════════════════════════════════════════════════
  // PÁGINA 3 — FORTALEZAS
  // ══════════════════════════════════════════════════════════════════════════

  y = sectionHeader(doc, y, '2. Fortalezas Técnicas', '🔧');

  const techStrengths = [
    ['Monorepo tipado end-to-end', 'TypeScript estricto compartido entre API, web y mobile via packages/shared. Imposible desincronizar contratos entre capas.'],
    ['Corrección server-side', 'Quiz y exámenes se corrigen en servidor desde questionsSnapshot en BD. El cliente nunca recibe isCorrect antes del submit.'],
    ['Rate limiting global', 'ThrottlerModule activo: 100 req/min por IP. Protección básica ante bots, scraping y ataques de fuerza bruta.'],
    ['URLs firmadas para vídeo', 'AWS S3 con expiración de 1 hora. El contenido multimedia del club no es público ni indexable externamente.'],
    ['Gamificación event-driven', 'Los hooks checkAndAward se disparan con void — no bloquean el request HTTP. Decisión de arquitectura correcta.'],
    ['Puntos denormalizados', 'User.totalPoints como campo calculado permite lecturas O(1) en la tienda, sin JOIN costoso en cada petición.'],
    ['Contenido interactivo como JSON', 'Lesson.content Json? evita migraciones Prisma por cada nuevo tipo de actividad. Pragmático para la escala actual.'],
    ['Fisher-Yates en exámenes', 'Selección aleatoria criptográficamente correcta de preguntas. Cada intento de examen es diferente.'],
  ];

  techStrengths.forEach(([k, v], i) => {
    y = tableRow(doc, y, k, v, i % 2 === 1, 62);
  });
  y += 6;

  y = sectionHeader(doc, y, '3. Fortalezas de Producto', '🎯');

  const prodStrengths = [
    ['6 tipos de lección', 'VIDEO, QUIZ, EXERCISE, MATCH, SORT, FILL_BLANK cubre variedad pedagógica completa para un LMS deportivo.'],
    ['Generación IA contextualizada', 'El generador incluye título del curso, nivel educativo y módulo en el prompt. Las preguntas son relevantes al contenido real.'],
    ['Sistema de exámenes completo', 'Fisher-Yates, contador regresivo con auto-submit, respuesta única, correcciones con texto real, PDF descargable.'],
    ['Analytics admin detallados', '8 KPIs, gráfico SVG propio sin librerías externas, top cursos/alumnos, desglose de reservas por estado y modalidad.'],
    ['Booking con videollamada', 'Daily.co integrado: sala creada automáticamente al confirmar reserva online, eliminada al cancelar.'],
    ['Racha semanal ISO', 'Cálculo correcto de semana ISO con manejo del cambio de año (semana 1 del año nuevo). Credibilidad del sistema.'],
    ['Rol TUTOR diferenciado', 'Los padres gestionan reservas sin que el alumno (menor de edad) tenga que hacerlo directamente.'],
    ['Segmentación por curso escolar', 'Los alumnos solo ven cursos de su nivel (1ESO–2Bach). Evita sobrecarga de información irrelevante.'],
    ['PDF de exámenes y quizzes', 'Informes descargables con jsPDF: diseño profesional con score, correcciones, fecha. Valor para padres y alumnos.'],
  ];

  prodStrengths.forEach(([k, v], i) => {
    y = tableRow(doc, y, k, v, i % 2 === 1, 62);
  });
  y += 6;

  // ══════════════════════════════════════════════════════════════════════════
  // DEBILIDADES
  // ══════════════════════════════════════════════════════════════════════════

  y = sectionHeader(doc, y, '4. Debilidades Técnicas', '⚠️');

  y = tableHeader(doc, y, ['Debilidad', 'Riesgo', 'Descripción'], [58, 22, COL_W - 80]);
  const techWeaknesses = [
    ['Sin tests automatizados', '🔴 Alto', '0 archivos .spec.ts en toda la API. Sin red de seguridad ante refactorizaciones o nuevas funcionalidades.'],
    ['Sin Swagger/OpenAPI', '🟠 Medio', 'Los endpoints no están documentados. Integración con app móvil (Fase 9) requerirá leer código fuente.'],
    ['Rate limiting no granular', '🟠 Medio', 'Límite de 100 req/min es global. Endpoints /generate (IA) y /auth/login necesitan límites propios más estrictos.'],
    ['App móvil pendiente', '🔴 Alto', 'Fase 9 no iniciada. El público objetivo (jugadores jóvenes) consume principalmente en smartphones.'],
    ['Sin paginación en admin users', '🟡 Bajo', 'GET /admin/users devuelve todos los usuarios sin paginación. Lento con >500 usuarios.'],
    ['Sin caché Redis en servicios', '🟡 Bajo', 'Redis disponible pero sin usar en consultas pesadas como /admin/analytics. Queries costosas se repiten.'],
    ['Tiempo de visionado no rastreado', '🟠 Medio', 'UserProgress.completed es boolean. Un alumno puede marcar una lección VIDEO sin verla. Datos de progreso poco fiables.'],
    ['Sin notificaciones push', '🔴 Alto', 'Email funciona para padres, no para adolescentes. Sin push, la plataforma es reactiva, nunca proactiva.'],
  ];
  techWeaknesses.forEach(([a, b, c], i) => {
    y = multiColRow(doc, y, [a, b, c], [58, 22, COL_W - 80], i % 2 === 1);
  });
  y += 6;

  y = sectionHeader(doc, y, '5. Debilidades de Producto', '📌');

  const prodWeaknesses = [
    ['Sin ranking/clasificación', 'Los puntos existen pero no hay leaderboard. La mecánica competitiva — esencial en contexto deportivo — está desaprovechada.'],
    ['Sin certificados de curso', 'No existe modelo Certificate ni generación de diplomas. Es un motivador clave y un recurso que los padres valoran.'],
    ['Sin comentarios en lecciones', 'Los alumnos no pueden preguntar dudas sobre el contenido. Obliga al uso de canales externos (WhatsApp, email).'],
    ['Tienda de merchandising estática', 'Los artículos están hardcodeados en el frontend. Añadir/editar artículos requiere despliegue de código.'],
    ['Sin prerequisitos de curso', 'No se puede bloquear acceso a un módulo avanzado hasta completar uno básico. Pérdida de control pedagógico.'],
    ['Sin calendario visual de reservas', 'El tutor ve una lista de reservas, no un calendario. Comparar disponibilidad y planificar es difícil.'],
    ['Rol TEACHER pasivo', 'TEACHER confirma reservas y gestiona disponibilidad, pero no puede iniciar comunicación ni ver progreso agregado de alumnos.'],
    ['Sin diario de entrenamiento', 'El alumno no puede registrar actividad fuera de la plataforma. Desconexión con la vida deportiva real.'],
    ['Sin modo offline', 'Cuando la app móvil se implemente, no habrá soporte offline. Los desplazamientos a torneos impedirán estudiar sin datos.'],
  ];

  prodWeaknesses.forEach(([k, v], i) => {
    y = tableRow(doc, y, k, v, i % 2 === 1, 68);
  });
  y += 6;

  // ══════════════════════════════════════════════════════════════════════════
  // RECOMENDACIONES
  // ══════════════════════════════════════════════════════════════════════════

  y = sectionHeader(doc, y, '6. Recomendaciones Prioritarias', '🚀');
  y = subHeader(doc, y, 'Prioridad Alta — Retención y Engagement');

  y = recBlock(doc, y, 'A', 'Tabla de clasificación (Leaderboard)',
    'Los deportistas son intrínsecamente competitivos. Un ranking visible es el motivador más efectivo en este contexto. Los puntos ya existen pero no se muestran comparativamente.',
    'GET /leaderboard?scope=global|course|schoolYear — top 10 por puntos. Filtrar por nivel educativo para evitar comparaciones injustas (2Bach vs 1ESO). Componente en DashboardPage. Implementación trivial: User.totalPoints ya existe.'
  );

  y = recBlock(doc, y, 'B', 'Notificaciones push (Expo)',
    'Email funciona para padres/tutores, no para adolescentes. Sin push, los recordatorios de clases o nuevos contenidos no llegan a la audiencia principal.',
    'User.expoPushToken String? en schema. POST /notifications/register-push guarda el token. Activar para: reserva confirmada, nueva lección, reto completado, recordatorio 1h antes de clase. Expo Notifications SDK ya está en el stack.'
  );

  y = recBlock(doc, y, 'C', 'Certificados de finalización de curso (PDF)',
    'Los padres los valoran para portfolios del alumno. Los alumnos los usan como motivación de fin de ciclo. Diferenciador frente a Moodle.',
    'Modelo Certificate { id, userId, courseId, issuedAt, pdfKey }. Se genera automáticamente cuando CourseProgress.percentage = 100. PDF con jsPDF (ya instalado): nombre, curso, nivel, fecha, sello del club. Almacenar en S3, servir con URL firmada.'
  );

  y = recBlock(doc, y, 'D', 'Comentarios y preguntas en lecciones',
    'Sin canal de comunicación sobre el contenido, los alumnos abandonan cuando se bloquean en algún concepto.',
    'Modelo LessonComment { id, lessonId, userId, text, parentId? } — árbol de 2 niveles. GET y POST /lessons/:id/comments. TEACHER ve comentarios de sus alumnos. Email/push al teacher cuando un alumno comenta.'
  );

  y = subHeader(doc, y, 'Prioridad Media — Pedagogía y Operacional');

  y = recBlock(doc, y, 'E', 'Prerequisitos de módulo/curso',
    'Permite diseñar rutas de aprendizaje progresivas (p.ej. "Táctica avanzada" requiere "Fundamentos básicos"). Sin esto, el alumno puede saltar contenido esencial.',
    'Campo Course.prerequisiteCourseId String?. El endpoint GET /courses/:id devuelve isUnlocked: boolean calculado desde el progreso del alumno. Visual: cursos bloqueados con candado en CoursesPage.'
  );

  y = recBlock(doc, y, 'F', 'Diario de entrenamiento personal',
    'Conecta la plataforma con la vida deportiva real del alumno. Diferenciador clave respecto a Moodle y cualquier LMS genérico.',
    'Modelo TrainingLog { userId, date, type (MATCH|TRAINING|GYM|REST), durationMinutes, notes? }. Vista de calendario en app móvil con heatmap de actividad. Nuevo reto TRAINING_LOGGED: registra N sesiones.'
  );

  y = recBlock(doc, y, 'G', 'Gestión de artículos de tienda por admin',
    'Los artículos de la tienda están hardcodeados en el frontend. Cambiar precios o añadir artículos requiere un despliegue de código.',
    'Modelo StoreItem { name, description, cost, imageUrl?, isActive, stock? }. GET /store/items + CRUD en /admin/store/items. POST /challenges/redeem acepta itemId en lugar de { itemName, cost } hardcodeado.'
  );

  y = recBlock(doc, y, 'H', 'Feedback del profesor al alumno',
    'El TEACHER no tiene canal para comunicarse proactivamente. La tutoría se reduce a reservar horas.',
    'Modelo Feedback { teacherId, studentId, courseId?, text, createdAt }. POST /feedback [TEACHER, ADMIN]. Visible en panel del alumno y del tutor como "Observaciones del profesor". Email/push de notificación.'
  );

  y = subHeader(doc, y, 'Prioridad Media-Baja — Técnica');

  y = recBlock(doc, y, 'I', 'Tests automatizados (unit + e2e)',
    '0 archivos .spec.ts es el riesgo técnico más grave. Cualquier refactorización puede romper funcionalidades sin saberlo.',
    'Jest ya configurado en el proyecto. Empezar por: exams.service.ts (corrección), challenges.service.ts (racha semanal), auth.service.ts. Tests e2e de flujos principales con supertest.'
  );

  y = recBlock(doc, y, 'J', 'Swagger/OpenAPI',
    'La app móvil (Fase 9) necesitará documentación de la API. Sin ella, el desarrollo será lento y propenso a errores de contrato.',
    '@nestjs/swagger ya disponible como dependencia transitiva. Decoradores @ApiOperation, @ApiResponse en controllers. Exponer en /api/docs solo en NODE_ENV !== production.'
  );

  y = recBlock(doc, y, 'K', 'Rastreo de tiempo de visionado de vídeo',
    'Actualmente un alumno puede marcar una lección VIDEO como completada sin verla. Invalida los datos de progreso y el reto TOTAL_HOURS.',
    'UserProgress.watchedSeconds Int @default(0). Frontend envía pings cada 10s de reproducción activa. POST /lessons/:id/complete requiere watchedSeconds >= duración * 0.8 para vídeos.'
  );

  y = recBlock(doc, y, 'L', 'Calendario visual de reservas',
    'El flujo de reservas muestra una lista. Para tutores con varios hijos o varios profesores, la gestión visual es esencial.',
    'Componente Calendar implementado con CSS Grid nativo (sin dependencias). Vista mensual/semanal. Slots disponibles del profesor en verde, reservas en morado.'
  );

  // ══════════════════════════════════════════════════════════════════════════
  // IDEAS A LARGO PLAZO
  // ══════════════════════════════════════════════════════════════════════════

  y = sectionHeader(doc, y, '7. Ideas de Diferenciación a Largo Plazo', '💡');

  const longTermIdeas = [
    ['Retos de equipo', 'Agrupar alumnos reflejando el equipo deportivo real para retos colectivos. "El equipo sub-16 completa 50 lecciones esta semana."'],
    ['Quiz en directo (WebSockets)', 'El profesor lanza un quiz en tiempo real durante un entrenamiento. Los alumnos responden desde el móvil y ven el ranking al instante en pantalla.'],
    ['Integración calendario del club', 'Importar partidos y entrenamientos del club (vía iCal o API) para que aparezcan junto con las reservas en un mismo calendario.'],
    ['Rutas de aprendizaje adaptativas', 'Basadas en resultados de exámenes: "Tu score en Defensa es 42% — te recomendamos repasar el módulo 2." Requiere IA de recomendación.'],
    ['Modo torneos', 'Durante un torneo, desbloquear contenido especial (análisis táctico del rival) visible solo esa semana. Crear evento de club.'],
    ['Rol COACH', 'Nuevo rol con acceso al progreso físico-táctico del equipo completo, sin gestionar reservas individuales. Distinto del TEACHER.'],
    ['Análisis de vídeo propio', 'Reemplazar YouTube embebido por reproductor propio con anotaciones de timestamp por parte del profesor. Mayor control pedagógico.'],
    ['Integración con wearables', 'Importar datos de frecuencia cardíaca o GPS de entrenamientos (Garmin, Apple Health) para enriquecer el diario de entrenamiento.'],
  ];

  y = tableHeader(doc, y, ['Idea', 'Descripción'], [58, COL_W - 58]);
  longTermIdeas.forEach(([k, v], i) => {
    y = multiColRow(doc, y, [k, v], [58, COL_W - 58], i % 2 === 1);
  });
  y += 6;

  // ══════════════════════════════════════════════════════════════════════════
  // CONCLUSIÓN
  // ══════════════════════════════════════════════════════════════════════════

  y = sectionHeader(doc, y, '8. Conclusión y Próximos Pasos', '🏁');

  y = text(doc, 'La plataforma tiene una base técnica sólida y un conjunto de funcionalidades que supera a soluciones genéricas para el caso de uso de un club deportivo con alumnado menor de edad. Las tres brechas más críticas son:', MARGIN, y, { size: 9.5, maxW: COL_W, lineH: 5.5 });
  y += 4;

  const criticals = [
    'Ausencia de tests automatizados (riesgo de regresión al escalar el equipo)',
    'App móvil no implementada (canal principal del público objetivo)',
    'Falta de mecánicas competitivas visibles (leaderboard, retos de equipo)',
  ];
  criticals.forEach((c) => { y = bullet(doc, y, c); });
  y += 6;

  y = text(doc, 'Las tres apuestas de mayor retorno para la próxima fase serían:', MARGIN, y, { size: 9.5, maxW: COL_W });
  y += 4;

  const bets = [
    ['1ª prioridad:', 'App móvil + push notifications — llegar al alumno donde está'],
    ['2ª prioridad:', 'Tabla de clasificación por nivel educativo — activar la competencia inherente al deporte'],
    ['3ª prioridad:', 'Certificados de finalización de curso — motivación de cierre y valor para las familias'],
  ];
  bets.forEach(([k, v]) => {
    y = checkPageBreak(doc, y, 10);
    rgb(doc, 'fill', { r: 238, g: 242, b: 255 });
    doc.roundedRect(MARGIN, y - 3, COL_W, 9, 2, 2, 'F');
    rgb(doc, 'text', PURPLE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(k, MARGIN + 3, y + 2.5);
    rgb(doc, 'text', DARK);
    doc.setFont('helvetica', 'normal');
    doc.text(v, MARGIN + 28, y + 2.5);
    y += 12;
  });

  y += 6;
  y = checkPageBreak(doc, y, 16);
  rgb(doc, 'fill', LIGHT);
  doc.roundedRect(MARGIN, y, COL_W, 14, 3, 3, 'F');
  rgb(doc, 'draw', PURPLE);
  doc.setLineWidth(0.5);
  doc.roundedRect(MARGIN, y, COL_W, 14, 3, 3, 'D');
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'italic');
  rgb(doc, 'text', MUTED);
  doc.text('Este informe es un documento vivo. Se actualizará en cada sprint de producto con nuevos hallazgos,', MARGIN + 4, y + 5);
  doc.text('métricas de uso real y ajustes de prioridad según el feedback del club.', MARGIN + 4, y + 10);

  // ── Pies de página ──────────────────────────────────────────────────────────
  addFooters(doc, date);

  // ── Guardar ─────────────────────────────────────────────────────────────────
  const output = doc.output('arraybuffer');
  const filename = join(__dirname, '../reports/informe-interno-vkbacademy-2026-02.pdf');
  writeFileSync(filename, Buffer.from(output));
  console.log(`✅ PDF generado: ${filename}`);
}

generate();
