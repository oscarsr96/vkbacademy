// Script idempotente: siembra el catálogo completo de asignaturas y temarios de
// ESO/Bachillerato (Comunidad de Madrid) definido en ./data/curriculum. No borra
// ni modifica módulos existentes; los cursos que ya existen no se tocan salvo para
// rellenar `subject`/`schoolYearId` si están a null.
//
// Uso:
//   DATABASE_URL="postgresql://..." npx ts-node prisma/seed-curriculum.ts [flags]
//
// Flags:
//   --level=<schoolYear>   Solo siembra ese nivel (1eso, 2eso, 3eso, 4eso, 1bach, 2bach).
//   --subject=<texto>      Solo siembra asignaturas cuyo subject/courseTitle casen (normalizado).
//   --dry-run              Imprime lo que haría, sin escribir nada en la BD.
import { PrismaClient, SchoolYear } from '@prisma/client';
import { CURRICULUM, getLevel, CurriculumLevel, CurriculumSubject } from './data/curriculum';
import { normalizeTitle } from './data/normalize-title';

const prisma = new PrismaClient();

interface CliArgs {
  level?: string;
  subject?: string;
  dryRun: boolean;
}

const USAGE =
  'Uso: seed-curriculum.ts [--level=<1eso|2eso|3eso|4eso|1bach|2bach>] [--subject=<texto>] [--dry-run]';

// Imprime el error de uso y termina antes de tocar la BD (nunca se llega a instanciar Prisma en este flujo).
function usageError(message: string): never {
  console.error(`❌ ${message}`);
  console.error(USAGE);
  process.exit(1);
}

// Parsea los flags soportados desde process.argv (sin dependencias nuevas). Cualquier
// argumento no reconocido, o --level/--subject sin valor, aborta con error de uso: en
// un script que siembra PROD, un flag mal escrito no puede pasar desapercibido.
function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { dryRun: false };
  for (const arg of argv) {
    if (arg === '--help') {
      console.log(USAGE);
      process.exit(0);
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg.startsWith('--level=')) {
      const value = arg.slice('--level='.length);
      if (!value) usageError('--level requiere un valor (ej: --level=1eso).');
      args.level = value;
    } else if (arg.startsWith('--subject=')) {
      const value = arg.slice('--subject='.length);
      if (!value) usageError('--subject requiere un valor (ej: --subject=Matemáticas).');
      args.subject = value;
    } else {
      usageError(`Argumento no reconocido: "${arg}".`);
    }
  }
  return args;
}

interface Stats {
  coursesCreated: number;
  coursesExisting: number;
  modulesCreated: number;
  modulesExisting: number;
}

interface SubjectResult {
  courseAction: 'created' | 'existing' | 'skipped';
  filledFields: string[];
  modulesCreated: number;
  modulesExisting: number;
}

// Resuelve el SchoolYear por name; lo crea si no existe (idempotente). En dry-run
// no escribe: si falta, avisa y devuelve null (no se necesita el id, no se escribe nada).
async function resolveSchoolYear(level: CurriculumLevel, dryRun: boolean): Promise<SchoolYear | null> {
  const existing = await prisma.schoolYear.findUnique({ where: { name: level.schoolYear } });
  if (existing) return existing;

  if (dryRun) {
    console.log(`   🆕 [dry-run] Se crearía el nivel "${level.label}" (${level.schoolYear})`);
    return null;
  }

  const created = await prisma.schoolYear.create({ data: { name: level.schoolYear, label: level.label } });
  console.log(`   🆕 Nivel creado: ${created.label} (${created.name})`);
  return created;
}

// Compara subject/courseTitle (normalizados) contra el filtro --subject.
function matchesSubjectFilter(subject: CurriculumSubject, filter: string | undefined): boolean {
  if (!filter) return true;
  const normalizedFilter = normalizeTitle(filter);
  return (
    normalizeTitle(subject.subject).includes(normalizedFilter) ||
    normalizeTitle(subject.courseTitle).includes(normalizedFilter)
  );
}

// Sincroniza un curso (y sus módulos) contra la BD. Nunca borra ni renumera módulos
// existentes; un curso ya existente solo se toca para rellenar campos que estén a null.
async function syncCourse(
  subject: CurriculumSubject,
  schoolYearRecord: SchoolYear | null,
  dryRun: boolean,
  stats: Stats,
): Promise<SubjectResult> {
  // Postgres no normaliza acentos sin extensiones: acotamos por schoolYearId (o cursos
  // antiguos sin nivel asignado, adoptables) y comparamos en memoria por título normalizado,
  // igual que ya se hace con los módulos.
  const candidates = await prisma.course.findMany({
    where: schoolYearRecord
      ? { OR: [{ schoolYearId: schoolYearRecord.id }, { schoolYearId: null }] }
      : { schoolYearId: null },
  });
  const normalizedCourseTitle = normalizeTitle(subject.courseTitle);
  const matchingCourses = candidates.filter((c) => normalizeTitle(c.title) === normalizedCourseTitle);

  const result: SubjectResult = { courseAction: 'existing', filledFields: [], modulesCreated: 0, modulesExisting: 0 };

  if (matchingCourses.length > 1) {
    // Ambiguo: en PROD no se elige al azar. Se avisa y se salta sin escribir nada.
    console.warn(
      `   ⚠️  "${subject.courseTitle}" coincide (normalizado) con ${matchingCourses.length} cursos existentes: ${matchingCourses.map((c) => `"${c.title}"`).join(', ')}. Saltando asignatura, no se escribe nada.`,
    );
    result.courseAction = 'skipped';
    return result;
  }

  const existingCourse = matchingCourses[0] ?? null;

  let courseId: string | null = null;
  let existingModules: { title: string; order: number }[] = [];

  if (!existingCourse) {
    result.courseAction = 'created';
    stats.coursesCreated += 1;

    if (!dryRun) {
      if (!schoolYearRecord) {
        throw new Error(`No se pudo resolver el SchoolYear para crear el curso "${subject.courseTitle}"`);
      }
      const created = await prisma.course.create({
        data: {
          title: subject.courseTitle,
          subject: subject.subject,
          schoolYearId: schoolYearRecord.id,
          published: false,
        },
      });
      courseId = created.id;
    }
  } else {
    stats.coursesExisting += 1;
    courseId = existingCourse.id;

    // Solo rellena subject/schoolYearId si están a null; nunca sobreescribe un valor existente.
    const fillData: { subject?: string; schoolYearId?: string } = {};
    if (existingCourse.subject === null) fillData.subject = subject.subject;
    if (existingCourse.schoolYearId === null && schoolYearRecord) fillData.schoolYearId = schoolYearRecord.id;

    if (Object.keys(fillData).length > 0) {
      result.filledFields = Object.keys(fillData);
      if (!dryRun) {
        await prisma.course.update({ where: { id: existingCourse.id }, data: fillData });
      }
    }

    existingModules = await prisma.module.findMany({
      where: { courseId: existingCourse.id },
      orderBy: { order: 'asc' },
    });
  }

  const existingNormalizedTitles = new Set(existingModules.map((m) => normalizeTitle(m.title)));
  let nextOrder = existingModules.reduce((max, m) => Math.max(max, m.order), 0) + 1;

  for (const moduleTitle of subject.modules) {
    if (existingNormalizedTitles.has(normalizeTitle(moduleTitle))) {
      result.modulesExisting += 1;
      stats.modulesExisting += 1;
      continue;
    }

    result.modulesCreated += 1;
    stats.modulesCreated += 1;

    if (!dryRun && courseId) {
      await prisma.module.create({ data: { title: moduleTitle, order: nextOrder, courseId } });
    }
    nextOrder += 1;
  }

  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  let levels: CurriculumLevel[];
  if (args.level) {
    const level = getLevel(args.level);
    if (!level) {
      console.error(
        `❌ No existe el nivel "${args.level}" en el catálogo. Valores válidos: 1eso, 2eso, 3eso, 4eso, 1bach, 2bach.`,
      );
      process.exit(1);
    }
    levels = [level];
  } else {
    levels = CURRICULUM;
  }

  if (args.dryRun) {
    console.log('🧪 Modo --dry-run: no se escribirá nada en la BD.');
  }

  const stats: Stats = { coursesCreated: 0, coursesExisting: 0, modulesCreated: 0, modulesExisting: 0 };
  let subjectsProcessed = 0;

  for (const level of levels) {
    const matchingSubjects = level.subjects.filter((s) => matchesSubjectFilter(s, args.subject));
    if (matchingSubjects.length === 0) continue;

    console.log(`\n📚 Nivel: ${level.label} (${level.schoolYear})`);
    const schoolYearRecord = await resolveSchoolYear(level, args.dryRun);

    for (const subject of matchingSubjects) {
      const result = await syncCourse(subject, schoolYearRecord, args.dryRun, stats);
      subjectsProcessed += 1;

      if (result.courseAction === 'skipped') continue; // el aviso ya se imprimió en syncCourse

      const prefix = args.dryRun ? '🧪 [dry-run] ' : '';
      const courseLabel = result.courseAction === 'created' ? 'curso nuevo' : 'curso existente';
      const fillLabel = result.filledFields.length > 0 ? `, rellenados: ${result.filledFields.join('/')}` : '';
      console.log(
        `   ${prefix}📖 ${subject.courseTitle} — ${courseLabel}${fillLabel}, módulos: ${result.modulesCreated} nuevos / ${result.modulesExisting} existentes`,
      );
    }
  }

  if (subjectsProcessed === 0) {
    console.error('❌ Ningún nivel/asignatura coincide con los filtros indicados.');
    process.exit(1);
  }

  console.log('\n📊 Resumen:');
  console.log(`   Cursos creados${args.dryRun ? ' (simulado)' : ''}: ${stats.coursesCreated}`);
  console.log(`   Cursos ya existentes: ${stats.coursesExisting}`);
  console.log(`   Módulos creados${args.dryRun ? ' (simulado)' : ''}: ${stats.modulesCreated}`);
  console.log(`   Módulos ya existentes: ${stats.modulesExisting}`);
  console.log(args.dryRun ? '🧪 Dry-run completado: nada se ha escrito en la BD.' : '✅ Catálogo sembrado correctamente.');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
