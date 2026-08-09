# Export de cursos PRE → JSON → import en PROD

**Fecha:** 2026-08-09
**Estado:** aprobado, pendiente de implementar

---

## 1. Problema

PRE y PROD tienen bases de datos Neon separadas. El pipeline (`.github/workflows/deploy-pipeline.yml`)
promociona **código** (Render/Vercel) y **esquema** (`prisma migrate deploy`, líneas 116 y 282), pero
nunca datos. Los cursos son filas de `Course`/`Module`/`Lesson`/`Quiz`/`ExamQuestion`, así que un curso
creado en PRE —desde el panel admin, el generador IA o `scripts/vkb-import.mjs`— vive solo en PRE.

En `data/imports/courses/` solo hay 2 JSON versionados, mucho menos que los cursos existentes en PRE:
para el resto no hay fichero de origen del que tirar.

Hace falta un camino explícito PRE → JSON → PROD.

## 2. Objetivo y alcance

**Dentro:**

- Exportar todos los cursos de un entorno a un único JSON.
- Reimportar ese JSON en otro entorno preservando el contenido educativo íntegro.
- Evitar duplicados accidentales al importar en producción.

**Fuera (no objetivo):**

- Sincronización automática o continua entre entornos. La promoción es manual y deliberada.
- Migrar progreso de alumnos, matrículas, intentos de examen o certificados. Solo contenido de curso.
- Upsert real de cursos existentes (actualizar en sitio). Ver §8.

## 3. Formato del fichero

Un envoltorio con metadatos y un array de cursos. Cada elemento de `courses` es **exactamente** un
`ImportCourseDto` (ampliado según §4), de modo que el fichero es a la vez el formato de export y el de
import.

```jsonc
{
  "version": 1,
  "exportedFrom": "https://<api-pre>/api",
  "exportedAt": "2026-08-09T10:22:31.004Z",
  "courses": [
    {
      "name": "Matemáticas 1º ESO",
      "schoolYear": "1eso",
      "description": "...",
      "coverUrl": "...",
      "subject": "Matemáticas",
      "published": true,
      "modules": [
        {
          "title": "Números naturales y operaciones",
          "order": 1,
          "lessons": [
            { "title": "...", "type": "VIDEO", "order": 1, "youtubeId": "..." },
            { "title": "...", "type": "QUIZ", "order": 2,
              "quiz": { "questions": [ { "text": "...", "type": "SINGLE",
                                         "answers": [ { "text": "...", "isCorrect": true } ] } ] } },
            { "title": "...", "type": "MATCH", "order": 3, "content": { "pairs": [] } }
          ],
          "examQuestions": [ { "text": "...", "type": "SINGLE", "answers": [] } ]
        }
      ],
      "examQuestions": [ { "text": "...", "type": "TRUE_FALSE", "answers": [] } ]
    }
  ]
}
```

El import sigue aceptando **también** un curso suelto en la raíz: los dos ficheros existentes de
`data/imports/courses/` no se tocan. El script distingue por la presencia de `courses[]`.

`schoolYear` viaja como **nombre** (`"1eso"`), no como id, porque los ids de `SchoolYear` difieren entre
bases de datos. `importCourse` ya lo resuelve por nombre (`admin-content.service.ts`).

## 4. Cambios en la API

Aditivos y retrocompatibles: todos los campos nuevos son opcionales y su ausencia reproduce el
comportamiento actual.

### 4.1 `apps/api/src/admin/dto/import-course.dto.ts`

| Clase | Campos nuevos |
| --- | --- |
| `ImportCourseDto` | `description?: string`, `coverUrl?: string`, `subject?: string` (`@IsOptional() @IsString()`), `published?: boolean` (`@IsOptional() @IsBoolean()`) |
| `ImportQuizQuestionDto` | `type?: QuestionType` (`@IsOptional() @IsEnum(QuestionType)`) |
| `ImportExamQuestionDto` | `type?: QuestionType` (`@IsOptional() @IsEnum(QuestionType)`) |

### 4.2 `apps/api/src/admin/admin-content.service.ts` → `importCourse`

- El `course.create` pasa a incluir `description`, `coverUrl`, `subject` y
  `published: dto.published ?? false`. Hoy solo escribe `title` y `schoolYearId`, de ahí que todo curso
  importado llegue despublicado y sin metadatos.
- Las tres construcciones de preguntas usan `type: q.type ?? QuestionType.SINGLE` en lugar de `SINGLE`
  fijo: preguntas de examen de curso, de módulo y de quiz. Sin esto, las preguntas `MULTIPLE` y
  `TRUE_FALSE` se degradan silenciosamente al importar.

No se añade ningún endpoint. El bulk lo resuelve el script iterando sobre
`POST /admin/courses/import`, que ya es transaccional por curso.

**Consecuencia operativa:** la API de PROD debe estar desplegada con estos cambios *antes* de importar
allí; si no, el `ValidationPipe` rechazará los campos nuevos.

## 5. Scripts

### 5.1 `scripts/lib/vkb-api.mjs` (nuevo)

Módulo compartido que extrae de `vkb-import.mjs` lo que ambos scripts necesitan:

- `loadEnv()` — lee y parsea `.env.scripts` (sin dependencia de dotenv, como hoy).
- `login(apiUrl, email, password)` — devuelve el `accessToken`.
- `api(path, opts)` — fetch autenticado que lanza si la respuesta no es OK.

Evita duplicar ~40 líneas entre export e import.

### 5.2 `scripts/vkb-export.mjs` (nuevo)

```
node scripts/vkb-export.mjs courses [--out=ruta.json] [--only=id1,id2]
```

1. Login contra `VKB_API_URL` de `.env.scripts`.
2. Pagina `GET /admin/courses` hasta agotar el total.
3. Por cada curso: `GET /admin/courses/:id/detail` (devuelve módulos, lecciones, quiz, preguntas y
   respuestas **con `isCorrect`** — es ruta admin) más `GET /admin/exam-questions?courseId=` y un
   `?moduleId=` por módulo.
4. Mapea el resultado a la forma de `ImportCourseDto` y escribe el fichero.

Salida por defecto: `data/exports/courses-<YYYYMMDD>.json`.

Solo hace lecturas: es seguro ejecutarlo contra PRE o PROD.

### 5.3 `scripts/vkb-import.mjs` (modificado)

- Acepta payload bulk (`{ courses: [...] }`) además del curso suelto actual.
- **Pre-chequeo de duplicados:** por cada curso, `GET /admin/courses?search=<title>` y compara `title`
  exacto + `schoolYear.name`. Si ya existe, lo salta con aviso y continúa con el resto. `--force` lo
  importa igualmente.
- **`--publish-all`:** publica en destino todos los cursos del fichero. Ver §5.4.
- Resumen final: importados / saltados / fallidos, con el id de cada curso creado. Un curso que falle
  no aborta los demás. Si no se importa nada porque estaba todo duplicado, sale con código 1: quien
  invoca el script (una persona o el agente `course-creator`, que hace `grep "^IMPORT_ID="`) espera un
  curso nuevo.

### 5.4 Publicación: por qué es un flag y no un dato del JSON

"Estudiar" (`StudyPage.tsx`) puebla su desplegable de asignaturas con `GET /courses`, que para un
STUDENT filtra por `published: true` y por su nivel (`courses.service.ts:32`). El tema es texto libre
(`StudyPage.tsx`): los módulos no intervienen. Es decir, **para que un curso exista de cara al
alumno basta con que esté publicado y sea de su nivel** — el contenido lo genera "Estudiar" bajo
demanda.

En el origen (PRE) casi todo el catálogo está despublicado, así que un import fiel dejaría el destino
invisible. La publicación se resuelve con `--publish-all` en el import, no reescribiendo el JSON, por
dos motivos:

- El fichero de export sigue siendo una foto fiel del origen y se puede volver a comparar contra él.
- Publicar 100 cursos en producción es una decisión deliberada; que aparezca en el comando la deja
  registrada en el historial de la terminal, no enterrada en un diff de datos.

## 6. Flujo de uso

```bash
# 1. Exportar de PRE (.env.scripts apuntando a PRE)
node scripts/vkb-export.mjs courses --out=data/exports/courses-pre.json

# 2. Ensayo contra local
docker compose up -d
# .env.scripts apuntando a localhost
node scripts/vkb-import.mjs courses data/exports/courses-pre.json

# 3. Desplegar la API con los cambios de §4 a PROD

# 4. Importar en PROD (.env.scripts apuntando a PROD)
node scripts/vkb-import.mjs courses data/exports/courses-pre.json --publish-all
```

## 7. Verificación

- Tests unitarios nuevos para `importCourse`, que hoy no tiene ninguno: persistencia de los campos
  nuevos, respeto del `type` real de las preguntas y retrocompatibilidad de un DTO legacy
  (sin campos nuevos → `published: false`, `type: SINGLE`).
- `pnpm --filter @vkbacademy/api test` en verde.
- Round-trip real: export de PRE (solo lectura) → import contra local, comparando módulos, lecciones y
  número de preguntas. PROD no se toca hasta que el ensayo local pase.
- Los scripts son Node plano sin suite propia; se validan con la ejecución real.

## 8. Decisiones y descartes

| Decisión | Motivo |
| --- | --- |
| Un único JSON con array en vez de un fichero por curso | Un solo artefacto que mover entre entornos y revisar en un PR. |
| Bulk en el script, no endpoint nuevo | `POST /admin/courses/import` ya es transaccional por curso; un endpoint bulk añadiría superficie de API sin ganancia real. |
| Anti-duplicados en el script, no upsert en el endpoint | El upsert obliga a decidir qué pasa con módulos y lecciones huérfanos y con el progreso de los alumnos que ya cursan el curso. Fuera de alcance. |
| `schoolYear` por nombre, no por id | Los ids de `SchoolYear` no coinciden entre bases de datos. |
| Publicar con `--publish-all`, no editando el JSON | El export se mantiene como foto fiel del origen y la decisión queda explícita en el comando. Ver §5.4. |
| Exportar los módulos aunque "Estudiar" no los use | Los consume la vista clásica de curso y no cuestan nada en el fichero. |
| No exportar matrículas ni progreso | Son datos por entorno, no contenido promocionable. |
