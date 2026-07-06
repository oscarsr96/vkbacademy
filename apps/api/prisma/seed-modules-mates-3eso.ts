// Script idempotente: amplía el temario oficial de "Matemáticas 3º ESO" con las 14 unidades
// de MATES_3ESO_MODULES. No borra ni modifica módulos existentes.
//
// Uso:
//   DATABASE_URL="postgresql://..." npx ts-node prisma/seed-modules-mates-3eso.ts [courseId]
//
// Si se pasa courseId como argumento, tiene prioridad sobre la búsqueda por título.
import { PrismaClient } from '@prisma/client';
import { MATES_3ESO_MODULES } from './data/mates-3eso-modules';

const prisma = new PrismaClient();

// Normaliza un título para comparación: trim + minúsculas + sin acentos.
function normalizeTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .normalize('NFD')
    // Marca de diacríticos: U+0300 a U+036F (tildes, virgulillas, etc.)
    .replace(/[̀-ͯ]/g, '');
}

async function main() {
  const courseIdArg = process.argv[2];

  const course = courseIdArg
    ? await prisma.course.findUnique({ where: { id: courseIdArg } })
    : await prisma.course.findFirst({
        where: { title: { equals: 'Matemáticas 3º ESO', mode: 'insensitive' } },
      });

  if (!course) {
    console.error(
      courseIdArg
        ? `❌ No se ha encontrado ningún curso con id "${courseIdArg}".`
        : '❌ No se ha encontrado el curso "Matemáticas 3º ESO". Pasa un courseId como argumento si el título difiere.',
    );
    process.exit(1);
  }

  console.log(`📚 Curso: ${course.title} (${course.id})`);

  const existingModules = await prisma.module.findMany({
    where: { courseId: course.id },
    orderBy: { order: 'asc' },
  });

  const existingNormalizedTitles = new Set(existingModules.map((m) => normalizeTitle(m.title)));
  let nextOrder = existingModules.reduce((max, m) => Math.max(max, m.order), 0) + 1;

  for (const title of MATES_3ESO_MODULES) {
    if (existingNormalizedTitles.has(normalizeTitle(title))) {
      console.log(`   ⏭️  Ya existía: ${title}`);
      continue;
    }

    await prisma.module.create({
      data: { title, order: nextOrder, courseId: course.id },
    });
    console.log(`   ✅ Creada: ${title} (order ${nextOrder})`);
    nextOrder += 1;
  }

  console.log('✅ Temario de Matemáticas 3º ESO actualizado.');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
