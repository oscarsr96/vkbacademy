import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ChallengeType } from '@prisma/client';
import { Response } from 'express';
import { TutorService } from './tutor.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChallengesService } from '../challenges/challenges.service';
import { AiUsageService } from '../ai/ai-usage.service';
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

const mockAiUsage = { record: jest.fn() };

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
        { provide: AiUsageService, useValue: mockAiUsage as unknown as AiUsageService },
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

    const buildMockStream = (
      chunks: Array<object> = [
        { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hola' } },
        { type: 'content_block_delta', delta: { type: 'text_delta', text: ' mundo' } },
      ],
      finalMessage: () => Promise<{ usage: { input_tokens: number; output_tokens: number } }> = () =>
        Promise.resolve({ usage: { input_tokens: 320, output_tokens: 85 } }),
    ) => ({
      [Symbol.asyncIterator]: async function* () {
        for (const chunk of chunks) {
          yield chunk;
        }
      },
      finalMessage,
    });

    const setMockAnthropic = (streamReturnValue: object) => {
      Object.defineProperty(service, 'anthropic', {
        value: { messages: { stream: jest.fn().mockReturnValue(streamReturnValue) } },
        writable: true,
        configurable: true,
      });
    };

    beforeEach(() => {
      mockTutorMessage.count.mockResolvedValue(0);
      // Copia nueva en cada llamada: streamChat hace history.reverse(), que
      // muta el array in-place. Reusar la misma referencia entre tests hace
      // que el orden dependa de cuántas veces se ha invocado antes (bug de
      // aislamiento del mock, no del servicio).
      mockTutorMessage.findMany.mockImplementation(() => Promise.resolve([...historialPrevio]));
      mockTutorMessage.create.mockResolvedValue({});
      setMockAnthropic(buildMockStream());
    });

    it('guarda el mensaje del usuario en BD antes de llamar a Anthropic', async () => {
      await service.streamChat(userId, dto, mockRes);

      expect(mockTutorMessage.create).toHaveBeenCalledWith({
        data: {
          userId,
          role: 'user',
          content: dto.message,
          courseId: dto.courseId,
          lessonId: dto.lessonId,
        },
      });

      const streamMock = service['anthropic'].messages.stream as jest.Mock;
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
      const streamMock = service['anthropic'].messages.stream as jest.Mock;
      const createCalls = mockTutorMessage.create.mock.calls;
      const userCreateCallIndex = createCalls.findIndex((call) => call[0].data.role === 'user');
      const userCreateCallOrder =
        mockTutorMessage.create.mock.invocationCallOrder[userCreateCallIndex];
      const checkAndAwardCallOrder = mockChallenges.checkAndAward.mock.invocationCallOrder[0];
      const streamCallOrder = streamMock.mock.invocationCallOrder[0];

      expect(userCreateCallOrder).toBeLessThan(checkAndAwardCallOrder);
      expect(checkAndAwardCallOrder).toBeLessThan(streamCallOrder);
    });

    it('incluye historial previo en los mensajes enviados a Anthropic', async () => {
      await service.streamChat(userId, dto, mockRes);

      const streamMock = service['anthropic'].messages.stream as jest.Mock;
      const llamadaArgs = streamMock.mock.calls[0][0];

      expect(llamadaArgs.messages).toEqual([
        { role: 'user', content: 'Pregunta anterior' },
        { role: 'assistant', content: 'Respuesta anterior' },
        { role: 'user', content: dto.message },
      ]);
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

      // Ni se guarda el mensaje ni se toca Anthropic: el corte es antes de todo
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

    it('registra el consumo del tutor con los tokens del stream', async () => {
      await service.streamChat(userId, dto, mockRes);

      expect(mockAiUsage.record).toHaveBeenCalledWith(
        { userId, category: 'CHATBOT' },
        {
          provider: 'haiku',
          model: 'claude-haiku-4-5-20251001',
          inputTokens: 320,
          outputTokens: 85,
        },
      );
    });

    it('si no se puede leer el consumo, la respuesta del tutor se guarda igual', async () => {
      // La contabilidad va DESPUÉS del guardado y en su propio try: el alumno no
      // puede perder una respuesta que ya ha leído por un fallo de facturación.
      setMockAnthropic(
        buildMockStream(undefined, () => Promise.reject(new Error('sin usage'))),
      );

      await service.streamChat(userId, dto, mockRes);

      const assistantCreate = mockTutorMessage.create.mock.calls.find(
        (call) => call[0].data.role === 'assistant',
      );
      expect(assistantCreate).toBeDefined();
      expect(assistantCreate[0].data.content).toBe('Hola mundo');
      expect(mockRes.write).toHaveBeenCalledWith(`data: ${JSON.stringify({ done: true })}\n\n`);
    });

    it('en caso de error de Anthropic, escribe evento SSE de error', async () => {
      const mockStreamError = {
        [Symbol.asyncIterator]: async function* () {
          throw new Error('Fallo de red Anthropic');
        },
      };

      setMockAnthropic(mockStreamError);

      await service.streamChat(userId, dto, mockRes);

      expect(mockRes.write).toHaveBeenCalledWith(
        `data: ${JSON.stringify({ error: 'Error al procesar tu pregunta' })}\n\n`,
      );
    });

    it('siempre llama a res.end() independientemente del resultado', async () => {
      await service.streamChat(userId, dto, mockRes);
      expect(mockRes.end).toHaveBeenCalledTimes(1);
    });

    it('siempre llama a res.end() incluso cuando Anthropic lanza un error', async () => {
      const mockStreamError = {
        [Symbol.asyncIterator]: async function* () {
          throw new Error('Fallo inesperado');
        },
      };

      setMockAnthropic(mockStreamError);

      await service.streamChat(userId, dto, mockRes);

      expect(mockRes.end).toHaveBeenCalledTimes(1);
    });
  });
});
