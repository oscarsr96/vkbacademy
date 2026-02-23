import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { TutorChatDto } from './dto/tutor-chat.dto';

@Injectable()
export class TutorService {
  private readonly logger = new Logger(TutorService.name);
  private readonly anthropic: Anthropic;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.anthropic = new Anthropic({
      apiKey: this.config.get<string>('ANTHROPIC_API_KEY'),
    });
  }

  // ─── Streaming ───────────────────────────────────────────────────────────────

  async streamChat(userId: string, dto: TutorChatDto, res: Response): Promise<void> {
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
        content: dto.message,
        courseId: dto.courseId ?? null,
        lessonId: dto.lessonId ?? null,
      },
    });

    // 3. Construir el system prompt con contexto
    const systemPrompt = this.buildSystemPrompt(dto);

    // 4. Configurar headers SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // evitar buffering en nginx
    res.flushHeaders();

    // 5. Construir mensajes para Anthropic (historial + mensaje actual)
    const anthropicMessages: Anthropic.MessageParam[] = [
      ...contextMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: dto.message },
    ];

    // 6. Hacer streaming desde Anthropic
    let fullResponse = '';

    try {
      const stream = this.anthropic.messages.stream({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        messages: anthropicMessages,
      });

      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
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
        createdAt: true,
      },
    });
  }

  async clearHistory(userId: string) {
    await this.prisma.tutorMessage.deleteMany({ where: { userId } });
    return { cleared: true };
  }

  // ─── System prompt ───────────────────────────────────────────────────────────

  private buildSystemPrompt(dto: TutorChatDto): string {
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

    return lines.join('\n');
  }
}
