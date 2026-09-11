# Resumen semanal a la familia — diseño

> Issue [#129](https://github.com/oscarsr96/vkbacademy/issues/129) · 31 de agosto de 2026

## Problema

No existe ningún canal para dirigirse a nadie desde la app. `NotificationsService` solo tiene
`sendEmail` y `sendPasswordReset`, y los alumnos autorregistrados no tienen email: solo
`username`. En #87 se descartaron push y correo al tutor por un motivo concreto —**no hay
scheduler**— y se optó por llevar la racha al dashboard.

Esa premisa ya no se sostiene, y por una vía más barata de lo que decía #129:
`.github/workflows/seed-curriculum.yml` **no pega a la API por HTTP**, se conecta directo a
la base de datos con `secrets.DATABASE_URL` y ejecuta `npx ts-node`. Un workflow con
`schedule:` puede hacer lo mismo. No hacen falta endpoint protegido, secreto compartido ni
despertar a Render.

Pero al mirar el código el bloqueo se mueve a otro sitio.

## Lo que el análisis cambió respecto al issue

**1. `guardianEmail` es hoy un dato de solo escritura, recogido sin propósito declarado.**
El formulario lo pide como *"Email del padre, madre o tutor"* y no dice para qué. La pantalla
de confirmación llega a decir, en negrita: *"**No te los enviamos por email** y no se vuelven
a mostrar"* (`RegisterPage.tsx:279`). Y nunca se verifica: `POST /auth/register-students` es
público y acepta hasta 10 alumnos, así que cualquiera puede escribir la dirección de otro.
Empezar a enviar sin más sería correo no solicitado a una dirección sin verificar.

**2. `guardianEmail` es uno por familia, no por alumno.** `registerStudents` escribe el mismo
valor en cada hermano (`auth.service.ts:101`). Un correo por alumno serían tres al mismo
buzón. El propio DTO ya normaliza la dirección (trim + lowercase) y su comentario lo dice:
*"es la única clave que relaciona a los hermanos de una familia"*.

**3. #129 mezclaba dos productos.** Recordar la racha **hoy** al alumno solo lo hace push;
esto le habla al padre, semanalmente, y no salva ninguna racha. Además no hay PWA de ninguna
clase (`apps/web/public` solo tiene marca y favicon), así que push sería montar manifest,
service worker, VAPID, tabla de suscripciones y UX de permiso, con el tope duro de que en iOS
solo llega a quien se instale la web en la pantalla de inicio.

**4. PROD está vacío**, así que no hay direcciones heredadas que migrar: se puede hacer bien
desde el principio.

## Decisiones tomadas

| Decisión | Elegido | Descartado |
| --- | --- | --- |
| Objetivo | **Resumen semanal a la familia** | Push al alumno (es la fase 11 por la puerta de atrás); el entrenador como canal; solo arreglar el consentimiento |
| Consentimiento | **Casilla en el registro, desmarcada, + baja en cada correo** | Doble opt-in (una familia que no confirme no recibe nada nunca); solo declarar propósito (convierte un dato de contacto en suscripción por defecto) |
| Ejecución | **Workflow con `schedule:` + script, como los seeds** | Endpoint protegido por secreto compartido; `@nestjs/schedule` dentro de la API (Render duerme) |

## Modelo

Entidad nueva: `guardianEmail` no es de nadie —está copiado en cada hermano— y hace falta una
fila que represente a la familia y guarde su consentimiento.

```prisma
model GuardianSubscription {
  id             String    @id @default(cuid())
  /// Normalizado (trim + lowercase) igual que en RegisterStudentsDto: es la clave
  /// que agrupa a los hermanos, así que "Padre@X.com" no puede ser otra familia.
  email          String    @unique
  consentAt      DateTime
  unsubscribedAt DateTime?
  /// Permite dar de baja sin cuenta ni login: el tutor no tiene ninguna.
  token          String    @unique
  /// "2026-W36" de la última semana enviada. Si Actions dispara dos veces, la
  /// segunda no envía.
  lastSentWeek   String?
  createdAt      DateTime  @default(now())
}
```

No lleva relación con `User`: la familia se resuelve consultando los alumnos que tienen ese
`guardianEmail`. Atarla con clave foránea obligaría a elegir un hermano como titular.

## Registro

`RegisterStudentsDto` gana `guardianDigestConsent: boolean` (opcional, por defecto `false`).
El formulario declara para qué sirve el email —hoy no lo dice— y añade la casilla
**desmarcada**.

Solo si llega `true` se hace `upsert` de `GuardianSubscription` con `consentAt`. Registrar sin
marcarla no crea nada: el email sigue siendo un dato de contacto, como hasta ahora.

Un segundo registro de la misma familia que marque la casilla reactiva la suscripción
(`unsubscribedAt` a `null`); si no la marca, no toca la que ya hubiera. Dar de alta a otro
hijo no puede ser una forma silenciosa de resucitar una baja, pero tampoco puede cancelarla.

## Baja

- API: `POST /guardians/unsubscribe/:token`, público. Marca `unsubscribedAt`. Idempotente:
  llamarlo dos veces responde lo mismo.
- Web: página pública `/baja/:token` con un botón. Es una página del `PublicLayout`, como la
  verificación de certificados de #113.

**El correo enlaza a la página, nunca al endpoint.** Los escáneres de los clientes de correo
abren los enlaces solos: una baja por `GET` se dispararía sin que nadie la pidiera.

## Envío

La lógica vive **dentro de la API**, como `GuardianDigestService.sendWeeklyDigests()`, para
que sea testeable con Jest como todo lo demás. El script solo arranca un contexto de Nest y
la llama.

- `apps/api/scripts/send-weekly-digest.ts` — con `--dry-run`, igual que los seeds.
- `.github/workflows/weekly-digest.yml` — `schedule:` más `workflow_dispatch` para poder
  lanzarlo a mano, con `DATABASE_URL` y `RESEND_API_KEY` de secretos, como
  `seed-curriculum.yml`.

Lunes por la mañana, en UTC. El cron de Actions no entiende de horario de verano, así que en
invierno llegará una hora antes; es preferible a inventar un scheduler.

Selección: suscripciones con `unsubscribedAt` a `null` y `lastSentWeek` distinto de la semana
actual. Se marca `lastSentWeek` **después** de enviar, para que un fallo a mitad no dé la
semana por enviada.

## Contenido

Un correo por familia, con una sección por hijo:

- Días que trabajó esta semana (de `UserActivityDay`, con `worked: true`).
- Racha diaria actual.
- Certificados obtenidos durante la semana.

**Sin puestos, sin comparaciones con otros alumnos y sin comparar a los hermanos entre sí.**
Es la misma línea que llevó a #85 a construirse en franja local y sin posiciones: el que va
último no puede enterarse de que va último, y menos por un correo a su casa.

Al hijo que no ha entrado en toda la semana se le dedica **una línea neutra y sin juicio**
("esta semana no ha entrado"). Es el dato más útil para un padre y a la vez el que más se
acerca a la vigilancia que #87 quería evitar; la forma de darlo es lo único que separa una
cosa de la otra.

Cada correo lleva el enlace de baja.

## Dependencia

Esto lee `UserActivityDay`, que llega en #126 (PR #131). La rama sale de
`feat/instrumentacion-retencion`, no de `main`: **#131 tiene que entrar primero**.

## Medición

Con #126 se puede comparar la retención de alumnos con familia suscrita y sin ella. Con
honestidad: **el número estará sesgado**, porque la familia que marca la casilla ya es la más
implicada. Sirve para detectar un desastre, no para demostrar una mejora.

## Qué no entra

- **Push y cualquier cosa dirigida al alumno.** Sigue sin haber canal para hablarle a él, y
  este trabajo no lo abre. Conviene que quede escrito para que no se dé por cerrado lo que no
  lo está.
- **Verificación de la dirección.** La casilla es el consentimiento; no se manda un correo de
  confirmación previo.
- **Migrar direcciones existentes.** PROD está vacío. Las que haya en PRE se quedan sin
  suscripción hasta que alguien vuelva a registrarse marcando la casilla.

## Riesgos

- **Alguien escribe la dirección de otra persona** en un formulario público y marca la
  casilla. El enlace de baja de cada correo es la única defensa; sin verificación previa no
  hay otra. Es el precio de haber elegido casilla simple sobre doble opt-in.
- **Resend puede fallar a mitad del envío.** `lastSentWeek` se marca por familia y después de
  enviar, así que un fallo deja a esa familia pendiente y el siguiente disparo la recoge; a
  cambio, un fallo *después* de enviar y antes de marcar duplicaría el correo de esa familia.
  Se prefiere ese riesgo al de perder el envío.
- **El correo habla de un menor a una dirección sin verificar.** Se mitiga con el contenido:
  ningún dato sensible más allá de si estudió y cuánto, y nunca comparaciones.
