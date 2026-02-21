import { PrismaClient, Role, ChallengeType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed...');

  // Limpiar datos existentes en orden correcto
  await prisma.userChallenge.deleteMany();
  await prisma.challenge.deleteMany();
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

  const passwordHash = await bcrypt.hash('password123', 10);

  // Crear admin
  const admin = await prisma.user.create({
    data: {
      email: 'admin@vkbacademy.com',
      passwordHash,
      role: Role.ADMIN,
      name: 'Admin VKB',
    },
  });

  // Crear teacher
  const teacher = await prisma.user.create({
    data: {
      email: 'teacher@vkbacademy.com',
      passwordHash,
      role: Role.TEACHER,
      name: 'Coach Martínez',
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

  // Crear tutor
  const tutor = await prisma.user.create({
    data: {
      email: 'oscar.sanchez@egocogito.com',
      passwordHash,
      role: Role.TUTOR,
      name: 'María López',
    },
  });

  // Crear estudiante asignado a 3º ESO, con tutor asignado
  const student = await prisma.user.create({
    data: {
      email: 'student@vkbacademy.com',
      passwordHash,
      role: Role.STUDENT,
      name: 'Juan García',
      schoolYearId: sy3eso.id,
      tutorId: tutor.id,
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

  // Crear retos de ejemplo (uno por cada ChallengeType)
  await Promise.all([
    prisma.challenge.create({
      data: {
        title: 'Primer paso',
        description: 'Completa tu primera lección del curso.',
        type: ChallengeType.LESSON_COMPLETED,
        target: 1,
        points: 10,
        badgeIcon: '📖',
        badgeColor: '#10b981',
      },
    }),
    prisma.challenge.create({
      data: {
        title: 'Módulo superado',
        description: 'Completa todos los temas de un módulo entero.',
        type: ChallengeType.MODULE_COMPLETED,
        target: 1,
        points: 50,
        badgeIcon: '🎓',
        badgeColor: '#3b82f6',
      },
    }),
    prisma.challenge.create({
      data: {
        title: 'Maestro del quiz',
        description: 'Consigue al menos 80 puntos en cualquier quiz.',
        type: ChallengeType.QUIZ_SCORE,
        target: 80,
        points: 30,
        badgeIcon: '🧠',
        badgeColor: '#8b5cf6',
      },
    }),
    prisma.challenge.create({
      data: {
        title: 'Alumno dedicado',
        description: 'Asiste a 3 clases particulares confirmadas.',
        type: ChallengeType.BOOKING_ATTENDED,
        target: 3,
        points: 75,
        badgeIcon: '📅',
        badgeColor: '#f59e0b',
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
    prisma.challenge.create({
      data: {
        title: 'Maratonista',
        description: 'Acumula 5 horas de formación entre lecciones y clases.',
        type: ChallengeType.TOTAL_HOURS,
        target: 5,
        points: 60,
        badgeIcon: '⏱️',
        badgeColor: '#6366f1',
      },
    }),
  ]);

  console.log('✅ Seed completado:');
  console.log(`   👤 Admin:    ${admin.email}`);
  console.log(`   👤 Teacher:  ${teacher.email}`);
  console.log(`   👤 Tutor:    ${tutor.email} → alumno: ${student.name}`);
  console.log(`   👤 Student:  ${student.email} (${sy3eso.label}) → tutor: ${tutor.name}`);
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
