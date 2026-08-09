import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AdminContentService } from './admin-content.service';
import { PrismaService } from '../prisma/prisma.service';
import { YoutubeService } from '../youtube/youtube.service';
import { ImportCourseDto } from './dto/import-course.dto';

/**
 * Tests de importCourse. Cubren la fidelidad del viaje export → import entre
 * entornos: los metadatos del curso y el tipo real de cada pregunta deben
 * sobrevivir, y un JSON antiguo sin esos campos debe comportarse como siempre.
 */
describe('AdminContentService.importCourse', () => {
  let service: AdminContentService;

  // Cliente transaccional: cada método devuelve algo con id para poder encadenar
  let tx: {
    course: { create: jest.Mock; findUnique: jest.Mock };
    module: { create: jest.Mock };
    lesson: { create: jest.Mock };
    quiz: { create: jest.Mock };
    question: { createMany: jest.Mock; findMany: jest.Mock };
    answer: { createMany: jest.Mock };
    examQuestion: { createMany: jest.Mock; findMany: jest.Mock };
    examAnswer: { createMany: jest.Mock };
  };

  let mockPrisma: {
    schoolYear: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  };

  const schoolYear = { id: 'sy-1', name: '1eso', label: '1º ESO' };

  let lastExamQuestionCount = 0;

  // Curso mínimo válido: un módulo con una lección VIDEO
  const minimalDto = (): ImportCourseDto =>
    ({
      name: 'Matemáticas 1º ESO',
      schoolYear: '1eso',
      modules: [
        {
          title: 'Números naturales',
          order: 1,
          lessons: [{ title: 'Intro', type: 'VIDEO', order: 1, youtubeId: 'abc123' }],
        },
      ],
    }) as ImportCourseDto;

  beforeEach(async () => {
    lastExamQuestionCount = 0;

    tx = {
      course: {
        create: jest.fn().mockResolvedValue({ id: 'course-1' }),
        findUnique: jest.fn().mockResolvedValue({ id: 'course-1', title: 'Matemáticas 1º ESO' }),
      },
      module: { create: jest.fn().mockResolvedValue({ id: 'module-1' }) },
      lesson: { create: jest.fn().mockResolvedValue({ id: 'lesson-1' }) },
      quiz: { create: jest.fn().mockResolvedValue({ id: 'quiz-1' }) },
      question: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([{ id: 'question-1' }]),
      },
      answer: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
      // findMany devuelve tantas filas como creó el createMany previo: el
      // servicio las relee para colgarles las respuestas por posición
      examQuestion: {
        createMany: jest.fn((args: { data: unknown[] }) => {
          lastExamQuestionCount = args.data.length;
          return Promise.resolve({ count: lastExamQuestionCount });
        }),
        findMany: jest.fn(() =>
          Promise.resolve(
            Array.from({ length: lastExamQuestionCount }, (_, i) => ({ id: `exam-q-${i + 1}` })),
          ),
        ),
      },
      examAnswer: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };

    mockPrisma = {
      schoolYear: { findFirst: jest.fn().mockResolvedValue(schoolYear) },
      $transaction: jest.fn((cb: (client: typeof tx) => unknown) => cb(tx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminContentService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: YoutubeService, useValue: { findCandidates: jest.fn() } },
      ],
    }).compile();

    service = module.get<AdminContentService>(AdminContentService);
  });

  it('rechaza un nivel educativo inexistente', async () => {
    mockPrisma.schoolYear.findFirst.mockResolvedValue(null);

    await expect(service.importCourse(minimalDto())).rejects.toThrow(BadRequestException);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  describe('metadatos del curso', () => {
    it('persiste description, coverUrl, subject y published cuando vienen en el JSON', async () => {
      const dto = {
        ...minimalDto(),
        description: 'Curso completo de matemáticas',
        coverUrl: 'https://cdn.example.com/portada.jpg',
        subject: 'Matemáticas',
        published: true,
      } as ImportCourseDto;

      await service.importCourse(dto);

      expect(tx.course.create).toHaveBeenCalledWith({
        data: {
          title: 'Matemáticas 1º ESO',
          schoolYearId: 'sy-1',
          description: 'Curso completo de matemáticas',
          coverUrl: 'https://cdn.example.com/portada.jpg',
          subject: 'Matemáticas',
          published: true,
        },
      });
    });

    it('crea el curso despublicado y sin metadatos con un JSON legacy', async () => {
      await service.importCourse(minimalDto());

      expect(tx.course.create).toHaveBeenCalledWith({
        data: {
          title: 'Matemáticas 1º ESO',
          schoolYearId: 'sy-1',
          description: null,
          coverUrl: null,
          subject: null,
          published: false,
        },
      });
    });
  });

  describe('tipo de las preguntas', () => {
    it('respeta el type de las preguntas de examen del curso', async () => {
      const dto = {
        ...minimalDto(),
        examQuestions: [
          {
            text: '¿El cero es natural?',
            type: 'TRUE_FALSE',
            answers: [{ text: 'Sí', isCorrect: true }],
          },
          { text: 'Marca los primos', type: 'MULTIPLE', answers: [{ text: '7', isCorrect: true }] },
        ],
      } as ImportCourseDto;

      await service.importCourse(dto);

      expect(tx.examQuestion.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({ type: 'TRUE_FALSE', order: 1 }),
          expect.objectContaining({ type: 'MULTIPLE', order: 2 }),
        ],
      });
    });

    it('respeta el type de las preguntas de examen del módulo', async () => {
      const dto = minimalDto();
      dto.modules[0].examQuestions = [
        { text: '¿7 es primo?', type: 'TRUE_FALSE', answers: [{ text: 'Sí', isCorrect: true }] },
      ] as ImportCourseDto['modules'][0]['examQuestions'];

      await service.importCourse(dto);

      expect(tx.examQuestion.createMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({ moduleId: 'module-1', type: 'TRUE_FALSE' })],
      });
    });

    it('respeta el type de las preguntas de un quiz', async () => {
      const dto = minimalDto();
      dto.modules[0].lessons = [
        {
          title: 'Test de repaso',
          type: 'QUIZ',
          order: 1,
          quiz: {
            questions: [
              {
                text: 'Marca los pares',
                type: 'MULTIPLE',
                answers: [{ text: '2', isCorrect: true }],
              },
            ],
          },
        },
      ] as ImportCourseDto['modules'][0]['lessons'];

      await service.importCourse(dto);

      expect(tx.question.createMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({ type: 'MULTIPLE', order: 1, quizId: 'quiz-1' })],
      });
    });

    it('cae a SINGLE cuando la pregunta no trae type', async () => {
      const dto = {
        ...minimalDto(),
        examQuestions: [{ text: '¿Cuánto es 2+2?', answers: [{ text: '4', isCorrect: true }] }],
      } as ImportCourseDto;

      await service.importCourse(dto);

      expect(tx.examQuestion.createMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({ type: 'SINGLE' })],
      });
    });
  });
});
