#!/usr/bin/env node
/**
 * Importa cursos o baterías de examen en VKB Academy.
 *
 * Uso:
 *   node scripts/vkb-import.mjs courses path/to/curso.json [--force] [--publish-all]
 *   node scripts/vkb-import.mjs exam-banks path/to/bateria.json [--courseId=xxx | --moduleId=xxx]
 *
 * Para cursos acepta tanto un curso suelto en la raíz del JSON como un fichero
 * de export con { courses: [...] } (ver scripts/vkb-export.mjs). Antes de crear
 * cada curso comprueba que no exista ya uno con el mismo título y nivel en el
 * entorno destino; --force salta esa comprobación.
 *
 * --publish-all publica todos los cursos del fichero en el destino, sin tocar el
 * JSON: "Estudiar" solo ofrece al alumno cursos con published = true y de su nivel.
 *
 * Credenciales leídas de .env.scripts (ver .env.scripts.example)
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { loadEnv, login } from './lib/vkb-api.mjs';

// ── Argumentos ────────────────────────────────────────────────────────────────
const [, , type, filePath, ...flags] = process.argv;

if (!type || !filePath) {
  console.error(
    'Uso: node scripts/vkb-import.mjs <courses|exam-banks> <archivo.json> [--courseId=xxx | --moduleId=xxx] [--force] [--publish-all]',
  );
  process.exit(1);
}

const courseId = flags.find((f) => f.startsWith('--courseId='))?.split('=')[1];
const moduleId = flags.find((f) => f.startsWith('--moduleId='))?.split('=')[1];
const force = flags.includes('--force');
const publishAll = flags.includes('--publish-all');

// ── Leer JSON ─────────────────────────────────────────────────────────────────
const absPath = resolve(process.cwd(), filePath);
if (!existsSync(absPath)) {
  console.error(`❌  Archivo no encontrado: ${absPath}`);
  process.exit(1);
}

const parsed = JSON.parse(readFileSync(absPath, 'utf8'));

// ── Login ─────────────────────────────────────────────────────────────────────
const env = loadEnv();
const client = await login(env);

// ── Baterías de examen: un único POST, como siempre ──────────────────────────
if (type === 'exam-banks') {
  if (!courseId && !moduleId) {
    console.error(
      '❌  Para importar una batería de examen necesitas pasar --courseId=xxx o --moduleId=xxx.',
    );
    process.exit(1);
  }

  const payload = { ...parsed, ...(courseId ? { courseId } : { moduleId }) };

  console.log(`📤  Importando ${filePath} → ${env.apiUrl}/admin/exam-questions/import ...`);
  const { ok, status, body } = await client.post('/admin/exam-questions/import', payload);

  if (!ok) {
    console.error(`❌  Error ${status}:`, body.message ?? body);
    process.exit(1);
  }

  console.log('✅  Importación completada:');
  console.log(JSON.stringify(body, null, 2));
  if (body.count != null) console.log(`IMPORT_COUNT=${body.count}`);
  process.exit(0);
}

if (type !== 'courses') {
  console.error(`❌  Tipo desconocido "${type}". Valores válidos: courses, exam-banks.`);
  process.exit(1);
}

// ── Cursos: un curso suelto o un fichero de export con courses[] ─────────────
const courses = Array.isArray(parsed.courses) ? parsed.courses : [parsed];

if (!courses.length) {
  console.error('❌  El fichero no contiene ningún curso.');
  process.exit(1);
}

if (parsed.exportedFrom) {
  console.log(`📦  Export de ${parsed.exportedFrom} (${parsed.exportedAt ?? 'sin fecha'})`);
}
console.log(`📚  ${courses.length} curso(s) a importar en ${env.apiUrl}`);

if (publishAll) {
  const yaPublicados = courses.filter((c) => c.published).length;
  console.log(
    `📢  --publish-all: se publicarán los ${courses.length} (${yaPublicados} ya venían publicados del origen).`,
  );
}
console.log();

/** Busca un curso ya existente con el mismo título y nivel en el destino. */
async function findExisting(course) {
  const res = await client.get(`/admin/courses?search=${encodeURIComponent(course.name)}&limit=50`);
  return res.data.find((c) => c.title === course.name && c.schoolYear?.name === course.schoolYear);
}

const imported = [];
const skippedCourses = [];
const failed = [];

for (const course of courses) {
  if (!force) {
    const existing = await findExisting(course);
    if (existing) {
      skippedCourses.push(course.name);
      console.log(
        `⏭️   "${course.name}" ya existe (${existing.id}) — omitido. Usa --force para importarlo igualmente.`,
      );
      continue;
    }
  }

  // El export refleja el `published` del origen; --publish-all lo fuerza en destino
  const payload = publishAll ? { ...course, published: true } : course;

  const { ok, status, body } = await client.post('/admin/courses/import', payload);

  if (!ok) {
    failed.push({ name: course.name, status, message: body.message ?? body });
    console.error(`❌  "${course.name}" → error ${status}:`, body.message ?? body);
    continue;
  }

  imported.push({ name: course.name, id: body.course?.id });
  console.log(`✅  "${course.name}" importado (${body.course?.id}).`);
  // Línea machine-readable para que los agentes puedan extraer el ID fácilmente
  if (body.course?.id) console.log(`IMPORT_ID=${body.course.id}`);
}

// ── Resumen ───────────────────────────────────────────────────────────────────
console.log(
  `\n📊  Importados: ${imported.length} | Omitidos: ${skippedCourses.length} | Fallidos: ${failed.length}`,
);

if (failed.length) {
  console.error('\n❌  Cursos que fallaron:');
  for (const f of failed) console.error(`   · ${f.name} (${f.status}): ${f.message}`);
  process.exit(1);
}

// Si no se importó nada porque estaba todo duplicado, es un fallo: quien invoca
// el script (una persona o el agente course-creator) espera un curso nuevo.
if (!imported.length && skippedCourses.length) {
  console.error('\n❌  No se importó ningún curso: ya existían todos en el destino.');
  process.exit(1);
}
