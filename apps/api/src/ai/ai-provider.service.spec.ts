import { ConfigService } from '@nestjs/config';
import { AiUsageService } from './ai-usage.service';
import { GoogleGenerativeAIAbortError } from '@google/generative-ai';
import { APIConnectionTimeoutError } from '@anthropic-ai/sdk';
import { AiProviderService } from './ai-provider.service';

// Mock de @google/generative-ai. Conserva las clases de error reales (p. ej.
// GoogleGenerativeAIAbortError) vía requireActual — solo se mockea el
// constructor principal.
const mockGeminiGenerateContent = jest.fn();
const mockGeminiGenerateContentStream = jest.fn();
const mockGeminiGetGenerativeModel = jest.fn(() => ({
  generateContent: mockGeminiGenerateContent,
  generateContentStream: mockGeminiGenerateContentStream,
}));
jest.mock('@google/generative-ai', () => ({
  ...jest.requireActual('@google/generative-ai'),
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: mockGeminiGetGenerativeModel,
  })),
}));

// Mock de @anthropic-ai/sdk (default export). Conserva las clases de error
// reales (p. ej. APIConnectionTimeoutError) vía requireActual.
const mockAnthropicCreate = jest.fn();
const mockAnthropicStream = jest.fn();
jest.mock('@anthropic-ai/sdk', () => ({
  ...jest.requireActual('@anthropic-ai/sdk'),
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: { create: mockAnthropicCreate, stream: mockAnthropicStream },
  })),
}));

function createProvider(overrides: Record<string, string | undefined> = {}) {
  const defaults: Record<string, string | undefined> = {
    GEMINI_API_KEY: 'test-gemini-key',
    ANTHROPIC_API_KEY: 'test-anthropic-key',
    AI_PROVIDER: 'auto',
    ...overrides,
  };
  const config = {
    get: jest.fn((key: string) => defaults[key]),
  } as unknown as ConfigService;
  // El registro de consumo se stubea: los tests que lo comprueban leen `usage`
  const usage = { record: jest.fn(), estimateMicroUsd: jest.fn(() => 0) };
  const provider = new AiProviderService(config, usage as unknown as AiUsageService);
  return Object.assign(provider, { __usage: usage });
}

describe('AiProviderService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('mode auto (Gemini → Haiku fallback)', () => {
    it('usa Gemini cuando responde correctamente', async () => {
      mockGeminiGenerateContent.mockResolvedValue({
        response: { text: () => '{"title":"Test"}' },
      });

      const provider = createProvider();
      const result = await provider.generate('prompt', 512);

      expect(result).toBe('{"title":"Test"}');
      expect(mockGeminiGenerateContent).toHaveBeenCalledTimes(1);
      expect(mockAnthropicCreate).not.toHaveBeenCalled();
    });

    it('cae a Haiku cuando Gemini falla', async () => {
      mockGeminiGenerateContent.mockRejectedValue(new Error('Gemini rate limited'));
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: '{"title":"Fallback"}' }],
      });

      const provider = createProvider();
      const result = await provider.generate('prompt', 512);

      expect(result).toBe('{"title":"Fallback"}');
      expect(mockGeminiGenerateContent).toHaveBeenCalledTimes(1);
      expect(mockAnthropicCreate).toHaveBeenCalledTimes(1);
    });
  });

  describe('mode gemini', () => {
    it('usa solo Gemini sin fallback', async () => {
      mockGeminiGenerateContent.mockResolvedValue({
        response: { text: () => '{"ok":true}' },
      });

      const provider = createProvider({ AI_PROVIDER: 'gemini' });
      const result = await provider.generate('prompt', 512);

      expect(result).toBe('{"ok":true}');
      expect(mockAnthropicCreate).not.toHaveBeenCalled();
    });

    it('falla si Gemini falla (sin fallback)', async () => {
      mockGeminiGenerateContent.mockRejectedValue(new Error('Gemini down'));

      const provider = createProvider({ AI_PROVIDER: 'gemini' });
      await expect(provider.generate('prompt', 512)).rejects.toThrow('Gemini down');
      expect(mockAnthropicCreate).not.toHaveBeenCalled();
    });
  });

  describe('mode haiku', () => {
    it('usa solo Haiku sin intentar Gemini', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: '{"ok":true}' }],
      });

      const provider = createProvider({ AI_PROVIDER: 'haiku' });
      const result = await provider.generate('prompt', 512);

      expect(result).toBe('{"ok":true}');
      expect(mockGeminiGenerateContent).not.toHaveBeenCalled();
    });
  });

  describe('configuración de thinking mode', () => {
    it('desactiva thinking en Gemini 2.5 para evitar truncamientos por consumo de budget', async () => {
      mockGeminiGenerateContent.mockResolvedValue({
        response: { text: () => '{"ok":true}' },
      });

      const provider = createProvider({ AI_PROVIDER: 'gemini', GEMINI_MODEL: 'gemini-2.5-flash' });
      await provider.generate('prompt', 512);

      expect(mockGeminiGetGenerativeModel).toHaveBeenCalledWith(
        expect.objectContaining({
          generationConfig: expect.objectContaining({
            thinkingConfig: { thinkingBudget: 0 },
          }),
        }),
      );
    });

    it('en Gemini 3+ usa thinkingLevel (thinkingBudget es de 2.5 y enviar ambos da 400)', async () => {
      mockGeminiGenerateContent.mockResolvedValue({
        response: { text: () => '{"ok":true}' },
      });

      const provider = createProvider({
        AI_PROVIDER: 'gemini',
        GEMINI_MODEL: 'gemini-3-flash-preview',
      });
      await provider.generate('prompt', 512);

      const [args] = mockGeminiGetGenerativeModel.mock.calls[0] as unknown as [
        {
          generationConfig: { thinkingConfig: Record<string, unknown> };
        },
      ];
      const { generationConfig } = args;
      expect(generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'minimal' });
      expect(generationConfig.thinkingConfig).not.toHaveProperty('thinkingBudget');
    });
  });

  // Gemini 3 no permite apagar el thinking del todo: los thinking tokens se
  // descuentan de maxOutputTokens sin aparecer en response.text(), así que el
  // JSON llega cortado. Sin esta detección el síntoma era un error de parseo
  // indescifrable dos capas más arriba.
  describe('truncamiento por MAX_TOKENS', () => {
    it('convierte una respuesta truncada en un error descriptivo en vez de devolver JSON roto', async () => {
      mockGeminiGenerateContent.mockResolvedValue({
        response: {
          text: () => '{"title":"a medio gene',
          candidates: [{ finishReason: 'MAX_TOKENS' }],
          usageMetadata: { thoughtsTokenCount: 480 },
        },
      });

      const provider = createProvider({ AI_PROVIDER: 'gemini' });
      await expect(provider.generate('prompt', 512)).rejects.toThrow(/truncad|MAX_TOKENS/i);
    });

    it('menciona los tokens gastados en thinking cuando los hay', async () => {
      mockGeminiGenerateContent.mockResolvedValue({
        response: {
          text: () => '{"title":"a medio gene',
          candidates: [{ finishReason: 'MAX_TOKENS' }],
          usageMetadata: { thoughtsTokenCount: 480 },
        },
      });

      const provider = createProvider({ AI_PROVIDER: 'gemini' });
      await expect(provider.generate('prompt', 512)).rejects.toThrow(/480/);
    });

    it('en modo auto, un truncamiento de Gemini cae al fallback', async () => {
      mockGeminiGenerateContent.mockResolvedValue({
        response: {
          text: () => '{"title":"a medio gene',
          candidates: [{ finishReason: 'MAX_TOKENS' }],
        },
      });
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: '{"ok":true}' }],
      });

      const provider = createProvider();
      await expect(provider.generate('prompt', 512)).resolves.toBe('{"ok":true}');
    });

    it('no molesta cuando la respuesta termina bien (finishReason STOP)', async () => {
      mockGeminiGenerateContent.mockResolvedValue({
        response: {
          text: () => '{"ok":true}',
          candidates: [{ finishReason: 'STOP' }],
        },
      });

      const provider = createProvider({ AI_PROVIDER: 'gemini' });
      await expect(provider.generate('prompt', 512)).resolves.toBe('{"ok":true}');
    });
  });

  describe('configuración del modelo', () => {
    it('Gemini usa un modelo soportado actualmente (no "gemini-2.0-flash" deprecado)', async () => {
      // Lectura del archivo fuente para verificar el modelo configurado
      const fs = await import('fs');
      const path = await import('path');
      const src = fs.readFileSync(path.resolve(__dirname, 'ai-provider.service.ts'), 'utf-8');
      // gemini-2.0-flash sin sufijo está deprecado a partir de 2026
      expect(src).not.toMatch(/['"]gemini-2\.0-flash['"]/);
    });

    it('el modelo por defecto está pinneado, no es un alias móvil', async () => {
      // Un alias ("-latest") lo repunta Google sin avisar: el 21-01-2026
      // gemini-flash-latest saltó a Gemini 3 y cambió la semántica del
      // thinking, rompiendo la generación sin tocar el repo.
      mockGeminiGenerateContent.mockResolvedValue({
        response: { text: () => '{"ok":true}' },
      });

      const provider = createProvider({ AI_PROVIDER: 'gemini' });
      await provider.generate('prompt', 512);

      const [{ model }] = mockGeminiGetGenerativeModel.mock.calls[0] as unknown as [
        { model: string },
      ];
      expect(model).not.toMatch(/-latest$/);
    });

    it('el modelo por defecto no usa thinkingBudget (medido: el alias lo rechaza con 400)', async () => {
      // Contra la API real, gemini-flash-latest + thinkingBudget: 0 devuelve
      // 400 INVALID_ARGUMENT en cada llamada. El default debe ser un modelo
      // cuya config de thinking esté validada, no heredar la de Gemini 2.5.
      mockGeminiGenerateContent.mockResolvedValue({
        response: { text: () => '{"ok":true}' },
      });

      const provider = createProvider({ AI_PROVIDER: 'gemini' });
      await provider.generate('prompt', 512);

      const [args] = mockGeminiGetGenerativeModel.mock.calls[0] as unknown as [
        { generationConfig: { thinkingConfig: Record<string, unknown> } },
      ];
      expect(args.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'minimal' });
    });

    it('GEMINI_MODEL sobreescribe el modelo por defecto', async () => {
      mockGeminiGenerateContent.mockResolvedValue({
        response: { text: () => '{"ok":true}' },
      });

      const provider = createProvider({
        AI_PROVIDER: 'gemini',
        GEMINI_MODEL: 'gemini-3-flash-preview',
      });
      await provider.generate('prompt', 512);

      expect(mockGeminiGetGenerativeModel).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gemini-3-flash-preview' }),
      );
    });
  });

  describe('mode auto (errores combinados)', () => {
    it('cuando Gemini falla y Haiku no está configurada, lanza error claro mencionando ambos', async () => {
      mockGeminiGenerateContent.mockRejectedValue(new Error('Gemini quota exceeded'));

      const provider = createProvider({ ANTHROPIC_API_KEY: undefined });
      await expect(provider.generate('prompt', 512)).rejects.toThrow(
        /Gemini.*Haiku|both providers|ningún proveedor/i,
      );
    });

    it('cuando fallan los dos, el error nombra ambas causas (no solo la del fallback)', async () => {
      // El fallo de Gemini se perdía: en los logs solo quedaba el error de
      // Haiku, que apuntaba a un problema de facturación y no a la causa real.
      mockGeminiGenerateContent.mockRejectedValue(new Error('Gemini quota exceeded'));
      mockAnthropicCreate.mockRejectedValue(new Error('credit balance is too low'));

      const provider = createProvider();
      const err = (await provider.generate('prompt', 512).catch((e: Error) => e)) as Error;

      expect(err.message).toMatch(/quota exceeded/);
      expect(err.message).toMatch(/credit balance is too low/);
    });
  });

  describe('sin API keys', () => {
    it('falla si GEMINI_API_KEY no está configurada y mode=gemini', async () => {
      const provider = createProvider({ GEMINI_API_KEY: undefined, AI_PROVIDER: 'gemini' });
      await expect(provider.generate('prompt', 512)).rejects.toThrow('GEMINI_API_KEY');
    });

    it('falla si ANTHROPIC_API_KEY no está configurada y mode=haiku', async () => {
      const provider = createProvider({ ANTHROPIC_API_KEY: undefined, AI_PROVIDER: 'haiku' });
      await expect(provider.generate('prompt', 512)).rejects.toThrow('ANTHROPIC_API_KEY');
    });

    it('en auto sin Gemini, va directamente a Haiku', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: '{"direct":true}' }],
      });

      const provider = createProvider({ GEMINI_API_KEY: undefined });
      const result = await provider.generate('prompt', 512);

      expect(result).toBe('{"direct":true}');
      expect(mockGeminiGenerateContent).not.toHaveBeenCalled();
    });
  });

  describe('timeout (AI_TIMEOUT_MS)', () => {
    it('pasa el timeout configurado a Gemini y a Haiku', async () => {
      mockGeminiGenerateContent.mockResolvedValue({
        response: { text: () => '{"ok":true}' },
      });
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: '{"ok":true}' }],
      });

      const provider = createProvider({ AI_TIMEOUT_MS: '5000', AI_PROVIDER: 'gemini' });
      await provider.generate('prompt', 512);
      expect(mockGeminiGenerateContent).toHaveBeenCalledWith('prompt', { timeout: 5000 });

      const haikuProvider = createProvider({ AI_TIMEOUT_MS: '5000', AI_PROVIDER: 'haiku' });
      await haikuProvider.generate('prompt', 512);
      expect(mockAnthropicCreate).toHaveBeenCalledWith(expect.anything(), { timeout: 5000 });
    });

    it('usa 60000ms por defecto si AI_TIMEOUT_MS no está configurado', async () => {
      mockGeminiGenerateContent.mockResolvedValue({
        response: { text: () => '{"ok":true}' },
      });

      const provider = createProvider({ AI_PROVIDER: 'gemini' });
      await provider.generate('prompt', 512);

      expect(mockGeminiGenerateContent).toHaveBeenCalledWith('prompt', { timeout: 60000 });
    });

    it('convierte un timeout de Gemini en un error descriptivo', async () => {
      mockGeminiGenerateContent.mockRejectedValue(
        new GoogleGenerativeAIAbortError('Request aborted'),
      );

      const provider = createProvider({ AI_PROVIDER: 'gemini', AI_TIMEOUT_MS: '5000' });
      await expect(provider.generate('prompt', 512)).rejects.toThrow(/5000ms.*timeout/i);
    });

    it('convierte un timeout de Haiku en un error descriptivo', async () => {
      mockAnthropicCreate.mockRejectedValue(new APIConnectionTimeoutError());

      const provider = createProvider({ AI_PROVIDER: 'haiku', AI_TIMEOUT_MS: '5000' });
      await expect(provider.generate('prompt', 512)).rejects.toThrow(/5000ms.*timeout/i);
    });
  });
});

  // ─── Registro de consumo ─────────────────────────────────────────────────────

  describe('atribución del consumo', () => {
    const context = { userId: 'user1', category: 'COURSE' as const };

    it('Gemini: registra los tokens del usageMetadata, thinking incluido', async () => {
      mockGeminiGenerateContent.mockResolvedValue({
        response: {
          text: () => '{"ok":true}',
          usageMetadata: {
            promptTokenCount: 1200,
            candidatesTokenCount: 800,
            thoughtsTokenCount: 300,
          },
        },
      });

      const provider = createProvider();
      await provider.generate('prompt', 512, context);

      // Los tokens de thinking se facturan aunque no salgan en el texto
      expect(provider.__usage.record).toHaveBeenCalledWith(context, {
        provider: 'gemini',
        model: 'gemini-3.5-flash',
        inputTokens: 1200,
        outputTokens: 1100,
      });
    });

    it('Haiku: registra los tokens que devuelve el SDK', async () => {
      mockGeminiGenerateContent.mockRejectedValue(new Error('Gemini caído'));
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: '{"ok":true}' }],
        usage: { input_tokens: 500, output_tokens: 250 },
      });

      const provider = createProvider();
      await provider.generate('prompt', 512, context);

      // El fallback cuenta contra Haiku, no contra Gemini: es lo que se paga
      expect(provider.__usage.record).toHaveBeenCalledTimes(1);
      expect(provider.__usage.record).toHaveBeenCalledWith(context, {
        provider: 'haiku',
        model: 'claude-haiku-4-5-20251001',
        inputTokens: 500,
        outputTokens: 250,
      });
    });

    it('sin contexto de atribución no registra nada', async () => {
      mockGeminiGenerateContent.mockResolvedValue({
        response: { text: () => '{"ok":true}', usageMetadata: { promptTokenCount: 10 } },
      });

      const provider = createProvider();
      await provider.generate('prompt', 512);

      expect(provider.__usage.record).not.toHaveBeenCalled();
    });
    describe('streamChat (chat en streaming, Gemini → Haiku)', () => {
    // Este describe cuelga de «atribución del consumo», que está fuera del
    // beforeEach global: sin esto las llamadas se acumulan entre tests.
    beforeEach(() => {
      jest.clearAllMocks();
    });

    const context = { userId: 'u1', category: 'CHATBOT' as const };

    /** Stream de Gemini como lo devuelve el SDK: chunks con .text() y la respuesta final aparte. */
    const geminiStream = (
      texts: string[],
      usage: Record<string, number> = { promptTokenCount: 10, candidatesTokenCount: 5, thoughtsTokenCount: 2 },
    ) => ({
      stream: (async function* () {
        for (const t of texts) yield { text: () => t };
      })(),
      response: Promise.resolve({ usageMetadata: usage }),
    });

    /** Stream de Anthropic: eventos content_block_delta y finalMessage() con el consumo. */
    const haikuStream = (texts: string[]) => ({
      [Symbol.asyncIterator]: async function* () {
        for (const t of texts) {
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text: t } };
        }
      },
      finalMessage: () => Promise.resolve({ usage: { input_tokens: 320, output_tokens: 85 } }),
    });

    const collect = async (it: AsyncIterable<string>) => {
      const out: string[] = [];
      for await (const c of it) out.push(c);
      return out;
    };

    const input = {
      system: 'Eres el tutor',
      messages: [
        { role: 'user' as const, text: 'Pregunta anterior' },
        { role: 'assistant' as const, text: 'Respuesta anterior' },
        {
          role: 'user' as const,
          text: '¿Qué ves?',
          image: { mimeType: 'image/jpeg', base64: 'QUJD' },
        },
      ],
      maxTokens: 1024,
      context,
    };

    it('en auto, emite los trozos de Gemini en orden y registra su consumo', async () => {
      mockGeminiGenerateContentStream.mockResolvedValue(geminiStream(['Hola', ' mundo']));
      const provider = createProvider();

      const chunks = await collect(provider.streamChat(input));

      expect(chunks).toEqual(['Hola', ' mundo']);
      expect(mockAnthropicStream).not.toHaveBeenCalled();
      expect(provider.__usage.record).toHaveBeenCalledWith(context, {
        provider: 'gemini',
        model: 'gemini-3.5-flash',
        inputTokens: 10,
        outputTokens: 7,
      });
    });

    it('a Gemini le pasa el system prompt, el historial con rol model y la foto como inlineData antes del texto', async () => {
      mockGeminiGenerateContentStream.mockResolvedValue(geminiStream(['ok']));
      const provider = createProvider();

      await collect(provider.streamChat(input));

      const [modelArgs] = mockGeminiGetGenerativeModel.mock.calls[0] as unknown as [
        { systemInstruction?: string; generationConfig: Record<string, unknown> },
      ];
      expect(modelArgs.systemInstruction).toBe('Eres el tutor');
      // Es prosa, no JSON: sin responseMimeType
      expect(modelArgs.generationConfig.responseMimeType).toBeUndefined();
      expect(modelArgs.generationConfig.maxOutputTokens).toBe(1024);

      const [request] = mockGeminiGenerateContentStream.mock.calls[0] as unknown as [
        { contents: { role: string; parts: unknown[] }[] },
      ];
      expect(request.contents).toEqual([
        { role: 'user', parts: [{ text: 'Pregunta anterior' }] },
        { role: 'model', parts: [{ text: 'Respuesta anterior' }] },
        {
          role: 'user',
          parts: [{ inlineData: { mimeType: 'image/jpeg', data: 'QUJD' } }, { text: '¿Qué ves?' }],
        },
      ]);
    });

    it('si Gemini falla antes del primer trozo, cae a Haiku sin que el caller lo note', async () => {
      mockGeminiGenerateContentStream.mockRejectedValue(new Error('429 quota'));
      mockAnthropicStream.mockReturnValue(haikuStream(['Hola', ' desde Haiku']));
      const provider = createProvider();

      const chunks = await collect(provider.streamChat(input));

      expect(chunks).toEqual(['Hola', ' desde Haiku']);
      expect(provider.__usage.record).toHaveBeenCalledWith(context, {
        provider: 'haiku',
        model: 'claude-haiku-4-5-20251001',
        inputTokens: 320,
        outputTokens: 85,
      });
    });

    it('si Gemini no emite ningún texto, también cae a Haiku', async () => {
      mockGeminiGenerateContentStream.mockResolvedValue(geminiStream([]));
      mockAnthropicStream.mockReturnValue(haikuStream(['Haiku']));
      const provider = createProvider();

      const chunks = await collect(provider.streamChat(input));

      expect(chunks).toEqual(['Haiku']);
    });

    it('si Gemini falla después del primer trozo, el error sube y NO se llama a Haiku', async () => {
      // Lo ya emitido está en pantalla del alumno: repetir la respuesta con otro
      // proveedor la duplicaría. El caller pinta su error y listo.
      mockGeminiGenerateContentStream.mockResolvedValue({
        stream: (async function* () {
          yield { text: () => 'Hola' };
          throw new Error('conexión cortada');
        })(),
        response: Promise.resolve({ usageMetadata: {} }),
      });
      const provider = createProvider();

      const received: string[] = [];
      await expect(
        (async () => {
          for await (const c of provider.streamChat(input)) received.push(c);
        })(),
      ).rejects.toThrow('conexión cortada');

      expect(received).toEqual(['Hola']);
      expect(mockAnthropicStream).not.toHaveBeenCalled();
    });

    it('a Haiku le pasa el system prompt y la foto como bloque image antes del texto', async () => {
      mockAnthropicStream.mockReturnValue(haikuStream(['ok']));
      const provider = createProvider({ AI_PROVIDER: 'haiku' });

      await collect(provider.streamChat(input));

      expect(mockGeminiGenerateContentStream).not.toHaveBeenCalled();
      const [params] = mockAnthropicStream.mock.calls[0] as unknown as [
        { system: string; max_tokens: number; messages: { role: string; content: unknown }[] },
      ];
      expect(params.system).toBe('Eres el tutor');
      expect(params.max_tokens).toBe(1024);
      expect(params.messages).toEqual([
        { role: 'user', content: 'Pregunta anterior' },
        { role: 'assistant', content: 'Respuesta anterior' },
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'QUJD' } },
            { type: 'text', text: '¿Qué ves?' },
          ],
        },
      ]);
    });

    it('en modo gemini, un fallo de Gemini sube sin tocar Haiku', async () => {
      mockGeminiGenerateContentStream.mockRejectedValue(new Error('Gemini down'));
      const provider = createProvider({ AI_PROVIDER: 'gemini' });

      await expect(collect(provider.streamChat(input))).rejects.toThrow('Gemini down');
      expect(mockAnthropicStream).not.toHaveBeenCalled();
    });

    it('si fallan los dos, el error nombra a ambos', async () => {
      mockGeminiGenerateContentStream.mockRejectedValue(new Error('Gemini 503'));
      mockAnthropicStream.mockImplementation(() => {
        throw new Error('credit balance is too low');
      });
      const provider = createProvider();

      await expect(collect(provider.streamChat(input))).rejects.toThrow(
        /Gemini: Gemini 503.*Haiku: credit balance is too low/,
      );
    });

    it('normaliza el historial: quita turnos de asistente al principio y funde turnos seguidos del mismo rol', async () => {
      // La ventana de 10 mensajes puede empezar por una respuesta, y un envío
      // que falló deja dos preguntas seguidas. Ambas APIs exigen empezar por
      // user y alternar.
      mockGeminiGenerateContentStream.mockResolvedValue(geminiStream(['ok']));
      const provider = createProvider();

      await collect(
        provider.streamChat({
          ...input,
          messages: [
            { role: 'assistant', text: 'huérfana' },
            { role: 'user', text: 'uno' },
            { role: 'user', text: 'dos' },
            { role: 'assistant', text: 'resp' },
            { role: 'user', text: 'tres' },
          ],
        }),
      );

      const [request] = mockGeminiGenerateContentStream.mock.calls[0] as unknown as [
        { contents: { role: string; parts: { text?: string }[] }[] },
      ];
      expect(request.contents).toEqual([
        { role: 'user', parts: [{ text: 'uno\n\ndos' }] },
        { role: 'model', parts: [{ text: 'resp' }] },
        { role: 'user', parts: [{ text: 'tres' }] },
      ]);
    });
  });
});
