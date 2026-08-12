#!/usr/bin/env node
/**
 * Volcado de solo lectura, vía API, de lo que la fase 1 del refactor va a eliminar:
 * usuarios con rol TEACHER y métricas agregadas de reservas.
 *
 * Uso:
 *   node scripts/vkb-dump-legacy.mjs [--out=ruta.json]
 *
 * Apunta al entorno configurado en .env.scripts (ver .env.scripts.example).
 * Solo hace lecturas: es seguro ejecutarlo contra cualquier entorno.
 *
 * LIMITACIÓN CONOCIDA: la API no expone las filas individuales de Booking ni el
 * contenido dependiente de cada profesor (TheoryModule, AiExamBank, StudyPlan…).
 * Para un volcado completo hace falta acceso directo a la base de datos con
 * apps/api/prisma/dump-legacy.ts. Este script cubre el censo y los agregados.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { loadEnv, login } from './lib/vkb-api.mjs';

const flags = process.argv.slice(2);
const outFlag = flags.find((f) => f.startsWith('--out='))?.split('=')[1];

const env = loadEnv();
const client = await login(env);

// Etiqueta del entorno a partir de la URL, para no pisar volcados entre entornos
const envName = env.apiUrl.includes('-pre')
  ? 'pre'
  : env.apiUrl.includes('localhost')
    ? 'local'
    : 'prod';
const today = new Date().toISOString().slice(0, 10);
const outPath = resolve(process.cwd(), outFlag ?? `data/exports/legacy-${envName}-${today}.json`);

console.log(`\n📋  Volcando datos heredados de ${envName} ...\n`);

// ── Censo de profesores ───────────────────────────────────────────────────────
const teachers = [];
let page = 1;
for (;;) {
  const res = await client.get(`/admin/users?role=TEACHER&page=${page}&limit=50`);
  const batch = res.data ?? res.items ?? [];
  teachers.push(...batch);
  const total = res.total ?? batch.length;
  if (teachers.length >= total || batch.length === 0) break;
  page++;
}
console.log(`👤  Usuarios TEACHER visibles en el listado: ${teachers.length}`);

// ── Agregados de reservas y de plataforma ─────────────────────────────────────
const metrics = await client.get('/admin/metrics');
console.log(
  `📅  Reservas: ${metrics.bookings?.total ?? 0} totales · ` +
    `${metrics.bookings?.confirmed ?? 0} confirmadas · ${metrics.bookings?.pending ?? 0} pendientes`,
);

// `/admin/users` filtra por academia (admin-users.service.ts: academyMembers.some),
// pero los profesores son globales y no tienen fila en AcademyMember: el listado los
// oculta. `/admin/metrics` hace un count global, así que es la cifra fiable.
const globalTeachers = metrics.users?.teachers ?? 0;
console.log(`👤  Usuarios TEACHER reales (count global): ${globalTeachers}`);

if (globalTeachers !== teachers.length) {
  console.warn(
    `\n⚠️   DISCREPANCIA: el listado muestra ${teachers.length} profesor(es) pero existen ` +
      `${globalTeachers} en la base de datos.\n` +
      `    Son globales y el listado de admin filtra por academia, así que no los ve.\n` +
      `    Identifícalos por SQL antes de la migración destructiva:\n` +
      `      SELECT id, email, name FROM "User" WHERE role = 'TEACHER';`,
  );
}

// Rango amplio para capturar el histórico completo en el desglose
const analytics = await client.get('/admin/analytics?from=2000-01-01&to=2100-01-01').catch((e) => {
  console.warn(`⚠️   No se pudo leer /admin/analytics: ${e.message}`);
  return null;
});

if (analytics?.teachers?.top?.length) {
  console.log(`\n🏫  Actividad por profesor:`);
  for (const t of analytics.teachers.top) {
    console.log(
      `    ${t.name} <${t.email}> — ${t.confirmed} confirmadas, ${t.hoursTaught}h impartidas`,
    );
  }
}

// ── Escritura ─────────────────────────────────────────────────────────────────
const payload = {
  env: envName,
  apiUrl: env.apiUrl,
  dumpedAt: new Date().toISOString(),
  source: 'API (parcial — sin filas de Booking ni contenido dependiente por profesor)',
  counts: {
    teachersGlobal: globalTeachers,
    teachersVisibleInList: teachers.length,
    bookings: metrics.bookings ?? null,
    users: metrics.users ?? null,
  },
  teachersListIsComplete: globalTeachers === teachers.length,
  teachers,
  bookingsByStatus: analytics?.bookings?.byStatus ?? null,
  bookingsByMode: analytics?.bookings?.byMode ?? null,
  teacherActivity: analytics?.teachers ?? null,
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
console.log(`\n✅  Volcado escrito en ${outPath}`);
