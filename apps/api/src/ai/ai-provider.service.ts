import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Proveedor de IA unificado con fallback automático.
 *
 * Orden de prioridad:
 *  1. Gemini 2.0 Flash (gratis, 15 RPM / 1M TPD)
 *  2. Claude Haiku (fallback de pago)
 *
 * El proveedor principal se configura con AI_PROVIDER:
 *  - "gemini"  → solo Gemini (falla si no responde)
 *  - "haiku"   → solo Haiku (comportamiento actual)
 *  - "auto"    → Gemini primero, Haiku si falla (por defecto)
 *
 * Ambos adapters comparten la misma interfaz: reciben un prompt y
 * devuelven el texto generado. El parseo de JSON queda en el caller
 * (CourseGeneratorService).
 */
@Injectable()
export class AiProviderService {
  private readonly logger = new Logger(AiProviderService.name);
  private readonly gemini?: GoogleGenerativeAI;
  private readonly anthropic?: Anthropic;
  private readonly provider: 'gemini' | 'haiku' | 'auto';

  constructor(private readonly config: ConfigService) {
    const geminiKey = this.config.get<string>('GEMINI_API_KEY');
    const anthropicKey = this.config.get<string>('ANTHROPIC_API_KEY');

    if (geminiKey) {
      this.gemini = new GoogleGenerativeAI(geminiKey);
    }
    if (anthropicKey) {
      this.anthropic = new Anthropic({ apiKey: anthropicKey });
    }

    this.provider =
      (this.config.get<string>('AI_PROVIDER') as 'gemini' | 'haiku' | 'auto') ?? 'auto';

    this.logger.log(
      `AI Provider inicializado: mode=${this.provider}, gemini=${!!this.gemini}, haiku=${!!this.anthropic}`,
    );
  }

  /**
   * Genera texto a partir de un prompt. Devuelve el contenido crudo
   * (normalmente JSON) que el caller debe parsear.
   */
  async generate(prompt: string, maxTokens: number): Promise<string> {
    if (this.provider === 'haiku') {
      return this.callHaiku(prompt, maxTokens);
    }

    if (this.provider === 'gemini') {
      return this.callGemini(prompt, maxTokens);
    }

    // auto: Gemini → Haiku fallback
    if (this.gemini) {
      try {
        return await this.callGemini(prompt, maxTokens);
      } catch (error) {
        this.logger.warn(
          `Gemini falló, cayendo a Haiku: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    return this.callHaiku(prompt, maxTokens);
  }

  private async callGemini(prompt: string, maxTokens: number): Promise<string> {
    if (!this.gemini) {
      throw new Error('GEMINI_API_KEY no configurada');
    }

    const model = this.gemini.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        maxOutputTokens: maxTokens,
        responseMimeType: 'application/json',
      },
    });

    this.logger.debug(`Llamando a Gemini 2.0 Flash (maxTokens=${maxTokens})`);
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    if (!text) {
      throw new Error('Gemini devolvió respuesta vacía');
    }

    return text;
  }

  private async callHaiku(prompt: string, maxTokens: number): Promise<string> {
    if (!this.anthropic) {
      throw new Error('ANTHROPIC_API_KEY no configurada');
    }

    this.logger.debug(`Llamando a Claude Haiku (maxTokens=${maxTokens})`);
    const message = await this.anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = message.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('Haiku no devolvió contenido de texto');
    }

    return textContent.text;
  }
}
