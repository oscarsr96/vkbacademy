import { ConfigService } from '@nestjs/config';
import { AiProviderService } from './ai-provider.service';

// Mock de @google/generative-ai
const mockGeminiGenerateContent = jest.fn();
const mockGeminiGetGenerativeModel = jest.fn(() => ({
  generateContent: mockGeminiGenerateContent,
}));
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: mockGeminiGetGenerativeModel,
  })),
}));

// Mock de @anthropic-ai/sdk (default export)
const mockAnthropicCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => ({
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

      const provider = createProvider({ AI_PROVIDER: 'gemini' });
      await provider.generate('prompt', 512);

      expect(mockGeminiGetGenerativeModel).toHaveBeenCalledWith(
        expect.objectContaining({
          generationConfig: expect.objectContaining({
            thinkingConfig: { thinkingBudget: 0 },
          }),
        }),
      );
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
      // Debe usar uno de los modelos vivos
      expect(src).toMatch(/gemini-flash-latest|gemini-2\.5-flash|gemini-2\.0-flash-001/);
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
});
