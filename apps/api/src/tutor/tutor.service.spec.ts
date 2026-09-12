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

const mockPrisma = {
  tutorMessage: mockTutorMessage,
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
      },
      {
        id: 'msg-1',
        role: 'user',
        content: 'Pregunta anterior',
        createdAt: new Date('2026-01-01'),
      },
    ];

    beforeEach(() => {
      mockTutorMessage.count.mockResolvedValue(0);
      // Copia nueva en cada llamada: streamChat hace history.reverse(), que
      // muta el array in-place. Reusar la misma referencia entre tests hace
      // que el orden dependa de cuántas veces se ha invocado antes (bug de
      // aislamiento del mock, no del servicio).
      mockTutorMessage.findMany.mockImplementation(() => Promise.resolve([...historialPrevio]));
      mockTutorMessage.create.mockResolvedValue({});
      mockAi.streamChat.mockImplementation(streamOf('Hola', ' mundo'));
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
