import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AiUsageCategory } from '@prisma/client';
import { AiUsageService } from './ai-usage.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AiUsageService', () => {
  let service: AiUsageService;
  let mockPrisma: {
    aiUsage: { create: jest.Mock };
    academyMember: { findFirst: jest.Mock };
  };

  async function build(env: Record<string, string> = {}) {
    mockPrisma = {
      aiUsage: { create: jest.fn().mockResolvedValue({}) },
      academyMember: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const config = { get: jest.fn((key: string) => env[key]) } as unknown as ConfigService;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiUsageService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    service = module.get(AiUsageService);
  }

  // ─── Tarifas ────────────────────────────────────────────────────────────────

  describe('estimateMicroUsd', () => {
    it('tarifa Haiku 4.5: $1 el millón de entrada y $5 el de salida', async () => {
      await build();

      // 1M entrada + 1M salida = 1 + 5 = 6 USD = 6.000.000 microdólares
      const micro = service.estimateMicroUsd({
        provider: 'haiku',
        model: 'claude-haiku-4-5-20251001',
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
      });

      expect(micro).toBe(6_000_000);
    });

    it('Gemini sale a 0: es el proveedor gratuito, no un coste que se ignore', async () => {
      await build();

      const micro = service.estimateMicroUsd({
        provider: 'gemini',
        model: 'gemini-3.5-flash',
        inputTokens: 500_000,
        outputTokens: 500_000,
      });

      expect(micro).toBe(0);
    });

    it('redondea a microdólar entero: sumar decimales por millares acumula error', async () => {
      await build();

      // 1.234 tokens de salida a $5/M = 0,00617 USD = 6.170 microdólares
      const micro = service.estimateMicroUsd({
        provider: 'haiku',
        model: 'claude-haiku-4-5-20251001',
        inputTokens: 0,
        outputTokens: 1_234,
      });

      expect(micro).toBe(6_170);
      expect(Number.isInteger(micro)).toBe(true);
    });

    it('la tarifa se puede cambiar por entorno sin tocar código', async () => {
      // El día que Google empiece a cobrar
      await build({ AI_PRICE_GEMINI_INPUT_USD: '0.3', AI_PRICE_GEMINI_OUTPUT_USD: '2.5' });

      const micro = service.estimateMicroUsd({
        provider: 'gemini',
        model: 'gemini-3.5-flash',
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
      });

      expect(micro).toBe(2_800_000);
    });
  });

  // ─── Registro ───────────────────────────────────────────────────────────────

  describe('record', () => {
    it('guarda tokens, coste y la academia del alumno', async () => {
      await build();
      mockPrisma.academyMember.findFirst.mockResolvedValue({ academyId: 'academy1' });

      await service.record(
        { userId: 'user1', category: AiUsageCategory.EXAM },
        {
          provider: 'haiku',
          model: 'claude-haiku-4-5-20251001',
          inputTokens: 1_000,
          outputTokens: 2_000,
        },
      );

      expect(mockPrisma.aiUsage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user1',
          academyId: 'academy1',
          category: AiUsageCategory.EXAM,
          provider: 'haiku',
          inputTokens: 1_000,
          outputTokens: 2_000,
          // 1.000 × $1/M + 2.000 × $5/M = 0,011 USD
          costMicroUsd: 11_000,
        }),
      });
    });

    it('registra los tokens de Gemini aunque el coste sea 0', async () => {
      await build();

      await service.record(
        { userId: 'user1', category: AiUsageCategory.COURSE },
        { provider: 'gemini', model: 'gemini-3.5-flash', inputTokens: 800, outputTokens: 4_000 },
      );

      const data = mockPrisma.aiUsage.create.mock.calls[0][0].data as Record<string, number>;
      expect(data.costMicroUsd).toBe(0);
      // Mientras Gemini sea gratis, los tokens son la única señal de consumo
      expect(data.inputTokens).toBe(800);
      expect(data.outputTokens).toBe(4_000);
    });

    it('no lanza si falla el guardado: la contabilidad no tumba una generación', async () => {
      await build();
      mockPrisma.aiUsage.create.mockRejectedValue(new Error('DB caída'));

      await expect(
        service.record(
          { userId: 'user1', category: AiUsageCategory.CHATBOT },
          { provider: 'haiku', model: 'claude-haiku-4-5-20251001', inputTokens: 1, outputTokens: 1 },
        ),
      ).resolves.toBeUndefined();
    });
  });
});
