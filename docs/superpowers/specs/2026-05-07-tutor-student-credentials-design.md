# Tutor sees student credentials in dashboard

> Diseño aprobado el 2026-05-07. Topic: que el tutor pueda ver las credenciales (email + contraseña en plano) de cada uno de sus alumnos en una tabla persistente dentro de su dashboard.

---

## 1. Contexto

Hoy, cuando un tutor se registra vía `POST /auth/register-tutor` (`auth.service.ts:104`):

1. Aporta sus datos + nombres de los alumnos.
2. El sistema autogenera email único (slug del nombre) y contraseña aleatoria de 8 caracteres por alumno.
3. Las contraseñas se hashean con bcrypt y se almacenan en `User.passwordHash`.
4. `sendTutorWelcomeWithStudents` envía un único email al tutor con todas las credenciales (las del tutor y las de cada alumno).
5. Tras eso, el plano se pierde: solo queda el hash bcrypt en BD.

Si el tutor pierde ese email, no puede recuperar las credenciales de sus alumnos: tiene que pedir un reset por email para cada uno.

---

## 2. Objetivo

El tutor debe ver, **en cualquier momento**, una tabla en su dashboard con una fila por alumno mostrando:

- Nombre
- Email (autogenerado)
- Contraseña en plano

Las credenciales deben permanecer disponibles aunque el tutor cierre sesión, refresque, o vuelva semanas después.

---

## 3. Decisión de seguridad asumida

Almacenar contraseñas de alumnos en una forma **recuperable** (cifrado reversible, no hash).

- Justificación: los alumnos son menores; los tutores (padres) son responsables de gestionar el acceso de sus hijos a la app y necesitan poder consultarlas en cualquier momento.
- Riesgo aceptado: una filtración de la BD + de la clave de cifrado expone todas las contraseñas de alumnos en plano. Mitigación: clave en variable de entorno separada, nunca commiteada.
- Alcance acotado: **solo** alumnos (`role = STUDENT`) con `tutorId != null`. Tutores, profesores y admins nunca tienen contraseña recuperable.

---

## 4. Modelo de datos

### Cambio en Prisma

```prisma
model User {
  // ...campos existentes
  viewablePassword String?  // AES-256-GCM, solo poblado para STUDENT con tutorId
}
```

- Tipo: `String?` (nullable). `null` para todos los usuarios que no son alumnos con tutor.
- Formato del valor: `iv:authTag:ciphertext` en hex (todo concatenado con `:`).
- Migración Prisma: `pnpm --filter @vkbacademy/api prisma migrate dev --name add_user_viewable_password`.

### Estado para alumnos preexistentes

Los alumnos creados antes de esta feature tendrán `viewablePassword = null`. Estrategia de UI: la tabla muestra "—" en la columna contraseña con un botón "Restablecer" que dispara el flujo `forgotPassword` para ese alumno (envía email al tutor con un link de reset).

---

## 5. Cifrado: `CryptoService`

Nuevo módulo `apps/api/src/crypto/`:

```
crypto/
├── crypto.module.ts
├── crypto.service.ts
└── crypto.service.spec.ts
```

### API

```ts
class CryptoService {
  encrypt(plain: string): string; // devuelve "iv:authTag:ciphertext" hex
  decrypt(payload: string): string; // throws si auth tag inválido
}
```

### Detalles

- Algoritmo: AES-256-GCM (autenticado, detecta manipulación).
- Clave: `STUDENT_PASSWORD_ENC_KEY` en env, 32 bytes (64 hex chars).
  - Validar al arrancar: si falta o longitud incorrecta, fallar con mensaje claro.
- IV: 12 bytes random por cada operación de `encrypt`.
- Auth tag: 16 bytes, almacenado junto al ciphertext.

### Variable de entorno nueva

Añadir a `apps/api/.env.example`:

```env
STUDENT_PASSWORD_ENC_KEY="<openssl rand -hex 32>"
```

Documentar en `CLAUDE.md` sección 9.

---

## 6. Puntos de actualización en backend

Tres flujos hoy mutan la contraseña de un usuario. Todos deben sincronizar `viewablePassword` cuando el target es un alumno con tutor.

### 6.1 `auth.service.ts:registerTutor` — creación inicial

Línea ~143 (`createdStudents`): tras `bcrypt.hash`, cifrar con `CryptoService.encrypt(plainPassword)` y guardar en `viewablePassword`.

### 6.2 `auth.service.ts:resetPassword` — flujo "olvidé mi contraseña"

Si el usuario afectado tiene `role === 'STUDENT'` y `tutorId != null`, actualizar `viewablePassword` además de `passwordHash`. En cualquier otro caso, dejar `viewablePassword` intacto.

### 6.3 `admin.service.ts:updateUser` — admin cambia password

Misma regla que en 6.2. Si `dto.password` viene definido y el usuario target es alumno con tutor, sincronizar.

### 6.4 No hay flujo "el alumno cambia su propia contraseña"

Confirmado: hoy no existe endpoint público para que un alumno cambie su contraseña sin pasar por el flujo de reset. No hay nada que hacer aquí.

---

## 7. API nueva

### Endpoint

```
GET /tutors/my-students/credentials
```

- Auth: JWT requerido. Roles permitidos: `TUTOR`, `ADMIN`, `SUPER_ADMIN`.
- Filtrado:
  - `TUTOR`: solo devuelve alumnos donde `tutorId === currentUser.id`.
  - `ADMIN`: solo alumnos cuyo `tutorId` esté en su academia.
  - `SUPER_ADMIN`: todos los alumnos con tutor.
- Response:
  ```ts
  {
    students: Array<{
      id: string;
      name: string;
      email: string;
      password: string | null; // null si viewablePassword es null (alumno preexistente)
    }>;
  }
  ```

### Implementación

- Controlador: `tutors.controller.ts` añade método `getMyStudentsCredentials()`.
- Servicio: `tutors.service.ts` añade método `getStudentsCredentials(tutor: User)`.
  - Carga alumnos con `viewablePassword` incluido en la query.
  - Para cada alumno con `viewablePassword != null`, descifra con `CryptoService.decrypt`.
  - Si la descifra falla (clave rotada, datos corruptos), devuelve `password: null` y loguea warning.

---

## 8. Frontend

### Página/sección

Nueva sección en el dashboard del tutor: **"Credenciales de mis alumnos"**. Ubicación: añadir a `apps/web/src/pages/tutor/` (mirar layout actual del tutor para ver si hay un dashboard existente o si va como ruta separada).

### Componente

`StudentCredentialsTable` con tabla:

| Nombre | Email    | Contraseña          | Acciones      |
| ------ | -------- | ------------------- | ------------- |
| Pepe   | pepe@... | `aB3xY7Q9` 📋       | —             |
| Ana    | ana@...  | — _(no disponible)_ | [Restablecer] |

- Click en 📋 copia al portapapeles.
- Botón "Restablecer" dispara `POST /auth/forgot-password` con el email del alumno y muestra confirmación.
- Aviso visible: "Estas credenciales son privadas. No las compartas en sitios públicos."

### Data fetching

- React Query hook `useStudentCredentials()` → llama a `GET /tutors/my-students/credentials`.
- Cache stale time: 0 (siempre fresh, son sensibles).
- No persistir en localStorage.

---

## 9. Tests

### Backend

- `crypto.service.spec.ts`:
  - `encrypt + decrypt` round-trip preserva el plaintext.
  - Detecta manipulación: alterar 1 byte del ciphertext lanza error de auth.
  - Falla si la clave en env tiene longitud incorrecta.
  - Distintos `iv` para llamadas sucesivas con el mismo plaintext (no determinista).

- `auth.service.spec.ts` actualizado:
  - `registerTutor` ahora guarda `viewablePassword` cifrada para cada alumno.
  - `resetPassword` actualiza `viewablePassword` cuando target es STUDENT con tutor.
  - `resetPassword` NO toca `viewablePassword` cuando target es TUTOR/TEACHER/ADMIN.

- `admin.service.spec.ts` actualizado:
  - `updateUser` con `password` actualiza `viewablePassword` si target es STUDENT con tutor.
  - `updateUser` con `password` NO toca `viewablePassword` para otros roles.

- `tutors.service.spec.ts`:
  - `getStudentsCredentials` devuelve solo alumnos del tutor.
  - Descifra correctamente.
  - Si `viewablePassword` es null, devuelve `password: null`.
  - Si descifra falla, loguea warning y devuelve `password: null`.

### Frontend

- Smoke type-check con `pnpm --filter @vkbacademy/web exec tsc --noEmit`.

---

## 10. Lista de archivos a tocar

**Nuevos:**

- `apps/api/src/crypto/crypto.module.ts`
- `apps/api/src/crypto/crypto.service.ts`
- `apps/api/src/crypto/crypto.service.spec.ts`
- `apps/api/prisma/migrations/<timestamp>_add_user_viewable_password/migration.sql`
- `apps/web/src/components/tutor/StudentCredentialsTable.tsx`

**Modificados:**

- `apps/api/prisma/schema.prisma` (añade `viewablePassword`)
- `apps/api/src/auth/auth.service.ts` (3 puntos: registerTutor, resetPassword)
- `apps/api/src/auth/auth.service.spec.ts`
- `apps/api/src/admin/admin.service.ts` (updateUser)
- `apps/api/src/admin/admin.service.spec.ts`
- `apps/api/src/tutors/tutors.controller.ts`
- `apps/api/src/tutors/tutors.service.ts`
- `apps/api/src/tutors/tutors.service.spec.ts`
- `apps/api/src/app.module.ts` (registrar CryptoModule)
- `apps/api/.env.example`
- `apps/web/src/api/tutors.api.ts`
- `apps/web/src/pages/tutor/...` (añadir sección o ruta)
- `CLAUDE.md` sección 9 (documentar nueva env var)

---

## 11. Riesgos y mitigaciones

| Riesgo                                               | Mitigación                                                                  |
| ---------------------------------------------------- | --------------------------------------------------------------------------- |
| Filtración BD + clave → exposición masa de passwords | Clave separada del backup BD, no commiteada, rotable.                       |
| Pérdida/rotación de la clave                         | Documentar en runbook. Alumnos sin descifrar verán "—" + botón restablecer. |
| Devolver passwords por error a otro tutor            | Test específico verifica filtrado por `tutorId`.                            |
| Logs accidentales con plaintext                      | Nunca loguear el plaintext descifrado, ni en error paths.                   |
| Cambio de password olvida sincronizar                | Cobertura de tests obligatoria en los 3 flujos.                             |

---

## 12. Fuera de alcance (no en esta feature)

- Endpoint para que el tutor regenere manualmente la contraseña de un alumno (futuro).
- Auditoría de quién consulta credenciales (futuro).
- Rotación automática de la clave de cifrado (futuro).
- Migración masiva de alumnos preexistentes (descartado: usamos botón "Restablecer" individual).
