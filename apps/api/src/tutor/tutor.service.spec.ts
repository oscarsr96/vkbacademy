import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ChallengeType } from '@prisma/client';
import { Response } from 'express';
import { TutorService } from './tutor.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChallengesService } from '../challenges/challenges.service';
import { AiProviderService } from '../ai/ai-provider.service';
import { TutorChatDto } from './dto/tutor-chat.dto';

const mockTutorMessage = {
  count: jest.fn().mockResolvedValue(0),
  findMany: jest.fn(),
  create: jest.fn(),
  deleteMany: jest.fn(),
};

// Perfil de estudio (#137): curso del alumno, planes y ejercicios recientes.
// Por defecto vacío: el prompt no debe llevar bloque de perfil.
const mockUser = { findUnique: jest.fn() };
const mockStudyPlan = { findMany: jest.fn() };
const mockExerciseAttempt = { findMany: jest.fn() };

const mockTutorImage = { create: jest.fn(), deleteMany: jest.fn() };

const mockPrisma = {
  tutorMessage: mockTutorMessage,
  tutorImage: mockTutorImage,
  user: mockUser,
  studyPlan: mockStudyPlan,
  exerciseAttempt: mockExerciseAttempt,
};

const mockConfig = {
  get: jest.fn().mockReturnValue('fake-api-key'),
};

/**
 * El proveedor de IA se mockea entero: el tutor solo consume `streamChat`, un
 * generador async de trozos de texto. Quién responde (Gemini o Haiku) y la
 * contabilidad de tokens son asunto del proveedor y se prueban en su spec.
 */
const streamOf = (...chunks: string[]) =>
  async function* () {
    for (const c of chunks) yield c;
  };
const mockAi = { streamChat: jest.fn() };

const mockChallenges = {
  checkAndAward: jest.fn().mockResolvedValue(undefined),
};

const mockRes = {
  setHeader: jest.fn(),
  flushHeaders: jest.fn(),
  write: jest.fn(),
  end: jest.fn(),
} as unknown as Response;

describe('TutorService', () => {
  let service: TutorService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TutorService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
        { provide: ChallengesService, useValue: mockChallenges },
        { provide: AiProviderService, useValue: mockAi as unknown as AiProviderService },
      ],
    }).compile();

    service = module.get<TutorService>(TutorService);
  });

  describe('getHistory', () => {
    it('devuelve los últimos 50 mensajes en orden cronológico', async () => {
      const fakeMessages = [
        {
          id: '1',
          role: 'user',
          content: 'Hola',
          courseId: null,
          lessonId: null,
          createdAt: new Date('2026-01-01'),
        },
        {
          id: '2',
          role: 'assistant',
          content: 'Hola, ¿en qué te puedo ayudar?',
          courseId: null,
          lessonId: null,
          createdAt: new Date('2026-01-02'),
        },
      ];
      mockTutorMessage.findMany.mockResolvedValue(fakeMessages);

      const result = await service.getHistory('user-123');

      expect(mockTutorMessage.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { createdAt: 'asc' },
        take: 50,
        select: {
          id: true,
          role: true,
          content: true,
          courseId: true,
          lessonId: true,
          hasImage: true,
          createdAt: true,
        },
      });
      expect(result).toEqual(fakeMessages);
    });

    it('devuelve array vacío si no hay historial', async () => {
      mockTutorMessage.findMany.mockResolvedValue([]);

      const result = await service.getHistory('user-sin-historial');

      expect(result).toEqual([]);
    });
  });

  describe('clearHistory', () => {
    it('llama a deleteMany con el userId correcto', async () => {
      mockTutorMessage.deleteMany.mockResolvedValue({ count: 5 });

      await service.clearHistory('user-123');

      expect(mockTutorMessage.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      });
    });

    it('devuelve { cleared: true }', async () => {
      mockTutorMessage.deleteMany.mockResolvedValue({ count: 3 });

      const result = await service.clearHistory('user-123');

      expect(result).toEqual({ cleared: true });
    });
  });

  describe('streamChat', () => {
    const userId = 'user-abc';
    const dto: TutorChatDto = {
      message: '¿Qué es la fotosíntesis?',
      courseId: 'course-1',
      lessonId: 'lesson-1',
      courseName: 'Biología',
      lessonName: 'Las plantas',
      schoolYear: '2º ESO',
    };

    // El servicio pide orderBy: { createdAt: 'desc' } (más reciente primero) y
    // luego hace history.reverse() para reconstruir el orden cronológico. El
    // mock debe devolver el mismo orden desc que Prisma, o el test no
    // reproduce lo que realmente hace streamChat.
    const historialPrevio = [
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'Respuesta anterior',
        createdAt: new Date('2026-01-02'),
        image: null,
      },
      {
        id: 'msg-1',
        role: 'user',
        content: 'Pregunta anterior',
        createdAt: new Date('2026-01-01'),
        image: null,
      },
    ];

    beforeEach(() => {
      mockTutorMessage.count.mockResolvedValue(0);
      // Copia nueva en cada llamada: streamChat hace history.reverse(), que
      // muta el array in-place. Reusar la misma referencia entre tests hace
      // que el orden dependa de cuántas veces se ha invocado antes (bug de
      // aislamiento del mock, no del servicio).
      mockTutorMessage.findMany.mockImplementation(() => Promise.resolve([...historialPrevio]));
      mockTutorMessage.create.mockResolvedValue({ id: 'msg-new' });
      mockTutorImage.create.mockResolvedValue({});
      mockTutorImage.deleteMany.mockResolvedValue({ count: 0 });
      mockAi.streamChat.mockImplementation(streamOf('Hola', ' mundo'));
      mockUser.findUnique.mockResolvedValue({ schoolYear: null });
      mockStudyPlan.findMany.mockResolvedValue([]);
      mockExerciseAttempt.findMany.mockResolvedValue([]);
    });

    it('guarda el mensaje del usuario en BD antes de llamar al proveedor', async () => {
      await service.streamChat(userId, dto, mockRes);

      expect(mockTutorMessage.create).toHaveBeenCalledWith({
        data: {
          userId,
          role: 'user',
          content: dto.message,
          courseId: dto.courseId,
          lessonId: dto.lessonId,
          hasImage: false,
        },
      });

      const streamMock = mockAi.streamChat;
      const createCalls = mockTutorMessage.create.mock.calls;
      const userCreateCallIndex = createCalls.findIndex((call) => call[0].data.role === 'user');
      const streamCallOrder = streamMock.mock.invocationCallOrder[0];
      const userCreateCallOrder =
        mockTutorMessage.create.mock.invocationCallOrder[userCreateCallIndex];

      expect(userCreateCallOrder).toBeLessThan(streamCallOrder);
    });

    it('dispara checkAndAward con TUTOR_QUESTIONS tras persistir el mensaje del alumno, sin bloquear el streaming', async () => {
      await service.streamChat(userId, dto, mockRes);

      expect(mockChallenges.checkAndAward).toHaveBeenCalledWith(
        userId,
        ChallengeType.TUTOR_QUESTIONS,
      );

      // Debe dispararse tras persistir el mensaje del alumno y antes de iniciar
      // el streaming (no debe retrasar la respuesta SSE).
      const streamMock = mockAi.streamChat;
      const createCalls = mockTutorMessage.create.mock.calls;
      const userCreateCallIndex = createCalls.findIndex((call) => call[0].data.role === 'user');
      const userCreateCallOrder =
        mockTutorMessage.create.mock.invocationCallOrder[userCreateCallIndex];
      const checkAndAwardCallOrder = mockChallenges.checkAndAward.mock.invocationCallOrder[0];
      const streamCallOrder = streamMock.mock.invocationCallOrder[0];

      expect(userCreateCallOrder).toBeLessThan(checkAndAwardCallOrder);
      expect(checkAndAwardCallOrder).toBeLessThan(streamCallOrder);
    });

    it('incluye historial previo en los mensajes enviados al proveedor, con el system prompt y el cupo de tokens', async () => {
      await service.streamChat(userId, dto, mockRes);

      const input = mockAi.streamChat.mock.calls[0][0];

      expect(input.messages).toEqual([
        { role: 'user', text: 'Pregunta anterior' },
        { role: 'assistant', text: 'Respuesta anterior' },
        { role: 'user', text: dto.message },
      ]);
      expect(input.system).toContain('tutor virtual de VKB Academy');
      expect(input.system).toContain('Biología');
      expect(input.maxTokens).toBe(1024);
    });

    it('escribe chunks SSE al response durante el streaming', async () => {
      await service.streamChat(userId, dto, mockRes);

      expect(mockRes.write).toHaveBeenCalledWith(`data: ${JSON.stringify({ text: 'Hola' })}\n\n`);
      expect(mockRes.write).toHaveBeenCalledWith(`data: ${JSON.stringify({ text: ' mundo' })}\n\n`);
    });

    it('guarda la respuesta completa del asistente en BD tras el stream', async () => {
      await service.streamChat(userId, dto, mockRes);

      const createCalls = mockTutorMessage.create.mock.calls;
      const assistantCreate = createCalls.find((call) => call[0].data.role === 'assistant');

      expect(assistantCreate).toBeDefined();
      expect(assistantCreate[0]).toEqual({
        data: {
          userId,
          role: 'assistant',
          content: 'Hola mundo',
          courseId: dto.courseId,
          lessonId: dto.lessonId,
        },
      });
    });

    it('corta cuando el alumno agota su cupo del día, sin llamar a la IA', async () => {
      mockTutorMessage.count.mockResolvedValue(30);

      await expect(service.streamChat(userId, dto, mockRes)).rejects.toMatchObject({
        status: 429,
      });

      // Ni se guarda el mensaje ni se toca la IA: el corte es antes de todo
      expect(mockTutorMessage.create).not.toHaveBeenCalled();
      expect(mockRes.setHeader).not.toHaveBeenCalled();
    });

    it('cuenta solo las preguntas del alumno de hoy, en día de Madrid', async () => {
      await service.streamChat(userId, dto, mockRes);

      const where = mockTutorMessage.count.mock.calls[0][0].where as {
        userId: string;
        role: string;
        createdAt: { gte: Date };
      };
      expect(where.userId).toBe(userId);
      expect(where.role).toBe('user');
      expect(where.createdAt.gte).toBeInstanceOf(Date);
    });

    it('deja pasar mientras quede cupo', async () => {
      mockTutorMessage.count.mockResolvedValue(29);

      await service.streamChat(userId, dto, mockRes);

      expect(mockTutorMessage.create).toHaveBeenCalled();
    });

    it('pide al modelo Markdown ligero y fórmulas LaTeX entre $…$, que es lo que renderiza el hilo', async () => {
      await service.streamChat(userId, dto, mockRes);

      const { system } = mockAi.streamChat.mock.calls[0][0];
      expect(system).toMatch(/Markdown/);
      expect(system).toMatch(/\$…\$/);
    });

    describe('practicar este tema (#141)', () => {
      const planConTemas = [
        {
          title: 'Fracciones · Ecuaciones',
          courseId: 'c-mat',
          course: { title: 'Matemáticas' },
          topics: [
            { title: 'Ecuaciones', moduleId: 'm-1' },
            { title: 'Fracciones', moduleId: null },
          ],
        },
      ];

      it('si la conversación toca un tema del alumno, el evento done lleva practice', async () => {
        mockStudyPlan.findMany.mockResolvedValue(planConTemas);
        mockAi.streamChat.mockImplementation(streamOf('Las fracciones se suman así…'));

        await service.streamChat(userId, { ...dto, message: 'no entiendo las fracciones' }, mockRes);

        expect(mockRes.write).toHaveBeenCalledWith(
          `data: ${JSON.stringify({
            done: true,
            practice: { title: 'Fracciones', courseId: 'c-mat', courseTitle: 'Matemáticas', moduleId: null },
          })}\n\n`,
        );
      });

      it('los temas flojos ganan cuando aparecen varios', async () => {
        mockStudyPlan.findMany.mockResolvedValue(planConTemas);
        mockExerciseAttempt.findMany.mockResolvedValue([{ topicLabel: 'Ecuaciones', verdict: 'incorrect' }]);
        mockAi.streamChat.mockImplementation(streamOf('ok'));

        await service.streamChat(userId, { ...dto, message: 'ecuaciones con fracciones' }, mockRes);

        const doneEvent = (mockRes.write as jest.Mock).mock.calls
          .map((c) => String(c[0]))
          .find((l) => l.includes('"done":true'));
        expect(doneEvent).toContain('"title":"Ecuaciones"');
        expect(doneEvent).toContain('"moduleId":"m-1"');
      });

      it('sin coincidencia, el evento done va sin practice', async () => {
        mockStudyPlan.findMany.mockResolvedValue(planConTemas);

        await service.streamChat(userId, { ...dto, message: 'quién ganó la liga' }, mockRes);

        expect(mockRes.write).toHaveBeenCalledWith(`data: ${JSON.stringify({ done: true })}\n\n`);
      });
    });

    describe('perfil de estudio (#137)', () => {
      it('con datos, el prompt lleva curso, planes y temas flojos leídos de BD', async () => {
        mockUser.findUnique.mockResolvedValue({ schoolYear: { label: '3º ESO' } });
        mockStudyPlan.findMany.mockResolvedValue([
          { title: 'Fracciones · Ecuaciones', courseId: 'c-mat', course: { title: 'Matemáticas' }, topics: [] },
        ]);
        mockExerciseAttempt.findMany.mockResolvedValue([
          { topicLabel: 'Ecuaciones', verdict: 'incorrect' },
          { topicLabel: 'Ecuaciones', verdict: 'correct' },
        ]);

        await service.streamChat(userId, { ...dto, schoolYear: undefined }, mockRes);

        const { system } = mockAi.streamChat.mock.calls[0][0];
        expect(system).toContain('El alumno está en 3º ESO.');
        expect(system).toContain('Fracciones · Ecuaciones (Matemáticas)');
        expect(system).toContain('Ecuaciones (1 fallos de 2)');
      });

      it('el curso de BD gana al que manda el cliente', async () => {
        mockUser.findUnique.mockResolvedValue({ schoolYear: { label: '3º ESO' } });

        await service.streamChat(userId, { ...dto, schoolYear: '1º ESO' }, mockRes);

        const { system } = mockAi.streamChat.mock.calls[0][0];
        expect(system).toContain('3º ESO');
        expect(system).not.toContain('1º ESO');
      });

      it('sin curso en BD, sigue valiendo el del cliente', async () => {
        await service.streamChat(userId, { ...dto, schoolYear: '1º ESO' }, mockRes);

        expect(mockAi.streamChat.mock.calls[0][0].system).toContain('El alumno está en 1º ESO.');
      });

      it('sin datos, el prompt no lleva bloque de perfil', async () => {
        await service.streamChat(userId, { ...dto, schoolYear: undefined }, mockRes);

        const { system } = mockAi.streamChat.mock.calls[0][0];
        expect(system).not.toContain('El alumno está en');
        expect(system).not.toContain('Está estudiando con estos planes');
        expect(system).not.toContain('Temas que le cuestan');
      });

      it('solo mira los ejercicios de los últimos 30 días y los últimos 3 planes', async () => {
        await service.streamChat(userId, dto, mockRes);

        const attemptsArgs = mockExerciseAttempt.findMany.mock.calls[0][0];
        const since = attemptsArgs.where.answeredAt.gte as Date;
        const days = (Date.now() - since.getTime()) / 86_400_000;
        expect(attemptsArgs.where.userId).toBe(userId);
        expect(days).toBeGreaterThan(29.9);
        expect(days).toBeLessThan(30.1);

        const plansArgs = mockStudyPlan.findMany.mock.calls[0][0];
        expect(plansArgs).toMatchObject({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 3,
        });
      });
    });

    it('atribuye el consumo al alumno con la categoría CHATBOT', async () => {
      await service.streamChat(userId, dto, mockRes);

      expect(mockAi.streamChat.mock.calls[0][0].context).toEqual({
        userId,
        category: 'CHATBOT',
      });
    });

    it('si el proveedor falla, escribe evento SSE de error', async () => {
      mockAi.streamChat.mockImplementation(async function* () {
        throw new Error('Los dos proveedores fallaron');
      });

      await service.streamChat(userId, dto, mockRes);

      expect(mockRes.write).toHaveBeenCalledWith(
        `data: ${JSON.stringify({ error: 'Error al procesar tu pregunta' })}\n\n`,
      );
    });

    it('siempre llama a res.end() independientemente del resultado', async () => {
      await service.streamChat(userId, dto, mockRes);
      expect(mockRes.end).toHaveBeenCalledTimes(1);
    });

    it('siempre llama a res.end() incluso cuando el proveedor lanza un error', async () => {
      mockAi.streamChat.mockImplementation(async function* () {
        throw new Error('Fallo inesperado');
      });

      await service.streamChat(userId, dto, mockRes);

      expect(mockRes.end).toHaveBeenCalledTimes(1);
    });

    describe('con foto', () => {
      const image = {
        buffer: Buffer.from('fake-jpeg-bytes'),
        mimeType: 'image/jpeg' as const,
      };

      it('manda al proveedor la foto en base64 junto al texto del último turno', async () => {
        await service.streamChat(userId, dto, mockRes, image);

        const { messages } = mockAi.streamChat.mock.calls[0][0];
        const last = messages[messages.length - 1];

        expect(last).toEqual({
          role: 'user',
          text: dto.message,
          image: { mimeType: 'image/jpeg', base64: image.buffer.toString('base64') },
        });
      });

      it('sin texto, pregunta por defecto y la guarda como contenido del mensaje', async () => {
        await service.streamChat(userId, { ...dto, message: undefined }, mockRes, image);

        const { messages } = mockAi.streamChat.mock.calls[0][0];
        const last = messages[messages.length - 1];
        expect(last.text).toBe('¿Me ayudas con este ejercicio?');

        const userCreate = mockTutorMessage.create.mock.calls.find(
          (c) => c[0].data.role === 'user',
        );
        expect(userCreate?.[0].data.content).toBe('¿Me ayudas con este ejercicio?');
      });

      it('guarda la foto ligada al mensaje del alumno para los seguimientos (#140)', async () => {
        await service.streamChat(userId, dto, mockRes, image);

        expect(mockTutorImage.create).toHaveBeenCalledWith({
          data: { messageId: 'msg-new', mimeType: 'image/jpeg', data: image.buffer },
        });
      });

      it('sin foto no guarda nada en TutorImage', async () => {
        await service.streamChat(userId, dto, mockRes);
        expect(mockTutorImage.create).not.toHaveBeenCalled();
      });

      it('las fotos de mensajes anteriores vuelven al modelo en los seguimientos, como mucho las 3 más recientes', async () => {
        const withPhoto = (id: string, day: number) => ({
          id,
          role: 'user',
          content: `Pregunta ${id}`,
          createdAt: new Date(`2026-01-0${day}`),
          image: { mimeType: 'image/png', data: Buffer.from(`bytes-${id}`) },
        });
        // Orden desc como lo devuelve Prisma: la más reciente primero
        mockTutorMessage.findMany.mockResolvedValue([
          withPhoto('p4', 4),
          withPhoto('p3', 3),
          withPhoto('p2', 2),
          withPhoto('p1', 1),
        ]);

        await service.streamChat(userId, { ...dto, message: '¿y el apartado b?' }, mockRes);

        const { messages } = mockAi.streamChat.mock.calls[0][0];
        const withImage = messages.filter((m: { image?: unknown }) => m.image);
        expect(withImage.map((m: { text: string }) => m.text)).toEqual([
          'Pregunta p2',
          'Pregunta p3',
          'Pregunta p4',
        ]);
        expect(withImage[0].image).toEqual({
          mimeType: 'image/png',
          base64: Buffer.from('bytes-p2').toString('base64'),
        });
        // La más antigua sigue en el hilo, pero solo como texto
        expect(messages.find((m: { text: string }) => m.text === 'Pregunta p1')?.image).toBeUndefined();
      });

      it('poda las fotos de mensajes que han salido de la ventana de contexto', async () => {
        await service.streamChat(userId, dto, mockRes, image);

        expect(mockTutorImage.deleteMany).toHaveBeenCalledWith({
          where: {
            message: { userId },
            messageId: { notIn: ['msg-1', 'msg-2', 'msg-new'] },
          },
        });
      });

      it('marca hasImage: true en el mensaje del alumno', async () => {
        await service.streamChat(userId, dto, mockRes, image);

        const userCreate = mockTutorMessage.create.mock.calls.find(
          (c) => c[0].data.role === 'user',
        );
        expect(userCreate?.[0].data.hasImage).toBe(true);
      });

      it('añade al system prompt las instrucciones de foto solo cuando hay foto', async () => {
        await service.streamChat(userId, dto, mockRes, image);
        expect(mockAi.streamChat.mock.calls[0][0].system).toContain('ha adjuntado la foto');

        jest.clearAllMocks();
        mockTutorMessage.findMany.mockImplementation(() => Promise.resolve([...historialPrevio]));
        mockTutorMessage.create.mockResolvedValue({});
        mockAi.streamChat.mockImplementation(streamOf('Hola', ' mundo'));

        await service.streamChat(userId, dto, mockRes);
        expect(mockAi.streamChat.mock.calls[0][0].system).not.toContain('ha adjuntado la foto');
      });
    });

    it('sin texto ni foto responde 400 y no toca BD ni la IA', async () => {
      await expect(
        service.streamChat(userId, { ...dto, message: '   ' }, mockRes),
      ).rejects.toMatchObject({ status: 400, message: 'Escribe una pregunta o adjunta una foto' });

      expect(mockTutorMessage.create).not.toHaveBeenCalled();
      expect(mockAi.streamChat).not.toHaveBeenCalled();
    });
  });
});
