# Retos v2 — rediseño sobre el flujo real del alumno

> Diseño validado el 2026-08-14. Rediseña el catálogo de tipos de reto (`ChallengeType`), añade misiones semanales y persiste por primera vez los ejercicios que el alumno resuelve.

---

## 1. Contexto y objetivo

La gamificación se diseñó en la fase 7, cuando el alumno consumía **cursos del temario**: lecciones, quizzes y progreso por lección. Desde entonces el producto ha girado hacia el **plan de estudio generado por IA** (`StudyPlan` → temas → teoría → ejercicios → examen), que es hoy el flujo principal del alumno.

Los retos no giraron con él. De los nueve tipos actuales, cinco miden fuentes de datos que el flujo real no toca:

| Tipo actual | Fuente | ¿Se mueve en el flujo de hoy? |
| ----------- | ------ | ----------------------------- |
| `EXERCISE_COMPLETED` | `UserProgress` de lecciones del temario | Solo con cursos con lecciones asignadas |
| `EXERCISE_SCORE` | `QuizAttempt` (quiz de lección) | Igual — los ejercicios del plan no persisten intento |
| `TOTAL_HOURS_EXERCISE` | heurística: 5 min × ejercicio completado | Número inventado |
| `TOTAL_HOURS_THEORY` | heurística: 10 min × `TheoryLesson` | Número inventado |
| `TOTAL_HOURS_EXAM` | `submittedAt − startedAt` | Real, pero mide poco |
| `THEORY_COMPLETED` | `TheoryModule` | ✅ sí (uno por tema del plan) |
| `EXAM_COMPLETED` / `EXAM_SCORE` | `ExamAttempt` (incluye bancos IA) | ✅ sí |
| `STREAK_WEEKLY` | `User.currentStreak` | Parcialmente — ver §3 |

**Objetivo:** que el apartado de Retos mida lo que el alumno hace de verdad, y que ese trabajo se pueda medir — hoy hay dos huecos de datos que lo impiden (§4).

---

## 2. Decisiones tomadas

| # | Decisión | Razón |
| - | -------- | ----- |
| D1 | **Rediseñar el set completo**, no solo añadir | Dejar tipos muertos significa retos con la barra a 0 para siempre. Es ruido que el alumno interpreta como que la app no funciona |
| D2 | Se **retiran** `EXERCISE_COMPLETED`, `EXERCISE_SCORE` y los tres `TOTAL_HOURS_*` | Los dos primeros los sustituyen tipos que sí miden el flujo real. Las horas de ejercicio y teoría son heurísticas fijas: enseñan al alumno un número falso |
| D3 | Se **conservan** `THEORY_COMPLETED`, `EXAM_COMPLETED`, `EXAM_SCORE`, `STREAK_WEEKLY` | Miden datos reales del flujo actual |
| D4 | **10 tipos nuevos** (§5). Set final: 14 | Cobertura: arranque, amplitud, volumen, precisión, dificultad, excelencia, ayuda y constancia |
| D5 | **Persistencia nueva**: modelo `ExerciseAttempt` + rachas diarias y de aciertos en `User` | Sin ella, la mitad del flujo del alumno es inmedible. Es la decisión que habilita los tipos 4, 5, 6 y 10 |
| D6 | **Dos cadencias**: `PERMANENT` y `WEEKLY` | Las misiones semanales dan un motivo para volver esta semana; los logros permanentes dan progresión larga. Los retos semanales vuelven a conceder puntos cada semana que se completan |
| D7 | Se extiende el **motor actual** en vez de sustituirlo por un log de eventos genérico | El motor de reglas sobre `ActivityEvent` evitaría migraciones futuras de enum, pero es una reescritura completa de la gamificación, duplica datos y convierte el admin en un constructor de reglas. Sobredimensionado para 14 tipos |
| D8 | La corrección del ejercicio pasa a hacerse **en servidor** | Hoy `ExercisePractice.tsx` compara la respuesta con `solution` en el cliente. Si de ahí salen puntos, se farmean desde la consola del navegador |
| D9 | **No hay clawback** de puntos por retos retirados | `User.totalPoints` está denormalizado y esos puntos se ganaron. Quitárselos a un alumno por una decisión nuestra es peor que la incoherencia |
| D10 | El `solution` sigue viajando al cliente en el JSON del plan | Es deuda anterior a este trabajo y arreglarla obliga a rediseñar el render de ejercicios. Los puntos quedan protegidos igualmente por D8. Fuera de alcance (§12) |
| D11 | Se conserva `TheoryModule` como unidad de "tema estudiado" para `THEORY_COMPLETED` | Cada tema del plan genera exactamente uno. Es la señal más fiable que hay hoy |

---

## 3. Dos defectos que este trabajo arregla de paso

Ambos se encontraron al leer los puntos de llamada. No los causa este rediseño, pero lo condicionan.

### 3.1 `STREAK_WEEKLY` es incompletable

`checkAndAward(userId, ...eventTypes)` solo carga retos cuyo `type` esté en `eventTypes`:

```ts
const challenges = await this.prisma.challenge.findMany({
  where: { isActive: true, type: { in: eventTypes } },
});
```

Los seis puntos de llamada pasan `EXERCISE_COMPLETED`, `TOTAL_HOURS_EXERCISE`, `THEORY_COMPLETED`, `TOTAL_HOURS_THEORY`, `EXAM_COMPLETED`, `EXAM_SCORE`, `TOTAL_HOURS_EXAM` y `EXERCISE_SCORE`. **Ninguno pasa `STREAK_WEEKLY`.** El reto "racha de N semanas" del seed nunca se evalúa y por tanto nunca se completa, aunque `updateStreak` sí mantenga el contador al día.

**Arreglo:** `checkAndAward` añade siempre `STREAK_DAILY` y `STREAK_WEEKLY` a los tipos recibidos. Ningún punto de llamada tiene que acordarse.

### 3.2 Crear un plan de estudio no cuenta como actividad

`checkAndAward` (y con él `updateStreak`) se llama desde `progress`, `theory`, `exams` y `quizzes`. **No se llama desde `study-plans`.** Un alumno que crea un plan de estudio y estudia la teoría desde ahí no registra actividad de racha por ese acto.

**Arreglo:** `study-plans.create()` pasa a llamar a `checkAndAward`.

---

## 4. Los dos huecos de datos

### 4.1 Los ejercicios del plan no dejan rastro

`StudyPlan.exercises` es un `Json?` con la lista generada por la IA. El alumno los resuelve en `ExercisePractice.tsx`, que:

- para `SINGLE` y `TRUE_FALSE`, compara la opción elegida con `exercise.solution` **en el cliente** (`normalizeForMatch`);
- para `OPEN`, llama a `POST /exercises/evaluate`, que corrige con IA en servidor pero **no persiste nada**.

No queda registro de qué resolvió, ni de si acertó. Es imposible medir volumen, precisión o dificultad sin añadir persistencia.

### 4.2 La racha solo cuenta semanas

`User.currentStreak` / `lastActiveWeek` cuentan **semanas ISO** con actividad. No existe noción de días consecutivos, que es la unidad con la que un alumno percibe la constancia.

### 4.3 Trampa: los ejercicios no tienen identidad estable

`regenerateExercises` reemplaza el array `StudyPlan.exercises` entero. Referenciar un ejercicio por su índice se corrompe en cuanto el alumno regenera. Cada ejercicio necesita un `id` propio.

---

## 5. Catálogo de tipos

### 5.1 Los 10 nuevos

| # | Tipo | Qué mide | Fuente | `WEEKLY` |
| - | ---- | -------- | ------ | :------: |
| 1 | `STUDY_PLAN_CREATED` | Planes de estudio creados | `StudyPlan` count por `createdAt` | ✅ |
| 2 | `TOPICS_STUDIED` | Temas distintos estudiados | `StudyPlanTopic` vía `plan.userId` / `plan.createdAt` | ✅ |
| 3 | `SUBJECT_VARIETY` | Asignaturas distintas tocadas | `distinct StudyPlanTopic.contextCourseId` | ❌ |
| 4 | `EXERCISES_SOLVED` | Ejercicios acertados | `ExerciseAttempt` con `verdict='correct'` | ✅ |
| 5 | `EXERCISES_CORRECT_STREAK` | Aciertos seguidos sin fallar | `User.currentCorrectStreak` | ❌ |
| 6 | `HARD_EXERCISES_SOLVED` | Ejercicios difíciles acertados | `ExerciseAttempt` `verdict='correct'` + `difficulty='HARD'` | ✅ |
| 7 | `EXAM_PERFECT` | Exámenes con 100 % | `ExamAttempt.score = 100` | ✅ |
| 8 | `EXAM_HARD_SCORE` | Nota ≥ N % en examen de nivel difícil | `max(score)` de `ExamAttempt` → `aiExamBank.level = 'HARD'` | ❌ |
| 9 | `TUTOR_QUESTIONS` | Preguntas hechas al tutor IA | `TutorMessage` con `role='user'` | ✅ |
| 10 | `STREAK_DAILY` | Días consecutivos con actividad | `User.currentDailyStreak` | ❌ |

`SUBJECT_VARIETY` se calcula sobre `StudyPlanTopic.contextCourseId` y no sobre `StudyPlan.courseId`: así cuentan también los temas `CUSTOM` que el alumno crea fuera de la asignatura base del plan.

`TOPICS_STUDIED` filtra la ventana semanal por `plan.createdAt` porque `StudyPlanTopic` no tiene timestamp propio. Un tema pertenece a la semana en que se creó su plan.

`EXERCISES_SOLVED` y `HARD_EXERCISES_SOLVED` cuentan **solo `verdict='correct'`**. Un `partial` no suma: si contara, el reto premiaría responder cualquier cosa en un ejercicio abierto.

### 5.2 Set final (14)

**Heredados:** `THEORY_COMPLETED` (✅ semanal), `EXAM_COMPLETED` (✅ semanal), `EXAM_SCORE` (❌), `STREAK_WEEKLY` (❌).

**Retirados:** `EXERCISE_COMPLETED`, `EXERCISE_SCORE`, `TOTAL_HOURS_EXERCISE`, `TOTAL_HOURS_THEORY`, `TOTAL_HOURS_EXAM`.

### 5.3 Candidatos descartados

- **`CERTIFICATES_EARNED`** — el modelo `Certificate` ya existe y sería barato, pero los certificados se emiten desde el flujo de temario clásico (completar módulo/curso, aprobar examen de módulo/curso), el mismo flujo infrautilizado que motiva este rediseño. Añadirlo repetiría el error.
- **`EXAM_IMPROVEMENT`** — subir la nota en un tema ya examinado. Es el candidato más motivador de los que quedan fuera, pero exige comparar intentos agrupados por `aiExamBank.studyPlanTopicId` y ordenados en el tiempo: bastante más caro que los diez elegidos. Candidato natural para una iteración posterior.

---

## 6. Schema

```prisma
enum ChallengeCadence {
  PERMANENT
  WEEKLY
}

model Challenge {
  // ... campos actuales
  cadence ChallengeCadence @default(PERMANENT)
}

model UserChallenge {
  // ... campos actuales
  periodKey String @default("ALL")   // "ALL" para PERMANENT | "2026-W33" para WEEKLY

  @@unique([userId, challengeId, periodKey])   // sustituye a @@unique([userId, challengeId])
  @@index([userId])
  @@index([userId, periodKey])
  @@index([academyId])
}

model ExerciseAttempt {
  id          String   @id @default(cuid())
  userId      String
  studyPlanId String
  exerciseId  String   // id estable inyectado en cada item de StudyPlan.exercises
  topicLabel  String
  difficulty  String   // EASY | MEDIUM | HARD
  verdict     String   // correct | partial | incorrect
  answeredAt  DateTime @default(now())

  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  studyPlan StudyPlan @relation(fields: [studyPlanId], references: [id], onDelete: Cascade)

  @@unique([userId, exerciseId])
  @@index([userId, answeredAt])
}

model User {
  // ... campos actuales
  lastActiveDay        String?  // "2026-08-14", calculado en Europe/Madrid
  currentDailyStreak   Int      @default(0)
  longestDailyStreak   Int      @default(0)
  currentCorrectStreak Int      @default(0)
  longestCorrectStreak Int      @default(0)
}
```

**`@@unique([userId, exerciseId])`** impide farmear puntos respondiendo el mismo ejercicio en bucle: un reintento actualiza la fila, no crea otra.

**Identidad del ejercicio.** Al persistir `StudyPlan.exercises` (en `create` y en `regenerateExercises`) se inyecta un `id: cuid()` en cada item. Los `ExerciseAttempt` de una generación anterior sobreviven a la regeneración: el alumno los resolvió de verdad y cuentan.

**Rachas denormalizadas.** `EXERCISES_CORRECT_STREAK` lee `currentCorrectStreak` en vez de recorrer el historial de intentos, siguiendo el patrón que ya usan `currentStreak` / `longestStreak`. Los campos `longest*` existen para mostrarlos en el hero de la página de Retos.

**Zona horaria.** `lastActiveDay` se calcula en `Europe/Madrid`. Con UTC, estudiar a la 01:00 de Madrid contaría como el día anterior y rompería rachas de forma invisible para el alumno.

---

## 7. Motor

### 7.1 `calculateProgress(userId, type, since?)`

`since` llega solo para retos `WEEKLY`, con el lunes 00:00 de la semana ISO en curso. Los tipos se parten en dos familias:

| Familia | Tipos | Uso de `since` |
| ------- | ----- | -------------- |
| **Contables en ventana** | `STUDY_PLAN_CREATED`, `TOPICS_STUDIED`, `EXERCISES_SOLVED`, `HARD_EXERCISES_SOLVED`, `EXAM_PERFECT`, `TUTOR_QUESTIONS`, `EXAM_COMPLETED`, `THEORY_COMPLETED` | Filtran por fecha |
| **De estado** | `SUBJECT_VARIETY`, `EXERCISES_CORRECT_STREAK`, `EXAM_SCORE`, `EXAM_HARD_SCORE`, `STREAK_DAILY`, `STREAK_WEEKLY` | Lo ignoran |

Una constante `WEEKLY_CAPABLE_TYPES` en `ChallengesService` es la fuente de verdad. El DTO de admin y el formulario web la respetan: crear un reto `WEEKLY` de tipo `STREAK_DAILY` devuelve 400, no un reto silenciosamente roto.

### 7.2 `checkAndAward`

Dos cambios sobre el flujo actual:

1. **Periodo.** Para cada reto se resuelve su `periodKey` (`"ALL"` si `PERMANENT`, la semana ISO en curso si `WEEKLY`) y el upsert usa la clave triple `userId + challengeId + periodKey`. Un reto semanal completado la semana pasada no bloquea el de esta semana: es otra fila y vuelve a conceder puntos. Es el comportamiento buscado.
2. **Streaks siempre.** Los tipos evaluados son `[...eventTypes, STREAK_DAILY, STREAK_WEEKLY]`, siempre. Arregla §3.1 sin tocar los puntos de llamada.

El resto del flujo se conserva: cálculo de progreso una vez por tipo único, upserts en paralelo, un único incremento de `totalPoints`, y el `try/catch` que impide que un fallo de gamificación tumbe la petición.

### 7.3 `updateStreak`

Pasa a mantener las dos rachas en la misma pasada: la semanal existente (`lastActiveWeek`, `currentStreak`, `longestStreak`) y la diaria nueva (`lastActiveDay`, `currentDailyStreak`, `longestDailyStreak`), con la misma lógica de "día consecutivo → +1, hueco → reinicio a 1".

### 7.4 Racha de aciertos

`currentCorrectStreak` avanza **solo cuando se crea** un `ExerciseAttempt`, nunca cuando se actualiza uno ya existente. Un acierto suma 1 y actualiza `longestCorrectStreak` si procede; `partial` e `incorrect` la ponen a 0. Así reintentar un ejercicio ya respondido no infla la racha.

---

## 8. Endpoint de intento de ejercicio

```
POST /study-plans/:id/exercises/:exerciseId/attempt
  body: { answer: string }
  → { verdict, feedback?, solution, explanation }
```

El servidor carga el plan (403 si no es el dueño), busca el ejercicio por `id` dentro del JSON y **corrige él mismo**:

- `SINGLE` / `TRUE_FALSE`: compara la respuesta normalizada contra `solution`. `normalizeForMatch` se mueve del front a la API.
- `OPEN`: delega en `ExercisesService.evaluate`, que ya corrige con IA en servidor.

Después persiste el intento (create, o update si el alumno reintenta), actualiza la racha de aciertos si es un intento nuevo, y lanza:

```ts
void this.challenges.checkAndAward(
  userId,
  ChallengeType.EXERCISES_SOLVED,
  ChallengeType.HARD_EXERCISES_SOLVED,
  ChallengeType.EXERCISES_CORRECT_STREAK,
);
```

El cliente manda la respuesta, nunca el veredicto (D8). `ExercisePractice.tsx` pasa a llamar a este endpoint antes de revelar la solución: es el cambio de front más grande del trabajo.

El rate limit sigue el criterio del módulo: los intentos de `SINGLE`/`TRUE_FALSE` no llaman a la IA, pero los `OPEN` sí, así que el endpoint hereda el `@Throttle({ default: { ttl: 3600000, limit: 30 } })` que ya usa `POST /exercises/evaluate`.

---

## 9. Puntos de llamada

| Servicio | Antes | Después |
| -------- | ----- | ------- |
| `study-plans.create()` | *(nada)* | `STUDY_PLAN_CREATED`, `TOPICS_STUDIED`, `SUBJECT_VARIETY` |
| intento de ejercicio (nuevo) | — | `EXERCISES_SOLVED`, `HARD_EXERCISES_SOLVED`, `EXERCISES_CORRECT_STREAK` |
| `exams.submit()` | `EXAM_COMPLETED`, `EXAM_SCORE`, `TOTAL_HOURS_EXAM` | `EXAM_COMPLETED`, `EXAM_SCORE`, `EXAM_PERFECT`, `EXAM_HARD_SCORE` |
| `theory.create()` | `THEORY_COMPLETED`, `TOTAL_HOURS_THEORY` | `THEORY_COMPLETED` |
| `tutor.chat()` | *(nada)* | `TUTOR_QUESTIONS` |
| `progress.complete()` | `EXERCISE_COMPLETED`, `TOTAL_HOURS_EXERCISE` | `checkAndAward(userId)` — registra actividad para las rachas |
| `quizzes.submit()` | `EXERCISE_SCORE` | `checkAndAward(userId)` — íd. |

Los dos últimos siguen llamando sin tipos: `checkAndAward` ejecuta `updateStreak` antes de consultar retos, así que la llamada mantiene vivas las rachas de un alumno que sí usa el temario clásico.

En `tutor.chat()` la llamada va **después** de persistir el mensaje del alumno y sin bloquear el streaming de la respuesta.

---

## 10. Migración

Es la parte delicada del trabajo, por el comportamiento conocido de Prisma con enums.

Orden obligatorio del SQL:

1. `DELETE` de `UserChallenge` y luego `Challenge` de los cinco tipos retirados. **Postgres no permite eliminar valores de un enum mientras haya filas que los usen**, así que este paso va a mano y va primero.
2. `AlterEnum` de `ChallengeType`: diez valores nuevos, cinco fuera.
3. `CreateEnum ChallengeCadence`; columna `Challenge.cadence`; columnas de racha en `User`; tabla `ExerciseAttempt`.
4. `DropIndex` del unique actual de `UserChallenge`, `AlterTable` para `periodKey` con default `"ALL"`, `CreateIndex` del unique triple y del índice `[userId, periodKey]`.

Prisma no genera este orden por sí solo: **hay que reordenar el SQL a mano antes del primer `migrate dev`**, porque el checksum se congela en el primer apply y corregirlo después obliga a rehacer la migración.

Las filas existentes de `UserChallenge` reciben `periodKey = "ALL"` por el default, que es exactamente lo que les corresponde: todos los retos actuales nacen `PERMANENT`.

Los puntos concedidos por retos retirados permanecen en `User.totalPoints` (D9).

---

## 11. Superficie web y seed

- **`apps/web/src/api/challenges.api.ts`** y **`admin.api.ts`**: uniones de tipos a 14 valores, campo `cadence` en las interfaces de reto.
- **`AdminChallengesPage.tsx`**: etiquetas en español para los 14 tipos en `CHALLENGE_TYPE_LABELS`, selector de cadencia en el formulario, y opción `WEEKLY` deshabilitada cuando el tipo elegido no está en `WEEKLY_CAPABLE_TYPES`.
- **`ChallengesPage.tsx`**: la lista se parte en dos bloques — **Misiones de la semana** (con la nota de que reinician el lunes) y **Logros**. Los filtros actuales (Todos / En progreso / Completados) se mantienen y aplican dentro de cada bloque. El hero gana la racha diaria junto a la semanal.
- **`GET /challenges`**: `getMyProgress` devuelve `cadence` por reto y, para los `WEEKLY`, la fila del periodo en curso. `getSummary` gana `currentDailyStreak` y `longestDailyStreak`.
- **`seed.ts`**: se reescribe `challengesData` cubriendo los 14 tipos, con cuatro o cinco retos `WEEKLY` entre ellos.

---

## 12. Fuera de alcance

- **Dejar de enviar `solution` al cliente** en el JSON del plan (D10). Es deuda anterior; obliga a rediseñar el render de ejercicios y los puntos ya quedan protegidos por la corrección en servidor.
- **`CERTIFICATES_EARNED` y `EXAM_IMPROVEMENT`** (§5.3).
- **Retos por academia.** `Challenge` es global hoy y sigue siéndolo; `UserChallenge` conserva su `academyId`.
- **Notificaciones al completar un reto.** No existen hoy y no las añade este trabajo.
- **Limpieza de `UserChallenge` de semanas pasadas.** Las filas se acumulan, pero son pequeñas y dan historial. Si algún día molestan, es una tarea de mantenimiento aparte.

---

## 13. Testing

- **`challenges.service.spec.ts`**: un test por rama nueva de `calculateProgress`; rollover semanal (semana nueva → fila nueva y puntos otra vez, permanente → no); validación de cadencia contra `WEEKLY_CAPABLE_TYPES`; y un test que fija §3.1 — un reto de racha se evalúa aunque el punto de llamada no pase su tipo.
- **Spec del endpoint de intento**: corrección en servidor para los tres tipos de ejercicio, 403 cuando el plan no es del alumno, reintento que actualiza sin duplicar, y racha de aciertos que solo avanza en el primer intento.
- **Verificación por mutación** de cada rama nueva antes de dar el trabajo por bueno: romper lo que el test vigila y comprobar que falla.
- `pnpm --filter @vkbacademy/api test` y `pnpm --filter @vkbacademy/web exec tsc --noEmit`.

---

## 14. Riesgos

| Riesgo | Mitigación |
| ------ | ---------- |
| La migración de enum se aplica en mal orden y queda con checksum congelado | Revisar y reordenar el SQL a mano antes del primer `migrate dev` (§10) |
| El cambio de `ExercisePractice.tsx` rompe la práctica de ejercicios, que es el flujo principal | Es el punto que más cuidado pide en la implementación: el endpoint entra antes que el cambio de front, y el front cae a la corrección local si el endpoint falla |
| Los retos semanales conceden puntos repetidos y desbalancean la tienda | Los `WEEKLY` del seed nacen con puntuación baja frente a los permanentes; se revisa con datos reales tras la primera semana en PRE |
| Un alumno con muchos intentos hace lenta la página de Retos | `ExerciseAttempt` lleva `@@index([userId, answeredAt])` y las rachas van denormalizadas en `User`, sin recorrer historial |
