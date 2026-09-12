# Dudas: el tutor IA como sección, con foto del ejercicio

**Fecha:** 2026-09-12
**Estado:** aprobado, pendiente de plan

## Qué se construye

Una sección **Dudas** en el menú del alumno, debajo de Estudiar, donde puede preguntar
lo que quiera a la IA sobre cualquier materia o **subir la foto de un ejercicio** para
que le ayude. No es un tutor nuevo: es el tutor IA que ya existe (`TutorWidget`, la
burbuja flotante; `POST /tutor/chat`) a pantalla completa, con el mismo historial, el
mismo cupo y el mismo endpoint, más la entrada por imagen.

## Decisiones tomadas

| Decisión | Elección | Descartado |
|---|---|---|
| Relación con la burbuja | Misma cosa a pantalla completa; la burbuja sigue para preguntar desde una lección | Sustituir la burbuja; un tutor separado con su cupo |
| Qué hace la IA con la foto | Guiar paso a paso, sin dar la solución (misma regla que el tutor de texto) | Resolver y explicar; que elija el alumno |
| Cómo se elige la materia | No se elige: se dice en la pregunta. El curso (`schoolYear`) ya viaja | Chips de materia; selector de cursos de Estudiar |
| Persistencia de la foto | No se guarda. Va al modelo y muere con la request | S3 + URLs firmadas + miniatura en el historial |
| Cupo | Una pregunta con foto cuenta como una (30/día, 10/h) | Cupo aparte para fotos |

## 1. Navegación y página

- `AppLayout.buildNavLinks`, rama STUDENT: nuevo item `{ to: '/tutor', label: 'Dudas', icon: 'message' }`
  inmediatamente después de Estudiar. ADMIN y SUPER_ADMIN no lo ven (no tienen tutor).
- Ruta `tutor` en `App.tsx` dentro del layout autenticado, lazy como el resto → `pages/TutorPage.tsx`.
- `TutorPage`: cabecera con título "Dudas" y una línea de ayuda ("Pregunta lo que no
  entiendas o sube la foto de un ejercicio"), y debajo `TutorChat` ocupando la altura
  disponible. El botón de limpiar historial va dentro de `TutorChat`, así lo tienen la
  página y la burbuja sin duplicarlo.
- Iconos nuevos en `components/ui/icons.ts`: `message` (bocadillo) y `camera`. Mismo
  estilo de línea que el resto del registro.

## 2. Refactor: `TutorChat` sale de `TutorWidget`

`TutorWidget.tsx` (543 líneas) mezcla la burbuja con toda la lógica de chat. Se parte en:

- `components/tutor/TutorChat.tsx` — el hilo, el input, el streaming, la carga del
  historial, el adjuntar foto. Props: `context?: { courseId, lessonId, courseName, schoolYear }`
  y `autoFocus?: boolean`. No sabe si está en una burbuja o en una página.
- `components/TutorWidget.tsx` — la burbuja: botón flotante, abrir/cerrar, detección de
  contexto por ruta (`matchPath` de curso/lección), y monta `TutorChat` con ese contexto.
- Los estilos inline de la burbuja se quedan en el widget; los del hilo van con `TutorChat`.

Comportamiento del widget tras el refactor: idéntico al actual, más el botón de foto.
Un solo código para los dos sitios.

## 3. Adjuntar foto (web)

- Botón 📷 junto al textarea, `<input type="file" accept="image/jpeg,image/png,image/webp">`
  sin `capture`: en móvil el sistema ofrece cámara o galería (sirve una captura de
  pantalla o una foto ya hecha); en escritorio, el selector.
- Al elegir, **se reescala en el navegador** (`canvas`) a ≤ 1568 px de lado mayor y se
  exporta a JPEG al 85 %. Una foto de móvil de 4 MB queda en ~300 KB. 1568 px es el
  máximo útil para Claude; por encima solo se pagan tokens. Helper puro
  `utils/downscaleImage.ts` (File → Promise<Blob>) para poder testearlo.
- Preview de la miniatura con botón "quitar" encima del input. Se puede enviar solo la
  foto, solo texto, o ambos. El botón enviar se habilita si hay cualquiera de los dos.
- Mientras se procesa la imagen el botón enviar se deshabilita (evitar mandar sin ella).
- Al enviar, el mensaje del alumno aparece en el hilo con el texto y un chip
  "📷 Foto adjunta" si la llevaba. La miniatura no se conserva al recargar.

## 4. API: `POST /tutor/chat` acepta multipart

- El endpoint pasa a aceptar `multipart/form-data`: los campos del `TutorChatDto` actual
  como texto + un fichero opcional `image`. `FileInterceptor('image')` con `memoryStorage`,
  `limits.fileSize = 5 MB`, `fileFilter` que solo deja pasar `image/jpeg`, `image/png`,
  `image/webp`. multer viene con `@nestjs/platform-express`; se añade `@types/multer`
  como devDependency para tipar `Express.Multer.File`.
- Tipo no permitido → 400 "Solo se aceptan fotos JPG, PNG o WebP". Tamaño → 413 con
  "La foto pesa demasiado (máximo 5 MB)". Multer lanza; se traduce en el controlador o
  con un filtro, con el mensaje en español y la forma `{ message, statusCode }` de siempre.
- `TutorChatDto.message` pasa a `@IsOptional()`; la regla "texto o imagen, al menos uno"
  se comprueba en el servicio (400 "Escribe una pregunta o adjunta una foto"). Sin texto
  y con foto, el texto que ve el modelo y que se guarda es
  `"¿Me ayudas con este ejercicio?"`.
- El cliente web envía siempre `FormData` (con o sin foto). Se retira el envío JSON del
  cliente; el servidor sigue aceptando JSON (el interceptor no interfiere si no hay
  multipart), así no hay que tocar los tests existentes del controlador.
- Los `@Throttle` y el cupo diario no cambian: una request es una pregunta.

## 5. Servicio y modelo

- `TutorService.streamChat(userId, dto, res, image?: { buffer, mimeType })`. Si hay
  imagen, el último mensaje a Anthropic es un array de bloques:
  `[{ type: 'image', source: { type: 'base64', media_type, data } }, { type: 'text', text }]`.
  Los mensajes del historial siguen siendo texto (la foto no se guarda, así que en
  preguntas de seguimiento la IA no la vuelve a ver; se apoya en su propia respuesta
  anterior, que para eso empieza describiendo el ejercicio).
- `TutorMessage.hasImage Boolean @default(false)` — migración aditiva. Se guarda `true`
  en el mensaje del alumno que llevaba foto. `TutorMessageDto.hasImage: boolean` en
  `packages/shared`. `getHistory` lo devuelve; el hilo pinta el chip.
- `max_tokens` se queda en 1024. Modelo `claude-haiku-4-5-20251001`, que ya acepta imagen.

## 6. Prompt

Al `buildSystemPrompt` actual se añade, solo cuando hay imagen:

```
El alumno ha adjuntado la foto de un ejercicio o de sus apuntes.
- Empieza diciendo en una frase qué ejercicio ves, para que confirme que lo has leído bien
- Si la foto no se lee o no es un ejercicio, dilo y pide otra
- Después pregunta qué ha intentado o dale solo el primer paso
- Nunca escribas la solución final ni el resultado numérico
```

El resto de reglas (español, 3-4 párrafos, analogías, nunca respuestas directas) no cambia.

## 7. Errores y límites conocidos

- El tutor llama a Anthropic directamente, sin `AiProviderService`: sin
  `ANTHROPIC_API_KEY` o con saldo agotado, falla hoy y seguirá fallando. Deuda conocida,
  fuera de alcance.
- El cupo horario vive en memoria y se pierde en cada arranque en frío de Render; el
  diario está en BD. Igual que hoy.
- El seguimiento sobre una foto ya enviada no la vuelve a ver (decisión de no guardar).

## 8. Tests

**API** (`tutor.service.spec.ts`, Jest, mocks de Prisma y Anthropic como en el spec actual):
- Con imagen, el último mensaje a Anthropic lleva el bloque `image` con `media_type` y
  `data` base64 correctos, seguido del bloque de texto.
- Con imagen y sin `message`, el texto usado y guardado es "¿Me ayudas con este ejercicio?".
- Sin `message` ni imagen → `HttpException` 400 y no se guarda nada ni se llama al modelo.
- Con imagen se guarda `hasImage: true`; sin ella, `false`.
- El system prompt incluye el bloque de foto solo cuando hay imagen.
- Verificación por mutación: quitar el bloque `image`, cambiar el texto por defecto,
  poner `hasImage` fijo → los tests deben fallar.

**Web** (Vitest + Testing Library):
- `downscaleImage.test.ts`: una imagen de 3000×2000 sale a 1568×1045; una de 800×600
  no crece; el tipo es `image/jpeg`.
- `TutorChat.test.tsx`: adjuntar muestra preview; "quitar" la elimina; enviar con foto
  hace `fetch` con `FormData` que contiene `image` y `message`; enviar sin foto manda
  `FormData` sin `image`; el botón enviar está deshabilitado sin texto ni foto.
- `TutorPage.test.tsx`: renderiza título y `TutorChat`.
- `AppLayout` nav: "Dudas" aparece para STUDENT y no para ADMIN (extender el test de nav
  si existe; si no, uno pequeño).
- `pnpm --filter @vkbacademy/web exec tsc --noEmit` limpio.

## Fuera de alcance

- Guardar la foto o mostrarla en el historial.
- Selector de materia o de curso.
- Cupo diferenciado para preguntas con foto.
- Llevar el tutor a `AiProviderService` (Gemini como primario).
