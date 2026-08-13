import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, GoogleGenerativeAIAbortError } from '@google/generative-ai';
import Anthropic, { APIConnectionTimeoutError } from '@anthropic-ai/sdk';

// Modelo por defecto, PINNEADO a propósito. No usar alias móviles
// ("gemini-flash-latest"): Google los repunta sin avisar y con ellos viaja la
// semántica de los parámetros. Medido contra la API el 13-08-2026:
//   gemini-flash-latest + thinkingBudget: 0  → 400 INVALID_ARGUMENT (siempre)
//   gemini-flash-latest sin thinkingConfig   → 200 OK
//   gemini-3.5-flash    + thinkingLevel      → 200 OK, 0 thinking tokens
//   gemini-2.5-flash                         → 404 "no longer available to new users"
// Es decir: el alias saltó a un modelo que rechaza el parámetro de thinking de
// Gemini 2.5, y cada llamada moría en 400 sin que nadie tocara el repo.
// Overridable con GEMINI_MODEL para migrar de familia sin desplegar código.
const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash';

/**
 * Proveedor de IA unificado con fallback automático.
 *
 * Orden de prioridad:
 *  1. Gemini Flash (gratis, 15 RPM / 1M TPD)
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
  private readonly geminiModel: string;
  private readonly timeoutMs: number;

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
    // Number() en vez de confiar en la coerción de Joi: el valor puede llegar
    // como string (process.env) o number (ConfigService validado), y así
    // funciona igual en ambos casos.
    this.timeoutMs = Number(this.config.get('AI_TIMEOUT_MS')) || 60000;
    this.geminiModel = this.config.get<string>('GEMINI_MODEL') || DEFAULT_GEMINI_MODEL;

    this.logger.log(
      `AI Provider inicializado: mode=${this.provider}, gemini=${!!this.gemini} (${this.geminiModel}), haiku=${!!this.anthropic}, timeoutMs=${this.timeoutMs}`,
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
    let geminiError: Error | null = null;
    if (this.gemini) {
      try {
        return await this.callGemini(prompt, maxTokens);
      } catch (error) {
        geminiError = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(`Gemini falló, intentando Haiku: ${geminiError.message}`);
      }
    }

    if (!this.anthropic) {
      // Ningún proveedor disponible: error claro mencionando ambos
      const reason = geminiError
        ? `Gemini falló (${geminiError.message}) y Haiku no está configurada (falta ANTHROPIC_API_KEY)`
        : 'Ningún proveedor de IA configurado: falta GEMINI_API_KEY y ANTHROPIC_API_KEY';
      throw new Error(reason);
    }

    // Si también falla el fallback, el error debe nombrar AMBAS causas: con solo
    // la de Haiku, un fallo de Gemini se leía como un problema de facturación.
    try {
      return await this.callHaiku(prompt, maxTokens);
    } catch (haikuError) {
      if (!geminiError) throw haikuError;
      const haikuMessage = haikuError instanceof Error ? haikuError.message : String(haikuError);
      throw new Error(
        `Los dos proveedores fallaron — Gemini: ${geminiError.message} | Haiku: ${haikuMessage}`,
      );
    }
  }

  private async callGemini(prompt: string, maxTokens: number): Promise<string> {
    if (!this.gemini) {
      throw new Error('GEMINI_API_KEY no configurada');
    }

    // El modelo va pinneado (ver DEFAULT_GEMINI_MODEL) y la config de thinking
    // depende de su familia. El SDK legacy @google/generative-ai@0.24.x no tipa
    // estos campos — se pasan transparentemente al endpoint REST.
    const model = this.gemini.getGenerativeModel({
      model: this.geminiModel,
      generationConfig: {
        maxOutputTokens: maxTokens,
        responseMimeType: 'application/json',
        thinkingConfig: this.thinkingConfigFor(this.geminiModel),
      } as Record<string, unknown>,
    });

    this.logger.debug(
      `Llamando a Gemini ${this.geminiModel} (maxTokens=${maxTokens}, timeout=${this.timeoutMs}ms)`,
    );
    let result;
    try {
      result = await model.generateContent(prompt, { timeout: this.timeoutMs });
    } catch (error) {
      if (error instanceof GoogleGenerativeAIAbortError) {
        this.logger.error(`Gemini superó el timeout de ${this.timeoutMs}ms sin responder`);
        throw new Error(`Gemini no respondió en ${this.timeoutMs}ms (timeout)`);
      }
      throw error;
    }

    this.assertNotTruncated(result.response, maxTokens);

    const text = result.response.text();

    if (!text) {
      throw new Error('Gemini devolvió respuesta vacía');
    }

    return text;
  }

  /**
   * Config de thinking según la familia del modelo. Los thinking tokens se
   * descuentan de maxOutputTokens pero NO aparecen en response.text(): si el
   * modelo piensa, el JSON llega truncado. Cada familia lo limita con un
   * parámetro distinto y enviar los dos en la misma request devuelve 400.
   *  - Gemini ≤2.x → `thinkingBudget: 0` (apagado real).
   *  - Gemini ≥3   → `thinkingLevel: 'minimal'` (el mínimo posible; Gemini 3 no
   *    permite apagarlo del todo, de ahí que además detectemos el truncamiento).
   */
  private thinkingConfigFor(model: string): Record<string, unknown> {
    const major = Number(/gemini-(\d+)/.exec(model)?.[1] ?? 0);
    return major >= 3 ? { thinkingLevel: 'minimal' } : { thinkingBudget: 0 };
  }

  /**
   * Un `finishReason: MAX_TOKENS` significa que la respuesta viene cortada a
   * media frase: el JSON es basura. Sin esto, el fallo emergía dos capas más
   * arriba como un error de parseo indescifrable ("Unexpected end of JSON
   * input") que no señalaba ni al modelo ni al thinking.
   */
  private assertNotTruncated(response: unknown, maxTokens: number): void {
    const res = response as {
      candidates?: { finishReason?: string }[];
      usageMetadata?: { thoughtsTokenCount?: number };
    };
    if (res.candidates?.[0]?.finishReason !== 'MAX_TOKENS') return;

    const thoughts = res.usageMetadata?.thoughtsTokenCount ?? 0;
    const thinkingNote =
      thoughts > 0
        ? ` — ${thoughts} tokens se fueron en thinking pese a la config, sube maxTokens o baja el thinking del modelo`
        : '';
    this.logger.error(
      `Gemini ${this.geminiModel} truncó la respuesta en maxOutputTokens=${maxTokens}${thinkingNote}`,
    );
    throw new Error(
      `Gemini (${this.geminiModel}) devolvió JSON truncado: agotó maxOutputTokens=${maxTokens}${thinkingNote}`,
    );
  }

  private async callHaiku(prompt: string, maxTokens: number): Promise<string> {
    if (!this.anthropic) {
      throw new Error('ANTHROPIC_API_KEY no configurada');
    }

    this.logger.debug(
      `Llamando a Claude Haiku (maxTokens=${maxTokens}, timeout=${this.timeoutMs}ms)`,
    );
    let message;
    try {
      message = await this.anthropic.messages.create(
        {
          model: 'claude-haiku-4-5-20251001',
          max_tokens: maxTokens,
          messages: [{ role: 'user', content: prompt }],
        },
        { timeout: this.timeoutMs },
      );
    } catch (error) {
      if (error instanceof APIConnectionTimeoutError) {
        this.logger.error(`Haiku superó el timeout de ${this.timeoutMs}ms sin responder`);
        throw new Error(`Haiku no respondió en ${this.timeoutMs}ms (timeout)`);
      }
      throw error;
    }

    const textContent = message.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('Haiku no devolvió contenido de texto');
    }

    return textContent.text;
  }
}
