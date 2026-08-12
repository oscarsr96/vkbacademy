#!/usr/bin/env node
/**
 * Vuelca desde la API de PRE (solo lectura) el estado de tutores y alumnos
 * antes de eliminar el rol TUTOR (fase 2 de refactor/fase2-tutores-registro).
 *
 * Contexto: no tenemos credenciales de base de datos de PRE ni de PROD, pero
 * sí de un usuario ADMIN de la API de PRE. A diferencia de los profesores,
 * los usuarios TUTOR sí tienen fila en AcademyMember (ver
 * apps/api/src/auth/auth.service.ts:141), así que el listado de admin
 * (GET /admin/users, que filtra por la academia del admin autenticado) los
 * ve. `AdminUsersService.getUsers` ya incluye `tutor` y `_count.students`
 * en su `select`, así que no hace falta ningún endpoint nuevo.
 *
 * Recoge:
 *  - Todos los TUTOR: id, email, nombre, nº de hijos.
 *  - Todos los STUDENT: id, nombre, username (si la API lo expone), tutorId/tutor.
 *  - Conteos derivados: tutores, alumnos CON tutor y alumnos SIN tutor.
 *
 * El conteo de alumnos SIN tutor es el dato más importante del volcado: esos
 * alumnos se quedarán sin `guardianEmail` tras la migración porque no hay
 * padre del que copiarlo.
 *
 * Uso:
 *   node scripts/vkb-dump-tutors.mjs [--out=ruta.json]
 *
 * Solo hace lecturas: es seguro ejecutarlo, pero SOLO debe apuntar a PRE —
 * .env.scripts apunta a PRE porque no disponemos de credenciales de PROD.
 * Credenciales leídas de .env.scripts (ver .env.scripts.example).
 */

import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { loadEnv, login } from './lib/vkb-api.mjs';

// ── Argumentos ────────────────────────────────────────────────────────────────
const flags = process.argv.slice(2);
const outFlag = flags.find((f) => f.startsWith('--out='))?.split('=')[1];

const today = new Date().toISOString().slice(0, 10);
const outPath = resolve(process.cwd(), outFlag ?? `data/exports/tutors-pre-${today}.json`);

/** Recorre GET /admin/users?role=<role> página a página hasta agotar totalPages. */
async function fetchAllUsers(client, role) {
  const items = [];
  let page = 1;
  let totalPages = 1;

  do {
    const res = await client.get(`/admin/users?role=${role}&page=${page}&limit=100`);
    items.push(...res.data);
    totalPages = res.totalPages || 1;
    page++;
  } while (page <= totalPages);

  return items;
}

// ── Descarga ──────────────────────────────────────────────────────────────────

const env = loadEnv();
const client = await login(env);

console.log('👨‍👩‍👧  Descargando usuarios TUTOR...');
const tutorUsers = await fetchAllUsers(client, 'TUTOR');

console.log('🧒  Descargando usuarios STUDENT...');
const studentUsers = await fetchAllUsers(client, 'STUDENT');

// ── Mapeo al formato del volcado ───────────────────────────────────────────────

const tutors = tutorUsers.map((u) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  childrenCount: u._count?.students ?? 0,
}));

const students = studentUsers.map((u) => ({
  id: u.id,
  name: u.name,
  // La API admin (admin-users.service.ts) no incluye `username` en su select
  // hoy; queda `null` si no llega en la respuesta.
  username: u.username ?? null,
  tutorId: u.tutorId ?? null,
  tutor: u.tutor ? { id: u.tutor.id, name: u.tutor.name } : null,
}));

const studentsWithTutor = students.filter((s) => s.tutorId).length;
const studentsWithoutTutor = students.length - studentsWithTutor;

// ── Anomalías a vigilar antes de aprobar la migración ──────────────────────────

const anomalies = [];

const tutorsWithoutChildren = tutors.filter((t) => t.childrenCount === 0);
if (tutorsWithoutChildren.length) {
  anomalies.push(
    `${tutorsWithoutChildren.length} tutor(es) sin ningún hijo asignado: ` +
      tutorsWithoutChildren.map((t) => t.email).join(', '),
  );
}

const tutorIds = new Set(tutors.map((t) => t.id));
const orphanTutorRefs = students.filter((s) => s.tutorId && !tutorIds.has(s.tutorId));
if (orphanTutorRefs.length) {
  anomalies.push(
    `${orphanTutorRefs.length} alumno(s) con tutorId que no aparece en el listado de TUTOR ` +
      `(¿tutor en otra academia o con otro rol?): ${orphanTutorRefs.map((s) => s.id).join(', ')}`,
  );
}

const emailCounts = tutors.reduce((acc, t) => {
  if (!t.email) return acc;
  acc[t.email] = (acc[t.email] ?? 0) + 1;
  return acc;
}, {});
const duplicateEmails = Object.entries(emailCounts).filter(([, count]) => count > 1);
if (duplicateEmails.length) {
  anomalies.push(`Email de tutor repetido: ${duplicateEmails.map(([e]) => e).join(', ')}`);
}

const tutorsWithoutEmail = tutors.filter((t) => !t.email);
if (tutorsWithoutEmail.length) {
  anomalies.push(
    `${tutorsWithoutEmail.length} tutor(es) sin email registrado: ` +
      tutorsWithoutEmail.map((t) => t.id).join(', '),
  );
}

// ── Escribir el fichero ────────────────────────────────────────────────────────

const payload = {
  version: 1,
  exportedFrom: env.apiUrl,
  exportedAt: new Date().toISOString(),
  counts: {
    tutors: tutors.length,
    studentsTotal: students.length,
    studentsWithTutor,
    studentsWithoutTutor,
  },
  tutors,
  students,
  anomalies,
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

console.log('\n📊  Resumen:');
console.log(`   Tutores: ${tutors.length}`);
console.log(`   Alumnos con tutor: ${studentsWithTutor}`);
console.log(`   Alumnos SIN tutor: ${studentsWithoutTutor}`);
if (anomalies.length) {
  console.log(
    `\n⚠️   ${anomalies.length} anomalía(s) detectada(s) — ver campo "anomalies" del volcado:`,
  );
  for (const a of anomalies) console.log(`   - ${a}`);
}
console.log(`\n✅  Volcado escrito en ${outPath}`);
