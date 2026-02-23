#!/usr/bin/env node
/**
 * Importa un JSON de curso o batería de examen en VKB Academy.
 *
 * Uso:
 *   node scripts/vkb-import.mjs courses path/to/curso.json
 *   node scripts/vkb-import.mjs exam-banks path/to/bateria.json [--courseId=xxx | --moduleId=xxx]
 *
 * Credenciales leídas de .env.scripts (ver .env.scripts.example)
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// ── Leer .env.scripts manualmente (sin dependencia de dotenv) ─────────────────
const envPath = resolve(process.cwd(), '.env.scripts');
if (!existsSync(envPath)) {
  console.error('❌  No se encontró .env.scripts. Copia .env.scripts.example y rellena tus credenciales.');
  process.exit(1);
}
const envVars = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.trim() && !l.startsWith('#'))
    .map(l => l.split('=').map(s => s.trim()))
    .filter(([k]) => k)
    .map(([k, ...v]) => [k, v.join('=').replace(/^["']|["']$/g, '')])
);

const API_URL    = envVars.VKB_API_URL    || 'http://localhost:3001/api';
const ADMIN_EMAIL    = envVars.VKB_ADMIN_EMAIL;
const ADMIN_PASSWORD = envVars.VKB_ADMIN_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('❌  Faltan VKB_ADMIN_EMAIL o VKB_ADMIN_PASSWORD en .env.scripts.');
  process.exit(1);
}

// ── Argumentos ────────────────────────────────────────────────────────────────
const [,, type, filePath, ...flags] = process.argv;

if (!type || !filePath) {
  console.error('Uso: node scripts/vkb-import.mjs <courses|exam-banks> <archivo.json> [--courseId=xxx | --moduleId=xxx]');
  process.exit(1);
}

const courseId = flags.find(f => f.startsWith('--courseId='))?.split('=')[1];
const moduleId = flags.find(f => f.startsWith('--moduleId='))?.split('=')[1];

// ── Login ─────────────────────────────────────────────────────────────────────
console.log(`🔐  Iniciando sesión como ${ADMIN_EMAIL}...`);
const loginRes = await fetch(`${API_URL}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
});

if (!loginRes.ok) {
  const err = await loginRes.json().catch(() => ({}));
  console.error('❌  Login fallido:', err.message ?? loginRes.statusText);
  process.exit(1);
}

const { accessToken } = await loginRes.json();
console.log('✅  Login correcto.');

// ── Leer JSON ─────────────────────────────────────────────────────────────────
const absPath = resolve(process.cwd(), filePath);
if (!existsSync(absPath)) {
  console.error(`❌  Archivo no encontrado: ${absPath}`);
  process.exit(1);
}

let payload = JSON.parse(readFileSync(absPath, 'utf8'));

// Para baterías de examen, inyectar courseId/moduleId en el payload
if (type === 'exam-banks') {
  if (!courseId && !moduleId) {
    console.error('❌  Para importar una batería de examen necesitas pasar --courseId=xxx o --moduleId=xxx.');
    process.exit(1);
  }
  payload = { ...payload, ...(courseId ? { courseId } : { moduleId }) };
}

// ── Importar ──────────────────────────────────────────────────────────────────
const endpoint = type === 'courses' ? '/admin/courses/import' : '/admin/exam-questions/import';
console.log(`📤  Importando ${filePath} → ${API_URL}${endpoint} ...`);

const importRes = await fetch(`${API_URL}${endpoint}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
  },
  body: JSON.stringify(payload),
});

const result = await importRes.json().catch(() => ({ message: importRes.statusText }));

if (!importRes.ok) {
  console.error(`❌  Error ${importRes.status}:`, result.message ?? result);
  process.exit(1);
}

console.log('✅  Importación completada:');
console.log(JSON.stringify(result, null, 2));

// Línea machine-readable para que los agentes puedan extraer el ID fácilmente
if (result.course?.id)  console.log(`IMPORT_ID=${result.course.id}`);
if (result.count != null) console.log(`IMPORT_COUNT=${result.count}`);
