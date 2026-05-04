import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma, TheoryLessonKind } from '@prisma/client';
import { TheoryService } from './theory.service';

describe('TheoryService', () => {
  let prisma: {
    course: { findUnique: jest.Mock };
    enrollment: { findFirst: jest.Mock };
    theoryModule: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      delete: jest.Mock;
    };
  };
  let ai: { generate: jest.Mock };
  let youtube: { findCandidates: jest.Mock };
  let service: TheoryService;

  const baseCourse = {
    id: 'course-1',
    title: 'Matemáticas 3º ESO',
    schoolYear: { label: '3º ESO' },
  };

  const validAiPayload = {
    title: 'Logaritmos: propiedades fundamentales',
    summary: 'Repaso de las propiedades del logaritmo y su aplicación.',
    lessons: [
      {
        kind: 'INTRO',
        heading: 'Introducción',
        body: 'El logaritmo es la operación inversa de la exponenciación.',
      },
      {
        kind: 'CONTENT',
        heading: 'Propiedades',
        body: '**Producto**: log(a*b) = log(a) + log(b).',
      },
      {
        kind: 'EXAMPLE',
        heading: 'Ejemplos',
        body: 'log(100) = 2 porque 10^2 = 100.',
      },
      {
        kind: 'VIDEO',
        heading: 'Vídeo recomendado',
        ytQuery: 'propiedades logaritmos bachillerato',
      },
    ],
  };

  beforeEach(() => {
    prisma = {
      course: { findUnique: jest.fn() },
      enrollment: { findFirst: jest.fn() },
      theoryModule: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
    };
    ai = { generate: jest.fn() };
    youtube = { findCandidates: jest.fn() };
    service = new TheoryService(prisma as never, ai as never, youtube as never);
  });

  describe('generate', () => {
    it('persiste el módulo con sus lecciones cuando el alumno está matriculado', async () => {
      prisma.course.findUnique.mockResolvedValue(baseCourse);
      prisma.enrollment.findFirst.mockResolvedValue({ id: 'enr-1' });
      ai.generate.mockResolvedValue(JSON.stringify(validAiPayload));
      const five = Array.from({ length: 5 }, (_, i) => ({
        youtubeId: `vid${i}`,
        title: `Vídeo ${i}`,
        channelTitle: 'Canal X',
        thumbnailUrl: `https://img/${i}.jpg`,
        durationSeconds: 600,
      }));
      youtube.findCandidates.mockResolvedValue(five);
      prisma.theoryModule.create.mockResolvedValue({ id: 'mod-1', lessons: [] });

      await service.generate('user-1', {
        courseId: 'course-1',
        topic: 'propiedades de logaritmos',
      });

      expect(prisma.theoryModule.create).toHaveBeenCalledTimes(1);
      const args = prisma.theoryModule.create.mock.calls[0][0];
      expect(args.data.userId).toBe('user-1');
      expect(args.data.courseId).toBe('course-1');
      expect(args.data.title).toBe(validAiPayload.title);
      const created = args.data.lessons.create as Array<{
        order: number;
        kind: TheoryLessonKind;
        body: string | null;
        youtubeId: string | null;
        videoCandidates: unknown;
      }>;
      expect(created).toHaveLength(4);
      expect(created.map((l) => l.kind)).toEqual([
        TheoryLessonKind.INTRO,
        TheoryLessonKind.CONTENT,
        TheoryLessonKind.EXAMPLE,
        TheoryLessonKind.VIDEO,
      ]);
      expect(created[0].order).toBe(0);
      expect(created[3].youtubeId).toBe('vid0');
      expect(created[3].videoCandidates).toEqual(five);
      expect(created[3].body).toBeNull();
      expect(created[0].body).toContain('logaritmo');
    });

    it('pide 5 candidatos a YoutubeService para la lección VIDEO', async () => {
      prisma.course.findUnique.mockResolvedValue(baseCourse);
      prisma.enrollment.findFirst.mockResolvedValue({ id: 'enr-1' });
      ai.generate.mockResolvedValue(JSON.stringify(validAiPayload));
      youtube.findCandidates.mockResolvedValue([]);
      prisma.theoryModule.create.mockResolvedValue({ id: 'mod-1', lessons: [] });

      await service.generate('user-1', { courseId: 'course-1', topic: 't' });

      expect(youtube.findCandidates).toHaveBeenCalledWith(expect.any(String), '3º ESO', {
        limit: 5,
      });
    });

    it('persiste lección VIDEO con candidates=null y youtubeId=null si YouTube no encuentra resultados', async () => {
      prisma.course.findUnique.mockResolvedValue(baseCourse);
      prisma.enrollment.findFirst.mockResolvedValue({ id: 'enr-1' });
      ai.generate.mockResolvedValue(JSON.stringify(validAiPayload));
      youtube.findCandidates.mockResolvedValue([]);
      prisma.theoryModule.create.mockResolvedValue({ id: 'mod-1', lessons: [] });

      await service.generate('user-1', { courseId: 'course-1', topic: 't' });

      const created = prisma.theoryModule.create.mock.calls[0][0].data.lessons.create;
      expect(created[3].kind).toBe(TheoryLessonKind.VIDEO);
      expect(created[3].youtubeId).toBeNull();
      expect(created[3].videoCandidates).toBe(Prisma.DbNull);
    });

    it('lanza NotFoundException si el curso no existe', async () => {
      prisma.course.findUnique.mockResolvedValue(null);
      await expect(service.generate('user-1', { courseId: 'missing', topic: 't' })).rejects.toThrow(
        NotFoundException,
      );
      expect(ai.generate).not.toHaveBeenCalled();
    });

    it('lanza ForbiddenException si el alumno no está matriculado', async () => {
      prisma.course.findUnique.mockResolvedValue(baseCourse);
      prisma.enrollment.findFirst.mockResolvedValue(null);
      await expect(
        service.generate('user-1', { courseId: 'course-1', topic: 't' }),
      ).rejects.toThrow(ForbiddenException);
      expect(ai.generate).not.toHaveBeenCalled();
    });

    it('parsea respuesta IA envuelta en ```json```', async () => {
      prisma.course.findUnique.mockResolvedValue(baseCourse);
      prisma.enrollment.findFirst.mockResolvedValue({ id: 'enr-1' });
      ai.generate.mockResolvedValue(`\`\`\`json\n${JSON.stringify(validAiPayload)}\n\`\`\``);
      youtube.findCandidates.mockResolvedValue([{ youtubeId: 'xyz' }]);
      prisma.theoryModule.create.mockResolvedValue({ id: 'mod-1', lessons: [] });

      await service.generate('user-1', { courseId: 'course-1', topic: 't' });
      expect(prisma.theoryModule.create).toHaveBeenCalled();
    });

    it('lanza error si la IA devuelve JSON inválido', async () => {
      prisma.course.findUnique.mockResolvedValue(baseCourse);
      prisma.enrollment.findFirst.mockResolvedValue({ id: 'enr-1' });
      ai.generate.mockResolvedValue('no es json {malformado');
      await expect(
        service.generate('user-1', { courseId: 'course-1', topic: 't' }),
      ).rejects.toThrow();
      expect(prisma.theoryModule.create).not.toHaveBeenCalled();
    });

    it('lanza error si una lección INTRO/CONTENT/EXAMPLE no tiene body', async () => {
      const broken = {
        ...validAiPayload,
        lessons: [{ kind: 'CONTENT', heading: 'sin body' }],
      };
      prisma.course.findUnique.mockResolvedValue(baseCourse);
      prisma.enrollment.findFirst.mockResolvedValue({ id: 'enr-1' });
      ai.generate.mockResolvedValue(JSON.stringify(broken));
      await expect(
        service.generate('user-1', { courseId: 'course-1', topic: 't' }),
      ).rejects.toThrow(/body/);
    });

    it('lanza error si una lección tiene kind desconocido', async () => {
      const broken = {
        ...validAiPayload,
        lessons: [{ kind: 'UNKNOWN', heading: 'x', body: 'y' }],
      };
      prisma.course.findUnique.mockResolvedValue(baseCourse);
      prisma.enrollment.findFirst.mockResolvedValue({ id: 'enr-1' });
      ai.generate.mockResolvedValue(JSON.stringify(broken));
      await expect(
        service.generate('user-1', { courseId: 'course-1', topic: 't' }),
      ).rejects.toThrow(/inválido/);
    });

    it('incluye título de curso, nivel y tema en el prompt', async () => {
      prisma.course.findUnique.mockResolvedValue(baseCourse);
      prisma.enrollment.findFirst.mockResolvedValue({ id: 'enr-1' });
      ai.generate.mockResolvedValue(JSON.stringify(validAiPayload));
      youtube.findCandidates.mockResolvedValue([]);
      prisma.theoryModule.create.mockResolvedValue({ id: 'mod-1', lessons: [] });

      await service.generate('user-1', {
        courseId: 'course-1',
        topic: 'propiedades de logaritmos',
      });

      const prompt = ai.generate.mock.calls[0][0] as string;
      expect(prompt).toContain('Matemáticas 3º ESO');
      expect(prompt).toContain('3º ESO');
      expect(prompt).toContain('propiedades de logaritmos');
    });
  });

  describe('listMine', () => {
    it('filtra por userId y opcionalmente por courseId', async () => {
      prisma.theoryModule.findMany.mockResolvedValue([]);
      await service.listMine('user-1', 'course-1');
      expect(prisma.theoryModule.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', courseId: 'course-1' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('omite courseId si no se pasa', async () => {
      prisma.theoryModule.findMany.mockResolvedValue([]);
      await service.listMine('user-1');
      expect(prisma.theoryModule.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getById', () => {
    it('devuelve el módulo si el usuario es dueño', async () => {
      prisma.theoryModule.findUnique.mockResolvedValue({
        id: 'mod-1',
        userId: 'user-1',
        lessons: [],
      });
      const mod = await service.getById('user-1', 'mod-1');
      expect(mod.id).toBe('mod-1');
    });

    it('lanza NotFoundException si no existe', async () => {
      prisma.theoryModule.findUnique.mockResolvedValue(null);
      await expect(service.getById('user-1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('lanza ForbiddenException si pertenece a otro usuario (aislamiento)', async () => {
      prisma.theoryModule.findUnique.mockResolvedValue({
        id: 'mod-1',
        userId: 'otro-user',
        lessons: [],
      });
      await expect(service.getById('user-1', 'mod-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteById', () => {
    it('elimina el módulo si el usuario es dueño', async () => {
      prisma.theoryModule.findUnique.mockResolvedValue({ id: 'mod-1', userId: 'user-1' });
      prisma.theoryModule.delete.mockResolvedValue({ id: 'mod-1' });
      await service.deleteById('user-1', 'mod-1');
      expect(prisma.theoryModule.delete).toHaveBeenCalledWith({ where: { id: 'mod-1' } });
    });

    it('lanza ForbiddenException si pertenece a otro usuario', async () => {
      prisma.theoryModule.findUnique.mockResolvedValue({ id: 'mod-1', userId: 'otro-user' });
      await expect(service.deleteById('user-1', 'mod-1')).rejects.toThrow(ForbiddenException);
      expect(prisma.theoryModule.delete).not.toHaveBeenCalled();
    });

    it('lanza NotFoundException si el módulo no existe', async () => {
      prisma.theoryModule.findUnique.mockResolvedValue(null);
      await expect(service.deleteById('user-1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });
});
