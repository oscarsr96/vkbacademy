import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiUsageCategory, ChallengeType } from '@prisma/client';
import { Response } from 'express';
import { TUTOR_DEFAULT_IMAGE_PROMPT } from '@vkbacademy/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ChallengesService } from '../challenges/challenges.service';
import { AiChatMessage, AiProviderService } from '../ai/ai-provider.service';
import { currentDayStart } from '../challenges/challenge-periods';
import { TutorChatDto } from './dto/tutor-chat.dto';
import {
  buildStudyProfileLines,
  MAX_PROFILE_PLANS,
  rankWeakTopics,
  suggestPracticeTopic,
  type PracticeCandidate,
  type StudyProfile,
} from './study-profile';

/** Tope de la respuesta. 3-4 párrafos caben de sobra; el prompt ya pide concisión. */
const TUTOR_MAX_TOKENS = 1024;

/** Ventana de ejercicios que cuenta para "lo que le cuesta" (#137). */
const WEAK_TOPICS_WINDOW_DAYS = 30;

/** Mensajes anteriores que ve el modelo en cada pregunta. */
const CONTEXT_WINDOW = 10;

/**
 * Fotos de mensajes anteriores que vuelven al modelo (#140). Cada una cuesta
 * ~1.000 tokens: con tres hay seguimiento de sobra sin disparar el gasto.
 */
const MAX_CONTEXT_IMAGES = 3;

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

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly challenges: ChallengesService,
    // Gemini primero, Haiku si falla — la misma política que el resto de la IA.
    // El proveedor registra el consumo por quien responda.
    private readonly ai: AiProviderService,
  ) {}

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

    // 1. Obtener los últimos mensajes de contexto (orden cronológico), con la
    //    foto de los que la tuvieran para que el modelo la vuelva a ver.
    const history = await this.prisma.tutorMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: CONTEXT_WINDOW,
      include: { image: { select: { mimeType: true, data: true } } },
    });
    const contextMessages = history.reverse();

    // 2. Guardar el mensaje del usuario en BD, y su foto si la lleva
    const saved = await this.prisma.tutorMessage.create({
      data: {
        userId,
        role: 'user',
        content: message,
        courseId: dto.courseId ?? null,
        lessonId: dto.lessonId ?? null,
        hasImage: Boolean(image),
      },
    });
    if (image) {
      await this.prisma.tutorImage.create({
        data: { messageId: saved.id, mimeType: image.mimeType, data: image.buffer },
      });
    }
    // Las fotos viven lo que dura la conversación: fuera de la ventana, fuera.
    await this.prisma.tutorImage.deleteMany({
      where: {
        message: { userId },
        messageId: { notIn: [...contextMessages.map((m) => m.id), saved.id] },
      },
    });

    // Preguntar al tutor cuenta como actividad y alimenta TUTOR_QUESTIONS
    void this.challenges.checkAndAward(userId, ChallengeType.TUTOR_QUESTIONS);

    // 3. Construir el system prompt con contexto: el de la petición (curso/
    //    lección desde donde pregunta) y el perfil de estudio leído de BD.
    const { profile, practiceCandidates } = await this.loadStudyProfile(userId);
    const systemPrompt = this.buildSystemPrompt(dto, Boolean(image), profile);

    // 4. Configurar headers SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // evitar buffering en nginx
    res.flushHeaders();

    // 5. Turnos para el proveedor (historial + mensaje actual). El historial
    //    es siempre texto: la foto no se guarda, así que en las preguntas de
    //    seguimiento el modelo se apoya en su propia respuesta.
    // Solo las últimas MAX_CONTEXT_IMAGES fotos viajan; el resto de mensajes
    // con foto van como texto.
    const imageBudget = new Set(
      contextMessages
        .filter((m) => m.image)
        .slice(-MAX_CONTEXT_IMAGES)
        .map((m) => m.id),
    );
    const messages: AiChatMessage[] = [
      ...contextMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        text: m.content,
        ...(m.image && imageBudget.has(m.id)
          ? { image: { mimeType: m.image.mimeType, base64: Buffer.from(m.image.data).toString('base64') } }
          : {}),
      })),
      {
        role: 'user',
        text: message,
        ...(image
          ? { image: { mimeType: image.mimeType, base64: image.buffer.toString('base64') } }
          : {}),
      },
    ];

    // 6. Streaming. Si Gemini falla antes del primer trozo el proveedor cae a
    //    Haiku solo; si falla a mitad, el error llega aquí y se pinta.
    let fullResponse = '';

    try {
      const stream = this.ai.streamChat({
        system: systemPrompt,
        messages,
        maxTokens: TUTOR_MAX_TOKENS,
        context: { userId, category: AiUsageCategory.CHATBOT },
      });

      for await (const text of stream) {
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
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

      // 8. Señal de fin. Si la conversación toca un tema de sus planes, va la
      //    propuesta de practicarlo (#141).
      const practice = suggestPracticeTopic(`${message}\n${fullResponse}`, practiceCandidates);
      res.write(`data: ${JSON.stringify(practice ? { done: true, practice } : { done: true })}\n\n`);
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

  // ─── Perfil de estudio (#137) ────────────────────────────────────────────────

  /**
   * Qué estudia el alumno y qué le cuesta, para que el tutor no responda a
   * ciegas desde la página Dudas. Tres consultas ligeras por pregunta; el
   * cupo diario acota el coste.
   */
  private async loadStudyProfile(
    userId: string,
  ): Promise<{ profile: StudyProfile; practiceCandidates: PracticeCandidate[] }> {
    const since = new Date(Date.now() - WEAK_TOPICS_WINDOW_DAYS * 86_400_000);
    const [user, plans, attempts] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { schoolYear: { select: { label: true } } },
      }),
      this.prisma.studyPlan.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: MAX_PROFILE_PLANS,
        select: {
          title: true,
          courseId: true,
          course: { select: { title: true } },
          topics: { select: { title: true, moduleId: true } },
        },
      }),
      this.prisma.exerciseAttempt.findMany({
        where: { userId, answeredAt: { gte: since } },
        select: { topicLabel: true, verdict: true },
      }),
    ]);

    const weakTopics = rankWeakTopics(attempts);
    const weakLabels = new Set(weakTopics.map((t) => t.topicLabel));

    // Temas de sus planes, candidatos a "practicar esto" (#141)
    const practiceCandidates: PracticeCandidate[] = plans.flatMap((p) =>
      p.topics.map((t) => ({
        title: t.title,
        courseId: p.courseId,
        courseTitle: p.course.title,
        moduleId: t.moduleId ?? null,
        weak: weakLabels.has(t.title),
      })),
    );

    return {
      profile: {
        schoolYear: user?.schoolYear?.label ?? null,
        plans: plans.map((p) => ({ title: p.title, course: p.course.title })),
        weakTopics,
      },
      practiceCandidates,
    };
  }

  // ─── System prompt ───────────────────────────────────────────────────────────

  private buildSystemPrompt(
    dto: TutorChatDto,
    withImage = false,
    profile: StudyProfile = { schoolYear: null, plans: [], weakTopics: [] },
  ): string {
    const lines = [
      'Eres el tutor virtual de VKB Academy, plataforma educativa de Vallekas Basket Club.',
      'Ayudas a alumnos jóvenes de ESO y Bachillerato con sus estudios de forma cercana y motivadora.',
    ];

    // El curso de BD manda; el del cliente solo cubre a quien no tiene curso asignado.
    lines.push(
      ...buildStudyProfileLines({
        ...profile,
        schoolYear: profile.schoolYear ?? dto.schoolYear ?? null,
      }),
    );
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
      '- Formato: Markdown ligero (negritas, listas cortas) y las fórmulas siempre en LaTeX entre $…$ (o $$…$$ en su propia línea)',
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
