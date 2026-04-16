import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ExercisesService } from './exercises.service';

describe('ExercisesService', () => {
  let prisma: {
    course: { findUnique: jest.Mock };
    enrollment: { findFirst: jest.Mock };
  };
  let ai: { generate: jest.Mock };
  let service: ExercisesService;

  const baseCourse = {
    id: 'course-1',
    title: 'Matemáticas 3º ESO',
    schoolYear: { label: '3º ESO' },
  };

  beforeEach(() => {
    prisma = {
      course: { findUnique: jest.fn() },
      enrollment: { findFirst: jest.fn() },
    };
    ai = { generate: jest.fn() };
    service = new ExercisesService(prisma as never, ai as never);
  });

  describe('generate', () => {
    it('devuelve los ejercicios generados por la IA cuando el alumno está matriculado', async () => {
      prisma.course.findUnique.mockResolvedValue(baseCourse);
      prisma.enrollment.findFirst.mockResolvedValue({ id: 'enr-1' });
      ai.generate.mockResolvedValue(
        JSON.stringify({
          exercises: [
            {
              statement: '¿Cuánto vale log(100)?',
              type: 'SINGLE',
              options: ['1', '2', '10'],
              solution: '2',
              explanation: 'log base 10 de 100 es 2',
            },
            {
              statement: '¿log(a) + log(b) = log(a + b)?',
              type: 'TRUE_FALSE',
              options: ['Verdadero', 'Falso'],
              solution: 'Falso',
              explanation: 'Es log(a*b)',
            },
          ],
        }),
      );

      const result = await service.generate('user-1', {
        courseId: 'course-1',
        topic: 'propiedades de logaritmos',
        count: 2,
      });

      expect(result.exercises).toHaveLength(2);
      expect(result.exercises[0].statement).toContain('log(100)');
      expect(result.exercises[1].type).toBe('TRUE_FALSE');
      expect(prisma.enrollment.findFirst).toHaveBeenCalledWith({
        where: { userId: 'user-1', courseId: 'course-1' },
      });
    });

    it('lanza NotFoundException si el curso no existe', async () => {
      prisma.course.findUnique.mockResolvedValue(null);
      await expect(
        service.generate('user-1', { courseId: 'missing', topic: 't', count: 5 }),
      ).rejects.toThrow(NotFoundException);
      expect(ai.generate).not.toHaveBeenCalled();
    });

    it('lanza ForbiddenException si el alumno no está matriculado en el curso', async () => {
      prisma.course.findUnique.mockResolvedValue(baseCourse);
      prisma.enrollment.findFirst.mockResolvedValue(null);

      await expect(
        service.generate('user-1', { courseId: 'course-1', topic: 't', count: 5 }),
      ).rejects.toThrow(ForbiddenException);
      expect(ai.generate).not.toHaveBeenCalled();
    });

    it('parsea respuesta de IA con markdown ```json``` rodeando el contenido', async () => {
      prisma.course.findUnique.mockResolvedValue(baseCourse);
      prisma.enrollment.findFirst.mockResolvedValue({ id: 'enr-1' });
      ai.generate.mockResolvedValue(
        '```json\n{"exercises":[{"statement":"x","type":"OPEN","options":[],"solution":"y","explanation":"z"}]}\n```',
      );

      const result = await service.generate('user-1', {
        courseId: 'course-1',
        topic: 't',
        count: 1,
      });

      expect(result.exercises).toHaveLength(1);
      expect(result.exercises[0].type).toBe('OPEN');
    });

    it('lanza error si la IA devuelve JSON inválido', async () => {
      prisma.course.findUnique.mockResolvedValue(baseCourse);
      prisma.enrollment.findFirst.mockResolvedValue({ id: 'enr-1' });
      ai.generate.mockResolvedValue('esto no es JSON {malformado');

      await expect(
        service.generate('user-1', { courseId: 'course-1', topic: 't', count: 1 }),
      ).rejects.toThrow();
    });

    it('incluye en el prompt el título del curso, nivel educativo, tema y número', async () => {
      prisma.course.findUnique.mockResolvedValue(baseCourse);
      prisma.enrollment.findFirst.mockResolvedValue({ id: 'enr-1' });
      ai.generate.mockResolvedValue('{"exercises":[]}');

      await service.generate('user-1', {
        courseId: 'course-1',
        topic: 'propiedades de logaritmos',
        count: 5,
      });

      const prompt = ai.generate.mock.calls[0][0] as string;
      expect(prompt).toContain('Matemáticas 3º ESO');
      expect(prompt).toContain('3º ESO');
      expect(prompt).toContain('propiedades de logaritmos');
      expect(prompt).toContain('5');
    });
  });
});
