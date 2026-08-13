# Fase 2 — Fuera tutores, registro por familia

> Diseño validado el 2026-08-12. Segunda y última fase del refactor de simplificación previo a la salida a mercado. La fase 1 está en [`2026-08-11-fase1-poda-reservas-teacher-design.md`](2026-08-11-fase1-poda-reservas-teacher-design.md).

---

## 1. Contexto y objetivo

VKB Academy sale a mercado con un solo cliente, Vallekas Basket. La fase 1 eliminó las clases particulares, la facturación y el rol `TEACHER`. Esta fase elimina el rol `TUTOR`.

**El cambio de fondo es de modelo mental.** Hoy el padre es un usuario de la plataforma: se registra, tiene cuenta, entra, ve un portal con el progreso de sus hijos y les restablece contraseñas. A partir de esta fase **el padre no entra en la plataforma**. Sigue siendo quien da de alta a sus hijos, pero no tiene cuenta: su email queda como dato de contacto en cada alumno.

Después de esta fase quedan **tres roles** (`STUDENT`, `ADMIN`, `SUPER_ADMIN`) y **un único tipo de usuario que usa la app**: el alumno.

**Objetivo:** eliminar el rol `TUTOR` y su portal, sustituir el registro en dos niveles por un registro por familia, y no dejar a ningún alumno sin vía de recuperar su contraseña.

---

## 2. Decisiones tomadas

| # | Decisión | Razón |
| - | -------- | ----- |
| D1 | El padre **no tiene cuenta**. Solo el alumno entra en la plataforma | Decisión del propietario. Simplifica a un único tipo de usuario |
| D2 | El padre sigue siendo **quien registra** a sus hijos, en un formulario multi-alumno | Es lo realista: un alumno de 1º ESO tiene 12 años |
| D3 | El alumno entra con **username**, no con email | Por descarte: si un padre registra a varios hijos, no pueden compartir su email (es único en BD). Cada alumno necesita identificador propio, y el módulo `username` que genera slugs únicos ya existe |
| D4 | El email del padre se guarda como **`guardianEmail`**, un campo string en cada alumno | Sustituye la self-relation `TutorStudents`. Es contacto, no identidad |
| D5 | **El padre elige la contraseña de cada hijo** en el formulario | Decisión del propietario. No hay contraseña compartida por defecto |
| D6 | Los usernames se muestran **en pantalla al terminar el registro**, y no se envía ningún email | Decisión del propietario. Es el único momento en que aparecen |
| D7 | Los `TUTOR` existentes se **migran y luego se borran**: su email se copia al `guardianEmail` de cada hijo antes del `DELETE` | No se pierde el contacto de familias reales y los alumnos conservan cuenta, progreso y username |
| D8 | Se elimina el flujo **`mustChangePassword`** completo | Con contraseña elegida por el padre, nada vuelve a poner el flag a `true`: solo lo activaban `registerTutor` y `tutors.service`, que desaparecen. El admin ya asigna contraseñas reales directamente |
| D9 | Se elimina **`DEFAULT_STUDENT_PASSWORD`** (`'cambiar123'`) | Sin contraseña por defecto que comunicar, queda huérfana |
| D10 | Se elimina **`POST /auth/register`** (alumno suelto con email) | Nadie lo llama desde la web. Dos caminos de alta son dos cosas que mantener |
| D11 | Se elimina **`sendTutorWelcomeWithStudents`** | Sin envío de credenciales no tiene función. `NotificationsService` queda con `sendEmail` y `sendPasswordReset` |
| D12 | **Se construye** un reset de contraseña de alumno para el admin | Sin él, un alumno que olvida su contraseña no tiene ninguna vía de recuperación: no tiene email y ya no hay tutor que se la restablezca |
| D13 | `guardianEmail` se guarda **aunque hoy no lo consuma nada** | La academia necesita saber de qué familia es cada alumno. Decisión consciente: no hay notificaciones y se descartó enviar credenciales, así que el campo nace sin lector automático |
| D14 | Multi-tenancy, dominio y los siete issues de la fase 1 quedan **fuera** | Mismo criterio que en la fase 1 |
| D15 | El panel de admin pasa a **mostrar el username** y a permitir buscar por él | Hoy no lo muestra ni lo devuelve la API. Si el admin es la única vía de recuperación, tiene que poder ver lo que recupera (§3) |

---

## 3. El agujero que esta fase abre y cómo se tapa

Merece sección propia porque es el único riesgo funcional del cambio.

Los alumnos se crean **sin email**: solo `username` (`auth.service.ts`, creación de estudiantes). Y `forgotPassword` busca por email (`auth.service.ts:264`). Es decir: **un alumno nunca ha podido recuperar su contraseña por sí mismo.** Hoy no importa porque el tutor tiene un botón que se la restablece (`tutors.service.ts:92`, `resetStudentPassword`).

Ese botón desaparece con el módulo de tutores, y el padre ya no tendrá cuenta desde la que pulsarlo. Sin nada a cambio, esta fase deja a los alumnos encerrados fuera.

**Solución (D12):** un endpoint nuevo y un botón en el panel de admin.

```
PATCH /admin/users/:id/password          [ADMIN, SUPER_ADMIN]
  { password }
  → { message }
```

Se construye **antes** de podar el módulo de tutores, para que la vía de recuperación exista en todo momento y no haya una ventana sin ninguna.

**Y falta una segunda mitad (D15): el admin tampoco ve los usernames.** `getUsers` no selecciona el campo `username` y `AdminUsersPage` no lo muestra en ninguna parte. Como los usernames solo aparecen una vez, en la pantalla de confirmación del registro (D6), si el padre la cierra sin apuntarlos **hoy no habría forma de recuperarlos salvo consultando la base de datos a mano**.

Convertir al admin en la única vía de recuperación exige que pueda ver lo que recupera. Por tanto, en la misma tarea:

- `admin-users.service.ts` añade `username` al `select` de `getUsers`.
- `AdminUsersPage` lo muestra en la ficha de cada alumno, junto al botón de restablecer contraseña.
- `AdminUsersParams` permite buscar por `username`, no solo por nombre y email — hoy `getUsers` filtra el `search` sobre `name` y `email`, así que un alumno sin email solo se puede encontrar por nombre.

---

## 4. Inventario de cambios

### 4.1 Se borra entero (~3.700 LOC)

| Backend | LOC |
| ------- | --: |
| `apps/api/src/tutors/` | 1.058 |
| `apps/api/src/auth/auth-register-tutor.service.spec.ts` | 510 |
| `apps/api/src/auth/interceptors/must-change-password.interceptor.ts` | 36 |
| `apps/api/src/auth/decorators/allow-when-must-change.decorator.ts` | 5 |
| `apps/api/src/admin/dto/assign-tutor.dto.ts` | 7 |
| `apps/api/test/e2e/14-tutors.e2e-spec.ts` | 233 |

| Frontend | LOC |
| -------- | --: |
| `apps/web/src/pages/TutorStudentsPage.tsx` | 967 |
| `apps/web/src/components/tutor/StudentAccessPanel.tsx` | 182 |
| `apps/web/src/pages/ChangePasswordPage.tsx` | 118 |
| `apps/web/src/api/tutors.api.ts` | 119 |
| `apps/web/src/hooks/useTutors.ts` | 17 |

### 4.2 Se modifica

| Fichero | Cambio |
| ------- | ------ |
| `auth/auth.service.ts` | Fuera `registerTutor` (86 líneas) y `register`. Nuevo `registerStudents`. Fuera los `mustChangePassword` de los flujos de contraseña |
| `auth/auth.controller.ts` | Fuera `POST /register` y `POST /register-tutor`. Nuevo `POST /register-students` |
| `auth/auth.constants.ts` | Fuera `DEFAULT_STUDENT_PASSWORD`. Si queda vacío, borrar el fichero |
| `auth/dto/` | Fuera `register.dto.ts` y `register-tutor.dto.ts`. Nuevo `register-students.dto.ts` |
| `auth/auth.module.ts` | Desregistrar el interceptor de `mustChangePassword` |
| `notifications/notifications.service.ts` | Fuera `sendTutorWelcomeWithStudents` y su plantilla |
| `admin/admin.controller.ts` | Fuera `PATCH users/:id/tutor` y su import. Nuevo `PATCH users/:id/password` |
| `admin/admin-users.service.ts` | Fuera `assignTutor`. Nuevo `resetPassword`. Fuera `tutorId` de `createUser`. Añadir `username` al `select` de `getUsers` y al filtro `search` (D15) |
| `admin/admin-analytics.service.ts` | Fuera `totalTutors` de la desestructuración **posicional** del `Promise.all` (línea 332), su consulta (340) y la clave `tutors` del retorno (351) |
| `admin/dto/create-admin-user.dto.ts` · `update-role.dto.ts` | `TUTOR` fuera de las listas `@IsIn` |
| `courses/courses.controller.ts` | `@Roles` sin `Role.TUTOR` |
| `courses/courses.service.ts` | Fuera la rama `TUTOR` de `assertCanViewStudentProgress` y del filtrado de visibilidad |
| `academies/academies.service.ts:136` | Fuera la referencia a `Role.TUTOR` |
| `prisma/seed.ts` | Deja de crear el tutor y de asignarle hijos. **Está fuera del typecheck**: no dará error de compilación, reventará en ejecución |
| `apps/web/src/pages/RegisterPage.tsx` | **Reescrita** (ver §5) |
| `apps/web/src/App.tsx` | Fuera rutas `tutor/students` y `change-password` y sus imports |
| `apps/web/src/layouts/AppLayout.tsx` | Fuera la rama `Role.TUTOR` (15), la redirección por `mustChangePassword` (66), y `Role.TUTOR` de la condición que monta `TutorWidget` (189) |
| `apps/web/src/pages/DashboardPage.tsx` | Fuera las ramas de `TUTOR`, el import de `tutors.api` y las etiquetas de rol |
| `apps/web/src/pages/admin/AdminUsersPage.tsx` | Fuera `TUTOR` de etiquetas, colores y selector, y la UI de asignar tutor. Nuevo botón de restablecer contraseña y visualización del `username` (D15) |
| `apps/web/src/pages/ProfilePage.tsx` · `styles/global.css` | Fuera etiqueta y badge de `TUTOR` |
| `apps/web/src/hooks/useAuth.ts` | Fuera las tres redirecciones por `mustChangePassword` y `useRegisterTutor`/`useRegister` |
| `apps/web/src/api/admin.api.ts` | Fuera `tutors` de `AdminMetrics` y las funciones de asignar tutor. Nueva función de reset |
| `packages/shared/src/types/user.types.ts` | Fuera `tutorId`, `tutor` y `mustChangePassword`. Nuevo `guardianEmail`. `Role` a tres valores |
| `CLAUDE.md` · `README.md` | Matriz de permisos, roles, endpoints y flujo de alta |

### 4.3 Schema

```prisma
model User {
  // fuera
  tutorId            String?
  tutor              User?   @relation("TutorStudents", ...)
  students           User[]  @relation("TutorStudents")
  mustChangePassword Boolean @default(false)
  // entra
  guardianEmail      String?   // contacto del padre/madre; sin lector automático (D13)
}

enum Role { STUDENT ADMIN SUPER_ADMIN }
```

---

## 5. El registro nuevo

**Contrato**

```
POST /auth/register-students          público
  {
    guardianEmail: string,
    academySlug?: string,
    students: [{ name: string, schoolYearId: string, password: string }]
  }
  → { students: [{ name: string, username: string, schoolYear: string | null }] }
```

**No devuelve tokens.** Nadie inicia sesión al registrarse: el padre no tiene cuenta y los alumnos entran después con su username. Es un cambio deliberado de semántica respecto a los dos endpoints que sustituye, y la razón por la que no se llama `register`.

**Reglas**
- Los usernames se generan con el módulo `username` ya existente, que resuelve colisiones con sufijo. Debe garantizar unicidad **también entre hermanos del mismo formulario**.
- Cada alumno recibe la contraseña que su padre escribió, hasheada por separado. Mínimo 8 caracteres, igual que el resto del sistema.
- Todo en una transacción: o se crean todos los hermanos o ninguno.
- Cada alumno recibe su `AcademyMember` según `academySlug`, como hoy.

**Pantalla de confirmación.** Al terminar, `RegisterPage` muestra el username de cada hijo. Es el **único** momento en que aparecen: no se envían por email (D6). La pantalla debe decirlo explícitamente y ofrecer copiarlos. Si el padre la cierra sin apuntarlos, la recuperación pasa por pedírselos al admin, que podrá verlos en su panel gracias a D15.

---

## 6. Migración de datos

**Pre-vuelo.** Contra PRE y PROD:

```sql
SELECT role, COUNT(*) FROM "User" GROUP BY role;
SELECT COUNT(*) FROM "User" WHERE role = 'STUDENT' AND "tutorId" IS NOT NULL;
SELECT COUNT(*) FROM "User" WHERE role = 'STUDENT' AND "tutorId" IS NULL;
```

La tercera importa: esos alumnos se quedarán **sin `guardianEmail`**, y hay que saber cuántos son antes de dar el paso.

**Volcado previo obligatorio y completo** — a diferencia de la fase 1, aquí hay datos de familias reales: cada tutor con su email y la lista de hijos que cuelgan de él.

**Orden**, en una transacción:

```sql
-- 1. Rescatar el contacto ANTES de borrar a nadie
UPDATE "User" s SET "guardianEmail" = t.email
  FROM "User" t
  WHERE s."tutorId" = t.id AND t.role = 'TUTOR';

-- 2. Ahora sí, borrar los tutores (cascada limpia sobre su contenido)
DELETE FROM "User" WHERE role = 'TUTOR';

-- 3. Columnas
ALTER TABLE "User" DROP COLUMN "tutorId";
ALTER TABLE "User" DROP COLUMN "mustChangePassword";

-- 4. Enum (patrón de Prisma, al final)
CREATE TYPE "Role_new" AS ENUM ('STUDENT','ADMIN','SUPER_ADMIN');
ALTER TABLE "User" ALTER COLUMN role DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN role TYPE "Role_new" USING (role::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";
ALTER TABLE "User" ALTER COLUMN role SET DEFAULT 'STUDENT';
```

**Si el `UPDATE` va después del `DELETE`, el email de cada familia se pierde para siempre.** Es la dependencia de orden crítica de esta fase.

**Lo que se lleva la cascada:** los tutores tienen el chat de IA disponible (`AppLayout` monta `TutorWidget` para `STUDENT` y `TUTOR`), así que pueden tener filas de `TutorMessage`; también `AcademyMember` y cualquier `Enrollment` propio. Todo cae con ellos. **Los alumnos sobreviven**: conservan cuenta, progreso, certificados y username, y solo pierden el puntero al padre, que pasa a ser un string.

**Aplicación:** PRE y PROD por separado, desde los jobs `migrate-pre` y `migrate-prod`. Nunca desde el contenedor. La migración va **en una sola transacción** y el bloque del enum debe quedar **al final**, porque su `COMMIT` cierra la transacción envolvente que Prisma abre: nada puede ir después.

---

## 7. Plan de ejecución

Mismo esquema que funcionó en la fase 1: **todo el código primero con el schema intacto**, migración al final como único punto de no retorno.

1. **Pre-vuelo y volcado.** Reportar los números al propietario antes de seguir.
2. **Reset de contraseña por el admin**, con TDD. Va primero para que nunca exista una ventana sin vía de recuperación.
3. **Registro nuevo**: `registerStudents` en backend con tests de contrato, y `RegisterPage` reescrita con su pantalla de confirmación.
4. **Poda del rol `TUTOR`**: módulo, portal, guards, DTOs, menú, analítica, tipos compartidos.
5. **Poda de `mustChangePassword`** y satélites.
6. **Schema, migración y seed** en la misma tarea (el seed está fuera del typecheck).
7. **Documentación.**
8. **Despliegue** con gate manual antes de PROD.

Cada paso termina con `pnpm --filter @vkbacademy/api test`, `pnpm --filter @vkbacademy/web exec tsc --noEmit` y un barrido de restos.

### Cuatro lecciones de la fase 1 que se aplican aquí

1. **`admin-analytics.service.ts` desestructura un `Promise.all` por posición.** Quitar la consulta de `totalTutors` sin quitar su nombre —o al revés— asigna datos a la variable equivocada **sin error de compilación y sin test rojo**. En la fase 1 fue el punto donde estuvieron a punto de colarse dos bugs. Hay que contar nombres y consultas después de editar.
2. **`apps/web/src/api/*.ts` declara los contratos a mano**, sin derivarlos del backend. `tsc` en verde **no** prueba que frontend y backend coincidan: el desajuste solo aparece en runtime. Comparar clave por clave.
3. **Los greps acotados se quedan cortos.** En la fase 1 se escaparon `tutors.service.ts`, `env.schema.ts`, un e2e y medio README, siempre por acotar la búsqueda a los directorios sospechosos. El barrido va sobre todo el repo.
4. **`prisma/seed.ts` está excluido del typecheck** (`apps/api/tsconfig.json`). Crea el tutor y le asigna hijos; al reducir el enum no dará error de compilación, reventará en ejecución. Va en la misma tarea que el schema.

---

## 8. Criterios de aceptación

1. Ningún fichero de `apps/api/src`, `apps/web/src` ni `packages/shared/src` menciona `Role.TUTOR`, `tutorId`, `mustChangePassword`, `DEFAULT_STUDENT_PASSWORD` ni `registerTutor`.
2. El enum `Role` tiene exactamente tres valores: `STUDENT`, `ADMIN`, `SUPER_ADMIN`, y coincide en Prisma y en `packages/shared`.
3. `User` tiene `guardianEmail` y no tiene `tutorId` ni `mustChangePassword`.
4. `POST /auth/register-students` crea N alumnos en una transacción, con usernames únicos entre sí, contraseñas independientes, y devuelve los usernames **sin** tokens.
5. `PATCH /admin/users/:id/password` restablece la contraseña de un alumno y está restringido a `[ADMIN, SUPER_ADMIN]`.
5b. `AdminUsersPage` muestra el `username` de cada alumno y permite buscar por él.
6. Todo alumno que tuviera `tutorId` conserva el email de su padre en `guardianEmail`.
7. `pnpm --filter @vkbacademy/api test` en verde y `pnpm --filter @vkbacademy/web exec tsc --noEmit` sin errores.
8. `pnpm build` completa en shared, api y web.
9. `prisma migrate reset --force` reconstruye y siembra sin errores.
10. Un padre puede registrar a dos hijos, ver sus dos usernames en pantalla, y cada hijo entrar con su username y su contraseña.
11. Un admin puede restablecer la contraseña de un alumno y el alumno entra con la nueva.
12. `CLAUDE.md` y `README.md` describen tres roles y el flujo de alta real.

---

## 9. Riesgos

| Riesgo | Mitigación |
| ------ | ---------- |
| Perder el email de las familias | El `UPDATE` va antes del `DELETE`, en la misma transacción (§6), y hay volcado previo completo |
| Dejar a los alumnos sin recuperar contraseña | El endpoint de admin se construye **antes** de podar el módulo de tutores (§7 paso 2) |
| Alumnos sin `tutorId` que se queden sin contacto | Se cuentan en el pre-vuelo y se reportan antes de migrar |
| Cruce silencioso en el `Promise.all` de analytics | Recuento explícito de nombres y consultas, documentado en la revisión |
| Desajuste de contrato frontend/backend invisible a `tsc` | Comparación clave por clave del registro y de `AdminMetrics` |
| El padre cierra la pantalla sin apuntar los usernames | La pantalla lo advierte y ofrece copiarlos; el admin puede consultarlos después |
| El seed revienta en ejecución tras reducir el enum | Va en la misma tarea que el schema, con `migrate reset --force` como verificación |

---

## 10. Métricas esperadas

| | Antes | Después (aprox.) |
| - | ----: | ----: |
| LOC API (`src`) | ~20.400 | ~18.600 |
| LOC Web (`src`) | ~29.300 | ~27.800 |
| Módulos de API | 25 | 24 |
| Rutas de frontend | 30 | 28 |
| Valores del enum `Role` | 4 | 3 |
| Roles que usan la app | 2 (alumno, padre) | 1 (alumno) |
