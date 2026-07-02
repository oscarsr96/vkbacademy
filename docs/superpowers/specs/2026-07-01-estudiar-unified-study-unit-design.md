# Diseño — "Estudiar": unidad de estudio unificada (Teoría + Ejercicios + Examen)

Fecha: 2026-07-01
Estado: aprobado (diseño). Pendiente de plan de implementación.

## 1. Contexto y motivación

Hoy el alumno tiene tres entradas separadas en el menú lateral, y las tres siguen
el mismo patrón de entrada (**asignatura + tema**) para generar contenido con IA:

| Menú actual                  | Endpoint                   | Genera                                             | ¿Persiste?       |
| ---------------------------- | -------------------------- | -------------------------------------------------- | ---------------- |
| 📖 Teoría (`/theory`)        | `POST /theory/generate`    | `TheoryModule` + `TheoryLesson[]` (slides + vídeo) | Sí               |
| 🧮 Ejercicios (`/exercises`) | `POST /exercises/generate` | Lista de ejercicios (SINGLE/TRUE_FALSE/OPEN)       | **No** (efímero) |
| 🎓 Exámenes (`/my-exams`)    | `POST /exams/ai/generate`  | `AiExamBank` + preguntas                           | Sí               |

El objetivo es unificar los tres en un único concepto orientado al alumno: introduce
un **tema** y se crea un **"Curso"** (técnicamente una _unidad de estudio_ personal)
que contiene Teoría, Ejercicios y Examen juntos.

## 2. Objetivo

- Sustituir los tres ítems de menú (`Teoría`, `Ejercicios`, `Exámenes`) por uno solo:
  **"🧠 Estudiar"**.
- El alumno crea una **unidad de estudio** a partir de una asignatura + un tema; la
  unidad agrupa las tres secciones generadas por IA y se persiste para volver a ella.
- Reutilizar al máximo el código existente (generadores IA, flujo de intentos de
  examen, render de slides y export a PDF).

## 3. Decisiones tomadas (brainstorming)

1. **Qué es el "Curso":** una **entidad nueva y ligera por alumno** (`StudyUnit`), NO
   el `Course` del admin. Convive con "Asignaturas". Se persiste.
2. **Contexto de IA:** la **asignatura es obligatoria** (como ahora). Una sola
   selección sirve para las tres secciones, en vez de repetirla en cada página.
3. **Cuándo se genera:** **las tres de golpe** al crear la unidad.
4. **Configuración:** **formulario breve al crear** (nº ejercicios, nº preguntas del
   examen 5/10, timer opcional, "1 intento").
5. **Exámenes oficiales** (profesor/admin, por curso/módulo): **se ignoran**; no se
   muestran en el flujo del alumno.
6. **Datos previos** (temarios y bancos IA ya creados): **empezar de cero**. Quedan en
   BD pero no se muestran. No hay migración de datos.

## 4. Arquitectura (Approach A)

Entidad nueva `StudyUnit` + FK `studyUnitId` _nullable_ en `TheoryModule` y
`AiExamBank` (relación 1:1 con la unidad) + ejercicios como JSON en `StudyUnit`.
Los datos antiguos quedan con `studyUnitId = null` → excluidos de las consultas de
"Estudiar", lo que satisface "empezar de cero" sin borrar nada.

Se descartaron: **B** (tablas hijas propias duplicando teoría/examen → duplicación
masiva de modelos y servicios) y **C** (agrupar por `(userId, courseId, topic)` sin
entidad → frágil, el tema como clave, sin identidad limpia).

## 5. Backend

### 5.1 Modelo de datos (Prisma)

Nuevo modelo, personal (patrón de `TheoryModule`, sin `academyId`):

```prisma
model StudyUnit {
  id        String   @id @default(cuid())
  userId    String
  courseId  String
  topic     String   // input crudo del alumno
  title     String   // título limpio (tomado de la teoría generada)
  summary   String   @db.Text
  /// Ejercicios generados por IA, persistidos como JSON. Estructura:
  /// [{ statement, type: 'SINGLE'|'TRUE_FALSE'|'OPEN', options: string[], solution, explanation }]
  exercises Json?
  createdAt DateTime @default(now())

  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  course Course @relation("CourseStudyUnits", fields: [courseId], references: [id], onDelete: Cascade)

  theoryModule TheoryModule?
  examBank     AiExamBank?

  @@index([userId, createdAt])
  @@index([userId, courseId])
}
```

Añadidos a modelos existentes (ambos nullable → compatibilidad con registros viejos):

```prisma
model TheoryModule {
  // ...campos actuales...
  studyUnitId String?    @unique
  studyUnit   StudyUnit? @relation(fields: [studyUnitId], references: [id], onDelete: Cascade)
}

model AiExamBank {
  // ...campos actuales...
  studyUnitId String?    @unique
  studyUnit   StudyUnit? @relation(fields: [studyUnitId], references: [id], onDelete: Cascade)
}
```

Migración **aditiva** (columnas nullable + tabla nueva). Se aplica desde el job de
pipeline (`migrate-pre`/`migrate-prod`), no en el contenedor.

### 5.2 Módulo `study`

Nuevo módulo Nest `apps/api/src/study/` (`controller → service`), inyectando los
servicios existentes: `TheoryService`, `ExercisesService`, `AiExamsService`.

Firmas actuales que se reutilizan (confirmadas):

- `TheoryService.generate(userId, { courseId, topic })` → `TheoryModuleWithLessons`
- `ExercisesService.generate(userId, { courseId, topic, count })` → `{ exercises }`
- `AiExamsService.generate(userId, { courseId, topic, numQuestions, timeLimit?, onlyOnce? })` → `AiExamBank`

Se añade un parámetro opcional `studyUnitId` a los tres generadores (o se actualiza el
registro creado tras la generación) para enlazarlos a la unidad. La reutilización debe
mantener las reglas duras existentes (p.ej. `isCorrect` nunca en GET; el examen se
corrige server-side).

### 5.3 Endpoints (todos `[STUDENT]`, scoped por `userId`)

```
POST   /study
  body: { courseId, topic, numExercises, numQuestions: 5|10, timeLimit?, onlyOnce? }
  1. Valida enrollment del alumno en courseId (misma validación que hoy usan los generadores).
  2. Crea StudyUnit (title/summary provisionales; se completan desde la teoría).
  3. Promise.allSettled([
       theory.generate(userId, { courseId, topic }),
       exercises.generate(userId, { courseId, topic, count: numExercises }),
       aiExams.generate(userId, { courseId, topic, numQuestions, timeLimit, onlyOnce }),
     ])
  4. Enlaza cada resultado cumplido a la unidad; exercises → JSON en StudyUnit.
     title/summary de la unidad = los de la teoría (si la teoría falló, fallback al topic).
  5. Devuelve la unidad ensamblada con el estado de cada sección (ok | failed).

GET    /study/mine          → lista de unidades del alumno (resumen), agrupables por curso
GET    /study/:id           → unidad completa (teoría con lecciones, ejercicios JSON, examen)
DELETE /study/:id           → borra la unidad (cascade a theory/exam vía FK)

POST   /study/:id/theory    → regenera la sección teoría de la unidad
POST   /study/:id/exercises → regenera ejercicios (acepta { count? })
POST   /study/:id/exam      → regenera examen (acepta { numQuestions?, timeLimit?, onlyOnce? })
```

### 5.4 Manejo de fallos parciales

`Promise.allSettled` permite que la unidad se cree aunque una llamada IA falle. Cada
sección se marca como `ok` o `failed`. En la UI, una sección fallida muestra un botón
**"Reintentar generación"** que llama al endpoint de regeneración correspondiente. Esto
evita perder las tres secciones por un único fallo transitorio de la IA.

Si **las tres** fallan, `POST /study` responde error y la unidad recién creada se borra
(no dejar unidades totalmente vacías).

## 6. Frontend

### 6.1 Navegación

- `AppLayout` (rama STUDENT): quitar `🧮 Ejercicios`, `📖 Teoría`, `🎓 Exámenes`.
  Añadir **`🧠 Estudiar` → `/study`**. Se mantienen Asignaturas, Retos, Mi perfil.
- `DashboardPage`: los tres accesos rápidos actuales (Teoría/Ejercicios/Exámenes)
  se sustituyen por uno a **`/study`**.

### 6.2 Rutas

```
/study        → StudyPage        (lista + creación)
/study/:id    → StudyUnitPage    (pestañas Teoría | Ejercicios | Examen)
```

Se retiran del router `TheoryPage` (`/theory`), `ExercisesPage` (`/exercises`) y
`ExamsListPage` (`/my-exams`). Se **conservan** como componentes reutilizados:
`ExamPage` (runner de intentos), `TheoryModulePage`/`SlideView`/`TheorySlides` (render
de slides) y `ExerciseCard` (tarjeta de ejercicio). Los ficheros de página retirados
pueden eliminarse una vez migrado su contenido reutilizable a componentes compartidos.

### 6.3 `StudyPage` (`/study`)

- **Lista** de "mis unidades" (`GET /study/mine`), agrupadas por asignatura, cada una
  enlaza a `/study/:id`, con acción de borrar.
- **Formulario breve de creación:** asignatura (select, obligatoria), tema (textarea),
  nº ejercicios (número), nº preguntas del examen (5/10), timer opcional, "1 intento".
  Submit → `POST /study` con estado de carga claro ("Generando tu curso…", pueden ser
  varios segundos por las 3 llamadas IA) → navega a `/study/:id`.

### 6.4 `StudyUnitPage` (`/study/:id`)

Tres pestañas, reutilizando componentes existentes:

- **Teoría:** `TheorySlides` + export a PDF (ya construido, con el footer de marca VKB).
  Alimentada por el `TheoryModule` de la unidad. Si la sección falló → botón reintentar.
- **Ejercicios:** `ExerciseCard` alimentado por el JSON persistido de la unidad. Las
  respuestas abiertas (OPEN) siguen evaluándose con `POST /exercises/evaluate`. El estado
  de resuelto/revelado es local a la sesión (no se persiste el progreso del alumno).
- **Examen:** tarjeta del `AiExamBank` de la unidad → lanza un intento con el flujo
  actual (`ExamPage` vía `?aiBankId=`). Al terminar, el retorno debe volver a la unidad
  (`/study/:id`) en vez de `/my-exams` (hoy `ExamPage` navega a `/my-exams` en dos sitios).

## 7. Reglas duras y consideraciones

- `isCorrect` de las respuestas del examen **nunca** en GET; corrección server-side
  (se hereda del flujo `AiExamBank` existente, no se toca).
- `StudyUnit` es `userId`-scoped (sin `academyId`), igual que `TheoryModule`/`AiExamBank`.
- Guards de rol en guard/decorador, no en service.
- TypeScript `strict`, sin `any` salvo justificación; DTOs con `class-validator`.
- Comentarios en español, código en inglés.

## 8. Testing

- **API:** test del `StudyService` con los generadores IA mockeados: creación con las 3
  secciones OK; fallo parcial (una rechaza) → unidad creada con sección `failed`; fallo
  total → error + rollback de la unidad. Endpoints de regeneración. Scoping por `userId`
  (un alumno no accede a la unidad de otro → 404/403).
- **Web:** `tsc --noEmit`. Tests de `StudyPage`/`StudyUnitPage` si se añaden (el proyecto
  usa Vitest; hoy sin tests en estas páginas).

## 9. Fuera de alcance

- Exámenes oficiales del profesor/admin (por curso/módulo): no se muestran al alumno.
- Migración de temarios/bancos IA antiguos: no se hace.
- Cambios en el modelo `Course` del admin, enrollments o niveles.
- Persistencia del progreso del alumno dentro de ejercicios (resuelto/no resuelto).

## 10. Riesgos

- **Latencia de creación:** 3 llamadas IA en paralelo. Mitigado con `allSettled` +
  estado de carga claro; el peor caso es la más lenta, no la suma.
- **Fallo parcial de IA:** cubierto con regeneración por sección.
- **Rutas huérfanas:** revisar todas las referencias a `/theory`, `/exercises`,
  `/my-exams` (menú, dashboard, retorno de `ExamPage`) y redirigirlas.
