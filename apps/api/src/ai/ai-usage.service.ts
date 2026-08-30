import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiUsageCategory } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Contexto de atribución que viaja con cada llamada a la IA. */
export interface AiUsageContext {
  userId: string;
  category: AiUsageCategory;
}

/** Consumo devuelto por el proveedor tras una llamada. */
export interface AiCallUsage {
  provider: 'gemini' | 'haiku';
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/** Precio en dólares por millón de tokens. */
interface ProviderPrice {
  inputPerMillionUsd: number;
  outputPerMillionUsd: number;
}

/**
 * Tarifas por defecto.
 *
 * Haiku 4.5: $1 entrada / $5 salida por millón (tarifa de lista de Anthropic).
 * Gemini: 0 porque hoy es el proveedor gratuito del proyecto (CLAUDE.md §9).
 * El coste registrado es el que paga el club, no uno hipotético: por eso los
 * tokens se guardan igual aunque el importe salga a cero — son la señal real
 * de consumo mientras el plan siga siendo gratis.
 *
 * Si Google empieza a cobrar, se ajusta por entorno sin tocar código.
 */
const DEFAULT_PRICES: Record<'gemini' | 'haiku', ProviderPrice> = {
  gemini: { inputPerMillionUsd: 0, outputPerMillionUsd: 0 },
  haiku: { inputPerMillionUsd: 1, outputPerMillionUsd: 5 },
};

const MICRO_USD = 1_000_000;

@Injectable()
export class AiUsageService {
  private readonly logger = new Logger(AiUsageService.name);
  private readonly prices: Record<'gemini' | 'haiku', ProviderPrice>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.prices = {
      gemini: {
        inputPerMillionUsd: this.price('AI_PRICE_GEMINI_INPUT_USD', 0),
        outputPerMillionUsd: this.price('AI_PRICE_GEMINI_OUTPUT_USD', 0),
      },
      haiku: {
        inputPerMillionUsd: this.price('AI_PRICE_HAIKU_INPUT_USD', 1),
        outputPerMillionUsd: this.price('AI_PRICE_HAIKU_OUTPUT_USD', 5),
      },
    };
  }

  private price(key: string, fallback: number): number {
    const raw = this.config.get(key);
    const parsed = Number(raw);
    return raw === undefined || raw === '' || Number.isNaN(parsed) ? fallback : parsed;
  }

  /** Coste estimado en microdólares (entero) de una llamada. */
  estimateMicroUsd(usage: AiCallUsage): number {
    const price = this.prices[usage.provider] ?? DEFAULT_PRICES[usage.provider];
    const usd =
      (usage.inputTokens / 1_000_000) * price.inputPerMillionUsd +
      (usage.outputTokens / 1_000_000) * price.outputPerMillionUsd;
    return Math.round(usd * MICRO_USD);
  }

  /**
   * Registra el consumo de una llamada. Nunca lanza: la contabilidad no puede
   * tumbar una generación que el alumno ya está esperando — mismo criterio que
   * `checkAndAward`. Si falla, queda en el log y se pierde ese registro.
   */
  async record(context: AiUsageContext, usage: AiCallUsage): Promise<void> {
    try {
      const membership = await this.prisma.academyMember.findFirst({
        where: { userId: context.userId },
        orderBy: { createdAt: 'asc' },
        select: { academyId: true },
      });

      await this.prisma.aiUsage.create({
        data: {
          userId: context.userId,
          academyId: membership?.academyId ?? null,
          category: context.category,
          provider: usage.provider,
          model: usage.model,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          costMicroUsd: this.estimateMicroUsd(usage),
        },
      });
    } catch (err) {
      this.logger.error(`No se pudo registrar el consumo de IA de userId=${context.userId}`, err);
    }
  }
}
