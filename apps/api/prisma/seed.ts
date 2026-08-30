import { PrismaClient, Role, ChallengeType, ChallengeCadence } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { MATES_3ESO_MODULES } from './data/mates-3eso-modules';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed...');

  // Limpiar datos existentes en orden correcto
  await prisma.academyMember.deleteMany();
  await prisma.billingConfig.deleteMany();
  await prisma.userChallenge.deleteMany();
  await prisma.challenge.deleteMany();
  await prisma.redemption.deleteMany();
  await prisma.quizAttempt.deleteMany();
  await prisma.userProgress.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.answer.deleteMany();
  await prisma.question.deleteMany();
  await prisma.quiz.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.module.deleteMany();
  await prisma.course.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.schoolYear.deleteMany();
  await prisma.academy.deleteMany();

  // Crear niveles educativos
  const schoolYears = await Promise.all([
    prisma.schoolYear.create({ data: { name: '1eso', label: '1º ESO' } }),
    prisma.schoolYear.create({ data: { name: '2eso', label: '2º ESO' } }),
    prisma.schoolYear.create({ data: { name: '3eso', label: '3º ESO' } }),
    prisma.schoolYear.create({ data: { name: '4eso', label: '4º ESO' } }),
    prisma.schoolYear.create({ data: { name: '1bach', label: '1º Bachillerato' } }),
    prisma.schoolYear.create({ data: { name: '2bach', label: '2º Bachillerato' } }),
  ]);

  const [sy1eso, , sy3eso, sy4eso] = schoolYears;

  // Crear academias
  const vkbAcademy = await prisma.academy.create({
    data: {
      slug: 'vallekas-basket',
      name: 'Vallekas Basket Academy',
      logoUrl: 'https://vallekasbasket.com/wp-content/uploads/2022/04/logotipo-vallekas-basket.png',
      primaryColor: '#ea580c',
      domain: 'vkbacademy.vercel.app',
    },
  });

  const cbOscar = await prisma.academy.create({
    data: {
      slug: 'cb-oscar',
      name: 'CB Oscar Academy',
      primaryColor: '#3b82f6',
      domain: 'cboscaracademy.vercel.app',
    },
  });

  const passwordHash = await bcrypt.hash('password123', 10);

  // Crear super admin
  const superAdmin = await prisma.user.create({
    data: {
      email: 'superadmin@vkbacademy.com',
      passwordHash,
      role: Role.SUPER_ADMIN,
      name: 'super-admin',
    },
  });

  // Crear admin (vinculado a Vallekas Basket)
  const admin = await prisma.user.create({
    data: {
      email: 'admin@vkbacademy.com',
      passwordHash,
      role: Role.ADMIN,
      name: 'admin',
      academyMembers: { create: { academyId: vkbAcademy.id } },
    },
  });

  // Crear admin para CB Oscar
  const adminOscar = await prisma.user.create({
    data: {
      email: 'admin@cboscar.com',
      passwordHash,
      role: Role.ADMIN,
      name: 'admin-oscar',
      academyMembers: { create: { academyId: cbOscar.id } },
    },
  });

  // Crear estudiante asignado a 3º ESO, con email de contacto familiar (vinculado a VKB)
  const student = await prisma.user.create({
    data: {
      email: 'student@vkbacademy.com',
      passwordHash,
      role: Role.STUDENT,
      name: 'juan-garcia',
      username: 'juan-garcia',
      schoolYearId: sy3eso.id,
      guardianEmail: 'maria.lopez@example.com',
      academyMembers: { create: { academyId: vkbAcademy.id } },
    },
  });

  // Curso principal: 3º ESO — coincide con el student de ejemplo
  const course = await prisma.course.create({
    data: {
      title: 'Fundamentos del Baloncesto',
      description: 'Curso introductorio con técnicas básicas de dribbling, pase y tiro.',
      published: true,
      schoolYearId: sy3eso.id,
      modules: {
        create: [
          {
            title: 'Módulo 1: Manejo del balón',
            order: 1,
            lessons: {
              create: [
                {
                  title: 'Técnica de dribbling básico',
                  type: 'VIDEO',
                  order: 1,
                },
                {
                  title: 'Test de dribbling',
                  type: 'QUIZ',
                  order: 2,
                  quiz: {
                    create: {
                      questions: {
                        create: [
                          {
                            text: '¿Con qué parte de la mano se realiza el dribbling?',
                            type: 'SINGLE',
                            order: 1,
                            answers: {
                              createMany: {
                                data: [
                                  { text: 'La palma', isCorrect: false },
                                  { text: 'Los dedos', isCorrect: true },
                                  { text: 'El puño', isCorrect: false },
                                  { text: 'La muñeca', isCorrect: false },
                                ],
                              },
                            },
                          },
                          {
                            text: '¿Es correcto mirar el balón al driblar?',
                            type: 'TRUE_FALSE',
                            order: 2,
                            answers: {
                              createMany: {
                                data: [
                                  { text: 'Verdadero', isCorrect: false },
                                  { text: 'Falso', isCorrect: true },
                                ],
                              },
                            },
                          },
                        ],
                      },
                    },
                  },
                },
              ],
            },
          },
          {
            title: 'Módulo 2: Pase y recepción',
            order: 2,
            lessons: {
              create: [
                {
                  title: 'Tipos de pase',
                  type: 'VIDEO',
                  order: 1,
                },
              ],
            },
          },
        ],
      },
    },
  });

  // Curso: Matemáticas de 3º ESO — visible para el student de ejemplo
  // Temario oficial: las 14 unidades de MATES_3ESO_MODULES, en orden
  const courseMath = await prisma.course.create({
    data: {
      title: 'Matemáticas 3º ESO',
      description: 'Repaso de álgebra, geometría y estadística para 3º de ESO.',
      published: true,
      schoolYearId: sy3eso.id,
      modules: {
        create: MATES_3ESO_MODULES.map((title, index) => ({
          title,
          order: index + 1,
        })),
      },
    },
  });

  // Curso extra: 1º ESO — NO visible para el student de ejemplo
  const course2 = await prisma.course.create({
    data: {
      title: 'Técnicas de Pase',
      description: 'Aprende los fundamentos del pase en baloncesto para principiantes.',
      published: true,
      schoolYearId: sy1eso.id,
    },
  });

  // Curso extra: 4º ESO — NO visible para el student de ejemplo
  const course3 = await prisma.course.create({
    data: {
      title: 'Defensa Avanzada',
      description: 'Estrategias y posicionamiento defensivo para jugadores avanzados.',
      published: true,
      schoolYearId: sy4eso.id,
    },
  });

  // Matricular a Juan en Matemáticas 3º ESO
  await prisma.enrollment.create({
    data: { userId: student.id, courseId: courseMath.id },
  });

  // ── Asignaturas por defecto disponibles para auto-matriculación ─────────
  // schoolYearId: null → visibles para alumnos de cualquier nivel
  await Promise.all([
    prisma.course.create({
      data: {
        title: 'Matemáticas',
        description: 'Asignatura de Matemáticas. Matricúlate para acceder al contenido.',
        published: true,
        subject: 'Matemáticas',
      },
    }),
    prisma.course.create({
      data: {
        title: 'Física y Química',
        description: 'Asignatura de Física y Química. Matricúlate para acceder al contenido.',
        published: true,
        subject: 'Física y Química',
      },
    }),
    prisma.course.create({
      data: {
        title: 'Inglés',
        description: 'Asignatura de Inglés. Matricúlate para acceder al contenido.',
        published: true,
        subject: 'Inglés',
      },
    }),
  ]);

  // Retos de ejemplo — 20 retos cubriendo los 14 ChallengeType.
  // Los WEEKLY se reinician cada semana ISO y vuelven a conceder puntos,
  // así que su puntuación es deliberadamente más baja que la de los logros.
  const challengesData: Array<{
    title: string;
    description: string;
    type: ChallengeType;
    cadence?: ChallengeCadence;
    target: number;
    points: number;
    badgeIcon: string;
    badgeColor: string;
  }> = [
    // ── Arranque y amplitud ──────────────────────────────────────────────────
    {
      title: 'Primer plan',
      description: 'Crea tu primer curso de estudio.',
      type: ChallengeType.STUDY_PLAN_CREATED,
      target: 1,
      points: 15,
      badgeIcon: '🚀',
      badgeColor: '#10b981',
    },
    {
      title: 'Planificador',
      description: 'Crea 5 cursos de estudio.',
      type: ChallengeType.STUDY_PLAN_CREATED,
      target: 5,
      points: 50,
      badgeIcon: '🗺️',
      badgeColor: '#059669',
    },
    {
      title: 'Diez temas',
      description: 'Estudia 10 temas, sumando los de todos tus cursos.',
      type: ChallengeType.TOPICS_STUDIED,
      target: 10,
      points: 60,
      badgeIcon: '📚',
      badgeColor: '#0ea5e9',
    },
    {
      title: 'Treinta temas',
      description: 'Estudia 30 temas, sumando los de todos tus cursos.',
      type: ChallengeType.TOPICS_STUDIED,
      target: 30,
      points: 150,
      badgeIcon: '🧠',
      badgeColor: '#0284c7',
    },
    {
      title: 'Todoterreno',
      description: 'Crea cursos de estudio de 3 asignaturas distintas.',
      type: ChallengeType.SUBJECT_VARIETY,
      target: 3,
      points: 70,
      badgeIcon: '🎒',
      badgeColor: '#8b5cf6',
    },
    {
      title: 'Teoría al día',
      description: 'Genera los apuntes de 15 temas.',
      type: ChallengeType.THEORY_COMPLETED,
      target: 15,
      points: 80,
      badgeIcon: '📖',
      badgeColor: '#6366f1',
    },

    // ── Ejercicios ───────────────────────────────────────────────────────────
    {
      title: 'Primeros aciertos',
      description: 'Acierta 10 ejercicios en total.',
      type: ChallengeType.EXERCISES_SOLVED,
      target: 10,
      points: 30,
      badgeIcon: '✏️',
      badgeColor: '#22c55e',
    },
    {
      title: 'Cien dianas',
      description: 'Acierta 100 ejercicios en total.',
      type: ChallengeType.EXERCISES_SOLVED,
      target: 100,
      points: 200,
      badgeIcon: '🎯',
      badgeColor: '#16a34a',
    },
    {
      title: 'Sin fallar',
      description: 'Acierta 10 ejercicios seguidos sin fallar ninguno.',
      type: ChallengeType.EXERCISES_CORRECT_STREAK,
      target: 10,
      points: 90,
      badgeIcon: '⚡',
      badgeColor: '#f59e0b',
    },
    {
      title: 'Imparable',
      description: 'Acierta 25 ejercicios seguidos sin fallar ninguno.',
      type: ChallengeType.EXERCISES_CORRECT_STREAK,
      target: 25,
      points: 220,
      badgeIcon: '🔥',
      badgeColor: '#ea580c',
    },
    {
      title: 'Sin miedo',
      description: 'Acierta 20 ejercicios de nivel difícil.',
      type: ChallengeType.HARD_EXERCISES_SOLVED,
      target: 20,
      points: 160,
      badgeIcon: '🧗',
      badgeColor: '#dc2626',
    },

    // ── Exámenes ─────────────────────────────────────────────────────────────
    {
      title: 'Primer examen',
      description: 'Entrega tu primer examen, de cualquier nivel.',
      type: ChallengeType.EXAM_COMPLETED,
      target: 1,
      points: 20,
      badgeIcon: '📝',
      badgeColor: '#13aff0',
    },
    {
      title: 'Veterano',
      description: 'Entrega 20 exámenes en total.',
      type: ChallengeType.EXAM_COMPLETED,
      target: 20,
      points: 140,
      badgeIcon: '🗂️',
      badgeColor: '#0369a1',
    },
    {
      title: 'Notable',
      description: 'Saca un 80% o más en un examen.',
      type: ChallengeType.EXAM_SCORE,
      target: 80,
      points: 70,
      badgeIcon: '⭐',
      badgeColor: '#ffd24d',
    },
    {
      title: 'Pleno',
      description: 'Saca un 100% en 3 exámenes.',
      type: ChallengeType.EXAM_PERFECT,
      target: 3,
      points: 180,
      badgeIcon: '💯',
      badgeColor: '#facc15',
    },
    {
      title: 'Nivel experto',
      description: 'Saca un 70% o más en un examen de nivel difícil.',
      type: ChallengeType.EXAM_HARD_SCORE,
      target: 70,
      points: 200,
      badgeIcon: '🏆',
      badgeColor: '#f5911e',
    },

    // ── Hábito (permanentes) ─────────────────────────────────────────────────
    {
      title: 'Pregunta sin miedo',
      description: 'Hazle 25 preguntas al tutor IA.',
      type: ChallengeType.TUTOR_QUESTIONS,
      target: 25,
      points: 60,
      badgeIcon: '💬',
      badgeColor: '#a855f7',
    },
    {
      title: 'Semana perfecta',
      description: 'Estudia algo 7 días seguidos.',
      type: ChallengeType.STREAK_DAILY,
      target: 7,
      points: 120,
      badgeIcon: '📅',
      badgeColor: '#ec4899',
    },
    {
      title: 'Mes constante',
      description: 'Estudia algo 30 días seguidos.',
      type: ChallengeType.STREAK_DAILY,
      target: 30,
      points: 400,
      badgeIcon: '🗓️',
      badgeColor: '#db2777',
    },
    {
      title: 'Un mes en racha',
      description: 'Estudia algo 4 semanas seguidas.',
      type: ChallengeType.STREAK_WEEKLY,
      target: 4,
      points: 150,
      badgeIcon: '🔗',
      badgeColor: '#14b8a6',
    },

    // ── Misiones semanales ───────────────────────────────────────────────────
    {
      title: 'Misión: 20 ejercicios',
      description: 'Acierta 20 ejercicios esta semana.',
      type: ChallengeType.EXERCISES_SOLVED,
      cadence: ChallengeCadence.WEEKLY,
      target: 20,
      points: 25,
      badgeIcon: '🗡️',
      badgeColor: '#22c55e',
    },
    {
      title: 'Misión: 5 difíciles',
      description: 'Acierta 5 ejercicios de nivel difícil esta semana.',
      type: ChallengeType.HARD_EXERCISES_SOLVED,
      cadence: ChallengeCadence.WEEKLY,
      target: 5,
      points: 30,
      badgeIcon: '⛰️',
      badgeColor: '#dc2626',
    },
    {
      title: 'Misión: 3 temas',
      description: 'Estudia 3 temas esta semana.',
      type: ChallengeType.TOPICS_STUDIED,
      cadence: ChallengeCadence.WEEKLY,
      target: 3,
      points: 25,
      badgeIcon: '📗',
      badgeColor: '#0ea5e9',
    },
    {
      title: 'Misión: 2 exámenes',
      description: 'Entrega 2 exámenes esta semana.',
      type: ChallengeType.EXAM_COMPLETED,
      cadence: ChallengeCadence.WEEKLY,
      target: 2,
      points: 25,
      badgeIcon: '🧾',
      badgeColor: '#13aff0',
    },
    {
      title: 'Misión: pregunta al tutor',
      description: 'Hazle 5 preguntas al tutor IA esta semana.',
      type: ChallengeType.TUTOR_QUESTIONS,
      cadence: ChallengeCadence.WEEKLY,
      target: 5,
      points: 20,
      badgeIcon: '🙋',
      badgeColor: '#a855f7',
    },
  ];

  await Promise.all(challengesData.map((data) => prisma.challenge.create({ data })));

  console.log('✅ Seed completado:');
  console.log(`   🏫 Academy:  ${vkbAcademy.name} (${vkbAcademy.slug})`);
  console.log(`   🏫 Academy:  ${cbOscar.name} (${cbOscar.slug})`);
  console.log(`   👤 SuperAdmin: ${superAdmin.email}`);
  console.log(`   👤 Admin VKB:  ${admin.email}`);
  console.log(`   👤 Admin Oscar: ${adminOscar.email}`);
  console.log(
    `   👤 Student:  ${student.email} (${sy3eso.label}, VKB) → contacto familiar: ${student.guardianEmail}`,
  );
  console.log(`   📚 Curso:    ${course.title} (${sy3eso.label})`);
  console.log(`   📚 Curso:    ${courseMath.title} (${sy3eso.label}) ← Juan matriculado`);
  console.log(`   📚 Curso:    ${course2.title} (${sy1eso.label})`);
  console.log(`   📚 Curso:    ${course3.title} (${sy4eso.label})`);
  console.log('\n   Contraseña para todos: password123');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
