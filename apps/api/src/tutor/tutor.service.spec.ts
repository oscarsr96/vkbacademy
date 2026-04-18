import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { TutorService } from './tutor.service';
import { PrismaService } from '../prisma/prisma.service';
import { TutorChatDto } from './dto/tutor-chat.dto';

const mockTutorMessage = {
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
      ],
    }).compile();

    service = module.get<TutorService>(TutorService);
  });

  describe('getHistory', () => {
    it('devuelve los últimos 50 mensajes en orden cronológico', async () => {
      const fakeMessages = [
        { id: '1', role: 'user', content: 'Hola', courseId: null, lessonId: null, createdAt: new Date('2026-01-01') },
        { id: '2', role: 'assistant', content: 'Hola, ¿en qué te puedo ayudar?', courseId: null, lessonId: null, createdAt: new Date('2026-01-02') },
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

    const historialPrevio = [
      { id: 'msg-1', role: 'user', content: 'Pregunta anterior', createdAt: new Date('2026-01-01') },
      { id: 'msg-2', role: 'assistant', content: 'Respuesta anterior', createdAt: new Date('2026-01-02') },
    ];

    const buildMockStream = (chunks: Array<object> = [
      { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hola' } },
      { type: 'content_block_delta', delta: { type: 'text_delta', text: ' mundo' } },
    ]) => ({
      [Symbol.asyncIterator]: async function* () {
        for (const chunk of chunks) {
          yield chunk;
        }
      },
    });

    const setMockAnthropic = (streamReturnValue: object) => {
      Object.defineProperty(service, 'anthropic', {
        value: { messages: { stream: jest.fn().mockReturnValue(streamReturnValue) } },
        writable: true,
        configurable: true,
      });
    };

    beforeEach(() => {
      mockTutorMessage.findMany.mockResolvedValue(historialPrevio);
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
      const userCreateCallIndex = createCalls.findIndex(
        (call) => call[0].data.role === 'user',
      );
      const streamCallOrder = streamMock.mock.invocationCallOrder[0];
      const userCreateCallOrder = mockTutorMessage.create.mock.invocationCallOrder[userCreateCallIndex];

      expect(userCreateCallOrder).toBeLessThan(streamCallOrder);
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

      expect(mockRes.write).toHaveBeenCalledWith(
        `data: ${JSON.stringify({ text: 'Hola' })}\n\n`,
      );
      expect(mockRes.write).toHaveBeenCalledWith(
        `data: ${JSON.stringify({ text: ' mundo' })}\n\n`,
      );
    });

    it('guarda la respuesta completa del asistente en BD tras el stream', async () => {
      await service.streamChat(userId, dto, mockRes);

      const createCalls = mockTutorMessage.create.mock.calls;
      const assistantCreate = createCalls.find(
        (call) => call[0].data.role === 'assistant',
      );

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
