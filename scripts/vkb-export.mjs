#!/usr/bin/env node
/**
 * Exporta los cursos de un entorno de VKB Academy a un único JSON, en el mismo
 * formato que acepta scripts/vkb-import.mjs. Sirve para promocionar contenido
 * entre entornos (PRE → PROD), que tienen bases de datos separadas.
 *
 * Uso:
 *   node scripts/vkb-export.mjs courses [--out=ruta.json] [--only=id1,id2]
 *
 * Solo hace lecturas: es seguro ejecutarlo contra cualquier entorno.
 * Credenciales leídas de .env.scripts (ver .env.scripts.example).
 */

import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { loadEnv, login } from './lib/vkb-api.mjs';

// ── Argumentos ────────────────────────────────────────────────────────────────
const [, , type, ...flags] = process.argv;

if (type !== 'courses') {
  console.error('Uso: node scripts/vkb-export.mjs courses [--out=ruta.json] [--only=id1,id2]');
  process.exit(1);
}

const outFlag = flags.find((f) => f.startsWith('--out='))?.split('=')[1];
const onlyIds = flags
  .find((f) => f.startsWith('--only='))
  ?.split('=')[1]
  ?.split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const outPath = resolve(process.cwd(), outFlag ?? `data/exports/courses-${today}.json`);

// ── Mapeadores al formato de import ───────────────────────────────────────────

const mapAnswers = (answers = []) => answers.map((a) => ({ text: a.text, isCorrect: a.isCorrect }));

const mapExamQuestions = (questions = []) =>
  questions.map((q) => ({ text: q.text, type: q.type, answers: mapAnswers(q.answers) }));

function mapLesson(lesson) {
  const mapped = { title: lesson.title, type: lesson.type, order: lesson.order };

  if (lesson.youtubeId) mapped.youtubeId = lesson.youtubeId;
  if (lesson.content) mapped.content = lesson.content;

  // El quiz solo viaja si tiene preguntas; el import lo ignora en otro caso
  if (lesson.quiz?.questions?.length) {
    mapped.quiz = {
      questions: lesson.quiz.questions.map((q) => ({
        text: q.text,
        type: q.type,
        answers: mapAnswers(q.answers),
      })),
    };
  }

  return mapped;
}

// ── Export ────────────────────────────────────────────────────────────────────

const env = loadEnv();
const client = await login(env);

// 1. Listado paginado de cursos
const summaries = [];
let page = 1;
let totalPages = 1;

do {
  const res = await client.get(`/admin/courses?page=${page}&limit=50`);
  summaries.push(...res.data);
  totalPages = res.totalPages || 1;
  page++;
} while (page <= totalPages);

const selected = onlyIds ? summaries.filter((c) => onlyIds.includes(c.id)) : summaries;

if (onlyIds) {
  const missing = onlyIds.filter((id) => !summaries.some((c) => c.id === id));
  if (missing.length) {
    console.error(`❌  Ids no encontrados en este entorno: ${missing.join(', ')}`);
    process.exit(1);
  }
}

console.log(`📚  ${selected.length} curso(s) a exportar de ${summaries.length} disponibles.`);

// 2. Banco de examen completo en una sola petición y agrupado en cliente.
// Pedirlo por curso y por módulo dispararía ~1 petición por módulo y agotaría
// el throttler de la API (100 req/min).
const allExamQuestions = await client.get('/admin/exam-questions');

const examByCourse = new Map();
const examByModule = new Map();
for (const q of allExamQuestions) {
  const target = q.courseId ? examByCourse : q.moduleId ? examByModule : null;
  if (!target) continue;
  const key = q.courseId ?? q.moduleId;
  if (!target.has(key)) target.set(key, []);
  target.get(key).push(q);
}

// Las preguntas llegan ordenadas por `order`, pero el agrupado no lo garantiza
const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);

console.log(`📝  ${allExamQuestions.length} pregunta(s) de examen en el banco.`);

// 3. Detalle de cada curso
const courses = [];
const skipped = [];

for (const summary of selected) {
  const detail = await client.get(`/admin/courses/${summary.id}/detail`);

  // El import resuelve el nivel por nombre; sin él, el curso no es importable
  if (!detail.schoolYear?.name) {
    skipped.push(detail.title);
    console.warn(`⚠️   "${detail.title}" no tiene nivel educativo asignado — se omite.`);
    continue;
  }

  const courseExamQuestions = (examByCourse.get(detail.id) ?? []).sort(byOrder);

  const modules = [];
  for (const mod of detail.modules) {
    const moduleExamQuestions = (examByModule.get(mod.id) ?? []).sort(byOrder);

    const mapped = {
      title: mod.title,
      order: mod.order,
      lessons: mod.lessons.map(mapLesson),
    };
    if (moduleExamQuestions.length) {
      mapped.examQuestions = mapExamQuestions(moduleExamQuestions);
    }

    modules.push(mapped);
  }

  const course = {
    name: detail.title,
    schoolYear: detail.schoolYear.name,
    modules,
  };

  if (detail.description) course.description = detail.description;
  if (detail.coverUrl) course.coverUrl = detail.coverUrl;
  if (detail.subject) course.subject = detail.subject;
  course.published = detail.published;

  if (courseExamQuestions.length) {
    course.examQuestions = mapExamQuestions(courseExamQuestions);
  }

  courses.push(course);

  const lessonCount = modules.reduce((n, m) => n + m.lessons.length, 0);
  console.log(
    `   ✓ ${detail.title} — ${modules.length} módulo(s), ${lessonCount} lección(es)` +
      `${detail.published ? '' : ' (sin publicar)'}`,
  );
}

// 4. Escribir el fichero
const payload = {
  version: 1,
  exportedFrom: env.apiUrl,
  exportedAt: new Date().toISOString(),
  courses,
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

console.log(`\n✅  ${courses.length} curso(s) exportados a ${outPath}`);
if (skipped.length) {
  console.log(`⚠️   ${skipped.length} omitido(s) por no tener nivel: ${skipped.join(', ')}`);
}
