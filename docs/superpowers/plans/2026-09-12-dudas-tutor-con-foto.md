# Dudas: tutor IA como sección, con foto — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una sección «Dudas» en el menú del alumno donde el tutor IA existente funciona a pantalla completa y acepta la foto de un ejercicio.

**Architecture:** No hay tutor nuevo. `POST /tutor/chat` pasa a aceptar `multipart/form-data` con un fichero `image` opcional que se convierte en bloque `image` base64 para Claude Haiku y no se persiste; `TutorMessage.hasImage` marca el mensaje. En la web, la lógica de chat sale de `TutorWidget` a un componente `TutorChat` que montan la burbuja y la nueva `TutorPage`.

**Tech Stack:** NestJS + multer (vía `@nestjs/platform-express`), Prisma, `@anthropic-ai/sdk` (bloques de imagen), React 18 + Vite, Vitest + Testing Library, Jest.

**Spec:** `docs/superpowers/specs/2026-09-12-dudas-tutor-con-foto-design.md`

## Global Constraints

- Rama de trabajo: `feat/dudas-tutor-foto` (ya existe, parte de `main`).
- Nombres en inglés (rutas, variables); copy y comentarios en español. El alumno ve «Dudas», la ruta es `/tutor`.
- TypeScript `strict: true`. Sin `any`.
- Errores HTTP con `HttpException` y mensaje en español: `{ message, statusCode }`.
- Filtro `pnpm --filter @vkbacademy/api` / `pnpm --filter @vkbacademy/web` (nombres con scope).
- Guards antes de services; nada de lógica de roles en el service.
- No crear archivos `.md` fuera de este plan.
- La foto **no se guarda** en ningún sitio. Máximo 5 MB; solo `image/jpeg`, `image/png`, `image/webp`. Reescalado en cliente a ≤ 1568 px, JPEG 85 %.
- Una pregunta con foto consume una del cupo (30/día, 10/h). No se tocan los límites.
- Texto por defecto cuando solo hay foto: `¿Me ayudas con este ejercicio?`
- Cada tarea termina con tests en verde (`pnpm --filter @vkbacademy/api test` o `pnpm --filter @vkbacademy/web test`) y un commit con estilo `feat(tutor):` / `refactor(tutor):`. Cada commit lleva al final:
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01KmbWAC9AiCv1kdMoGSoMSQ
  ```
- Prisma: tras cambiar el schema, `pnpm --filter @vkbacademy/api prisma migrate dev --name <nombre>` con Docker levantado (`docker compose up -d` en la raíz) y después `pnpm --filter @vkbacademy/api exec prisma generate`.

---

### Task 1: `TutorMessage.hasImage` en BD y en el tipo compartido

**Files:**
- Modify: `apps/api/prisma/schema.prisma:539-551` (modelo `TutorMessage`)
- Create: `apps/api/prisma/migrations/<timestamp>_add_tutor_message_has_image/migration.sql` (la genera Prisma)
- Modify: `packages/shared/src/types/tutor.types.ts`
- Modify: `apps/api/src/tutor/tutor.service.ts:80-90` (`create` del mensaje del usuario) y `:170-185` (`getHistory`)
- Test: `apps/api/src/tutor/tutor.service.spec.ts`

**Interfaces:**
- Produces: columna `TutorMessage.hasImage Boolean @default(false)`; `TutorMessageDto.hasImage: boolean` en `@vkbacademy/shared`; `getHistory` devuelve `hasImage`.

- [ ] **Step 1: Test — el mensaje del usuario se guarda con `hasImage: false` y el historial lo devuelve**

En `apps/api/src/tutor/tutor.service.spec.ts`, dentro de `describe('getHistory')`, cambia el `expect(...).toHaveBeenCalledWith` para que el `select` incluya `hasImage: true`:

```ts
      expect(mockTutorMessage.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
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
```

Dentro de `describe('streamChat')`, en el test `'guarda el mensaje del usuario en BD antes de llamar a Anthropic'`, cambia el `expect` del `create`:

```ts
      expect(mockTutorMessage.create).toHaveBeenCalledWith({
        data: {
          userId,
          role: 'user',
          content: dto.message,
          courseId: dto.courseId,
          lessonId: dto.lessonId,
          hasImage: false,
        },
      });
```

- [ ] **Step 2: Ejecuta y comprueba que fallan**

Run: `pnpm --filter @vkbacademy/api exec jest src/tutor/tutor.service.spec.ts`
Expected: 2 tests FAIL (el `select` y el `data` no llevan `hasImage`).

- [ ] **Step 3: Schema + migración**

En `apps/api/prisma/schema.prisma`, modelo `TutorMessage`, añade la línea tras `lessonId`:

```prisma
  lessonId  String?
  /// El alumno adjuntó una foto en este mensaje. La foto no se guarda: solo queda la marca.
  hasImage  Boolean  @default(false)
  createdAt DateTime @default(now())
```

Run: `docker compose up -d && pnpm --filter @vkbacademy/api prisma migrate dev --name add_tutor_message_has_image`
Expected: crea `apps/api/prisma/migrations/<ts>_add_tutor_message_has_image/migration.sql` con un único `ALTER TABLE "TutorMessage" ADD COLUMN "hasImage" BOOLEAN NOT NULL DEFAULT false;`. Comprueba que el SQL es solo eso (aditivo).

- [ ] **Step 4: Tipo compartido**

`packages/shared/src/types/tutor.types.ts`, interfaz `TutorMessageDto`:

```ts
export interface TutorMessageDto {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  courseId?: string | null;
  lessonId?: string | null;
  /** El mensaje llevaba foto. La foto no se conserva. */
  hasImage: boolean;
  createdAt: string;
}
```

Run: `pnpm --filter @vkbacademy/shared build`

- [ ] **Step 5: Servicio**

En `apps/api/src/tutor/tutor.service.ts`:

En el `create` del mensaje del usuario (paso "2." de `streamChat`):

```ts
    await this.prisma.tutorMessage.create({
      data: {
        userId,
        role: 'user',
        content: dto.message,
        courseId: dto.courseId ?? null,
        lessonId: dto.lessonId ?? null,
        hasImage: false,
      },
    });
```

En `getHistory`, añade `hasImage: true` al `select`, entre `lessonId` y `createdAt`.

- [ ] **Step 6: Verifica**

Run: `pnpm --filter @vkbacademy/api exec jest src/tutor/tutor.service.spec.ts`
Expected: PASS.
Run: `pnpm --filter @vkbacademy/api exec tsc --noEmit -p tsconfig.json`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations packages/shared/src/types/tutor.types.ts apps/api/src/tutor/tutor.service.ts apps/api/src/tutor/tutor.service.spec.ts
git commit -m "feat(tutor): TutorMessage.hasImage marca los mensajes que llevaron foto"
```

---

### Task 2: `TutorService.streamChat` acepta imagen

**Files:**
- Modify: `apps/api/src/tutor/dto/tutor-chat.dto.ts`
- Modify: `apps/api/src/tutor/tutor.service.ts`
- Test: `apps/api/src/tutor/tutor.service.spec.ts`

**Interfaces:**
- Consumes: `hasImage` de Task 1.
- Produces:
  ```ts
  export const TUTOR_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
  export type TutorImageMimeType = (typeof TUTOR_IMAGE_MIME_TYPES)[number];
  export interface TutorImage { buffer: Buffer; mimeType: TutorImageMimeType }
  export const DEFAULT_IMAGE_PROMPT = '¿Me ayudas con este ejercicio?';
  streamChat(userId: string, dto: TutorChatDto, res: Response, image?: TutorImage): Promise<void>
  ```
  `TutorChatDto.message` pasa a opcional.

- [ ] **Step 1: Tests nuevos en `describe('streamChat')`**

Añade al final del bloque `describe('streamChat', ...)` (antes de su cierre), reutilizando `buildMockStream`, `setMockAnthropic`, `mockRes`, `dto` y `userId` ya definidos:

```ts
    describe('con foto', () => {
      const image = {
        buffer: Buffer.from('fake-jpeg-bytes'),
        mimeType: 'image/jpeg' as const,
      };

      it('manda a Anthropic un bloque image base64 seguido del texto', async () => {
        await service.streamChat(userId, dto, mockRes, image);

        const streamMock = service['anthropic'].messages.stream as jest.Mock;
        const { messages } = streamMock.mock.calls[0][0];
        const last = messages[messages.length - 1];

        expect(last.role).toBe('user');
        expect(last.content).toEqual([
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: image.buffer.toString('base64'),
            },
          },
          { type: 'text', text: dto.message },
        ]);
      });

      it('sin texto, pregunta por defecto y la guarda como contenido del mensaje', async () => {
        await service.streamChat(userId, { ...dto, message: undefined }, mockRes, image);

        const streamMock = service['anthropic'].messages.stream as jest.Mock;
        const { messages } = streamMock.mock.calls[0][0];
        const last = messages[messages.length - 1];
        expect(last.content[1]).toEqual({ type: 'text', text: '¿Me ayudas con este ejercicio?' });

        const userCreate = mockTutorMessage.create.mock.calls.find((c) => c[0].data.role === 'user');
        expect(userCreate?.[0].data.content).toBe('¿Me ayudas con este ejercicio?');
      });

      it('marca hasImage: true en el mensaje del alumno', async () => {
        await service.streamChat(userId, dto, mockRes, image);

        const userCreate = mockTutorMessage.create.mock.calls.find((c) => c[0].data.role === 'user');
        expect(userCreate?.[0].data.hasImage).toBe(true);
      });

      it('añade al system prompt las instrucciones de foto solo cuando hay foto', async () => {
        await service.streamChat(userId, dto, mockRes, image);
        const streamMock = service['anthropic'].messages.stream as jest.Mock;
        expect(streamMock.mock.calls[0][0].system).toContain('ha adjuntado la foto');

        jest.clearAllMocks();
        mockTutorMessage.findMany.mockImplementation(() => Promise.resolve([...historialPrevio]));
        mockTutorMessage.create.mockResolvedValue({});
        setMockAnthropic(buildMockStream());

        await service.streamChat(userId, dto, mockRes);
        const streamMock2 = service['anthropic'].messages.stream as jest.Mock;
        expect(streamMock2.mock.calls[0][0].system).not.toContain('ha adjuntado la foto');
      });
    });

    it('sin texto ni foto responde 400 y no toca BD ni Anthropic', async () => {
      await expect(
        service.streamChat(userId, { ...dto, message: '   ' }, mockRes),
      ).rejects.toMatchObject({ status: 400, message: 'Escribe una pregunta o adjunta una foto' });

      expect(mockTutorMessage.create).not.toHaveBeenCalled();
      const streamMock = service['anthropic'].messages.stream as jest.Mock;
      expect(streamMock).not.toHaveBeenCalled();
    });
```

- [ ] **Step 2: Ejecuta y comprueba que fallan**

Run: `pnpm --filter @vkbacademy/api exec jest src/tutor/tutor.service.spec.ts`
Expected: los 5 tests nuevos FAIL (TypeScript se queja del 4º argumento; el resto no encuentra bloques/400).

- [ ] **Step 3: DTO — `message` opcional**

`apps/api/src/tutor/dto/tutor-chat.dto.ts`:

```ts
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class TutorChatDto {
  // Opcional porque el alumno puede mandar solo la foto. La regla "texto o
  // foto, al menos uno" vive en el servicio, que es quien ve las dos cosas.
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  @IsOptional()
  @IsString()
  courseId?: string;

  @IsOptional()
  @IsString()
  lessonId?: string;

  @IsOptional()
  @IsString()
  courseName?: string;

  @IsOptional()
  @IsString()
  lessonName?: string;

  @IsOptional()
  @IsString()
  schoolYear?: string; // "1º ESO", "3º ESO"...
}
```

- [ ] **Step 4: Servicio**

En `apps/api/src/tutor/tutor.service.ts`, tras la constante `DEFAULT_DAILY_LIMIT`, añade:

```ts
/** Formatos de foto que acepta el tutor. Los mismos que entiende Claude. */
export const TUTOR_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type TutorImageMimeType = (typeof TUTOR_IMAGE_MIME_TYPES)[number];

/** Foto adjunta a una pregunta. Vive solo lo que dura la request. */
export interface TutorImage {
  buffer: Buffer;
  mimeType: TutorImageMimeType;
}

/** Lo que "dice" el alumno cuando manda la foto sin escribir nada. */
export const DEFAULT_IMAGE_PROMPT = '¿Me ayudas con este ejercicio?';
```

Sustituye la firma y el arranque de `streamChat`:

```ts
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
      throw new HttpException(
        'Escribe una pregunta o adjunta una foto',
        HttpStatus.BAD_REQUEST,
      );
    }

    // 0. Cupo diario. Se comprueba ANTES de tocar las cabeceras SSE para que el
    //    429 salga como JSON y el cliente pueda explicar el motivo real.
    await this.assertDailyQuota(userId);
```

En el `create` del mensaje del usuario usa `content: message` y `hasImage: Boolean(image)`.

En el paso "3." usa `const systemPrompt = this.buildSystemPrompt(dto, Boolean(image));`.

Sustituye el paso "5." (construcción de `anthropicMessages`):

```ts
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
```

Sustituye `buildSystemPrompt`:

```ts
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
```

- [ ] **Step 5: Verifica**

Run: `pnpm --filter @vkbacademy/api exec jest src/tutor/tutor.service.spec.ts`
Expected: PASS, todos (los antiguos siguen pasando: `dto.message` no vacío no cambia de comportamiento).

- [ ] **Step 6: Mutación**

Comprueba que los tests vigilan de verdad. Una a una, revierte después de cada una:
1. Quita el bloque `image` del array (deja solo el texto) → debe fallar «manda a Anthropic un bloque image».
2. Cambia `DEFAULT_IMAGE_PROMPT` a `'Ayuda'` → debe fallar «sin texto, pregunta por defecto».
3. Pon `hasImage: false` fijo → debe fallar «marca hasImage: true».
4. Quita el `if (!message) throw` → debe fallar «sin texto ni foto responde 400».

Si alguna mutación no hace fallar su test, arregla el test antes de seguir.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/tutor
git commit -m "feat(tutor): el tutor acepta la foto de un ejercicio y guía sin resolverlo"
```

---

### Task 3: `POST /tutor/chat` acepta multipart con `image`

**Files:**
- Create: `apps/api/src/tutor/tutor-image.options.ts`
- Create: `apps/api/src/tutor/tutor-image.options.spec.ts`
- Modify: `apps/api/src/tutor/tutor.controller.ts`
- Modify: `apps/api/package.json` (devDependency `@types/multer`)

**Interfaces:**
- Consumes: `TutorImage`, `TutorImageMimeType`, `TUTOR_IMAGE_MIME_TYPES` de Task 2.
- Produces: `tutorImageMulterOptions` (para `FileInterceptor`), `TUTOR_IMAGE_MAX_BYTES = 5 * 1024 * 1024`, `TutorImageTooLargeFilter`.

- [ ] **Step 1: Instala tipos de multer**

Run: `pnpm --filter @vkbacademy/api add -D @types/multer`
Expected: `@types/multer` en `devDependencies`. multer en sí ya viene con `@nestjs/platform-express`.

- [ ] **Step 2: Test del filtro de tipo y del filtro de tamaño**

`apps/api/src/tutor/tutor-image.options.spec.ts`:

```ts
import { ArgumentsHost, HttpException, PayloadTooLargeException } from '@nestjs/common';
import {
  TUTOR_IMAGE_MAX_BYTES,
  TutorImageTooLargeFilter,
  tutorImageFileFilter,
  tutorImageMulterOptions,
} from './tutor-image.options';

describe('tutorImageFileFilter', () => {
  const asFile = (mimetype: string) => ({ mimetype }) as Express.Multer.File;

  it.each(['image/jpeg', 'image/png', 'image/webp'])('acepta %s', (mimetype) => {
    const cb = jest.fn();
    tutorImageFileFilter({} as never, asFile(mimetype), cb);
    expect(cb).toHaveBeenCalledWith(null, true);
  });

  it.each(['application/pdf', 'image/gif', 'text/plain'])('rechaza %s con 400 en español', (mimetype) => {
    const cb = jest.fn();
    tutorImageFileFilter({} as never, asFile(mimetype), cb);

    const [error, accept] = cb.mock.calls[0];
    expect(accept).toBe(false);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(400);
    expect((error as HttpException).message).toBe('Solo se aceptan fotos JPG, PNG o WebP');
  });
});

describe('tutorImageMulterOptions', () => {
  it('limita a un fichero de 5 MB', () => {
    expect(TUTOR_IMAGE_MAX_BYTES).toBe(5 * 1024 * 1024);
    expect(tutorImageMulterOptions.limits).toEqual({ fileSize: TUTOR_IMAGE_MAX_BYTES, files: 1 });
  });
});

describe('TutorImageTooLargeFilter', () => {
  it('traduce el 413 de multer a un mensaje en español con la forma { message, statusCode }', () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({ getResponse: () => ({ status }) }),
    } as unknown as ArgumentsHost;

    new TutorImageTooLargeFilter().catch(new PayloadTooLargeException('File too large'), host);

    expect(status).toHaveBeenCalledWith(413);
    expect(json).toHaveBeenCalledWith({
      statusCode: 413,
      message: 'La foto pesa demasiado (máximo 5 MB)',
    });
  });
});
```

- [ ] **Step 3: Ejecuta y comprueba que falla**

Run: `pnpm --filter @vkbacademy/api exec jest src/tutor/tutor-image.options.spec.ts`
Expected: FAIL, "Cannot find module './tutor-image.options'".

- [ ] **Step 4: Implementa las opciones y el filtro**

`apps/api/src/tutor/tutor-image.options.ts`:

```ts
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  PayloadTooLargeException,
} from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { Response } from 'express';
import { TUTOR_IMAGE_MIME_TYPES } from './tutor.service';

/** Red de seguridad: el cliente ya reescala a ~300 KB antes de subir. */
export const TUTOR_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

type FileFilterCallback = (error: Error | null, acceptFile: boolean) => void;

/** Solo los formatos que entiende Claude. Lo demás, 400 con mensaje en español. */
export function tutorImageFileFilter(
  _req: unknown,
  file: Express.Multer.File,
  cb: FileFilterCallback,
): void {
  if ((TUTOR_IMAGE_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
    cb(null, true);
    return;
  }
  cb(new HttpException('Solo se aceptan fotos JPG, PNG o WebP', HttpStatus.BAD_REQUEST), false);
}

/**
 * Sin `storage`: multer usa memoria, que es lo que queremos — la foto va al
 * modelo y muere con la request, nunca toca disco ni S3.
 */
export const tutorImageMulterOptions: MulterOptions = {
  limits: { fileSize: TUTOR_IMAGE_MAX_BYTES, files: 1 },
  fileFilter: tutorImageFileFilter,
};

/**
 * multer corta con "File too large" antes de llegar al controlador y Nest lo
 * envuelve en PayloadTooLargeException. Este filtro solo cambia el mensaje
 * para que el alumno lea algo útil en su idioma.
 */
@Catch(PayloadTooLargeException)
export class TutorImageTooLargeFilter implements ExceptionFilter {
  catch(_exception: PayloadTooLargeException, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    res.status(HttpStatus.PAYLOAD_TOO_LARGE).json({
      statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
      message: 'La foto pesa demasiado (máximo 5 MB)',
    });
  }
}
```

- [ ] **Step 5: Controlador**

`apps/api/src/tutor/tutor.controller.ts`, sustituye el método `chat` y los imports:

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Request,
  Res,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TutorChatDto } from './dto/tutor-chat.dto';
import { TutorImageTooLargeFilter, tutorImageMulterOptions } from './tutor-image.options';
import { TutorImage, TutorImageMimeType, TutorService } from './tutor.service';

@Controller('tutor')
@UseGuards(JwtAuthGuard)
export class TutorController {
  constructor(private readonly tutorService: TutorService) {}

  // 10 preguntas por hora por usuario (~$0.24/alumno en uso moderado).
  // Acepta JSON (solo texto) o multipart con un fichero `image` opcional; el
  // interceptor no interfiere si la request no es multipart.
  @Post('chat')
  @Throttle({ default: { ttl: 3600000, limit: 10 } })
  @UseInterceptors(FileInterceptor('image', tutorImageMulterOptions))
  @UseFilters(TutorImageTooLargeFilter)
  chat(
    @Request() req: { user: { id: string } },
    @Body() dto: TutorChatDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Res() res: Response,
  ) {
    // El fileFilter ya ha dejado pasar solo los mime permitidos.
    const image: TutorImage | undefined = file
      ? { buffer: file.buffer, mimeType: file.mimetype as TutorImageMimeType }
      : undefined;
    return this.tutorService.streamChat(req.user.id, dto, res, image);
  }
```

Los métodos `getHistory` y `clearHistory` no cambian.

- [ ] **Step 6: Verifica**

Run: `pnpm --filter @vkbacademy/api exec jest src/tutor`
Expected: PASS.
Run: `pnpm --filter @vkbacademy/api exec tsc --noEmit -p tsconfig.json`
Expected: sin errores (si `Express.Multer.File` no resuelve, falta `@types/multer`).
Run: `pnpm --filter @vkbacademy/api test`
Expected: toda la suite en verde.

- [ ] **Step 7: Prueba manual del endpoint con curl (opcional, requiere API local y un token)**

```bash
curl -s -X POST http://localhost:3001/api/tutor/chat \
  -H "Authorization: Bearer $TOKEN" \
  -F "message=¿Qué ves?" -F "image=@/path/foto.jpg" | head -c 300
```
Expected: chunks `data: {"text": ...}`. Con un `.pdf` en `image`: `{"message":"Solo se aceptan fotos JPG, PNG o WebP","statusCode":400}`.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/tutor apps/api/package.json pnpm-lock.yaml
git commit -m "feat(tutor): POST /tutor/chat acepta multipart con la foto del ejercicio"
```

---

### Task 4: Web — iconos, reescalado de la foto y `chatStream` con `FormData`

**Files:**
- Modify: `apps/web/src/components/ui/icons.ts` (añadir `message` y `camera`)
- Create: `apps/web/src/utils/downscaleImage.ts`
- Create: `apps/web/src/utils/downscaleImage.test.ts`
- Modify: `apps/web/src/api/tutor.api.ts`
- Create: `apps/web/src/api/tutor.api.test.ts`

**Interfaces:**
- Consumes: `TutorChatPayload` de `@vkbacademy/shared` (sin cambios; `message` ya es string, la web manda `''` cuando solo hay foto).
- Produces:
  ```ts
  export const MAX_IMAGE_SIDE = 1568;
  export function fitWithin(width: number, height: number, maxSide?: number): { width: number; height: number };
  export function downscaleImage(file: Blob, maxSide?: number): Promise<Blob>;  // JPEG 0.85
  export function chatStream(payload: TutorChatPayload, image?: Blob): Promise<Response>;
  ```
  Iconos `message` y `camera` en `ICONS`.

- [ ] **Step 1: Iconos**

En `apps/web/src/components/ui/icons.ts`, dentro de `ICONS`, tras la entrada `trophy`:

```ts
  message:
    '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
  camera:
    '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
```

- [ ] **Step 2: Test del reescalado**

`apps/web/src/utils/downscaleImage.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_IMAGE_SIDE, downscaleImage, fitWithin } from './downscaleImage';

describe('fitWithin', () => {
  it('reduce el lado mayor a 1568 manteniendo la proporción', () => {
    expect(fitWithin(3000, 2000)).toEqual({ width: 1568, height: 1045 });
  });

  it('no agranda una imagen pequeña', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('funciona en vertical', () => {
    expect(fitWithin(2000, 4000)).toEqual({ width: 784, height: 1568 });
  });

  it('MAX_IMAGE_SIDE es el máximo útil de Claude', () => {
    expect(MAX_IMAGE_SIDE).toBe(1568);
  });
});

describe('downscaleImage', () => {
  // jsdom no pinta: se sustituyen createImageBitmap y el canvas por dobles
  // que recuerdan a qué tamaño se les pidió dibujar.
  const drawImage = vi.fn();
  let canvasSize: { width: number; height: number } | undefined;

  function stubBrowser(width: number, height: number) {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({ width, height, close: vi.fn() }),
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => ({ drawImage }) as unknown as CanvasRenderingContext2D,
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      cb: BlobCallback,
      type?: string,
    ) {
      canvasSize = { width: this.width, height: this.height };
      cb(new Blob(['x'], { type }));
    });
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    canvasSize = undefined;
  });

  it('dibuja al tamaño reducido y devuelve JPEG', async () => {
    stubBrowser(3000, 2000);

    const out = await downscaleImage(new Blob(['orig'], { type: 'image/png' }));

    expect(canvasSize).toEqual({ width: 1568, height: 1045 });
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1568, 1045);
    expect(out.type).toBe('image/jpeg');
  });

  it('pide JPEG con calidad 0.85', async () => {
    stubBrowser(800, 600);
    const toBlob = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob');

    await downscaleImage(new Blob(['orig'], { type: 'image/jpeg' }));

    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.85);
  });
});
```

- [ ] **Step 3: Ejecuta y comprueba que falla**

Run: `pnpm --filter @vkbacademy/web exec vitest run src/utils/downscaleImage.test.ts`
Expected: FAIL, módulo no encontrado.

- [ ] **Step 4: Implementa el reescalado**

`apps/web/src/utils/downscaleImage.ts`:

```ts
/**
 * Reduce una foto antes de subirla al tutor.
 *
 * 1568 px es el lado mayor que Claude usa de verdad: por encima solo se pagan
 * tokens y tiempo de subida. Una foto de móvil de 4 MB se queda en ~300 KB.
 */
export const MAX_IMAGE_SIDE = 1568;
const JPEG_QUALITY = 0.85;

/** Tamaño destino sin deformar. Nunca agranda. */
export function fitWithin(
  width: number,
  height: number,
  maxSide: number = MAX_IMAGE_SIDE,
): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export async function downscaleImage(file: Blob, maxSide: number = MAX_IMAGE_SIDE): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height, maxSide);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('No se pudo procesar la foto');
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo procesar la foto'))),
      'image/jpeg',
      JPEG_QUALITY,
    );
  });
}
```

Run: `pnpm --filter @vkbacademy/web exec vitest run src/utils/downscaleImage.test.ts`
Expected: PASS.

- [ ] **Step 5: Test de `chatStream` con `FormData`**

`apps/web/src/api/tutor.api.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../store/auth.store', () => ({
  useAuthStore: { getState: () => ({ accessToken: 'tok-123' }) },
}));

import { chatStream } from './tutor.api';

describe('chatStream', () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(''));

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockClear();
  });

  afterEach(() => vi.unstubAllGlobals());

  function sentForm(): FormData {
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.body).toBeInstanceOf(FormData);
    return init.body as FormData;
  }

  it('manda FormData con el texto y el contexto, sin fijar Content-Type', async () => {
    await chatStream({ message: 'Hola', courseId: 'c1', schoolYear: '2º ESO' });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/tutor\/chat$/);
    expect(init.method).toBe('POST');
    // El navegador pone el boundary; fijarlo a mano rompe el multipart.
    expect(init.headers).toEqual({ Authorization: 'Bearer tok-123' });

    const form = sentForm();
    expect(form.get('message')).toBe('Hola');
    expect(form.get('courseId')).toBe('c1');
    expect(form.get('schoolYear')).toBe('2º ESO');
    expect(form.has('lessonId')).toBe(false);
    expect(form.has('image')).toBe(false);
  });

  it('adjunta la foto como campo image', async () => {
    const photo = new Blob(['jpeg'], { type: 'image/jpeg' });

    await chatStream({ message: '' }, photo);

    const form = sentForm();
    expect(form.has('message')).toBe(false);
    const sent = form.get('image');
    expect(sent).toBeInstanceOf(Blob);
    expect((sent as Blob).type).toBe('image/jpeg');
  });
});
```

- [ ] **Step 6: Ejecuta y comprueba que falla**

Run: `pnpm --filter @vkbacademy/web exec vitest run src/api/tutor.api.test.ts`
Expected: FAIL (el body es JSON string, no `FormData`).

- [ ] **Step 7: Implementa `chatStream`**

En `apps/web/src/api/tutor.api.ts`, sustituye la función `chatStream`:

```ts
// ─── Streaming (fetch nativo — axios no soporta ReadableStream) ───────────────

/**
 * Siempre multipart, haya foto o no: un solo camino en el cliente. Los campos
 * vacíos no se mandan para que class-validator vea `undefined`, no `''`.
 */
export function chatStream(payload: TutorChatPayload, image?: Blob): Promise<Response> {
  const token = useAuthStore.getState().accessToken;
  const baseUrl = import.meta.env.VITE_API_URL ?? '/api';

  const form = new FormData();
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === 'string' && value.trim() !== '') form.append(key, value);
  }
  if (image) form.append('image', image, 'foto.jpg');

  return fetch(`${baseUrl}/tutor/chat`, {
    method: 'POST',
    // Sin Content-Type: el navegador pone multipart/form-data con su boundary.
    headers: { Authorization: `Bearer ${token ?? ''}` },
    body: form,
  });
}
```

- [ ] **Step 8: Verifica**

Run: `pnpm --filter @vkbacademy/web exec vitest run src/api/tutor.api.test.ts src/utils/downscaleImage.test.ts`
Expected: PASS.
Run: `pnpm --filter @vkbacademy/web exec tsc --noEmit`
Expected: sin errores.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/components/ui/icons.ts apps/web/src/utils/downscaleImage.ts apps/web/src/utils/downscaleImage.test.ts apps/web/src/api/tutor.api.ts apps/web/src/api/tutor.api.test.ts
git commit -m "feat(tutor): la web reescala la foto y manda el chat como multipart"
```

---

### Task 5: Web — `TutorChat` sale de `TutorWidget`, con adjuntar foto

**Files:**
- Create: `apps/web/src/components/tutor/TutorChat.tsx`
- Create: `apps/web/src/components/tutor/TutorChat.test.tsx`
- Modify: `apps/web/src/components/TutorWidget.tsx` (queda solo la burbuja)

**Interfaces:**
- Consumes: `chatStream(payload, image?)`, `downscaleImage`, iconos `camera`/`close` de Task 4; `useTutorHistory`/`useClearHistory` de `hooks/useTutor.ts`; `TutorMessageDto.hasImage` de Task 1.
- Produces:
  ```ts
  export interface TutorContext { courseId?: string; lessonId?: string; courseName?: string; schoolYear?: string }
  export default function TutorChat(props: { context?: TutorContext; autoFocus?: boolean }): JSX.Element
  ```
  Ocupa el 100 % de alto de su contenedor (flex column). El contenedor decide la altura.

- [ ] **Step 1: Test del componente**

`apps/web/src/components/tutor/TutorChat.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockChatStream = vi.fn();
const mockGetHistory = vi.fn();
const mockClearHistory = vi.fn();
const mockDownscale = vi.fn();

vi.mock('../../api/tutor.api', () => ({
  chatStream: (...args: unknown[]) => mockChatStream(...args),
  getTutorHistory: () => mockGetHistory(),
  clearTutorHistory: () => mockClearHistory(),
}));
vi.mock('../../utils/downscaleImage', () => ({
  downscaleImage: (...args: unknown[]) => mockDownscale(...args),
}));

import TutorChat from './TutorChat';

function sseResponse(text: string): Response {
  return new Response(
    `data: ${JSON.stringify({ text })}\n\ndata: ${JSON.stringify({ done: true })}\n\n`,
    { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
  );
}

function renderChat() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TutorChat />
    </QueryClientProvider>,
  );
}

const photo = new File(['jpeg-bytes'], 'ejercicio.jpg', { type: 'image/jpeg' });
const smallBlob = new Blob(['small'], { type: 'image/jpeg' });

describe('TutorChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetHistory.mockResolvedValue([]);
    mockDownscale.mockResolvedValue(smallBlob);
    mockChatStream.mockResolvedValue(sseResponse('Veo una ecuación'));
    // jsdom no implementa createObjectURL; se añade sin tocar el resto de URL
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => vi.restoreAllMocks());

  it('sin texto ni foto no se puede enviar', async () => {
    renderChat();
    expect(await screen.findByRole('button', { name: /enviar/i })).toBeDisabled();
  });

  it('adjuntar muestra la miniatura y "quitar" la retira', async () => {
    renderChat();

    await userEvent.upload(screen.getByLabelText(/adjuntar foto/i), photo);

    expect(await screen.findByAltText(/foto adjunta/i)).toHaveAttribute('src', 'blob:preview');
    expect(mockDownscale).toHaveBeenCalledWith(photo);
    expect(screen.getByRole('button', { name: /enviar/i })).toBeEnabled();

    await userEvent.click(screen.getByRole('button', { name: /quitar foto/i }));

    expect(screen.queryByAltText(/foto adjunta/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enviar/i })).toBeDisabled();
  });

  it('enviar con foto manda la imagen reducida y pinta el chip en el hilo', async () => {
    renderChat();

    await userEvent.upload(screen.getByLabelText(/adjuntar foto/i), photo);
    await screen.findByAltText(/foto adjunta/i);
    await userEvent.type(screen.getByPlaceholderText(/escribe tu pregunta/i), '¿Qué es esto?');
    await userEvent.click(screen.getByRole('button', { name: /enviar/i }));

    await waitFor(() =>
      expect(mockChatStream).toHaveBeenCalledWith(
        expect.objectContaining({ message: '¿Qué es esto?' }),
        smallBlob,
      ),
    );
    expect(await screen.findByText(/foto adjunta/i)).toBeInTheDocument();
    expect(await screen.findByText('Veo una ecuación')).toBeInTheDocument();
    // La miniatura no sobrevive al envío
    expect(screen.queryByAltText(/foto adjunta/i)).not.toBeInTheDocument();
  });

  it('enviar solo texto no manda imagen', async () => {
    renderChat();

    await userEvent.type(screen.getByPlaceholderText(/escribe tu pregunta/i), 'Hola');
    await userEvent.click(screen.getByRole('button', { name: /enviar/i }));

    await waitFor(() =>
      expect(mockChatStream).toHaveBeenCalledWith(expect.objectContaining({ message: 'Hola' }), undefined),
    );
  });

  it('un mensaje del historial con hasImage muestra el chip', async () => {
    mockGetHistory.mockResolvedValue([
      { id: 'm1', role: 'user', content: 'Mira esto', hasImage: true, createdAt: '2026-09-12T10:00:00Z' },
      { id: 'm2', role: 'assistant', content: 'Veo una fracción', hasImage: false, createdAt: '2026-09-12T10:00:05Z' },
    ]);

    renderChat();

    expect(await screen.findByText('Mira esto')).toBeInTheDocument();
    expect(screen.getByText(/foto adjunta/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Ejecuta y comprueba que falla**

Run: `pnpm --filter @vkbacademy/web exec vitest run src/components/tutor/TutorChat.test.tsx`
Expected: FAIL, módulo no encontrado.

- [ ] **Step 3: Crea `TutorChat`**

`apps/web/src/components/tutor/TutorChat.tsx`. Es la lógica y el render del hilo que hoy vive en `TutorWidget` (mensajes, streaming, input, limpiar historial), más el adjunto:

```tsx
import { useEffect, useRef, useState } from 'react';
import { TutorMessageDto } from '@vkbacademy/shared';
import { chatStream } from '../../api/tutor.api';
import { useClearHistory, useTutorHistory } from '../../hooks/useTutor';
import { downscaleImage } from '../../utils/downscaleImage';
import Icon from '../ui/Icon';

// ─── Tipos ────────────────────────────────────────────────────────────────────

/** Curso/lección desde donde se pregunta. Lo aporta quien monta el chat. */
export interface TutorContext {
  courseId?: string;
  lessonId?: string;
  courseName?: string;
  schoolYear?: string;
}

interface TutorChatProps {
  context?: TutorContext;
  autoFocus?: boolean;
}

interface LocalMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  hasImage: boolean;
}

/** Foto lista para enviar: el blob reducido y su preview. */
interface Attachment {
  blob: Blob;
  previewUrl: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toLocalMessage(m: TutorMessageDto): LocalMessage {
  return { id: m.id, role: m.role, content: m.content, hasImage: m.hasImage };
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function TutorChat({ context, autoFocus = false }: TutorChatProps) {
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [isPreparingImage, setIsPreparingImage] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Historial ──────────────────────────────────────────────────────────────

  const { data: history, isSuccess: historyReady } = useTutorHistory();
  const { mutate: clearHistory, isPending: isClearing } = useClearHistory();

  useEffect(() => {
    if (historyReady && !historyLoaded && history) {
      setMessages(history.map(toLocalMessage));
      setHistoryLoaded(true);
    }
  }, [historyReady, historyLoaded, history]);

  // ─── Auto-scroll al último mensaje ─────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  // ─── Foco al montar ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (autoFocus) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);

  // ─── Foto ───────────────────────────────────────────────────────────────────

  function releaseAttachment(att: Attachment | null) {
    if (att) URL.revokeObjectURL(att.previewUrl);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Permite volver a elegir el mismo fichero tras quitarlo
    e.target.value = '';
    if (!file) return;

    setAttachError(null);
    setIsPreparingImage(true);
    try {
      const blob = await downscaleImage(file);
      releaseAttachment(attachment);
      setAttachment({ blob, previewUrl: URL.createObjectURL(blob) });
    } catch {
      setAttachError('No se pudo leer la foto. Prueba con otra.');
    } finally {
      setIsPreparingImage(false);
    }
  }

  function handleRemoveAttachment() {
    releaseAttachment(attachment);
    setAttachment(null);
  }

  // ─── Enviar mensaje ─────────────────────────────────────────────────────────

  const canSend = !isStreaming && !isPreparingImage && (inputValue.trim() !== '' || attachment !== null);

  async function handleSend() {
    if (!canSend) return;
    const text = inputValue.trim();
    const image = attachment?.blob;

    const userMsg: LocalMessage = {
      id: `local-${Date.now()}`,
      role: 'user',
      // Mismo texto por defecto que pone el servidor cuando solo va la foto
      content: text || '¿Me ayudas con este ejercicio?',
      hasImage: Boolean(image),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    releaseAttachment(attachment);
    setAttachment(null);
    setIsStreaming(true);
    setStreamingText('');

    try {
      const response = await chatStream(
        {
          message: text,
          courseId: context?.courseId,
          lessonId: context?.lessonId,
          courseName: context?.courseName,
          schoolYear: context?.schoolYear,
        },
        image,
      );

      if (!response.ok || !response.body) {
        // Un 429 es cupo agotado, no un fallo de red: decirle "comprueba tu
        // conexión" a quien ha gastado sus preguntas del día es mentirle.
        const motivo = await response
          .json()
          .then((body: { message?: string }) => body.message)
          .catch(() => undefined);
        throw new Error(motivo ?? 'Error en la respuesta del servidor');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6)) as {
              text?: string;
              done?: boolean;
              error?: string;
            };

            if (data.text) {
              accumulated += data.text;
              setStreamingText(accumulated);
            }

            if (data.done) {
              setMessages((prev) => [
                ...prev,
                { id: `assistant-${Date.now()}`, role: 'assistant', content: accumulated, hasImage: false },
              ]);
              setStreamingText('');
              setIsStreaming(false);
            }

            if (data.error) {
              setMessages((prev) => [
                ...prev,
                {
                  id: `error-${Date.now()}`,
                  role: 'assistant',
                  content: '❌ Lo siento, ha ocurrido un error. Inténtalo de nuevo.',
                  hasImage: false,
                },
              ]);
              setStreamingText('');
              setIsStreaming(false);
            }
          } catch {
            // ignorar líneas mal formadas
          }
        }
      }
    } catch (err) {
      console.error('Tutor stream error:', err);
      const motivo = err instanceof Error ? err.message : '';
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: motivo.includes('preguntas') || motivo.includes('foto')
            ? `⏳ ${motivo}`
            : '❌ No pude conectar con el tutor. Comprueba tu conexión.',
          hasImage: false,
        },
      ]);
      setStreamingText('');
      setIsStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  function handleClearHistory() {
    clearHistory(undefined, { onSuccess: () => setMessages([]) });
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={styles.root}>
      {/* Mensajes */}
      <div style={styles.messages}>
        {messages.length === 0 && !isStreaming && (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>🎓</div>
            <p style={styles.emptyText}>
              ¡Hola! Soy tu tutor virtual de VKB Academy.
              Pregúntame cualquier duda o súbeme la foto de un ejercicio.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              ...styles.bubble,
              ...(msg.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant),
            }}
          >
            {msg.hasImage && <span style={styles.imageChip}>📷 Foto adjunta</span>}
            <span style={styles.bubbleText}>{msg.content}</span>
          </div>
        ))}

        {isStreaming && streamingText && (
          <div style={{ ...styles.bubble, ...styles.bubbleAssistant }}>
            <span style={styles.bubbleText}>
              {streamingText}
              <span style={styles.cursor}>▌</span>
            </span>
          </div>
        )}

        {isStreaming && !streamingText && (
          <div style={{ ...styles.bubble, ...styles.bubbleAssistant }}>
            <span style={styles.typingDots}>···</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Foto pendiente de enviar */}
      {attachment && (
        <div style={styles.attachmentRow}>
          <img src={attachment.previewUrl} alt="Foto adjunta" style={styles.thumb} />
          <button
            type="button"
            onClick={handleRemoveAttachment}
            style={styles.removeBtn}
            aria-label="Quitar foto"
            disabled={isStreaming}
          >
            <Icon name="close" size={14} />
            Quitar
          </button>
        </div>
      )}
      {attachError && <div style={styles.attachError}>{attachError}</div>}

      {/* Input */}
      <div style={styles.inputArea}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          onChange={(e) => void handleFileChange(e)}
          style={{ display: 'none' }}
          aria-label="Adjuntar foto"
          disabled={isStreaming}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isStreaming || isPreparingImage}
          style={styles.cameraBtn}
          title="Adjuntar foto de un ejercicio"
          aria-label="Abrir selector de foto"
        >
          <Icon name="camera" size={18} />
        </button>
        <textarea
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe tu pregunta..."
          disabled={isStreaming}
          rows={2}
          style={{ ...styles.textarea, ...(isStreaming ? styles.textareaDisabled : {}) }}
        />
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={!canSend}
          style={{ ...styles.sendBtn, ...(!canSend ? styles.sendBtnDisabled : {}) }}
          aria-label="Enviar"
        >
          ▶
        </button>
      </div>

      {/* Limpiar historial */}
      <div style={styles.footer}>
        <button
          type="button"
          onClick={handleClearHistory}
          disabled={isClearing || isStreaming || messages.length === 0}
          style={styles.clearBtn}
        >
          🗑 Limpiar historial
        </button>
      </div>
    </div>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0,
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: 12,
    padding: '0 16px',
  },
  emptyIcon: { fontSize: '2.5rem' },
  emptyText: {
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    fontSize: '0.875rem',
    lineHeight: 1.5,
    margin: 0,
  },
  bubble: {
    maxWidth: '85%',
    padding: '8px 12px',
    borderRadius: 12,
    fontSize: '0.875rem',
    lineHeight: 1.5,
    wordBreak: 'break-word',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    background: 'var(--gradient-orange)',
    color: 'var(--brand-contrast)',
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    alignSelf: 'flex-start',
    background: 'rgba(255,255,255,0.07)',
    color: 'rgba(255,255,255,0.88)',
    borderBottomLeftRadius: 4,
  },
  bubbleText: { whiteSpace: 'pre-wrap' },
  imageChip: {
    fontSize: '0.75rem',
    opacity: 0.85,
    fontWeight: 600,
  },
  cursor: {
    display: 'inline-block',
    animation: 'tutorBlink 0.8s step-end infinite',
    marginLeft: 1,
    color: 'var(--brand-light)',
  },
  typingDots: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: '1.25rem',
    letterSpacing: 4,
    animation: 'tutorBlink 1s step-end infinite',
  },
  attachmentRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '6px 14px',
    borderTop: '1px solid rgba(255,255,255,0.09)',
    flexShrink: 0,
  },
  thumb: {
    width: 56,
    height: 56,
    objectFit: 'cover',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.15)',
  },
  removeBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.2)',
    color: 'rgba(255,255,255,0.7)',
    borderRadius: 8,
    padding: '4px 8px',
    fontSize: '0.75rem',
    cursor: 'pointer',
  },
  attachError: {
    color: '#ff8a80',
    fontSize: '0.75rem',
    padding: '4px 14px',
  },
  inputArea: {
    display: 'flex',
    gap: 8,
    padding: '8px 14px',
    borderTop: '1px solid rgba(255,255,255,0.09)',
    flexShrink: 0,
  },
  cameraBtn: {
    width: 40,
    height: 40,
    alignSelf: 'flex-end',
    borderRadius: 10,
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid var(--brand-soft)',
    color: 'rgba(255,255,255,0.8)',
    cursor: 'pointer',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textarea: {
    flex: 1,
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid var(--brand-soft)',
    borderRadius: 10,
    color: '#fff',
    fontSize: '0.875rem',
    padding: '8px 10px',
    resize: 'none',
    outline: 'none',
    fontFamily: 'inherit',
    lineHeight: 1.4,
    transition: 'border-color 0.15s',
  },
  textareaDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  sendBtn: {
    width: 40,
    height: 40,
    alignSelf: 'flex-end',
    borderRadius: 10,
    background: 'var(--gradient-orange)',
    border: 'none',
    color: 'var(--brand-contrast)',
    fontSize: '0.875rem',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'opacity 0.15s',
  },
  sendBtnDisabled: { opacity: 0.35, cursor: 'not-allowed' },
  footer: { padding: '4px 14px 10px', flexShrink: 0 },
  clearBtn: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.3)',
    cursor: 'pointer',
    fontSize: '0.75rem',
    padding: '2px 4px',
    borderRadius: 4,
    transition: 'color 0.15s',
  },
};
```

- [ ] **Step 4: Ejecuta el test del componente**

Run: `pnpm --filter @vkbacademy/web exec vitest run src/components/tutor/TutorChat.test.tsx`
Expected: PASS (5 tests). Si «adjuntar muestra la miniatura» falla por `userEvent.upload` con el input oculto, `userEvent.upload` funciona con `display: none`; si aun así falla, usa `fireEvent.change(input, { target: { files: [photo] } })`.

- [ ] **Step 5: `TutorWidget` queda como burbuja**

Sustituye **todo** `apps/web/src/components/TutorWidget.tsx` por:

```tsx
import { useState } from 'react';
import { matchPath, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import TutorChat, { TutorContext } from './tutor/TutorChat';

/**
 * Burbuja flotante del tutor. Solo aporta el panel y el contexto de la ruta
 * (curso/lección); el chat en sí vive en TutorChat, que también monta la
 * página Dudas.
 */
export default function TutorWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const queryClient = useQueryClient();

  // Detectar contexto de la página actual
  const courseMatch = matchPath('/courses/:id', location.pathname);
  const lessonMatch = matchPath('/lessons/:id', location.pathname);
  const courseId = courseMatch?.params?.id ?? undefined;
  const lessonId = lessonMatch?.params?.id ?? undefined;

  // Intentar obtener nombre del curso desde el caché de React Query
  const cachedCourse = courseId
    ? (queryClient.getQueryData(['courses', courseId]) as
        | { title?: string; schoolYear?: { label?: string } }
        | undefined)
    : undefined;
  const courseName = cachedCourse?.title;
  const schoolYear = cachedCourse?.schoolYear?.label;

  const context: TutorContext = { courseId, lessonId, courseName, schoolYear };

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={styles.fab}
          title="Tutor Virtual VKB"
          aria-label="Abrir tutor virtual"
        >
          💬
        </button>
      )}

      {isOpen && (
        <div style={styles.panel}>
          <div style={styles.header}>
            <div style={styles.headerLeft}>
              <span style={styles.headerIcon}>🤖</span>
              <div>
                <div style={styles.headerTitle}>Tutor VKB</div>
                {(courseName || schoolYear) && (
                  <div style={styles.contextBadge}>
                    {courseName ?? ''}{schoolYear ? ` · ${schoolYear}` : ''}
                  </div>
                )}
              </div>
            </div>
            <div style={styles.headerActions}>
              <button
                onClick={() => setIsOpen(false)}
                style={styles.headerBtn}
                title="Cerrar"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>
          </div>

          {/* El panel fija la altura; TutorChat la rellena */}
          <div style={styles.body}>
            <TutorChat context={context} autoFocus />
          </div>
        </div>
      )}
    </>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  fab: {
    position: 'fixed',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: '50%',
    background: 'var(--gradient-orange)',
    border: 'none',
    cursor: 'pointer',
    fontSize: '1.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 18px var(--brand-glow)',
    zIndex: 1000,
    transition: 'transform 0.18s, box-shadow 0.18s',
  },
  panel: {
    position: 'fixed',
    bottom: 88,
    right: 24,
    width: 380,
    height: 520,
    background: 'var(--navy-800)',
    border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: 16,
    boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    zIndex: 1000,
    animation: 'tutorSlideUp 0.2s ease-out',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 14px',
    background: 'linear-gradient(90deg, #080e1a 0%, #0d1b2a 100%)',
    borderBottom: '1px solid rgba(255,255,255,0.09)',
    flexShrink: 0,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  headerIcon: { fontSize: '1.5rem' },
  headerTitle: { color: '#fff', fontWeight: 700, fontSize: '0.9375rem' },
  contextBadge: {
    color: 'var(--brand-light)',
    fontSize: '0.6875rem',
    fontWeight: 500,
    marginTop: 1,
    maxWidth: 220,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  headerActions: { display: 'flex', gap: 4 },
  headerBtn: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.45)',
    cursor: 'pointer',
    fontSize: '1rem',
    padding: '4px 8px',
    borderRadius: 6,
    lineHeight: 1,
    transition: 'color 0.15s',
  },
  body: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' },
};
```

(El botón «Minimizar» del widget antiguo hacía lo mismo que «Cerrar»; se deja uno.)

- [ ] **Step 6: Verifica todo el web**

Run: `pnpm --filter @vkbacademy/web exec tsc --noEmit`
Expected: sin errores.
Run: `pnpm --filter @vkbacademy/web test`
Expected: toda la suite en verde.

- [ ] **Step 7: Mutación**

1. En `TutorChat`, cambia `canSend` para que ignore `attachment` (solo texto) → debe fallar «adjuntar muestra la miniatura» (el botón no se habilita).
2. Quita `releaseAttachment(attachment); setAttachment(null);` de `handleSend` → debe fallar «enviar con foto» (la miniatura sobrevive).
3. Pasa `undefined` en vez de `image` a `chatStream` → debe fallar «enviar con foto manda la imagen reducida».

Revierte cada mutación. Si un test no cae, arréglalo.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/tutor apps/web/src/components/TutorWidget.tsx
git commit -m "refactor(tutor): TutorChat sale de la burbuja y aprende a adjuntar una foto"
```

---

### Task 6: Web — página «Dudas», ruta y entrada de menú

**Files:**
- Create: `apps/web/src/pages/TutorPage.tsx`
- Create: `apps/web/src/pages/TutorPage.test.tsx`
- Modify: `apps/web/src/App.tsx:32-33` (lazy import) y `:159-161` (ruta)
- Modify: `apps/web/src/layouts/AppLayout.tsx:12` (exportar `buildNavLinks`) y `:43-51` (item de menú)
- Create: `apps/web/src/layouts/AppLayout.nav.test.ts`

**Interfaces:**
- Consumes: `TutorChat` de Task 5; `PageHeader` de `components/ui/PageHeader.tsx`; icono `message` de Task 4.
- Produces: ruta `/tutor`; `export function buildNavLinks(role: Role | undefined): NavItem[]`.

- [ ] **Step 1: Test del menú**

`apps/web/src/layouts/AppLayout.nav.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { Role } from '@vkbacademy/shared';
import { buildNavLinks } from './AppLayout';

describe('buildNavLinks', () => {
  it('el alumno tiene «Dudas» justo debajo de «Estudiar»', () => {
    const labels = buildNavLinks(Role.STUDENT).map((l) => l.label);
    const study = labels.indexOf('Estudiar');

    expect(study).toBeGreaterThan(-1);
    expect(labels[study + 1]).toBe('Dudas');
    expect(buildNavLinks(Role.STUDENT).find((l) => l.label === 'Dudas')?.to).toBe('/tutor');
  });

  it.each([Role.ADMIN, Role.SUPER_ADMIN])('%s no tiene «Dudas»', (role) => {
    expect(buildNavLinks(role).some((l) => l.label === 'Dudas')).toBe(false);
  });
});
```

Comprueba antes cómo se importa `Role` en `AppLayout.tsx` (línea ~1-10) y usa el mismo import.

- [ ] **Step 2: Test de la página**

`apps/web/src/pages/TutorPage.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../components/tutor/TutorChat', () => ({
  default: () => <div data-testid="tutor-chat" />,
}));

import TutorPage from './TutorPage';

describe('TutorPage', () => {
  it('muestra el título Dudas, la ayuda y el chat', () => {
    render(<TutorPage />);

    expect(screen.getByRole('heading', { name: /dudas/i })).toBeInTheDocument();
    expect(screen.getByText(/sube la foto de un ejercicio/i)).toBeInTheDocument();
    expect(screen.getByTestId('tutor-chat')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Ejecuta y comprueba que fallan**

Run: `pnpm --filter @vkbacademy/web exec vitest run src/layouts/AppLayout.nav.test.ts src/pages/TutorPage.test.tsx`
Expected: FAIL (`buildNavLinks` no exportado; `TutorPage` no existe).

- [ ] **Step 4: Menú**

En `apps/web/src/layouts/AppLayout.tsx`:
- Línea 12: `function buildNavLinks(` → `export function buildNavLinks(`.
- En la rama STUDENT, tras `{ to: '/study', label: 'Estudiar', icon: 'brain' },` añade:

```ts
    // Dudas: el tutor IA a pantalla completa, con foto del ejercicio
    { to: '/tutor', label: 'Dudas', icon: 'message' },
```

- [ ] **Step 5: Página**

`apps/web/src/pages/TutorPage.tsx`:

```tsx
import TutorChat from '../components/tutor/TutorChat';
import PageHeader from '../components/ui/PageHeader';

/**
 * Dudas: el tutor IA a pantalla completa. Mismo historial y mismo cupo que la
 * burbuja; aquí además cabe la foto de un ejercicio con comodidad.
 */
export default function TutorPage() {
  return (
    <div style={styles.page}>
      <PageHeader
        variant="light"
        title="Dudas"
        subtitle="Pregunta lo que no entiendas de cualquier asignatura o sube la foto de un ejercicio y te guío paso a paso."
      />

      <div className="vkb-card" style={styles.chatCard}>
        <TutorChat autoFocus />
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 900,
    margin: '0 auto',
    padding: '32px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  chatCard: {
    // Altura fija en viewport: el hilo hace scroll dentro, no la página
    height: 'min(70vh, 720px)',
    minHeight: 420,
    padding: 0,
    overflow: 'hidden',
    background: 'var(--navy-800)',
    display: 'flex',
    flexDirection: 'column',
  },
};
```

- [ ] **Step 6: Ruta**

En `apps/web/src/App.tsx`, junto a los otros lazy (línea ~33):

```ts
const TutorPage = lazy(() => import('./pages/TutorPage'));
```

Y tras la ruta `study/plan/:id`:

```tsx
          {/* Dudas — tutor IA a pantalla completa, con foto */}
          <Route path="tutor" element={<TutorPage />} />
```

- [ ] **Step 7: Verifica**

Run: `pnpm --filter @vkbacademy/web exec vitest run src/layouts/AppLayout.nav.test.ts src/pages/TutorPage.test.tsx`
Expected: PASS.
Run: `pnpm --filter @vkbacademy/web exec tsc --noEmit && pnpm --filter @vkbacademy/web test`
Expected: sin errores y toda la suite en verde.

- [ ] **Step 8: Comprobación en el navegador (con API y web locales)**

`pnpm dev`, entra como alumno, menú → **Dudas** debajo de Estudiar. Adjunta una foto de un ejercicio: aparece la miniatura, «Quitar» la retira; enviando, el mensaje lleva «📷 Foto adjunta» y la IA empieza describiendo el ejercicio sin resolverlo. Abre la burbuja desde una lección: mismo historial y mismo botón de cámara.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/pages/TutorPage.tsx apps/web/src/pages/TutorPage.test.tsx apps/web/src/App.tsx apps/web/src/layouts/AppLayout.tsx apps/web/src/layouts/AppLayout.nav.test.ts
git commit -m "feat(tutor): sección Dudas en el menú del alumno"
```

---

## Cierre

Tras Task 6, en la rama:
- `pnpm --filter @vkbacademy/api test` y `pnpm --filter @vkbacademy/web test` en verde; `tsc --noEmit` limpio en ambos.
- Push de `feat/dudas-tutor-foto` y PR contra `main` con título `feat(tutor): sección Dudas con foto del ejercicio` y cuerpo que enlace el spec. **Comprobar que la base de la PR es `main`.**
- La migración `add_tutor_message_has_image` la aplica el pipeline (`migrate-pre` / `migrate-prod`); no hay seed.
