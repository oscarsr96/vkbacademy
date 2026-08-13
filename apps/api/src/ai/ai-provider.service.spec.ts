import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAIAbortError } from '@google/generative-ai';
import { APIConnectionTimeoutError } from '@anthropic-ai/sdk';
import { AiProviderService } from './ai-provider.service';

// Mock de @google/generative-ai. Conserva las clases de error reales (p. ej.
// GoogleGenerativeAIAbortError) vía requireActual — solo se mockea el
// constructor principal.
const mockGeminiGenerateContent = jest.fn();
const mockGeminiGetGenerativeModel = jest.fn(() => ({
  generateContent: mockGeminiGenerateContent,
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
jest.mock('@anthropic-ai/sdk', () => ({
  ...jest.requireActual('@anthropic-ai/sdk'),
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: { create: mockAnthropicCreate },
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
  return new AiProviderService(config);
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
