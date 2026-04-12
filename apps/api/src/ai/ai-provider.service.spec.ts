import { ConfigService } from '@nestjs/config';
import { AiProviderService } from './ai-provider.service';

// Mock de @google/generative-ai
const mockGeminiGenerateContent = jest.fn();
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: () => ({
      generateContent: mockGeminiGenerateContent,
    }),
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
