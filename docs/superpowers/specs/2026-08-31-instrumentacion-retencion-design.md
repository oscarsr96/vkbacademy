# Instrumentación de retención — diseño

> Issue [#126](https://github.com/oscarsr96/vkbacademy/issues/126) · 31 de agosto de 2026

## Problema

En agosto de 2026 se cerró una tanda entera de retención (#84, #85, #87, #88, #89) y no hay
forma de saber si sirvió de algo. Dos consecuencias concretas:

- **#85** (clasificación semanal) se eligió sobre **#86** (objetivo colectivo) asumiendo un
  riesgo explícito: que la franja local desanime a la mitad de abajo. La condición para
  retomar #86 era "si la retención de la mitad inferior empeora". Ese dato no existe.
- **#83**, el único issue abierto, espera "datos de uso reales" para revisar el balance de
  puntos. Nadie los está recogiendo, así que espera indefinidamente.

Lo que sí existe hoy es `User.lastActiveDay` (`"2026-08-14"`, calculado en Europe/Madrid),
que mantiene `updateStreak` dentro de `checkAndAward`. Es **un escalar**: dice cuándo fue la
última vez que un alumno hizo algo, no si volvió al día siguiente. Con un solo valor por
alumno no se pueden calcular cohortes, que es justo lo que hace falta.

También conviene saber que la lógica de rachas ya distingue "es un día nuevo para este
alumno" (`dayChanged`, `challenges.service.ts:57`) y sale sin escribir si no lo es. Existe,
por tanto, un punto exacto donde engancharse que se ejecuta una vez al día y no más.

## Decisiones tomadas

| Decisión | Elegido | Descartado |
| --- | --- | --- |
| Qué cuenta como día activo | **Visita y trabajo, separados**: una fila por (alumno, día) en cuanto hace cualquier petición autenticada, con un flag que se marca si además hizo algo | Solo trabajo (el que abre, mira y se va es invisible — y en un adolescente ese es el primer síntoma); solo visita (mezcla al que volvió a estudiar con el que entró a mirar la tienda) |
| Alcance de la primera versión | **Solo si vuelven**: cohortes semanales con D1 y D7 | El corte arriba/abajo de #85, que se podrá añadir después sobre los mismos datos sin volver a migrar |
| Cómo se captura la visita | **Interceptor global con deduplicación en memoria** | Escribir en cada petición (una consulta para un dato que cambia una vez al día); colgarse de un endpoint concreto (deja de medir en cuanto se reordena la pantalla) |

## Modelo de datos

Tabla nueva, aditiva. No toca ningún modelo existente ni ningún enum — la migración es
segura en PRE y PROD.

```prisma
model UserActivityDay {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  day       String   // "2026-08-31" en Europe/Madrid — mismo formato que User.lastActiveDay
  worked    Boolean  @default(false) // false = solo abrió; true = además hizo algo
  academyId String?
  createdAt DateTime @default(now())

  @@unique([userId, day])
  @@index([day])
}
```

`day` va como texto y no como fecha **a propósito**: reutiliza `madridDay()`, el helper que
ya calcula `User.lastActiveDay`, y evita que la zona horaria se cuele en las comparaciones
—un alumno que estudia a las 00:30 de Madrid pertenece al día de Madrid, no al de UTC—.

`academyId` se rellena desde la membresía del alumno. Es el mismo campo que en
`UserChallenge` quedó siempre a `null` (#81, ya corregido); aquí se escribe desde el primer
día para que las métricas por academia no nazcan vacías.

Volumen: ~1 fila por alumno y día activo. Cien alumnos son 36.000 filas al año.

## Los dos caminos de escritura

**1. Visita — `ActivityInterceptor`, global.**

Los guards corren antes que los interceptores en NestJS, así que `request.user` ya está
resuelto. El interceptor no hace nada si no hay usuario (rutas públicas: marketing,
verificación de certificados) o si no es un STUDENT.

La deduplicación va en un `Map<userId, día>` en memoria: solo se escribe la primera vez que
se ve a ese alumno ese día. La API corre en una sola instancia y Redis no está desplegado en
PROD, así que el `Map` basta. Si Render reinicia, como mucho se repite un `upsert`
idempotente por alumno.

La escritura es `upsert` con `create: { worked: false }` y `update: {}` — un `update` vacío
para no pisar un `worked: true` ya puesto ese día.

**2. Trabajo — dentro de `updateStreak`.**

En la rama `dayChanged` que ya existe (`challenges.service.ts:71-77`), `upsert` con
`worked: true`. No añade ni una consulta en el caso normal: esa rama solo entra la primera
vez que el alumno hace algo cada día.

Ambas escrituras van con `void` y su propio manejo de error, como `checkAndAward`: la
instrumentación **nunca** puede tumbar ni retrasar una petición del alumno.

## Cálculo

Cohorte = semana ISO de alta (`User.createdAt`), solo alumnos con rol STUDENT. Por cohorte:

- **Vuelve al día siguiente (D1)**: tiene fila en el día exacto `alta + 1`.
- **Sigue en la primera semana (D7)**: tiene alguna fila entre `alta + 1` y `alta + 7`.

Cada una en dos versiones, **abrió** y **trabajó**, que salen de la misma fila según el flag.

D7 se define como "alguna vez en la ventana" y no "el día 7 exacto" porque con cohortes de
diez alumnos el día exacto es ruido, no señal.

Una cohorte cuyo plazo aún no ha cerrado (alta hace menos de 1 día para D1, menos de 7 para
D7) se marca como **incompleta** en vez de pintar un porcentaje que solo puede subir.

El cálculo es una **función pura** sobre las filas ya cargadas, para poder testear los casos
límite sin base de datos.

## Superficie

**API**: `GET /admin/analytics/retention`, endpoint propio y no un campo más dentro de
`getAnalytics` — ese método ya hace nueve cosas y devuelve un payload grande. Roles ADMIN y
SUPER_ADMIN, como el resto de `/admin/*`.

Respuesta: una lista de cohortes, de la más reciente a la más antigua, cada una con la
semana, el número de altas, y los cuatro porcentajes (D1 abrió / D1 trabajó / D7 abrió / D7
trabajó) más su marca de completitud.

**Web**: sección **Retención** en `AdminDashboardPage`, junto a "Alumnos en riesgo". Una
tabla con las últimas ~8 cohortes semanales. La página ya consume analytics y ya tiene el
patrón de secciones (`s.section` + `s.sectionTitle`), así que no hace falta pantalla nueva.

## Qué no entra

- **Backfill.** Se podría reconstruir el histórico de "trabajó" desde `UserProgress`,
  `QuizAttempt` y `ExerciseAttempt`, pero hoy no hay datos en PROD que reconstruir. Si algún
  día los hubiera, es un añadido posterior que no obliga a volver a migrar.
- **El corte arriba/abajo de #85.** Decisión explícita: los datos quedan recogidos para
  poder añadirlo cuando haya suficientes semanas que comparar.
- **Cualquier aviso o alerta.** Esto mide; no habla con nadie. Hablar con el alumno es #129.

## Riesgos

- **El `Map` en memoria miente si algún día hay más de una instancia de la API.** Escribiría
  hasta N filas duplicadas por día, pero el `@@unique([userId, day])` las convierte en
  `upsert` idempotentes: el dato sigue siendo correcto, solo se paga alguna consulta de más.
- **Medir la visita depende de que el frontend llame a algo autenticado al abrir.** Hoy lo
  hace (dashboard, retos, cursos), pero si mañana una pantalla se sirviera de caché sin
  tocar la API, ese alumno no contaría como visita. Los tests no pueden protegerlo; queda
  anotado.
- **Un alumno dado de alta y borrado** desaparece de las cohortes por el `onDelete: Cascade`.
  Es coherente con cómo el resto de la app trata el borrado, y preferible a dejar filas
  huérfanas.
