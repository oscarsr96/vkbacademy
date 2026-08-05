// Validación estática del catálogo curricular (CURRICULUM). No usa Prisma ni toca ninguna BD:
// solo recorre las estructuras en memoria de prisma/data/curriculum/*.ts.
//
// Uso (desde apps/api):
//   npx ts-node prisma/validate-curriculum.ts
import { CURRICULUM } from './data/curriculum';
import type { CurriculumLevel, CurriculumSubject } from './data/curriculum';
import { normalizeTitle } from './data/normalize-title';

const VALID_SCHOOL_YEARS = ['1eso', '2eso', '3eso', '4eso', '1bach', '2bach'];
const MIN_MODULES = 8;
const MAX_MODULES = 15;

// Rangos Unicode prohibidos, definidos por code point (evita escribir escapes \u literales,
// que algunos editores/herramientas corrompen al guardar). Cubren caracteres de control
// C0/C1 y los bloques de emoji habituales (dingbats, símbolos misceláneos, banderas,
// emoji extendido, ZWJ y el modificador de presentación emoji).
const FORBIDDEN_RANGES: Array<[number, number]> = [
  [0x0000, 0x001f], // controles C0
  [0x007f, 0x009f], // DEL + controles C1
  [0x200d, 0x200d], // ZWJ, usado para componer emojis
  [0xfe0f, 0xfe0f], // variation selector-16 (fuerza presentación emoji)
  [0x2600, 0x27bf], // dingbats y símbolos misceláneos
  [0x2b00, 0x2bff], // flechas y símbolos misceláneos adicionales
  [0x1f1e6, 0x1f1ff], // regional indicators (banderas)
  [0x1f300, 0x1faff], // emoji extendido (caras, objetos, símbolos, etc.)
];

const errors: string[] = [];
const warnings: string[] = [];

function hasForbiddenChar(value: string): boolean {
  for (const char of value) {
    const codePoint = char.codePointAt(0) ?? 0;
    if (FORBIDDEN_RANGES.some(([start, end]) => codePoint >= start && codePoint <= end)) {
      return true;
    }
  }
  return false;
}

function checkForbiddenChars(value: string, context: string): void {
  if (hasForbiddenChar(value)) {
    errors.push(`${context}: contiene emojis o caracteres de control no permitidos ("${value}").`);
  }
}

function validateSubject(level: CurriculumLevel, subject: CurriculumSubject): void {
  const context = `[${level.schoolYear}] "${subject.courseTitle}"`;

  checkForbiddenChars(subject.subject, `${context} (subject)`);
  checkForbiddenChars(subject.courseTitle, `${context} (courseTitle)`);

  // Invariante 2: modules no vacío, sin duplicados, sin strings vacíos ni con espacios sobrantes.
  if (subject.modules.length === 0) {
    errors.push(`${context}: no tiene ninguna unidad (modules vacío).`);
  }

  const seenModules = new Set<string>();
  for (const moduleTitle of subject.modules) {
    checkForbiddenChars(moduleTitle, `${context} (module "${moduleTitle}")`);

    if (moduleTitle.trim() === '') {
      errors.push(`${context}: tiene una unidad vacía o solo espacios.`);
      continue;
    }
    if (moduleTitle !== moduleTitle.trim()) {
      errors.push(`${context}: la unidad "${moduleTitle}" tiene espacios sobrantes.`);
    }

    const normalized = normalizeTitle(moduleTitle);
    if (seenModules.has(normalized)) {
      errors.push(`${context}: unidad duplicada "${moduleTitle}".`);
    }
    seenModules.add(normalized);
  }

  // Invariante 3: entre 8 y 15 unidades (aviso, no error, si se sale del rango).
  if (subject.modules.length < MIN_MODULES || subject.modules.length > MAX_MODULES) {
    warnings.push(
      `${context}: tiene ${subject.modules.length} unidades (fuera del rango recomendado ${MIN_MODULES}-${MAX_MODULES}).`,
    );
  }

  // Invariante 4: ninguna materia de ESO lleva modality; las de modalidad en Bachillerato sí
  // (las comunes de Bachillerato pueden omitirlo, así que en Bachillerato no se exige).
  const isBach = level.schoolYear === '1bach' || level.schoolYear === '2bach';
  if (!isBach && subject.modality !== undefined) {
    errors.push(`${context}: es de ESO pero tiene "modality" (${subject.modality}).`);
  }
}

function validateLevel(level: CurriculumLevel, seenSchoolYears: Set<string>): void {
  // Invariante 6: schoolYear dentro del conjunto válido y sin repetir entre niveles.
  if (!VALID_SCHOOL_YEARS.includes(level.schoolYear)) {
    errors.push(`Nivel "${level.label}": schoolYear "${level.schoolYear}" no es válido.`);
  }
  if (seenSchoolYears.has(level.schoolYear)) {
    errors.push(`schoolYear "${level.schoolYear}" está repetido entre niveles.`);
  }
  seenSchoolYears.add(level.schoolYear);

  // Invariante 1: courseTitle no duplicado dentro del mismo nivel.
  const seenTitles = new Set<string>();
  for (const subject of level.subjects) {
    const normalized = normalizeTitle(subject.courseTitle);
    if (seenTitles.has(normalized)) {
      errors.push(`[${level.schoolYear}] courseTitle duplicado: "${subject.courseTitle}".`);
    }
    seenTitles.add(normalized);

    validateSubject(level, subject);
  }
}

function printSummary(): void {
  console.log('\nResumen del temario:\n');
  console.log('Nivel'.padEnd(10) + 'Asignaturas'.padEnd(14) + 'Unidades');
  console.log('-'.repeat(36));

  let totalSubjects = 0;
  let totalModules = 0;

  for (const level of CURRICULUM) {
    const levelModules = level.subjects.reduce((sum, s) => sum + s.modules.length, 0);
    totalSubjects += level.subjects.length;
    totalModules += levelModules;
    console.log(level.schoolYear.padEnd(10) + String(level.subjects.length).padEnd(14) + String(levelModules));
  }

  console.log('-'.repeat(36));
  console.log('TOTAL'.padEnd(10) + String(totalSubjects).padEnd(14) + String(totalModules));
}

function main(): void {
  const seenSchoolYears = new Set<string>();
  for (const level of CURRICULUM) {
    validateLevel(level, seenSchoolYears);
  }

  if (warnings.length > 0) {
    console.log('Avisos:\n');
    warnings.forEach((w) => console.log(`   WARN: ${w}`));
  }

  printSummary();

  if (errors.length > 0) {
    console.log(`\n${errors.length} error(es) encontrados:\n`);
    errors.forEach((e) => console.log(`   - ${e}`));
    process.exit(1);
  }

  console.log('\nTemario válido: sin errores.');
}

main();
