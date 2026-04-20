# Auto-asignación de vídeos de YouTube a lecciones VIDEO

**Fecha:** 2026-04-20
**Estado:** Propuesto
**Autor:** brainstorming session

---

## 1. Problema

Al crear un módulo nuevo (sea manualmente o con la generación por IA en `POST /admin/courses/:id/modules/generate`), las lecciones de tipo `VIDEO` se persisten con `youtubeId = null`. El admin tiene que ir lección por lección, buscar manualmente en YouTube el vídeo apropiado, copiar el ID y pegarlo en el formulario de edición (`PATCH /admin/lessons/:id`). Es tedioso y escala mal: un curso con 30 lecciones VIDEO requiere 30 búsquedas manuales.

## 2. Objetivo

Automatizar la asignación de `youtubeId` para lecciones VIDEO mediante búsqueda en YouTube Data API v3, aplicando filtros de calidad (idioma, duración, whitelist) y un scoring por engagement (ratio likes/views).

## 3. Decisiones de diseño (tomadas en brainstorming)

| Decisión                         | Elección                                                                                            |
| -------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Trigger**                      | Ambos: (a) auto-asignación durante generación IA + (b) botón manual "🔍" en cada lección VIDEO      |
| **Query de búsqueda**            | `"<lesson.title> <course.schoolYear.label>"` (ej: `"Propiedades de logaritmos 1º Bachillerato"`)    |
| **Filtros duros**                | Idioma ES, duración ≤ 20 min, `safeSearch=strict`, sin `ageRestricted`                              |
| **Whitelist de canales**         | Hardcoded en `youtube-whitelist.ts`, comportamiento **soft** (boost de score, no filtro excluyente) |
| **Ranking / desempate**          | Score = `engagementRatio (likes/views) + (isWhitelisted ? 0.5 : 0)`; desempate por views            |
| **Flujo IA**                     | Auto-persiste `youtubeId` directamente, sin pantalla de revisión                                    |
| **Flujo manual**                 | Modal con top 5 candidatos + botón "🔄 Buscar otros" para paginar con `excludeIds`                  |
| **Fallback sin match**           | `youtubeId = null`, no falla la operación                                                           |
| **Marca visual "auto-asignado"** | Fuera de alcance (YAGNI)                                                                            |
| **Schema Prisma**                | Sin cambios                                                                                         |

## 4. Arquitectura

### Módulo nuevo

```
apps/api/src/youtube/
├── youtube.module.ts
├── youtube.service.ts
├── youtube.service.spec.ts
├── youtube-whitelist.ts
├── __fixtures__/
│   ├── search-list-logaritmos.json
│   ├── videos-list-logaritmos.json
│   ├── videos-list-all-long.json
│   └── videos-list-with-whitelisted.json
└── dto/
    └── youtube-candidate.dto.ts
```

Registrado con `providers: [YoutubeService]` y `exports: [YoutubeService]`. Importado por:

- `AdminModule` (endpoint de candidatos)
- `CourseGeneratorService` (enriquecimiento durante generación IA — `CourseGeneratorService` vive en `admin/`, ya dentro de `AdminModule`)

### Interfaz pública de `YoutubeService`

```ts
export interface YoutubeCandidate {
  youtubeId: string;
  title: string;
  channelTitle: string;
  channelId: string;
  durationSeconds: number;
  viewCount: number;
  likeCount: number;
  engagementRatio: number; // likes / views (0 si viewCount === 0)
  isWhitelisted: boolean;
  publishedAt: string; // ISO 8601
  thumbnailUrl: string; // snippet.thumbnails.medium.url (320x180)
}

export interface FindCandidatesOptions {
  limit?: number; // default 5, max 20
  excludeIds?: string[];
}

export class YoutubeService {
  findBestVideo(query: string, schoolYearLabel: string): Promise<YoutubeCandidate | null>;

  findCandidates(
    query: string,
    schoolYearLabel: string,
    opts?: FindCandidatesOptions,
  ): Promise<YoutubeCandidate[]>;
}
```

`findBestVideo` es equivalente a `findCandidates(query, label, {limit:1}).then(arr => arr[0] ?? null)`.

### Whitelist inicial (seed)

Canales educativos españoles habituales. Guardados como `channelId` (no nombre, para robustez ante renombrados):

```ts
export const YOUTUBE_WHITELIST_CHANNELS: string[] = [
  // Unicoos
  'UCR9zNNl1_T3dcmuCnBpOoNg',
  // Matemáticas Profe Alex
  'UCGc8ZVCsrR3dAuhvUbkbToQ',
  // Derivando (Eduardo Sáenz de Cabezón)
  'UCdRjp5DiJZvKOJsxQcCh4GA',
  // QuantumFracture
  'UCbdSYaPD-lr1kW27UJuk8Pw',
  // Academia Internet
  'UCwuG9HKUf-Xa1-XAQQtOSCA',
  // Date un Vlog / Date un Voltio (Javier Santaolalla)
  'UCqWR5kqa2MPNhfM5Tm2Txbg',
];
```

**Nota:** Los IDs exactos se verifican durante la implementación consultando YouTube. Si alguno no existe o el canal está inactivo, se omite con un log de warning al cargar el módulo.

### Endpoint admin nuevo

```
GET /admin/lessons/:lessonId/youtube-candidates?exclude=<id1,id2,...>
  Guard: JwtAuthGuard + RolesGuard([ADMIN])
  Response: YoutubeCandidate[]
  Errores:
    - 404 si la lección no existe
    - 400 si la lección no es type VIDEO
    - 503 si YOUTUBE_API_KEY no está configurada
    - 503 si la cuota diaria está agotada
```

**No hay endpoint POST ni PATCH nuevo.** El admin, tras elegir un candidato en el modal, reutiliza el `PATCH /admin/lessons/:lessonId` existente con `{ youtubeId }`.

### Cambio en `CourseGeneratorService`

Única modificación: tras construir el objeto `GeneratedModule` a partir de la respuesta de la IA, se añade un bucle de enriquecimiento **antes** del `prisma.module.create(...)`:

```ts
for (const lesson of generatedModule.lessons) {
  if (lesson.type !== 'VIDEO') continue;
  try {
    const candidate = await this.youtube.findBestVideo(lesson.title, schoolYearLabel);
    if (candidate) {
      (lesson as GeneratedLesson & { youtubeId?: string }).youtubeId = candidate.youtubeId;
    }
  } catch (err) {
    this.logger.warn(`[youtube] fallo al buscar para "${lesson.title}": ${err.message}`);
    // continúa sin youtubeId — no bloquea la generación
  }
}
```

El tipo `GeneratedLesson` se amplía con `youtubeId?: string` y `buildNestedLessonData` ya propaga el campo.

### Frontend: modal de candidatos

Nuevo componente `apps/web/src/components/admin/YoutubeCandidatesModal.tsx`. Se abre desde la vista actual de edición de lección en `/admin/courses/:id` cuando el admin pulsa "🔍 Buscar vídeo" en una lección VIDEO.

Props:

- `lessonId: string`
- `isOpen: boolean`
- `onClose: () => void`
- `onSelect: (youtubeId: string) => void` — el padre llama al PATCH existente

Comportamiento:

1. Al abrir, llama a `GET /admin/lessons/:lessonId/youtube-candidates` con React Query
2. Renderiza 5 cards: thumbnail, título, canal, `PT15M30S → 15:30`, `1.2M views · 4.2% 👍`
3. Botón primario "✓ Usar este" en cada card → `onSelect(youtubeId)` → cierra modal
4. Botón secundario "🔄 Buscar otros" en el footer del modal → re-llama con `exclude=` acumulando IDs ya vistos
5. Estado vacío: "Sin resultados que cumplan los criterios. Puedes pegar un ID manualmente en el campo de la lección."

## 5. Data flow

### Flujo A: generación con IA

```
POST /admin/courses/:id/modules/generate
  └─ CourseGeneratorService.generateModule()
       ├─ AiProviderService.generate(prompt) → { lessons: [...] }
       ├─ forEach lesson.type === 'VIDEO':
       │     YoutubeService.findBestVideo(lesson.title, schoolYearLabel)
       │     lesson.youtubeId = result?.youtubeId ?? null
       └─ prisma.module.create({ data: { ..., lessons: { create: [...] } } })
```

Llamadas a YouTube **secuenciales por módulo** (no paralelas en v1). Un módulo típico con 3-5 lecciones VIDEO añade 3-5s a la generación total de IA (~10-20s). Aceptable; se paraleliza con `Promise.all` en v2 si molesta.

### Flujo B: búsqueda manual

```
Admin UI: click "🔍 Buscar vídeo" en LessonEditor
  ├─ GET /admin/lessons/:lessonId/youtube-candidates
  │    └─ AdminController → YoutubeService.findCandidates(title, label, {limit:5})
  ├─ Modal renderiza top 5
  ├─ Admin click "✓ Usar este" en candidato
  └─ PATCH /admin/lessons/:lessonId { youtubeId: candidate.youtubeId }
       (endpoint existente, sin cambios)
```

### Interno de `findCandidates`

```
1. Si process.env.YOUTUBE_API_KEY no existe → return []
2. query = `${lessonTitle} ${schoolYearLabel}`
3. search.list?
     part=snippet
     q=<query>
     type=video
     maxResults=20
     relevanceLanguage=es
     regionCode=ES
     videoDuration=any          (el filtro de max 20min se aplica local en paso 6 para no excluir intros de 2-3min, que YouTube clasifica como "short")
     safeSearch=strict
     order=relevance
   → array de 20 videoIds
4. Filtra excludeIds localmente antes de la siguiente llamada
5. videos.list?id=<ids,comma>&part=contentDetails,statistics,snippet
   → stats completos
6. Filtros duros:
   - parseDurationISO8601(contentDetails.duration) <= 1200 (20 min)
   - contentDetails.contentRating?.ytRating !== 'ytAgeRestricted'
   - statistics.viewCount y statistics.likeCount presentes (algunos canales los ocultan; se descartan)
7. Para cada candidato:
   - engagementRatio = likeCount / viewCount (0 si viewCount=0)
   - isWhitelisted = YOUTUBE_WHITELIST_CHANNELS.includes(snippet.channelId)
   - score = engagementRatio + (isWhitelisted ? 0.5 : 0)
8. Ordena por score descendente; empate → por viewCount descendente
9. Trunca a opts.limit ?? 5
10. Mapea a YoutubeCandidate[] y devuelve
```

### Caché

Redis opcional detrás de flag `YOUTUBE_CACHE_ENABLED=true`. Key: `youtube:search:<sha256(query)>`. TTL 24h. **Solo cachea la fase `search.list`** (los 20 videoIds); `videos.list` siempre se re-ejecuta para tener stats actualizados y cuesta solo 1 unidad de cuota.

Si Redis no está disponible en runtime, `YoutubeService` captura el error, loguea un warn, y sigue sin caché. Nunca bloquea.

## 6. Error handling

| Escenario                                  | Tratamiento                                                                                                                                                                                                       |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `YOUTUBE_API_KEY` ausente                  | `findBestVideo/findCandidates` devuelven `null`/`[]` inmediatamente. Endpoint responde `503 Service Unavailable` con mensaje "YouTube no configurado". Warn al boot de `YoutubeService`.                          |
| Cuota diaria agotada (`403 quotaExceeded`) | Capturada específicamente. Log error. Devuelve `null`/`[]`. Endpoint responde `503` con mensaje "Cuota de YouTube agotada, inténtalo mañana". El flujo IA **no falla** — el módulo se crea con `youtubeId: null`. |
| Timeout o error de red                     | 1 retry con backoff de 500ms. Timeout total por búsqueda: 10s. Si el retry falla, mismo comportamiento que cuota agotada.                                                                                         |
| 0 resultados tras filtros                  | No es error. Devuelve `null`/`[]`. Modal muestra estado vacío.                                                                                                                                                    |
| `lessonId` inexistente (endpoint)          | `404 NotFoundException`                                                                                                                                                                                           |
| Lección no es tipo VIDEO (endpoint)        | `400 BadRequestException` con mensaje "Solo se puede buscar vídeo para lecciones de tipo VIDEO"                                                                                                                   |
| Redis caído (si caché activa)              | Warn log, sigue sin caché                                                                                                                                                                                         |

**Principio rector:** la generación IA **nunca** falla por un problema de YouTube. Si YouTube está caído, el módulo se crea con vídeos sin asignar y el admin los resuelve manualmente (o con el botón cuando YouTube vuelva).

### Logging

- `logger.log` en asignación exitosa: `[youtube] asignado "<id>" a "<title>" (ratio=<x>, whitelisted=<bool>)`
- `logger.warn` en 0 resultados: `[youtube] sin candidatos para "<query>" (20 búsquedas, 0 pasaron filtros)`
- `logger.error` con stack en errores de red/cuota

## 7. Testing

### `apps/api/src/youtube/youtube.service.spec.ts` (nuevo)

Mockea `global.fetch` o inyecta un cliente HTTP via constructor. Fixtures JSON en `__fixtures__/` con respuestas realistas de YouTube.

Casos:

1. `findBestVideo` devuelve el candidato top con datos completos (happy path)
2. `findBestVideo` devuelve `null` cuando todos superan 20 min
3. `findBestVideo` prefiere vídeo whitelisted con ratio peor (boost aplica)
4. Empate por ratio → gana el más visto (desempate determinista)
5. `findBestVideo` devuelve `null` si `YOUTUBE_API_KEY` no configurada (no llama a fetch)
6. `findBestVideo` devuelve `null` si `search.list` responde 403 quota
7. `findCandidates` respeta `excludeIds`
8. `findCandidates` respeta `limit`
9. Query se construye correctamente como `"<title> <schoolYearLabel>"`
10. Descarta candidatos con `statistics.viewCount` ausente
11. Parseo correcto de duración ISO 8601 (`PT15M30S` → 930s)
12. Timeout o error de red → 1 retry → si falla, devuelve `null`

### `apps/api/src/admin/admin.controller.spec.ts` o `admin.service.spec.ts` (extensión)

1. `GET /admin/lessons/:id/youtube-candidates` con rol STUDENT → 403
2. `lessonId` inexistente → 404
3. Lección tipo QUIZ → 400
4. Happy path: devuelve array de candidatos (mock de `YoutubeService`)

### `apps/api/src/admin/course-generator.service.spec.ts` (extensión)

1. `generateModule` llama a `YoutubeService.findBestVideo` una vez por lección VIDEO
2. Si `findBestVideo` devuelve `null`, el módulo se crea con `youtubeId: null` (no rompe)
3. Lecciones QUIZ/MATCH/SORT/FILL_BLANK **no** disparan llamadas a YouTube
4. Si `YoutubeService` lanza excepción, el módulo se crea igual con `youtubeId: null` (try/catch en el bucle)

### Smoke manual (fuera de CI)

Script `apps/api/scripts/youtube-smoke.ts` ejecutable con `pnpm --filter api youtube:smoke "<query>"`. Llama a YouTube real y printea los top 5 candidatos con score. Para tunear filtros y whitelist manualmente. **No corre en CI** (consume cuota).

### Frontend

Sin tests automatizados nuevos (el proyecto no tiene suite de tests frontend según CLAUDE.md §12). El modal se valida manualmente contra el backend real.

## 8. Variables de entorno nuevas

En `apps/api/.env`:

```env
# YouTube Data API v3 (clave obtenida vía Google Cloud Console)
YOUTUBE_API_KEY=""

# Activar caché Redis de búsquedas (opcional, default false)
YOUTUBE_CACHE_ENABLED=false
```

Al desplegar: añadir `YOUTUBE_API_KEY` a Railway (`api-pre` y `api-prod`). La key es la misma para ambos entornos (cuota compartida) salvo que quieras separarlas — en ese caso, dos keys distintas del mismo "proyecto" de Google Cloud.

## 9. Cuota estimada

- `search.list` = 100 unidades
- `videos.list` (batch) = 1 unidad
- Cuota gratis diaria = 10.000 unidades

**Por generación de módulo** (5 lecciones VIDEO): 5 × 100 + 5 × 1 = **505 unidades** → ~19 módulos/día antes de agotar cuota. Holgado para uso actual del panel.

**Por click manual de "Buscar vídeo"**: 101 unidades (1 search + 1 videos.list batch). Si el admin pulsa "🔄 Buscar otros", se añade otro search = +100 (salvo que esté cacheado).

Si la cuota se convierte en problema (improbable), hay 2 opciones: activar caché Redis (elimina `search.list` repetidos) o pedir aumento de cuota a Google (gratis pero requiere formulario).

## 10. Fuera de alcance (YAGNI explícito)

- Campo `Lesson.youtubeIdAutoAssigned` para marcar vídeos asignados automáticamente
- Paralelización de búsquedas dentro de un módulo (secuencial en v1)
- Gestión de whitelist desde UI `/admin/youtube-channels` (hardcoded por ahora)
- IA como desempatador entre candidatos (Opción 3 del brainstorming)
- Métricas de auto-asignación en `/admin/metrics`
- Traducción del query si `schoolYearLabel` está en idioma distinto (solo ES)
- Soporte para Shorts (filtro `videoDuration=medium` los excluye)
- Tests frontend automatizados

## 11. Criterios de aceptación

1. Al ejecutar `POST /admin/courses/:id/modules/generate` con un módulo que contiene lecciones VIDEO, estas se persisten con `youtubeId` poblado cuando hay candidatos válidos, o `null` cuando no los hay.
2. El endpoint `GET /admin/lessons/:id/youtube-candidates` devuelve 5 candidatos ordenados por score descendente para una lección VIDEO válida.
3. El modal `YoutubeCandidatesModal` permite seleccionar un candidato y persistirlo vía `PATCH /admin/lessons/:id` sin recargar la página (invalidación de React Query correcta — ver CLAUDE.md §15).
4. Con `YOUTUBE_API_KEY` vacía, la generación IA sigue funcionando (lecciones VIDEO sin `youtubeId`) y el endpoint devuelve 503.
5. Con cuota agotada simulada, mismo comportamiento que 4.
6. Un vídeo de canal whitelisted con ratio engagement menor gana a uno no-whitelisted con ratio mayor (dentro de los filtros duros).
7. Todos los tests unitarios nuevos pasan.
