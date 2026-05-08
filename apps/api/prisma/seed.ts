import { PrismaClient, Role, ChallengeType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed...');

  // Limpiar datos existentes en orden correcto
  await prisma.academyMember.deleteMany();
  await prisma.billingConfig.deleteMany();
  await prisma.userChallenge.deleteMany();
  await prisma.challenge.deleteMany();
  await prisma.redemption.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.availabilitySlot.deleteMany();
  await prisma.quizAttempt.deleteMany();
  await prisma.userProgress.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.answer.deleteMany();
  await prisma.question.deleteMany();
  await prisma.quiz.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.module.deleteMany();
  await prisma.course.deleteMany();
  await prisma.teacherProfile.deleteMany();
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

  // Crear teacher
  const teacher = await prisma.user.create({
    data: {
      email: 'teacher@vkbacademy.com',
      passwordHash,
      role: Role.TEACHER,
      name: 'teacher',
      teacherProfile: {
        create: {
          bio: 'Entrenador de baloncesto con 10 años de experiencia.',
          availability: {
            createMany: {
              data: [
                { dayOfWeek: 1, startTime: '09:00', endTime: '10:00' },
                { dayOfWeek: 1, startTime: '10:00', endTime: '11:00' },
                { dayOfWeek: 3, startTime: '16:00', endTime: '17:00' },
                { dayOfWeek: 5, startTime: '09:00', endTime: '10:00' },
              ],
            },
          },
        },
      },
    },
  });

  // Crear tutor (vinculado a VKB)
  const tutor = await prisma.user.create({
    data: {
      email: 'tutor@vkbacademy.com',
      passwordHash,
      role: Role.TUTOR,
      name: 'maria-lopez',
      academyMembers: { create: { academyId: vkbAcademy.id } },
    },
  });

  // Crear estudiante asignado a 3º ESO, con tutor asignado (vinculado a VKB)
  const student = await prisma.user.create({
    data: {
      email: 'student@vkbacademy.com',
      passwordHash,
      role: Role.STUDENT,
      name: 'juan-garcia',
      schoolYearId: sy3eso.id,
      tutorId: tutor.id,
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
  const courseMath = await prisma.course.create({
    data: {
      title: 'Matemáticas 3º ESO',
      description: 'Repaso de álgebra, geometría y estadística para 3º de ESO.',
      published: true,
      schoolYearId: sy3eso.id,
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

  // Crear retos de ejemplo (Ejercicios, Teoría, Exámenes + racha)
  await Promise.all([
    prisma.challenge.create({
      data: {
        title: 'Primer ejercicio',
        description: 'Completa tu primer ejercicio.',
        type: ChallengeType.EXERCISE_COMPLETED,
        target: 1,
        points: 10,
        badgeIcon: '🎯',
        badgeColor: '#10b981',
      },
    }),
    prisma.challenge.create({
      data: {
        title: 'Entrenado',
        description: 'Completa 25 ejercicios.',
        type: ChallengeType.EXERCISE_COMPLETED,
        target: 25,
        points: 80,
        badgeIcon: '💪',
        badgeColor: '#22c55e',
      },
    }),
    prisma.challenge.create({
      data: {
        title: 'Ojo clínico',
        description: 'Consigue al menos 80 puntos en cualquier ejercicio.',
        type: ChallengeType.EXERCISE_SCORE,
        target: 80,
        points: 30,
        badgeIcon: '🧠',
        badgeColor: '#8b5cf6',
      },
    }),
    prisma.challenge.create({
      data: {
        title: 'Curioso',
        description: 'Genera tu primer módulo de teoría.',
        type: ChallengeType.THEORY_COMPLETED,
        target: 1,
        points: 15,
        badgeIcon: '📚',
        badgeColor: '#0ea5e9',
      },
    }),
    prisma.challenge.create({
      data: {
        title: 'Estudioso',
        description: 'Genera 10 módulos de teoría.',
        type: ChallengeType.THEORY_COMPLETED,
        target: 10,
        points: 70,
        badgeIcon: '🎓',
        badgeColor: '#3b82f6',
      },
    }),
    prisma.challenge.create({
      data: {
        title: 'Primer examen',
        description: 'Entrega tu primer examen.',
        type: ChallengeType.EXAM_COMPLETED,
        target: 1,
        points: 25,
        badgeIcon: '📝',
        badgeColor: '#f97316',
      },
    }),
    prisma.challenge.create({
      data: {
        title: 'Maestro del examen',
        description: 'Consigue al menos 90 puntos en cualquier examen.',
        type: ChallengeType.EXAM_SCORE,
        target: 90,
        points: 100,
        badgeIcon: '🏆',
        badgeColor: '#eab308',
      },
    }),
    prisma.challenge.create({
      data: {
        title: 'Maratón de ejercicios',
        description: 'Acumula 5 horas haciendo ejercicios.',
        type: ChallengeType.TOTAL_HOURS_EXERCISE,
        target: 5,
        points: 60,
        badgeIcon: '⏱️',
        badgeColor: '#6366f1',
      },
    }),
    prisma.challenge.create({
      data: {
        title: 'Maratón de teoría',
        description: 'Acumula 5 horas estudiando teoría.',
        type: ChallengeType.TOTAL_HOURS_THEORY,
        target: 5,
        points: 60,
        badgeIcon: '📖',
        badgeColor: '#14b8a6',
      },
    }),
    prisma.challenge.create({
      data: {
        title: 'Maratón de exámenes',
        description: 'Acumula 3 horas resolviendo exámenes.',
        type: ChallengeType.TOTAL_HOURS_EXAM,
        target: 3,
        points: 90,
        badgeIcon: '⌛',
        badgeColor: '#ec4899',
      },
    }),
    prisma.challenge.create({
      data: {
        title: 'Racha de fuego',
        description: 'Mantén una racha activa de 4 semanas consecutivas.',
        type: ChallengeType.STREAK_WEEKLY,
        target: 4,
        points: 100,
        badgeIcon: '🔥',
        badgeColor: '#ef4444',
      },
    }),
  ]);

  console.log('✅ Seed completado:');
  console.log(`   🏫 Academy:  ${vkbAcademy.name} (${vkbAcademy.slug})`);
  console.log(`   🏫 Academy:  ${cbOscar.name} (${cbOscar.slug})`);
  console.log(`   👤 SuperAdmin: ${superAdmin.email}`);
  console.log(`   👤 Admin VKB:  ${admin.email}`);
  console.log(`   👤 Admin Oscar: ${adminOscar.email}`);
  console.log(`   👤 Teacher:  ${teacher.email} (compartido)`);
  console.log(`   👤 Tutor:    ${tutor.email} → alumno: ${student.name} (VKB)`);
  console.log(`   👤 Student:  ${student.email} (${sy3eso.label}, VKB) → tutor: ${tutor.name}`);
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
