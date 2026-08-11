# Fase 1 — Poda de reservas y rol TEACHER

> Diseño validado el 2026-08-11. Primera de dos fases del refactor de simplificación previo a la salida a mercado.

---

## 1. Contexto y objetivo

VKB Academy sale a mercado con **un solo cliente: Vallekas Basket**. El objetivo del refactor no es técnico sino de producto: **recortar la app hasta su núcleo vendible** y, de paso, quitarse de encima el código que ya no sostiene a nadie.

Las clases particulares se eliminan del producto. Con ellas cae toda la maquinaria de reservas, disponibilidad y videollamadas, y el rol `TEACHER` se queda sin nada exclusivo que hacer.

**Objetivo de esta fase:** eliminar reservas y rol `TEACHER` sin tocar ninguna otra funcionalidad, dejando la app compilando y con la suite en verde en cada paso.

### Alcance del refactor completo (contexto)

| Fase | Contenido | Estado |
| ---- | --------- | ------ |
| 1 | Reservas + rol `TEACHER` | este documento |
| 2 | Tutores (padres) + registro abierto con `guardianEmail` | pendiente de diseño |

Explícitamente **fuera** de ambas fases: multi-tenancy (se deja latente) y la unificación del modelo de dominio (dos jerarquías de contenido, tres sistemas de preguntas), que se evaluará más adelante con datos de uso reales.

---

## 2. Decisiones tomadas

| # | Decisión | Razón |
| - | -------- | ----- |
| D1 | Se eliminan las clases particulares del producto | Decisión de negocio |
| D2 | El rol `TEACHER` desaparece del enum `Role` | Sin reservas no le queda ninguna capacidad exclusiva: `Course` no tiene `authorId`, así que la regla "solo en cursos donde sean autor" nunca existió. Lo único que hacía —subir vídeos, listar cursos no publicados, ver resultados de todos— ya lo hace `ADMIN` |
| D3 | Los `User` con rol `TEACHER` existentes **se eliminan** de la BD | Decisión del propietario. Cascada limpia: todas las relaciones de `User` son `onDelete: Cascade` |
| D4 | El módulo de facturación se elimina | `billing.service.ts` calcula coste de minutos de Daily.co y emails por reserva. Sin reservas se queda sin objeto |
| D5 | El modelo `BillingConfig` **se conserva** en el schema | Es una tabla de configuración aislada, sin FK entrantes ni salientes relevantes. Dejarla cuesta cero y evita rehacerla si vuelve el cobro. Revertible: si se prefiere limpieza total, basta añadir su `DROP TABLE` a la misma migración |
| D6 | `SUPER_ADMIN` y `academyId` se quedan intactos | 144 referencias en 63 ficheros y es load-bearing (`Enrollment`, `Redemption`, `UserChallenge`). El cliente es "solo Vallekas **por ahora**": quitarlo hoy y rehacerlo mañana es pagar dos veces |
| D7 | El código se borra antes que el schema, en commits separados | El commit de código es desplegable y reversible por sí solo; el de schema es el punto de no retorno |
| D8 | Volcado previo a JSON, obligatorio | El `DELETE` de usuarios arrastra en cascada su contenido generado. Sin volcado no hay forma de consultar el histórico |

---

## 3. Inventario de cambios

### 3.1 Backend — se borra entero

| Ruta | LOC | Nota |
| ---- | --: | ---- |
| `apps/api/src/bookings/` | 979 | incluye `bookings.service.spec.ts` |
| `apps/api/src/availability/` | 504 | incluye `availability.service.spec.ts` |
| `apps/api/src/daily/` | 247 | solo lo consume `bookings.module.ts`; incluye `daily.service.spec.ts` |
| `apps/api/src/admin/billing.service.ts` | — | D4 |
| `apps/api/src/admin/dto/billing-query.dto.ts` | — | |
| `apps/api/src/admin/dto/update-billing-config.dto.ts` | — | |
| `apps/api/test/e2e/05-bookings.e2e-spec.ts` | — | |

### 3.2 Backend — se modifica

| Fichero | Cambio |
| ------- | ------ |
| `app.module.ts` | Fuera `BookingsModule` y `AvailabilityModule` (imports líneas 13-14, registro 62-63). `DailyModule` no aparece aquí: cuelga de `bookings.module.ts` |
| `admin/admin.module.ts` | Fuera `BillingService` de imports y providers |
| `admin/admin.controller.ts` | Fuera `GET /admin/billing`, `PATCH /admin/billing/config`, sus imports y la inyección en el constructor |
| `notifications/notifications.service.ts` | Fuera `sendBookingCreated`, `sendBookingConfirmed`, `sendBookingCancelled` (~85 de 244 LOC) y sus plantillas HTML |
| `notifications/notifications.service.spec.ts` | Fuera los tests de esos tres métodos |
| `admin/admin-analytics.service.ts` | Fuera los bloques de reservas: `bookingWhere`, `newBookings`, `confirmedBookings`, `cancelledBookings`, `bookingsTimeSeries`, `bookingsByStatus`, `bookingsByMode`, heatmap, `avgBookingLeadDays`, ranking de profesores, y el `count` de usuarios con rol `TEACHER` (línea 513) |
| `admin/admin-users.service.ts` | Fuera la creación automática de `teacherProfile` al dar de alta un `TEACHER` (línea 106) y `TEACHER` de los DTO de rol |
| `admin/dto/create-admin-user.dto.ts` | Fuera `TEACHER` de los valores válidos |
| `courses/courses.controller.ts` | `@Roles` de las líneas 80, 91 y 98: fuera `Role.TEACHER` |
| `courses/courses.service.ts` | Fuera la rama `TEACHER` de la visibilidad de cursos (línea 49) y de `canSeeAllResults` (línea 151), que queda solo para `SUPER_ADMIN` y `ADMIN` |
| `media/media.controller.ts` | `@Roles` líneas 17 y 34: fuera `Role.TEACHER`; actualizar los comentarios |
| `prisma/seed.ts` | Fuera `booking.deleteMany`, `availabilitySlot.deleteMany`, `teacherProfile.deleteMany` (líneas 16-17, 27) y el usuario profesor con su perfil y disponibilidad (líneas 104-109+) |
| `.env.example` | Fuera las claves de Daily.co |

### 3.3 Frontend — se borra entero

| Ruta | LOC |
| ---- | --: |
| `pages/TeacherPortalPage.tsx` | 419 |
| `pages/bookings/` (`StudentView`, `TutorView`, `TeacherView`) | ~1.100 |
| `pages/BookingsPage.tsx` | 23 |
| `pages/admin/AdminBillingPage.tsx` | — |
| `api/bookings.api.ts` | 56 |
| `hooks/useBookings.ts` | — |

### 3.4 Frontend — se modifica

| Fichero | Cambio |
| ------- | ------ |
| `App.tsx` | Fuera rutas `bookings`, `teacher`, `admin/billing` |
| `layouts/AppLayout.tsx` | Fuera la rama `role === Role.TEACHER` (línea 51) y las entradas de menú `Reservas` (línea 19), `Portal Docente` (54) y `Facturación` (31, 45) |
| `pages/DashboardPage.tsx` | Fuera `useMyBookings`, la tarjeta "Próxima reserva" (líneas 258-273), la acción rápida "Mis reservas" (58), y las entradas `TEACHER` de los mapas de rol (18, 25, 55) |
| `pages/admin/AdminDashboardPage.tsx` | Fuera KPIs `newBookings` / `confirmedBookings` / `cancelledBookings`, la serie "Reservas" del gráfico, el bloque `bookings.byStatus` y el heatmap |
| `api/admin.api.ts` | Fuera los tipos `BookingHeatmapCell`, `bookings`, `newBookings`, `confirmedBookings`, `cancelledBookings`, `bookingHeatmap`, `avgBookingLeadDays` |
| `pages/ProfilePage.tsx` | Fuera la etiqueta `TEACHER: 'Profesor'` |
| `pages/admin/AdminUsersPage.tsx` | Fuera `TEACHER` de las etiquetas y colores de rol; fuera del selector de alta |
| `styles/global.css` | Fuera `.role-badge.TEACHER` |
| `utils/errorMessage.ts` | Actualizar el comentario que cita `BookingsPage.tsx` |
| `packages/shared/src/types/user.types.ts` | Fuera `TEACHER` del enum `Role` |

### 3.5 Schema

```prisma
// Se eliminan
model Booking            { ... }
model TeacherProfile     { ... }
model AvailabilitySlot   { ... }
enum  BookingStatus      { ... }
enum  BookingMode        { ... }

// Campos que se eliminan de modelos que permanecen
User.bookingsAsStudent
User.teacherProfile
Course.bookings
Academy.bookings

// Enum que se reduce
enum Role { STUDENT TUTOR ADMIN SUPER_ADMIN }   // TEACHER fuera
```

`TUTOR` permanece: cae en la Fase 2.

---

## 4. Migración de datos

Postgres no permite eliminar un valor de un enum en uso, así que el orden es obligatorio y todo va en una transacción:

```sql
-- 1. Borrado de usuarios profesores (cascada limpia sobre sus 15 relaciones)
DELETE FROM "User" WHERE role = 'TEACHER';

-- 2. Tablas de reservas
DROP TABLE "Booking";
DROP TABLE "AvailabilitySlot";
DROP TABLE "TeacherProfile";

-- 3. Enums huérfanos
DROP TYPE "BookingStatus";
DROP TYPE "BookingMode";

-- 4. Reducción de Role (SQL que genera Prisma)
CREATE TYPE "Role_new" AS ENUM ('STUDENT','TUTOR','ADMIN','SUPER_ADMIN');
ALTER TABLE "User" ALTER COLUMN role TYPE "Role_new" USING (role::text::"Role_new");
DROP TYPE "Role";
ALTER TYPE "Role_new" RENAME TO "Role";
```

**Efecto colateral documentado del paso 1:** borrar un `TEACHER` arrastra en cascada su `TheoryModule`, `AiExamBank`, `StudyPlan`, `TutorMessage`, `QuizAttempt`, `ExamAttempt`, `UserProgress`, `Enrollment`, `Certificate`, `Redemption`, `UserChallenge` y `AcademyMember`. Los **cursos sobreviven** porque no cuelgan de ningún usuario. Si un profesor generó baterías de examen con IA, desaparecen con él.

**Aplicación:** en PRE y PROD por separado (bases distintas), desde los jobs `migrate-pre` y `migrate-prod` del pipeline. Nunca desde el contenedor.

### Volcado previo (obligatorio, D8)

Script de un solo uso que escribe en `data/exports/` (ya en `.gitignore`):

- `bookings-<entorno>-<fecha>.json` — todas las filas de `Booking` con su profesor y alumno resueltos.
- `teachers-<entorno>-<fecha>.json` — los `User` con rol `TEACHER` y un recuento de su contenido dependiente, para saber qué se pierde.

---

## 5. Plan de ejecución

Cuatro pasos, cada uno con su commit y su verificación.

### Paso 0 — Pre-vuelo (solo lectura)

```sql
SELECT role, COUNT(*) FROM "User" GROUP BY role;
SELECT COUNT(*) FROM "Booking";
SELECT COUNT(*) FROM "AvailabilitySlot";
```

Contra PRE y PROD. Ejecutar el volcado a JSON. **Se reportan los números al propietario antes de continuar.**

### Paso 1 — Borrado de código, sin tocar el schema

Todo lo de §3.1 a §3.4. Al terminar, la app ya no usa `Booking` ni `TEACHER`, pero las tablas siguen existiendo.

**Este commit es desplegable por sí solo y se revierte con un `git revert` limpio.**

Verificación:
- `pnpm --filter @vkbacademy/api test` en verde
- `pnpm --filter @vkbacademy/web exec tsc --noEmit` sin errores
- `grep -rniE "booking|teacherprofile|availabilityslot|daily|role\.teacher" apps/api/src apps/web/src packages/shared/src` devuelve cero

### Paso 2 — Schema y migración

Quitar los modelos de `schema.prisma`, generar la migración con `prisma migrate dev` y **editar a mano el SQL** para meter el `DELETE FROM "User"` antes de los `DROP` y garantizar el orden de §4.

**Punto de no retorno. Se avisa al propietario antes de aplicarlo a PROD.**

Verificación:
- `prisma generate` sin errores y la suite de API en verde con el cliente regenerado
- La migración aplica limpia sobre una copia local de la BD

### Paso 3 — Seeds y documentación

- `seed.ts` deja de crear profesor, perfil, disponibilidad y reservas, y de borrarlos al arrancar
- `CLAUDE.md`: matriz de permisos sin `TEACHER`, lista de módulos sin `bookings`/`availability`/`daily`, bloque de endpoints sin reservas ni disponibilidad, namespace `billing` fuera del apartado admin
- `CLAUDE.md`: corregir dos errores preexistentes detectados durante el diseño — el `ChallengeType` documentado está obsoleto (ya no existe `BOOKING_ATTENDED`; los valores reales son `EXERCISE_COMPLETED`, `EXERCISE_SCORE`, `THEORY_COMPLETED`, `EXAM_COMPLETED`, `EXAM_SCORE`, `STREAK_WEEKLY`, `TOTAL_HOURS_EXERCISE`, `TOTAL_HOURS_THEORY`, `TOTAL_HOURS_EXAM`) y la nota "solo en cursos donde estén asignados como autor" describe una regla que no existe
- Daily.co fuera de la tabla de stack y de las variables de entorno

### Paso 4 — Despliegue

Pipeline habitual: `test` → `migrate-pre` → `deploy-pre` → `smoke-pre` → gate → `migrate-prod` → `deploy-prod` → `smoke-prod`.

Verificación manual en PRE antes de cruzar el gate: login como alumno y como admin, recorrer Inicio, Asignaturas, Estudiar, Retos, Perfil y el panel de admin, comprobando que no queda ningún enlace roto ni 404.

---

## 6. Criterios de aceptación

1. Ningún fichero de `apps/api/src`, `apps/web/src` ni `packages/shared/src` menciona `Booking`, `TeacherProfile`, `AvailabilitySlot`, `Daily` ni `Role.TEACHER`.
2. `pnpm --filter @vkbacademy/api test` en verde.
3. `pnpm --filter @vkbacademy/web exec tsc --noEmit` sin errores.
4. `pnpm build` completa en los tres paquetes.
5. El enum `Role` tiene exactamente cuatro valores: `STUDENT`, `TUTOR`, `ADMIN`, `SUPER_ADMIN`.
6. Las tablas `Booking`, `AvailabilitySlot` y `TeacherProfile` no existen en PRE ni en PROD.
7. Existen los volcados JSON en `data/exports/` para PRE y PROD.
8. Los smoke tests de PRE y PROD pasan.
9. Ningún alumno ni admin encuentra un enlace muerto en la navegación.
10. `CLAUDE.md` refleja el estado real: sin reservas, sin `TEACHER`, sin facturación, con el `ChallengeType` correcto.

---

## 7. Riesgos

| Riesgo | Mitigación |
| ------ | ---------- |
| Pérdida irreversible de datos de reservas y de usuarios profesores | Volcado a JSON obligatorio antes de la migración (D8, §4) |
| Un profesor real generó contenido con IA que se borra en cascada | El volcado de `teachers-*.json` incluye el recuento de contenido dependiente; se revisa en el Paso 0 antes de decidir seguir |
| La migración del enum falla si queda alguna fila con `TEACHER` | El `DELETE` va en la misma transacción y antes que el `ALTER TYPE` |
| Restos de código muerto que compilan | El `grep` del criterio 1 es parte de la verificación, no una comprobación opcional |
| Desincronía PRE/PROD | Migraciones aplicadas desde los jobs del pipeline, en ese orden, con gate manual entre PRE y PROD |

---

## 8. Métricas esperadas

| | Antes | Después (aprox.) |
| - | ----: | ----: |
| LOC API (`src`) | 22.404 | ~20.400 |
| LOC Web (`src`) | 32.501 | ~30.900 |
| Modelos + enums en el schema | 42 | 37 |
| Módulos de API | 28 | 25 |
| Rutas de frontend | 33 | 30 |
| Valores del enum `Role` | 5 | 4 |
