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

  describe('generateForTopics', () => {
    function easyExerciseJson(): string {
      return JSON.stringify({
        exercises: [
          {
            difficulty: 'EASY',
            statement: 'x',
            type: 'SINGLE',
            options: ['a', 'b'],
            solution: 'a',
            explanation: 'porque sí',
          },
        ],
      });
    }

    it('hace una llamada IA por tema (no una combinada)', async () => {
      prisma.course.findUnique.mockResolvedValue(baseCourse);
      prisma.enrollment.findFirst.mockResolvedValue({ id: 'enr-1' });
      ai.generate.mockResolvedValue(easyExerciseJson());

      const result = await service.generateForTopics('user-1', {
        courseId: 'course-1',
        topics: ['Tema A', 'Tema B'],
        perTopic: { easy: 1, medium: 0, hard: 0 },
      });

      expect(ai.generate).toHaveBeenCalledTimes(2);
      expect(result.exercises).toHaveLength(2);
      // El topicLabel lo asigna el servicio localmente, no la IA
      expect(result.exercises.map((e) => e.topicLabel)).toEqual(['Tema A', 'Tema B']);
      expect(result.exercises.every((e) => e.difficulty === 'EASY')).toBe(true);
    });

    it('incluye la instrucción de LaTeX (con escape JSON) en el prompt de generación', async () => {
      prisma.course.findUnique.mockResolvedValue(baseCourse);
      prisma.enrollment.findFirst.mockResolvedValue({ id: 'enr-1' });
      ai.generate.mockResolvedValue(easyExerciseJson());

      await service.generateForTopics('user-1', {
        courseId: 'course-1',
        topics: ['Fracciones'],
        perTopic: { easy: 1, medium: 0, hard: 0 },
      });

      const prompt = ai.generate.mock.calls[0][0] as string;
      expect(prompt).toContain('LaTeX');
      // El ejemplo del prompt debe enseñar la doble barra del escape JSON
      expect(prompt).toContain('$\\\\frac{1}{2}$');
    });

    it('lanza ForbiddenException si el alumno no está matriculado', async () => {
      prisma.course.findUnique.mockResolvedValue(baseCourse);
      prisma.enrollment.findFirst.mockResolvedValue(null);

      await expect(
        service.generateForTopics('user-1', {
          courseId: 'course-1',
          topics: ['Tema A'],
          perTopic: { easy: 1, medium: 0, hard: 0 },
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(ai.generate).not.toHaveBeenCalled();
    });

    it('lanza NotFoundException si el curso no existe', async () => {
      prisma.course.findUnique.mockResolvedValue(null);

      await expect(
        service.generateForTopics('user-1', {
          courseId: 'missing',
          topics: ['Tema A'],
          perTopic: { easy: 1, medium: 0, hard: 0 },
        }),
      ).rejects.toThrow(NotFoundException);
      expect(ai.generate).not.toHaveBeenCalled();
    });

    it('reintenta (2x) un tema cuyo conteo por dificultad no cuadra, y acepta si el 2º intento es correcto', async () => {
      prisma.course.findUnique.mockResolvedValue(baseCourse);
      prisma.enrollment.findFirst.mockResolvedValue({ id: 'enr-1' });
      // 1er intento: la IA devuelve MEDIUM cuando se pidió EASY (conteo incumplido)
      ai.generate
        .mockResolvedValueOnce(
          JSON.stringify({
            exercises: [
              {
                difficulty: 'MEDIUM',
                statement: 'x',
                type: 'SINGLE',
                options: ['a', 'b'],
                solution: 'a',
                explanation: 'z',
              },
            ],
          }),
        )
        .mockResolvedValueOnce(easyExerciseJson());

      const result = await service.generateForTopics('user-1', {
        courseId: 'course-1',
        topics: ['Fracciones'],
        perTopic: { easy: 1, medium: 0, hard: 0 },
      });

      expect(ai.generate).toHaveBeenCalledTimes(2);
      expect(result.exercises).toHaveLength(1);
      expect(result.exercises[0].difficulty).toBe('EASY');
      expect(result.exercises[0].topicLabel).toBe('Fracciones');
    });

    it('lanza error tras agotar los 2 intentos si el conteo por dificultad sigue sin cuadrar', async () => {
      prisma.course.findUnique.mockResolvedValue(baseCourse);
      prisma.enrollment.findFirst.mockResolvedValue({ id: 'enr-1' });
      // Ambos intentos devuelven MEDIUM cuando se pidió EASY
      ai.generate.mockResolvedValue(
        JSON.stringify({
          exercises: [
            {
              difficulty: 'MEDIUM',
              statement: 'x',
              type: 'SINGLE',
              options: ['a', 'b'],
              solution: 'a',
              explanation: 'z',
            },
          ],
        }),
      );

      await expect(
        service.generateForTopics('user-1', {
          courseId: 'course-1',
          topics: ['Fracciones'],
          perTopic: { easy: 1, medium: 0, hard: 0 },
        }),
      ).rejects.toThrow();
      expect(ai.generate).toHaveBeenCalledTimes(2);
    });
  });

  describe('evaluate', () => {
    const dto = {
      statement: '¿Cuánto vale 2+2?',
      studentAnswer: '4',
      solution: '4',
    };

    it('devuelve el veredicto y feedback que la IA produce', async () => {
      ai.generate.mockResolvedValue(
        JSON.stringify({ verdict: 'correct', feedback: 'Perfecto, 2+2=4.' }),
      );

      const result = await service.evaluate(dto);

      expect(result.verdict).toBe('correct');
      expect(result.feedback).toContain('Perfecto');
    });

    it('acepta respuesta envuelta en ```json```', async () => {
      ai.generate.mockResolvedValue(
        '```json\n{"verdict":"partial","feedback":"Falta una parte"}\n```',
      );
      const result = await service.evaluate(dto);
      expect(result.verdict).toBe('partial');
    });

    it('incluye statement, studentAnswer y solution en el prompt', async () => {
      ai.generate.mockResolvedValue('{"verdict":"correct","feedback":"OK"}');
      await service.evaluate({
        statement: '¿Capital de Francia?',
        studentAnswer: 'Paris',
        solution: 'París',
      });

      const prompt = ai.generate.mock.calls[0][0] as string;
      expect(prompt).toContain('Capital de Francia');
      expect(prompt).toContain('Paris');
      expect(prompt).toContain('París');
    });

    it('incluye la instrucción de LaTeX para el feedback en el prompt de evaluación', async () => {
      ai.generate.mockResolvedValue('{"verdict":"correct","feedback":"OK"}');
      await service.evaluate(dto);

      const prompt = ai.generate.mock.calls[0][0] as string;
      expect(prompt).toContain('LaTeX');
      expect(prompt).toContain('$\\\\frac{1}{2}$');
    });

    it('rechaza veredictos fuera del enum esperado', async () => {
      ai.generate.mockResolvedValue('{"verdict":"maybe","feedback":"dunno"}');
      await expect(service.evaluate(dto)).rejects.toThrow();
    });

    it('lanza error si la IA devuelve JSON inválido', async () => {
      ai.generate.mockResolvedValue('no es json');
      await expect(service.evaluate(dto)).rejects.toThrow();
    });
  });
});
