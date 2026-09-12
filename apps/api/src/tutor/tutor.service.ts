import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { AiUsageCategory, ChallengeType } from '@prisma/client';
import { Response } from 'express';
import { TUTOR_DEFAULT_IMAGE_PROMPT } from '@vkbacademy/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ChallengesService } from '../challenges/challenges.service';
import { AiUsageService } from '../ai/ai-usage.service';
import { currentDayStart } from '../challenges/challenge-periods';
import { TutorChatDto } from './dto/tutor-chat.dto';

/** Modelo del tutor. Pinneado, igual que los del AiProviderService. */
const TUTOR_MODEL = 'claude-haiku-4-5-20251001';

/**
 * Preguntas al tutor por alumno y día.
 *
 * El controlador ya limita a 10 por hora, pero ese contador vive en memoria
 * (Redis no está desplegado) y Render Starter duerme el servicio: cada
 * arranque en frío lo pone a cero, así que por sí solo no acota el gasto de
 * un día. Este se cuenta en BD sobre los mensajes ya guardados, que es lo
 * único que sobrevive a un reinicio.
 *
 * 30 son unas cuantas sesiones largas de estudio y deja el peor caso en
 * torno a diez céntimos de dólar por alumno y día.
 */
const DEFAULT_DAILY_LIMIT = 30;

/** Formatos de foto que acepta el tutor. Los mismos que entiende Claude. */
export const TUTOR_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type TutorImageMimeType = (typeof TUTOR_IMAGE_MIME_TYPES)[number];

/** Foto adjunta a una pregunta. Vive solo lo que dura la request. */
export interface TutorImage {
  buffer: Buffer;
  mimeType: TutorImageMimeType;
}

/** Lo que "dice" el alumno cuando manda la foto sin escribir nada. */
export const DEFAULT_IMAGE_PROMPT = TUTOR_DEFAULT_IMAGE_PROMPT;

@Injectable()
export class TutorService {
  private readonly logger = new Logger(TutorService.name);
  private readonly anthropic: Anthropic;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly challenges: ChallengesService,
    private readonly aiUsage: AiUsageService,
  ) {
    this.anthropic = new Anthropic({
      apiKey: this.config.get<string>('ANTHROPIC_API_KEY'),
    });
  }

  /** Límite diario efectivo, configurable por entorno. */
  private get dailyLimit(): number {
    const raw = Number(this.config.get('TUTOR_DAILY_LIMIT'));
    return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_DAILY_LIMIT;
  }

  /**
   * Corta si el alumno ya ha agotado sus preguntas de hoy.
   *
   * El día se corta en Madrid, el mismo calendario con el que se mueven las
   * rachas: si no, el cupo se renovaría a la una o a las dos de la madrugada
   * según la época del año.
   */
  private async assertDailyQuota(userId: string): Promise<void> {
    const limit = this.dailyLimit;
    const startOfDay = currentDayStart(new Date());

    const asked = await this.prisma.tutorMessage.count({
      where: { userId, role: 'user', createdAt: { gte: startOfDay } },
    });

    if (asked >= limit) {
      throw new HttpException(
        `Has gastado tus ${limit} preguntas de hoy. El tutor vuelve mañana.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  // ─── Streaming ───────────────────────────────────────────────────────────────

  async streamChat(
    userId: string,
    dto: TutorChatDto,
    res: Response,
    image?: TutorImage,
  ): Promise<void> {
    // Texto o foto, al menos uno. Se comprueba antes que el cupo: una request
    // vacía no debe gastar una pregunta.
    const message = dto.message?.trim() || (image ? DEFAULT_IMAGE_PROMPT : '');
    if (!message) {
      throw new HttpException('Escribe una pregunta o adjunta una foto', HttpStatus.BAD_REQUEST);
    }

    // 0. Cupo diario. Se comprueba ANTES de tocar las cabeceras SSE para que el
    //    429 salga como JSON y el cliente pueda explicar el motivo real.
    await this.assertDailyQuota(userId);

    // 1. Obtener últimos 10 mensajes de contexto (orden cronológico)
    const history = await this.prisma.tutorMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    const contextMessages = history.reverse();

    // 2. Guardar el mensaje del usuario en BD
    await this.prisma.tutorMessage.create({
      data: {
        userId,
        role: 'user',
        content: message,
        courseId: dto.courseId ?? null,
        lessonId: dto.lessonId ?? null,
        hasImage: Boolean(image),
      },
    });

    // Preguntar al tutor cuenta como actividad y alimenta TUTOR_QUESTIONS
    void this.challenges.checkAndAward(userId, ChallengeType.TUTOR_QUESTIONS);

    // 3. Construir el system prompt con contexto
    const systemPrompt = this.buildSystemPrompt(dto, Boolean(image));

    // 4. Configurar headers SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // evitar buffering en nginx
    res.flushHeaders();

    // 5. Construir mensajes para Anthropic (historial + mensaje actual). El
    //    historial es siempre texto: la foto no se guarda, así que en las
    //    preguntas de seguimiento el modelo se apoya en su propia respuesta.
    const currentContent: Anthropic.MessageParam['content'] = image
      ? [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: image.mimeType,
              data: image.buffer.toString('base64'),
            },
          },
          { type: 'text', text: message },
        ]
      : message;

    const anthropicMessages: Anthropic.MessageParam[] = [
      ...contextMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: currentContent },
    ];

    // 6. Hacer streaming desde Anthropic
    let fullResponse = '';

    try {
      const stream = this.anthropic.messages.stream({
        model: TUTOR_MODEL,
        max_tokens: 1024,
        system: systemPrompt,
        messages: anthropicMessages,
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          const text = event.delta.text;
          fullResponse += text;
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
      }

      // 7. Guardar la respuesta completa del asistente en BD
      await this.prisma.tutorMessage.create({
        data: {
          userId,
          role: 'assistant',
          content: fullResponse,
          courseId: dto.courseId ?? null,
          lessonId: dto.lessonId ?? null,
        },
      });

      // 8.b Registrar el consumo, DESPUÉS de guardar y en su propio try: el
      //      tutor llama a Anthropic directamente, así que se contabiliza aquí.
      //      Va detrás del guardado a propósito — si finalMessage() falla, el
      //      alumno no puede perder la respuesta que ya ha leído por una
      //      cuestión de contabilidad.
      try {
        const finalMessage = await stream.finalMessage();
        void this.aiUsage.record(
          { userId, category: AiUsageCategory.CHATBOT },
          {
            provider: 'haiku',
            model: TUTOR_MODEL,
            inputTokens: finalMessage.usage.input_tokens,
            outputTokens: finalMessage.usage.output_tokens,
          },
        );
      } catch (err) {
        this.logger.warn(
          `No se pudo leer el consumo del tutor para userId=${userId}: ${String(err)}`,
        );
      }

      // 8. Señal de fin
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    } catch (error) {
      this.logger.error('Error en streaming del tutor', error);
      res.write(`data: ${JSON.stringify({ error: 'Error al procesar tu pregunta' })}\n\n`);
    }

    res.end();
  }

  // ─── Historial ───────────────────────────────────────────────────────────────

  async getHistory(userId: string) {
    return this.prisma.tutorMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      take: 50,
      select: {
        id: true,
        role: true,
        content: true,
        courseId: true,
        lessonId: true,
        hasImage: true,
        createdAt: true,
      },
    });
  }

  async clearHistory(userId: string) {
    await this.prisma.tutorMessage.deleteMany({ where: { userId } });
    return { cleared: true };
  }

  // ─── System prompt ───────────────────────────────────────────────────────────

  private buildSystemPrompt(dto: TutorChatDto, withImage = false): string {
    const lines = [
      'Eres el tutor virtual de VKB Academy, plataforma educativa de Vallekas Basket Club.',
      'Ayudas a alumnos jóvenes de ESO y Bachillerato con sus estudios de forma cercana y motivadora.',
    ];

    if (dto.schoolYear) {
      lines.push(`El alumno está en ${dto.schoolYear}.`);
    }
    if (dto.courseName) {
      lines.push(`Está estudiando el curso: "${dto.courseName}".`);
    }
    if (dto.lessonName) {
      lines.push(`Actualmente en la lección: "${dto.lessonName}".`);
    }

    lines.push(
      '',
      'Instrucciones:',
      '- Responde siempre en español, claro y adaptado a la edad del alumno',
      '- Máximo 3-4 párrafos por respuesta; sé conciso',
      '- Usa ejemplos concretos; si es ciencia, usa analogías del baloncesto o vida cotidiana',
      '- Anima al alumno; si está atascado, desglosa el problema en pasos',
      '- Nunca des respuestas directas a ejercicios: guía para que llegue solo',
      '- Si la pregunta está fuera del ámbito educativo, redirige amablemente',
    );

    if (withImage) {
      lines.push(
        '',
        'El alumno ha adjuntado la foto de un ejercicio o de sus apuntes.',
        '- Empieza diciendo en una frase qué ejercicio ves, para que confirme que lo has leído bien',
        '- Si la foto no se lee o no es un ejercicio, dilo y pide otra',
        '- Después pregunta qué ha intentado o dale solo el primer paso',
        '- Nunca escribas la solución final ni el resultado numérico',
      );
    }

    return lines.join('\n');
  }
}
