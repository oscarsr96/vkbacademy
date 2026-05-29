# Rediseño del modelo de credenciales de alumnos

> Spec de diseño — 2026-05-29
> Estado: validado, pendiente de plan de implementación.

## 1. Problema

Hoy el tutor se registra junto con sus alumnos y, en su panel, puede ver **en claro la contraseña de cada alumno**. Para que esto sea posible, la contraseña del alumno se guarda **cifrada de forma reversible** (`viewablePassword`, AES-256-GCM con `STUDENT_PASSWORD_ENC_KEY`) además del hash bcrypt.

Esto tiene tres problemas distintos:

1. **Pasivo de seguridad**: una contraseña que se puede descifrar nunca debería existir. Si se filtra `STUDENT_PASSWORD_ENC_KEY`, se filtran en claro **todas** las contraseñas de alumnos.
2. **Exposición de credenciales al tutor**: que el tutor vea la contraseña real del alumno no es deseable.
3. (Menor) las contraseñas se generan con `Math.random()`, que no es criptográficamente seguro.

## 2. Decisiones de diseño

Contexto que condiciona el diseño: los alumnos son **mayoritariamente menores sin email propio**. El email del alumno hoy es solo un identificador de login falso (`nombre@vkbacademy.com`). El tutor es quien gestiona el acceso.

- **El tutor sigue creando las cuentas de sus alumnos** (en el registro y, ahora también, después). Esto se mantiene.
- **El identificador de login del alumno pasa a ser un `username` legible** autogenerado (`oscar.sanchez`, con sufijo numérico `oscar.sanchez2` si colisiona). Se elimina el email falso.
- **Cada alumno nace con una contraseña global por defecto** (constante `DEFAULT_STUDENT_PASSWORD`) y el flag `mustChangePassword = true`.
- **En el primer login el alumno está obligado a cambiar la contraseña** antes de poder navegar. La contraseña real la elige el alumno y **nadie más la conoce ni puede verla**.
- **Recuperación** = el tutor pulsa "restablecer", que devuelve la cuenta a la contraseña por defecto y reactiva `mustChangePassword`. No requiere email del alumno ni exponer ninguna contraseña real.
- **Se elimina por completo** el almacenamiento reversible: `viewablePassword`, el endpoint de credenciales, la tabla del panel y `STUDENT_PASSWORD_ENC_KEY`.

### Alternativas descartadas

- **Auto-inscripción del alumno con email del tutor + aprobación**: añade cola de aprobaciones y problema de impostores; innecesario porque el tutor ya monta el roster y los alumnos son menores.
- **Mostrar la contraseña una sola vez al crear/restablecer**: el tutor seguiría teniendo que copiar y pasar un secreto. El flag de cambio obligatorio sobre una contraseña por defecto global es más simple y suficiente.
- **Código de invitación del tutor**: obligaría al alumno a depender de que el tutor le pase algo.

## 3. Trade-off asumido

Existe una ventana entre la creación de la cuenta y el primer login en la que la cuenta tiene la contraseña por defecto (conocida). Se mitiga con:

- Cambio de contraseña **obligatorio** en el primer login.
- Una cuenta recién creada **no tiene datos sensibles** (solo el nombre y el nivel).

Para este contexto (academia, menores, sin datos sensibles en cuentas nuevas) es un riesgo asumible.

## 4. Cambios en el modelo de datos (Prisma)

En `User`:

- **Eliminar** `viewablePassword`.
- **Añadir** `username String? @unique` — identificador de login del alumno.
- **Añadir** `mustChangePassword Boolean @default(false)`.
- **`email` pasa a nullable** (`String? @unique`). Tutores/staff siguen teniendo email; los alumnos no.

## 5. Backend (apps/api)

- **`registerTutor`**: genera `username` por alumno (en vez de email falso), asigna `DEFAULT_STUDENT_PASSWORD` hasheada + `mustChangePassword = true`. Sin generar contraseñas únicas, sin cifrado reversible. Email de bienvenida al tutor: incluye usuario de cada alumno y la instrucción de la contraseña por defecto + cambio obligatorio (no contraseñas reales).
- **Login**: acepta `username` (alumno) o `email` (tutor/staff). La respuesta de auth incluye `mustChangePassword`. La aplicación lo fuerza en dos capas: (1) el frontend redirige a la pantalla de cambio y bloquea la navegación; (2) un guard de backend rechaza cualquier endpoint mutador salvo `POST /auth/change-password` mientras `mustChangePassword` sea `true`.
- **Nuevo `POST /auth/change-password`** (autenticado): valida y fija la nueva contraseña, pone `mustChangePassword = false`.
- **Nuevo `POST /tutors/my-students`** [TUTOR, ADMIN]: crea un alumno bajo el tutor (mismo mecanismo: `username` generado + contraseña por defecto + `mustChangePassword`).
- **Nuevo `POST /tutors/my-students/:id/reset-password`** [TUTOR, ADMIN]: vuelve a `DEFAULT_STUDENT_PASSWORD` + `mustChangePassword = true`.
- **Eliminar**: `GET /tutors/my-students/credentials`, el uso de `CryptoService` para contraseñas, la sincronización de `viewablePassword` en `resetPassword`, y la variable `STUDENT_PASSWORD_ENC_KEY`.
- (Menor) sustituir `Math.random()` por `crypto.randomInt` donde quede generación aleatoria.

Se respetan las reglas duras del proyecto: guards antes de services, DTOs con `class-validator`, `isCorrect` sin afectar, sin tocar `PublicLayout`.

## 6. Frontend (apps/web)

- **RegisterPage**: el hint pasa a explicar que se crea un usuario y que la primera vez entrará con la contraseña por defecto y deberá cambiarla. Tras el registro, se muestra el `username` generado de cada alumno.
- **Eliminar** `StudentCredentialsTable` y su uso. En el panel del tutor, cada alumno tiene:
  - Botón **"Restablecer contraseña"** (confirma "vuelve a la contraseña por defecto", sin mostrar nada).
  - Botón **"Añadir alumno"** a nivel de panel.
- **Nueva pantalla de cambio de contraseña obligatorio**: si el login indica `mustChangePassword`, se redirige aquí y se bloquea la navegación hasta completarla.

## 7. Migración de datos existentes

PROD tiene datos mínimos, así que la migración es directa:

- Backfill de `username` desde el nombre de los alumnos existentes (con resolución de colisiones).
- `mustChangePassword = true` para los alumnos existentes (en el próximo login entran con la contraseña por defecto y la cambian).
- Drop de la columna `viewablePassword`.
- `email` → nullable.

Sin lógica defensiva especial dado el volumen.

## 8. Fuera de alcance

- Cobro/pago del tutor (planificado "dentro de poco", pero no entra en este cambio).
- Auto-inscripción del alumno.
