# Fase 1 — Poda de reservas y rol TEACHER · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar de VKB Academy las clases particulares (reservas, disponibilidad, Daily.co), el módulo de facturación y el rol `TEACHER`, dejando la app compilando y con la suite en verde tras cada tarea.

**Architecture:** Poda en tres bloques secuenciales. Primero se borra **todo el código** que consume las tablas condenadas, mientras el schema sigue intacto: en ese punto la app funciona igual pero ya no toca `Booking` ni `TEACHER`, y el conjunto es reversible con un `git revert`. Después se aplica la **migración destructiva** de Postgres, que es el punto de no retorno. Por último se ajustan seeds y documentación. Dentro del bloque de código, el backend va antes que el frontend porque el frontend depende de tipos de `packages/shared`, que se limpia el último.

**Tech Stack:** NestJS + Prisma + PostgreSQL 16 (API) · React 18 + Vite + React Query (web) · Jest (unit y e2e) · pnpm workspaces + Turborepo.

**Spec:** [`docs/superpowers/specs/2026-08-11-fase1-poda-reservas-teacher-design.md`](../specs/2026-08-11-fase1-poda-reservas-teacher-design.md)

## Global Constraints

- TypeScript `strict: true`. Sin `any` salvo justificación explícita en comentario.
- Nombres de código en inglés; comentarios en español.
- Usar siempre `pnpm --filter @vkbacademy/api` y `pnpm --filter @vkbacademy/web` (nombres con scope).
- Estilo de commit del repo: `refactor(scope): …`, `chore(scope): …`, `docs(scope): …`. Nunca mezclar estilos.
- **Nunca `--no-verify`** ni saltarse hooks de git.
- Las migraciones **no** corren en el contenedor: se aplican desde los jobs `migrate-pre` / `migrate-prod` del pipeline.
- No crear ficheros `.md` fuera de los que este plan indica explícitamente.
- Rama de trabajo: `refactor/fase1-poda-reservas` (ya creada, con el spec commiteado).
- `TUTOR` **permanece** en todo este plan. Es la Fase 2. Cualquier referencia a `Role.TUTOR`, `tutorId`, `tutors.api.ts`, `TutorStudentsPage` o `apps/api/src/tutors/` se deja intacta.
- El **tutor IA** (`apps/api/src/tutor/`, `TutorMessage`, `TutorWidget.tsx`, `tutor.types.ts`) no se toca en ninguna tarea. Es funcionalidad que se queda.

---

## File Structure

**Se borran (ficheros completos)**

| Ruta | Responsabilidad que desaparece |
| ---- | ------------------------------ |
| `apps/api/src/bookings/` | CRUD de reservas, confirmación y cancelación |
| `apps/api/src/availability/` | Franjas horarias recurrentes de profesor |
| `apps/api/src/daily/` | Creación y borrado de salas Daily.co |
| `apps/api/src/admin/billing.service.ts` | Informe de ingresos y costes |
| `apps/api/src/admin/dto/billing-query.dto.ts` | Rango de fechas del informe |
| `apps/api/src/admin/dto/update-billing-config.dto.ts` | Tarifas configurables |
| `apps/api/test/e2e/05-bookings.e2e-spec.ts` | e2e de reservas |
| `apps/api/test/e2e/11-availability.e2e-spec.ts` | e2e de disponibilidad |
| `apps/api/prisma/dump-legacy.ts` | *(temporal — se crea en Task 1 y se borra en Task 11)* |
| `apps/web/src/pages/TeacherPortalPage.tsx` | Portal del profesor (agenda) |
| `apps/web/src/pages/BookingsPage.tsx` | Router por rol de la vista de reservas |
| `apps/web/src/pages/bookings/` | `StudentView`, `TutorView`, `TeacherView` |
| `apps/web/src/pages/admin/AdminBillingPage.tsx` | Pantalla de facturación |
| `apps/web/src/api/bookings.api.ts` | Cliente HTTP de reservas |
| `apps/web/src/hooks/useBookings.ts` | Hooks React Query de reservas |
| `packages/shared/src/types/booking.types.ts` | Tipos `Booking`, `AvailabilitySlot`, enums |

**Se modifican**

| Ruta | Cambio |
| ---- | ------ |
| `apps/api/src/app.module.ts` | Desregistrar `BookingsModule`, `AvailabilityModule` |
| `apps/api/src/admin/admin.module.ts` | Quitar `BillingService` |
| `apps/api/src/admin/admin.controller.ts` | Quitar 2 endpoints de billing |
| `apps/api/src/admin/admin-analytics.service.ts` | Quitar métricas de reservas y profesores |
| `apps/api/src/admin/admin-users.service.ts` | Quitar creación de `teacherProfile` |
| `apps/api/src/admin/admin-users.service.spec.ts` | Quitar 2 tests de `TeacherProfile` |
| `apps/api/src/admin/dto/create-admin-user.dto.ts` | Restringir roles válidos |
| `apps/api/src/notifications/notifications.service.ts` | Quitar 3 métodos de email |
| `apps/api/src/notifications/notifications.service.spec.ts` | Quitar 6 tests |
| `apps/api/src/courses/courses.controller.ts` | Quitar `Role.TEACHER` de 3 `@Roles` |
| `apps/api/src/courses/courses.service.ts` | Quitar rama `TEACHER` de visibilidad y permisos |
| `apps/api/src/courses/courses.service.spec.ts` | Reescribir 1 test |
| `apps/api/src/media/media.controller.ts` | Quitar `Role.TEACHER` de 2 `@Roles` |
| `apps/api/test/e2e/01,02,07,16-*.e2e-spec.ts` | Quitar el usuario profesor de los e2e |
| `apps/api/prisma/schema.prisma` | Borrar 3 modelos, 2 enums, 4 campos; reducir `Role` |
| `apps/api/prisma/seed.ts` | Dejar de crear profesor, perfil, disponibilidad y reservas |
| `apps/api/.env.example` | Quitar claves de Daily.co |
| `apps/web/src/App.tsx` | Quitar 3 rutas y sus imports |
| `apps/web/src/layouts/AppLayout.tsx` | Quitar rama `TEACHER` y 3 entradas de menú |
| `apps/web/src/pages/DashboardPage.tsx` | Quitar tarjeta y acciones de reservas, y el rol `TEACHER` |
| `apps/web/src/pages/ProfilePage.tsx` | Quitar etiqueta `TEACHER` |
| `apps/web/src/pages/admin/AdminUsersPage.tsx` | Quitar `TEACHER` de etiquetas y colores |
| `apps/web/src/pages/admin/AdminDashboardPage.tsx` | Quitar KPIs, gráficos, heatmap y sección de profesores |
| `apps/web/src/api/admin.api.ts` | Quitar tipos y funciones de reservas y billing |
| `apps/web/src/styles/global.css` | Quitar `.role-badge.TEACHER` |
| `apps/web/src/utils/errorMessage.ts` | Actualizar comentario |
| `packages/shared/src/index.ts` | Quitar el `export *` de `booking.types` |
| `packages/shared/src/types/user.types.ts` | Quitar `TEACHER` del enum y la interfaz `TeacherProfile` |
| `CLAUDE.md` | Actualizar matriz de permisos, módulos, endpoints y stack |

---

## Task 1: Pre-vuelo — conteos y volcado a JSON

Antes de borrar nada hay que saber qué hay y guardarlo. Este volcado es la única red de seguridad de la migración destructiva.

**Files:**
- Create: `apps/api/prisma/dump-legacy.ts` *(temporal; se borra en Task 11)*

**Interfaces:**
- Consumes: nada.
- Produces: ficheros `data/exports/legacy-<entorno>-<fecha>.json` y unos conteos que se reportan al propietario. Ninguna tarea posterior depende del código de este script.

- [ ] **Step 1: Crear el script de volcado**

Crear `apps/api/prisma/dump-legacy.ts`:

```ts
/**
 * Volcado de solo lectura de los datos que la Fase 1 va a eliminar:
 * reservas, disponibilidad y usuarios con rol TEACHER (con el recuento de su
 * contenido dependiente, que caerá en cascada al borrarlos).
 *
 * Uso:
 *   DATABASE_URL="<url del entorno>" ENV_NAME=pre \
 *     pnpm --filter @vkbacademy/api exec ts-node prisma/dump-legacy.ts
 *
 * No escribe en la base de datos. Es seguro ejecutarlo contra PROD.
 */
import { PrismaClient } from '@prisma/client';
import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const envName = process.env.ENV_NAME ?? 'unknown';
  const today = new Date().toISOString().slice(0, 10);

  const bookings = await prisma.booking.findMany({
    include: {
      student: { select: { id: true, name: true, email: true } },
      teacher: { select: { id: true, user: { select: { name: true, email: true } } } },
      course: { select: { id: true, title: true } },
    },
    orderBy: { startAt: 'asc' },
  });

  const availability = await prisma.availabilitySlot.findMany({
    orderBy: [{ teacherId: 'asc' }, { dayOfWeek: 'asc' }],
  });

  const teachers = await prisma.user.findMany({
    where: { role: 'TEACHER' },
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      createdAt: true,
      _count: {
        select: {
          theoryModules: true,
          aiExamBanks: true,
          studyPlans: true,
          tutorMessages: true,
          quizAttempts: true,
          examAttempts: true,
          certificates: true,
          enrollments: true,
        },
      },
    },
  });

  const roleCounts = await prisma.user.groupBy({ by: ['role'], _count: { role: true } });

  const payload = {
    env: envName,
    dumpedAt: new Date().toISOString(),
    roleCounts: roleCounts.map((r) => ({ role: r.role, count: r._count.role })),
    counts: {
      bookings: bookings.length,
      availabilitySlots: availability.length,
      teachers: teachers.length,
    },
    bookings,
    availability,
    teachers,
  };

  const outDir = resolve(process.cwd(), '../../data/exports');
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, `legacy-${envName}-${today}.json`);
  writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');

  console.log(`Volcado escrito en ${outPath}`);
  console.log('Roles:', payload.roleCounts);
  console.log('Conteos:', payload.counts);
  console.log(
    'Contenido dependiente de los TEACHER que se borrará en cascada:',
    teachers.map((t) => ({ email: t.email, ...t._count })),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
```

- [ ] **Step 2: Verificar que compila**

Run: `pnpm --filter @vkbacademy/api exec tsc --noEmit -p tsconfig.json`
Expected: sin errores.

- [ ] **Step 3: Ejecutar contra PRE**

Run:
```bash
DATABASE_URL="<url de la BD de PRE>" ENV_NAME=pre \
  pnpm --filter @vkbacademy/api exec ts-node prisma/dump-legacy.ts
```
Expected: escribe `data/exports/legacy-pre-<fecha>.json` e imprime los conteos.

- [ ] **Step 4: Ejecutar contra PROD**

Run:
```bash
DATABASE_URL="<url de la BD de PROD>" ENV_NAME=prod \
  pnpm --filter @vkbacademy/api exec ts-node prisma/dump-legacy.ts
```
Expected: escribe `data/exports/legacy-prod-<fecha>.json` e imprime los conteos.

- [ ] **Step 5: Confirmar que los volcados no se versionan**

Run: `git status --short data/`
Expected: sin salida. `data/exports/` ya está en `.gitignore`.

- [ ] **Step 6: PARADA — reportar al propietario**

Presentar los conteos de PRE y PROD: reservas, franjas, número de usuarios `TEACHER` y, por cada uno, cuánto contenido dependiente se perderá (`theoryModules`, `aiExamBanks`, `studyPlans`, `certificates`…).

**No continuar sin el visto bueno explícito.** Si algún profesor tiene contenido con valor, la decisión D3 del spec (eliminar los usuarios) debe revisarse antes de seguir.

- [ ] **Step 7: Commit**

```bash
git add apps/api/prisma/dump-legacy.ts
git commit -m "chore(refactor): script temporal de volcado previo a la poda de reservas"
```

---

## Task 2: Backend — borrar los módulos de reservas

**Files:**
- Delete: `apps/api/src/bookings/`, `apps/api/src/availability/`, `apps/api/src/daily/`
- Delete: `apps/api/test/e2e/05-bookings.e2e-spec.ts`, `apps/api/test/e2e/11-availability.e2e-spec.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/.env.example`

**Interfaces:**
- Consumes: nada.
- Produces: desaparecen `BookingsService`, `AvailabilityService`, `DailyService` y sus módulos. Task 4 asume que ya nadie llama a `sendBookingCreated`/`Confirmed`/`Cancelled`.

- [ ] **Step 1: Borrar los tres directorios y los e2e**

```bash
git rm -r apps/api/src/bookings apps/api/src/availability apps/api/src/daily
git rm apps/api/test/e2e/05-bookings.e2e-spec.ts apps/api/test/e2e/11-availability.e2e-spec.ts
```

- [ ] **Step 2: Desregistrar los módulos en `app.module.ts`**

Borrar estas dos líneas de imports (líneas 13-14):

```ts
import { BookingsModule } from './bookings/bookings.module';
import { AvailabilityModule } from './availability/availability.module';
```

Y estas dos del array `imports` (líneas 62-63):

```ts
    BookingsModule,
    AvailabilityModule,
```

`DailyModule` no aparece en `app.module.ts`: solo lo importaba `bookings.module.ts`, que ya no existe.

- [ ] **Step 3: Quitar Daily.co de `.env.example`**

Borrar de `apps/api/.env.example` las líneas 22-23 y la línea en blanco que las sigue:

```
# Daily.co (videollamadas para reservas online)
DAILY_API_KEY=""
```

Comprobar además que no queda ninguna otra variable con prefijo `DAILY_`:

Run: `grep -n -i daily apps/api/.env.example`
Expected: sin salida.

- [ ] **Step 4: Verificar que no queda ninguna referencia**

Run: `grep -rniE "bookingsmodule|availabilitymodule|dailyservice|dailymodule" apps/api/src`
Expected: sin salida.

- [ ] **Step 5: Verificar que compila y los tests pasan**

Run: `pnpm --filter @vkbacademy/api exec tsc --noEmit -p tsconfig.json && pnpm --filter @vkbacademy/api test`
Expected: compila sin errores y la suite en verde. El total de tests baja respecto a los 549 actuales: desaparecen `bookings.service.spec.ts`, `availability.service.spec.ts` y `daily.service.spec.ts`.

- [ ] **Step 6: Commit**

```bash
git add -A apps/api
git commit -m "refactor(api): elimina los modulos de reservas, disponibilidad y Daily.co"
```

---

## Task 3: Backend — borrar la facturación

**Files:**
- Delete: `apps/api/src/admin/billing.service.ts`
- Delete: `apps/api/src/admin/dto/billing-query.dto.ts`
- Delete: `apps/api/src/admin/dto/update-billing-config.dto.ts`
- Modify: `apps/api/src/admin/admin.module.ts`
- Modify: `apps/api/src/admin/admin.controller.ts`

**Interfaces:**
- Consumes: nada de tareas anteriores.
- Produces: desaparecen los endpoints `GET /admin/billing` y `PATCH /admin/billing/config`. Task 8 borra su consumidor en el frontend.

El modelo `BillingConfig` **se conserva** en `schema.prisma` (decisión D5 del spec). No tocarlo.

- [ ] **Step 1: Borrar el servicio y sus DTOs**

```bash
git rm apps/api/src/admin/billing.service.ts \
       apps/api/src/admin/dto/billing-query.dto.ts \
       apps/api/src/admin/dto/update-billing-config.dto.ts
```

- [ ] **Step 2: Quitar `BillingService` de `admin.module.ts`**

Borrar el import (línea 9) y la entrada del array `providers` (línea 23):

```ts
import { BillingService } from './billing.service';
```
```ts
    BillingService,
```

- [ ] **Step 3: Quitar los endpoints de `admin.controller.ts`**

Borrar los tres imports:

```ts
import { BillingQueryDto } from './dto/billing-query.dto';
import { UpdateBillingConfigDto } from './dto/update-billing-config.dto';
import { BillingService } from './billing.service';
```

Borrar la línea del constructor:

```ts
    private readonly billingService: BillingService,
```

Y borrar el bloque completo, incluido su comentario de sección:

```ts
  // ─── Facturación ──────────────────────────────────────────────────────────

  @Get('billing')
  getBilling(@Query() query: BillingQueryDto, @CurrentAcademy() academyId: string | null) {
    return this.billingService.getReport(query.from, query.to, academyId);
  }

  @Patch('billing/config')
  updateBillingConfig(
    @Body() dto: UpdateBillingConfigDto,
    @CurrentAcademy() academyId: string | null,
  ) {
    return this.billingService.updateConfig(dto, academyId);
  }
```

Comprobar después si `@CurrentAcademy`, `@Patch`, `@Query` o `@Body` han quedado sin uso en el fichero; si TypeScript o ESLint avisan de un import huérfano, quitarlo.

- [ ] **Step 4: Verificar**

Run: `grep -rni "billingservice\|billingquerydto\|updatebillingconfigdto" apps/api/src`
Expected: sin salida.

Run: `pnpm --filter @vkbacademy/api exec tsc --noEmit -p tsconfig.json && pnpm --filter @vkbacademy/api test`
Expected: compila y la suite en verde.

- [ ] **Step 5: Commit**

```bash
git add -A apps/api
git commit -m "refactor(api): elimina el modulo de facturacion, sin objeto sin reservas"
```

---

## Task 4: Backend — limpiar las notificaciones de reservas

**Files:**
- Modify: `apps/api/src/notifications/notifications.service.ts:35-154`
- Modify: `apps/api/src/notifications/notifications.service.spec.ts`

**Interfaces:**
- Consumes: Task 2 ya eliminó al único llamante de estos tres métodos.
- Produces: `NotificationsService` conserva exactamente `sendEmail`, `sendTutorWelcomeWithStudents` y `sendPasswordReset`.

- [ ] **Step 1: Borrar los tres métodos del servicio**

En `apps/api/src/notifications/notifications.service.ts`, borrar íntegros `sendBookingCreated` (empieza en línea 35), `sendBookingConfirmed` (67) y `sendBookingCancelled` (119), incluyendo sus plantillas HTML y los comentarios de sección que solo les pertenezcan. El método `sendEmail` (línea 22) y todo lo que va a partir de `sendTutorWelcomeWithStudents` (línea 155) se mantienen.

Si al quitarlos queda algún import sin usar (por ejemplo tipos de fecha o utilidades de formato que solo usaban las plantillas de reservas), quitarlo también.

- [ ] **Step 2: Borrar los tests correspondientes**

En `apps/api/src/notifications/notifications.service.spec.ts`, borrar estos seis `it(...)` completos:

- `'sendBookingCreated no lanza ningún error cuando resend es null'` (línea 90)
- `'sendBookingCreated invoca sendEmail con el email del profesor'` (118)
- `'sendBookingConfirmed envía exactamente 2 emails (tutor + alumno)'` (130)
- `'sendBookingConfirmed usa Promise.allSettled (ambos envíos se completan aunque uno falle)'` (140)
- `'sendBookingCancelled envía un email por cada entrada en notifyEmails'` (152)
- `'sendBookingCancelled con lista vacía no invoca send'` (192)

Se conservan los cinco restantes: los de `sendEmail`, `sendPasswordReset` y `sendTutorWelcomeWithStudents`.

**Atención al `describe` de la línea 70** (`'sin API key configurada'`): tras borrar el test de la línea 90 debe quedarle al menos el de `sendEmail` (línea 84). Si quedara vacío, borrar el `describe` entero.

- [ ] **Step 3: Verificar**

Run: `pnpm --filter @vkbacademy/api test -- notifications`
Expected: la suite de notificaciones en verde con 5 tests.

Run: `grep -rni "sendbooking" apps/api/src`
Expected: sin salida.

- [ ] **Step 4: Commit**

```bash
git add -A apps/api/src/notifications
git commit -m "refactor(api): elimina los emails de reservas de NotificationsService"
```

---

## Task 5: Backend — limpiar las métricas de reservas y profesores

La tarea más delicada del backend: hay que quitar bloques intercalados sin romper las métricas que se quedan.

**Files:**
- Modify: `apps/api/src/admin/admin-analytics.service.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `getAnalytics()` devuelve el mismo objeto **menos** las claves `kpis.newBookings`, `kpis.confirmedBookings`, `kpis.cancelledBookings`, `timeSeries[].newBookings`, `bookings`, `teachers`, `insights.bookingHeatmap` e `insights.avgBookingLeadDays`. `getMetrics()` devuelve el mismo objeto menos `users.teachers` y `bookings`. Task 8 alinea los tipos del frontend con esta forma exacta.

- [ ] **Step 1: Limpiar `getAnalytics` — consultas**

En `apps/api/src/admin/admin-analytics.service.ts`:

1. Borrar el bloque `bookingWhere` (líneas 90-93).
2. En el `Promise.all` desestructurado (líneas ~103-125): quitar de la lista de nombres `newBookings`, `confirmedBookings`, `cancelledBookings` y `bookingsTimeSeries`, y quitar las cuatro llamadas correspondientes (`this.prisma.booking.count(...)` ×3 y `this.prisma.booking.findMany(...)`). Mantener `newUsers`, `newEnrollments`, `progressRecords`, `quizRecords` y `usersTimeSeries` **en el mismo orden relativo**: la desestructuración es posicional y un desajuste aquí asigna datos silenciosamente al nombre equivocado.
3. Borrar `const bookingsByDate = buildMap(bookingsTimeSeries.map(...))`.
4. En el `.map` de `timeSeries`, borrar la línea `newBookings: bookingsByDate.get(date) ?? 0,`.
5. Borrar el bloque `// ── Desglose reservas ──` completo, con su `const [bookingsByStatus, bookingsByMode] = await Promise.all([...])`.
6. Borrar el bloque `// ── Estadísticas de profesores ──` completo: desde `const teacherBookings = ...` hasta `const totalMinutesTaught = ...` inclusive (líneas ~237-321). Se va con él `teacherProfiles`, `teacherProfileMap`, `teacherStatsMap`, el bucle `for (const booking of teacherBookings)`, `topTeachers`, `uniqueTeacherIds` y `totalConfirmedSessions`.
7. Borrar el bloque `// ── Heatmap de reservas + lead time ──` completo (líneas ~427-452): `bookingsForHeatmap`, `heatmapCounts`, el bucle, `bookingHeatmap` y `avgBookingLeadDays`.
8. Si tras esto `BookingStatus` ya no se usa, quitarlo del import de `@prisma/client` de la línea 2, dejando `import { Role } from '@prisma/client';`.

- [ ] **Step 2: Limpiar `getAnalytics` — objeto de retorno**

El `return` debe quedar exactamente así:

```ts
    return {
      kpis: {
        newUsers,
        newEnrollments,
        completedLessons,
        quizAttempts: quizRecords.length,
        avgQuizScore,
      },
      timeSeries,
      topCourses,
      topStudents,
      insights: {
        atRiskStudents,
        scoreDistribution,
        lowCompletionLessons,
      },
    };
```

- [ ] **Step 3: Limpiar `getMetrics`**

En el `Promise.all` (líneas ~500-521): quitar de la desestructuración `totalTeachers`, `totalBookings`, `confirmedBookings` y `pendingBookings`, y quitar sus cuatro consultas (`user.count({ where: { role: Role.TEACHER } })`, `booking.count()` ×3). Mantener el orden relativo del resto.

El `return` debe quedar exactamente así:

```ts
    return {
      users: {
        total: totalUsers,
        students: totalStudents,
        tutors: totalTutors,
      },
      courses: { total: totalCourses, published: publishedCourses },
      enrollments: totalEnrollments,
      quizAttempts: totalQuizAttempts,
    };
```

- [ ] **Step 4: Verificar**

Run: `grep -niE "booking|teacherprofile|role\.teacher" apps/api/src/admin/admin-analytics.service.ts`
Expected: sin salida.

Run: `pnpm --filter @vkbacademy/api exec tsc --noEmit -p tsconfig.json && pnpm --filter @vkbacademy/api test`
Expected: compila y la suite en verde. No hay spec para este servicio, así que el type-check es aquí la red principal: una variable desestructurada que ya no existe o un nombre huérfano salta como error de compilación.

- [ ] **Step 5: Commit**

```bash
git add -A apps/api/src/admin
git commit -m "refactor(api): elimina las metricas de reservas y profesores de analytics"
```

---

## Task 6: Backend — retirar el rol TEACHER de guards, DTOs y servicios

`Role` sigue teniendo `TEACHER` en Prisma hasta la Task 10, así que este código compila en ambos lados del cambio. Es a propósito: aquí se retira el uso, allí el valor.

**Files:**
- Modify: `apps/api/src/courses/courses.controller.ts:80,91,98`
- Modify: `apps/api/src/courses/courses.service.ts:49,143-152`
- Modify: `apps/api/src/courses/courses.service.spec.ts:289-293`
- Modify: `apps/api/src/media/media.controller.ts:14,17,30,34`
- Modify: `apps/api/src/admin/admin-users.service.ts:106`
- Modify: `apps/api/src/admin/admin-users.service.spec.ts:139-171`
- Modify: `apps/api/src/admin/dto/create-admin-user.dto.ts`
- Modify: `apps/api/test/e2e/01-auth.e2e-spec.ts`, `02-courses.e2e-spec.ts`, `07-admin.e2e-spec.ts`, `16-media.e2e-spec.ts`

**Interfaces:**
- Consumes: nada.
- Produces: ningún fichero de `apps/api/src` referencia `Role.TEACHER` ni `teacherProfile`. Task 10 puede eliminar el valor del enum sin romper la compilación.

- [ ] **Step 1: Escribir primero los tests en su forma final**

En `apps/api/src/courses/courses.service.spec.ts`, sustituir el test de la línea 289 por su equivalente para `SUPER_ADMIN`, que es quien conserva ese privilegio:

```ts
    it('SUPER_ADMIN: accede sin comprobar ownership (ve resultados de todos)', async () => {
      // ... mantener el mismo cuerpo del test original ...
      requester(Role.SUPER_ADMIN, { id: 'super1' }),
      // ... mismas aserciones ...
    });
```

En `apps/api/src/admin-users.service.spec.ts` (ruta real: `apps/api/src/admin/admin-users.service.spec.ts`), borrar los dos tests de las líneas 139 y 159 (`'crea TeacherProfile asociado cuando el rol es TEACHER'` y `'NO crea TeacherProfile cuando el rol no es TEACHER'`). El primero prueba comportamiento que desaparece; el segundo prueba la ausencia de algo que ya no puede existir.

- [ ] **Step 2: Ejecutar los tests para verlos fallar**

Run: `pnpm --filter @vkbacademy/api test -- courses.service`
Expected: FALLA. El test de `SUPER_ADMIN` no pasa todavía porque `assertCanViewStudentProgress` sigue devolviendo pronto solo para `TEACHER` y `SUPER_ADMIN`… **si ya pasa en verde**, es la señal correcta: la rama actual `requester.role === Role.TEACHER || requester.role === Role.SUPER_ADMIN` ya cubre `SUPER_ADMIN`. En ese caso anotar que el test pasa y continuar: la implementación del Step 3 debe mantenerlo verde.

- [ ] **Step 3: Retirar `TEACHER` de `courses`**

En `apps/api/src/courses/courses.controller.ts`:

```ts
  // línea 80
  @Roles(Role.TUTOR, Role.ADMIN)
  // línea 91
  @Roles(Role.ADMIN)
  // línea 98
  @Roles(Role.ADMIN)
```

En `apps/api/src/courses/courses.service.ts`:

```ts
      // línea 49 — comentario
      // TUTOR/ADMIN ven todos los cursos (publicados o no)
```

Y en el bloque de permisos (líneas 143-152), el comentario y la condición:

```ts
  /**
   * Verifica que el solicitante puede ver el progreso de un alumno concreto.
   * - SUPER_ADMIN: ve resultados de todos (matriz de permisos).
   * - TUTOR: solo sus alumnos asignados (`tutorId`).
   * - ADMIN: solo alumnos de su propia academia (membresía compartida).
   */
  private async assertCanViewStudentProgress(
    requester: AuthenticatedUser,
    studentId: string,
  ): Promise<void> {
    if (requester.role === Role.SUPER_ADMIN) {
      return;
    }
```

- [ ] **Step 4: Retirar `TEACHER` de `media`**

En `apps/api/src/media/media.controller.ts`, las dos anotaciones pasan a `@Roles(Role.ADMIN)` (líneas 17 y 34) y hay que corregir los dos comentarios:

```ts
  /** Genera una presigned URL para subir un vídeo a S3 [ADMIN] */
```

y, en el bloque de la línea 30, sustituir el final del párrafo por:

```
   * quienes suben contenido (ADMIN; SUPER_ADMIN pasa por el chequeo ADMIN).
```

- [ ] **Step 5: Retirar la creación de `teacherProfile`**

En `apps/api/src/admin/admin-users.service.ts`, borrar la línea 106:

```ts
        ...(dto.role === 'TEACHER' ? { teacherProfile: { create: {} } } : {}),
```

En `apps/api/src/admin/dto/create-admin-user.dto.ts`, restringir los roles que un admin puede asignar. Sustituir el campo `role`:

```ts
  @IsEnum(Role, { message: 'Rol no válido' })
  role: Role;
```

por una lista explícita, para que el DTO deje de aceptar `TEACHER` aunque el enum de Prisma todavía lo contenga hasta la Task 10:

```ts
  @IsIn([Role.STUDENT, Role.TUTOR, Role.ADMIN, Role.SUPER_ADMIN], {
    message: 'Rol no válido',
  })
  role: Role;
```

Actualizar el import de `class-validator` de la primera línea para incluir `IsIn` y quitar `IsEnum` si deja de usarse en el fichero.

- [ ] **Step 6: Limpiar los e2e**

En `apps/api/test/e2e/07-admin.e2e-spec.ts`:
- Quitar `let teacherToken: string;` (línea 17), el `login('teacher@vkbacademy.com')` del `Promise.all` del `beforeAll` (línea 30) y la asignación `teacherToken = t.accessToken;` (línea 37). Ajustar la desestructuración del `Promise.all` para que siga cuadrando posicionalmente.
- Borrar el test `'TEACHER no puede acceder a los usuarios (403)'` (línea 74).
- En el test que crea un usuario con `role: 'TEACHER'` (líneas ~154-158), cambiar el rol a `'TUTOR'` y la aserción a `expect(res.body.role).toBe('TUTOR');`.

En `apps/api/test/e2e/16-media.e2e-spec.ts`: el fichero prueba que un `TEACHER` autenticado pasa los guards. Como el rol desaparece, sustituir `teacherToken` por un token de admin en las cuatro llamadas (líneas 53, 59, 68, 80 y 112), renombrar la variable a `adminToken` si no existe ya una, y actualizar los títulos de los dos tests (`'un TEACHER …'` → `'un ADMIN …'`) y el comentario de la línea 112.

En `apps/api/test/e2e/01-auth.e2e-spec.ts`, línea 202: el test de logout usa la cuenta de profesor solo como un usuario cualquiera, no prueba nada del rol. Cambiar el actor:

```ts
      const { refreshToken } = await login('admin@vkbacademy.com');
```

En `apps/api/test/e2e/02-courses.e2e-spec.ts`:

1. Borrar `let teacherToken: string;` (línea 13).
2. En el `beforeAll` (líneas 26-36), quitar `login('teacher@vkbacademy.com')` del `Promise.all` y `teacherToken = t.accessToken;`, ajustando la desestructuración posicional:

```ts
    const [s, a, tu] = await Promise.all([
      login('student@vkbacademy.com'),
      login('admin@vkbacademy.com'),
      login('oscar.sanchez@egocogito.com'),
    ]);

    studentToken = s.accessToken;
    adminToken = a.accessToken;
    tutorToken = tu.accessToken;
```

3. Borrar los tres tests que prueban capacidades ahora exclusivas de ADMIN, porque el fichero ya tiene su equivalente con `adminToken`: `'TEACHER ve todos los cursos'` (línea 77), `'TEACHER puede acceder a cualquier curso'` (149) y `'TEACHER puede crear un curso'` (198). Antes de borrarlos, confirmar con `grep -n "adminToken" apps/api/test/e2e/02-courses.e2e-spec.ts` que existe cobertura equivalente para admin; si alguno de los tres no la tiene, en vez de borrarlo cambiar el actor a `adminToken` y ajustar el título.
4. En `'devuelve 400 si el título es demasiado corto'` (línea 241), sustituir `teacherToken` por `adminToken`. Este test valida el DTO, no el rol, y es el único uso restante de la variable.

- [ ] **Step 7: Verificar**

Run: `grep -rn "Role.TEACHER\|'TEACHER'\|teacherProfile" apps/api/src apps/api/test`
Expected: sin salida.

Run: `pnpm --filter @vkbacademy/api exec tsc --noEmit -p tsconfig.json && pnpm --filter @vkbacademy/api test`
Expected: compila y la suite en verde.

Los e2e necesitan una base de datos levantada (`docker compose up -d`) y la seed aplicada. Si está disponible: `pnpm --filter @vkbacademy/api test:e2e`. Si no lo está, dejar constancia en el commit de que los e2e no se ejecutaron localmente — el pipeline los correrá.

- [ ] **Step 8: Commit**

```bash
git add -A apps/api
git commit -m "refactor(api): retira el rol TEACHER de guards, DTOs y servicios"
```

---

## Task 6b: Backend — cortar el consumo de reservas en `tutors` y en la config

> Añadida tras la revisión de la Task 2. El módulo `tutors/` pertenece a la Fase 2 y **no se elimina aquí**, pero consulta la tabla `Booking`, que sí desaparece en la Task 10. Sin este corte, el `prisma generate` de la Task 10 deja la API sin compilar.

**Files:**
- Modify: `apps/api/src/tutors/tutors.service.ts:163,203-211,306,371-374`
- Modify: `apps/api/src/tutors/tutors.service.spec.ts:64,78,314`
- Modify: `apps/api/src/config/env.schema.ts:66-67`

**Interfaces:**
- Consumes: nada.
- Produces: `getStudentSummary` deja de devolver la clave `sessions`. El resto de la respuesta (`exams`, `certificates`, `courses`, `activity`) no cambia. Las Tasks 7-9 alinean el frontend con esta forma.

- [ ] **Step 1: Quitar la consulta de reservas del `Promise.all`**

En `apps/api/src/tutors/tutors.service.ts`, la desestructuración de la línea 163 es **posicional**. Quitar `bookings` de la lista de nombres:

```ts
    const [completedInPeriod, quizAttempts, examAttempts, certificates, enrollments] =
```

y borrar del array la consulta correspondiente, con su comentario, manteniendo el orden relativo del resto:

```ts
        // Reservas confirmadas en el período
        this.prisma.booking.findMany({
          where: {
            studentId,
            status: 'CONFIRMED',
            ...(dateRange ? { startAt: dateRange } : {}),
          },
          select: { startAt: true, endAt: true },
        }),
```

Un desajuste aquí asigna `enrollments` al nombre `bookings` sin error de compilación: verificar que los cinco nombres restantes siguen alineados con las cinco consultas restantes, en el mismo orden.

- [ ] **Step 2: Quitar el cálculo y la clave de respuesta**

Borrar `const totalBookingMinutes = bookings.reduce(...)` (línea 306) con su comentario.

En el objeto de retorno, borrar el bloque completo:

```ts
      sessions: {
        confirmed: bookings.length,
        totalHours: Math.round(totalBookingMinutes / 6) / 10,
      },
```

- [ ] **Step 3: Limpiar el spec**

En `apps/api/src/tutors/tutors.service.spec.ts`, borrar la clave `booking` del objeto `mockPrisma` (línea 64), la línea `mockPrisma.booking.findMany.mockResolvedValue([]);` del `beforeEach` (línea 78) y el bloque de la línea 314 que carga reservas de prueba. Si algún test asertaba sobre `sessions`, borrar esas aserciones; si el test entero solo existía para comprobar `sessions`, borrarlo.

- [ ] **Step 4: Quitar `DAILY_API_KEY` de la validación de entorno**

En `apps/api/src/config/env.schema.ts`, borrar las líneas 66-67 y la línea en blanco sobrante:

```ts
  // ── Videollamadas (Daily.co) ───────────────────────────────────────────────
  DAILY_API_KEY: Joi.string().allow('').optional(),
```

- [ ] **Step 5: Verificar**

Run: `grep -rniE "booking|daily" apps/api/src/tutors apps/api/src/config`
Expected: sin salida.

Run: `pnpm --filter @vkbacademy/api exec tsc --noEmit -p tsconfig.json && pnpm --filter @vkbacademy/api test`
Expected: compila y la suite en verde.

- [ ] **Step 6: Commit**

```bash
git add -A apps/api/src/tutors apps/api/src/config
git commit -m "refactor(api): tutors y config dejan de depender de reservas"
```

---

## Task 7: Frontend — borrar las páginas y clientes de reservas y facturación

**Files:**
- Delete: `apps/web/src/pages/TeacherPortalPage.tsx`, `apps/web/src/pages/BookingsPage.tsx`, `apps/web/src/pages/bookings/`, `apps/web/src/pages/admin/AdminBillingPage.tsx`, `apps/web/src/api/bookings.api.ts`, `apps/web/src/hooks/useBookings.ts`
- Modify: `apps/web/src/App.tsx:17,31,39,151,173,212`
- Modify: `apps/web/src/layouts/AppLayout.tsx:19,31,45,51-58`

**Interfaces:**
- Consumes: Task 3 ya eliminó los endpoints de billing del backend.
- Produces: no queda ninguna ruta ni entrada de menú hacia `/bookings`, `/teacher` o `/admin/billing`. Task 8 se ocupa de las referencias sueltas que queden en otras páginas.

- [ ] **Step 1: Borrar los ficheros**

```bash
git rm -r apps/web/src/pages/bookings
git rm apps/web/src/pages/BookingsPage.tsx \
       apps/web/src/pages/TeacherPortalPage.tsx \
       apps/web/src/pages/admin/AdminBillingPage.tsx \
       apps/web/src/api/bookings.api.ts \
       apps/web/src/hooks/useBookings.ts
```

- [ ] **Step 2: Quitar las rutas de `App.tsx`**

Borrar los tres imports (líneas 17, 31, 39):

```ts
import BookingsPage from './pages/BookingsPage';
const TeacherPortalPage = lazy(() => import('./pages/TeacherPortalPage'));
const AdminBillingPage = lazy(() => import('./pages/admin/AdminBillingPage'));
```

Borrar la ruta de reservas (línea 151):

```tsx
        <Route path="bookings" element={<BookingsPage />} />
```

Borrar la ruta del portal docente (línea 173):

```tsx
        <Route path="teacher" element={<TeacherPortalPage />} />
```

Borrar la ruta de facturación completa: el `<Route path="admin/billing" …>` cuyo elemento envuelve `<AdminBillingPage />` en la línea 212, incluyendo el wrapper de suspense o guard que lleve alrededor.

El import de `TutorStudentsPage` (línea 18) y su ruta `tutor/students` (línea 154) **se quedan**: son Fase 2.

- [ ] **Step 3: Limpiar el menú en `AppLayout.tsx`**

Borrar la entrada de reservas del bloque `TUTOR` (línea 19):

```ts
      { to: '/bookings', label: 'Reservas', icon: 'calendar' },
```

Borrar la entrada de facturación de los bloques `SUPER_ADMIN` (línea 31) y `ADMIN` (línea 45):

```ts
      { to: '/admin/billing', label: 'Facturación', icon: 'credit-card' },
```

Borrar el bloque `TEACHER` entero (líneas 51-58):

```ts
  if (role === Role.TEACHER) {
    return [
      ...base,
      { to: '/teacher', label: 'Portal Docente', icon: 'school' },
      { to: '/courses', label: 'Cursos', icon: 'book' },
      { to: '/profile', label: 'Mi perfil', icon: 'user' },
    ];
  }
```

- [ ] **Step 4: Verificar**

Run: `pnpm --filter @vkbacademy/web exec tsc --noEmit`
Expected: **FALLA**, y debe fallar. Los errores esperados son los de `DashboardPage.tsx` (importa `useMyBookings`, que ya no existe) y `admin.api.ts` / `AdminDashboardPage.tsx`. Son exactamente los que resuelve la Task 8. Anotar la lista de errores: sirve de checklist.

Si aparece algún error en un fichero **no** previsto por la Task 8, investigarlo antes de continuar.

- [ ] **Step 5: NO commitear todavía**

El árbol no compila. Continuar directamente con la Task 8 y hacer un único commit al final de ella.

---

## Task 8: Frontend — limpiar TEACHER y las métricas de reservas

Cierra el agujero que deja la Task 7.

**Files:**
- Modify: `apps/web/src/api/admin.api.ts`
- Modify: `apps/web/src/pages/admin/AdminDashboardPage.tsx`
- Modify: `apps/web/src/pages/DashboardPage.tsx`
- Modify: `apps/web/src/pages/ProfilePage.tsx:10-16`
- Modify: `apps/web/src/pages/admin/AdminUsersPage.tsx:14-27`
- Modify: `apps/web/src/styles/global.css:707-710`
- Modify: `apps/web/src/utils/errorMessage.ts:3`

**Interfaces:**
- Consumes: la forma exacta de `getAnalytics()` y `getMetrics()` definida en la Task 5.
- Produces: `apps/web/src` compila sin errores y no referencia `Role.TEACHER`. Task 9 puede quitar el valor del enum en `packages/shared`.

- [ ] **Step 1: Alinear los tipos de `admin.api.ts` con el backend**

En `AdminMetrics`, quitar `teachers` y `bookings`:

```ts
export interface AdminMetrics {
  users: { total: number; students: number; tutors: number };
  courses: { total: number; published: number };
  enrollments: number;
  quizAttempts: number;
}
```

En `AnalyticsKPIs`, quitar las tres claves de reservas:

```ts
export interface AnalyticsKPIs {
  newUsers: number;
  newEnrollments: number;
  completedLessons: number;
  quizAttempts: number;
  avgQuizScore: number;
}
```

En `TimeSeriesPoint`, quitar `newBookings`:

```ts
export interface TimeSeriesPoint {
  date: string;
  completedLessons: number;
  quizAttempts: number;
  newUsers: number;
}
```

Borrar enteras las interfaces `TeacherActivity` y `BookingHeatmapCell`.

En `AdminAnalytics`, quitar las claves `bookings` y `teachers` y las dos de `insights`:

```ts
export interface AdminAnalytics {
  kpis: AnalyticsKPIs;
  timeSeries: TimeSeriesPoint[];
  topCourses: CourseActivity[];
  topStudents: StudentActivity[];
  insights: {
    atRiskStudents: AtRiskStudent[];
    scoreDistribution: ScoreBucket[];
    lowCompletionLessons: LowCompletionLesson[];
  };
}
```

Borrar el bloque de billing completo: el comentario de sección `// ─── Billing ───`, las interfaces `BillingConfig`, `BillingReport` y `BillingConfigPayload`, y las dos funciones del objeto de API (líneas 541-545):

```ts
  getBilling: (params?: { from?: string; to?: string }) =>
    api.get<BillingReport>('/admin/billing', { params }).then((r) => r.data),

  updateBillingConfig: (payload: BillingConfigPayload) =>
    api.patch<BillingConfig>('/admin/billing/config', payload).then((r) => r.data),
```

- [ ] **Step 2: Limpiar `AdminDashboardPage.tsx`**

1. Quitar `type TeacherActivity` (línea 9) y `type BookingHeatmapCell` (línea 12) del import.
2. Borrar `const pendingBookings = …` (líneas 119-120).
3. Borrar las tres `<KpiCard>` de reservas (líneas 251-253).
4. Borrar la entrada `{ key: 'newBookings', label: 'Reservas', color: '#f59e0b' }` de la configuración del gráfico (línea 268).
5. Borrar la tarjeta de desglose por estado (bloque que usa `data.bookings.byStatus`, líneas ~305-334, incluido el aviso de pendientes de la línea 330) y la de desglose por modalidad (`data.bookings.byMode`, líneas ~336-345). Borrar también sus cabeceras de sección.
6. Borrar la sección de profesores completa: el bloque `s.teacherSummary` con sus tres KPIs y la lista `data.teachers.top` (líneas ~363-390).
7. Borrar la sección del heatmap (líneas ~440-456), incluido el texto de antelación media.
8. Borrar los dos componentes auxiliares que quedan huérfanos: `BookingHeatmap` (línea 664) y `TeacherRow` (línea 755), con sus comentarios de cabecera.
9. Borrar del objeto de estilos `s` las claves que solo usaban esas secciones: `teacherSummary`, `teacherKpi`, `teacherKpiValue`, `teacherKpiLabel`, `teacherKpiDivider`, `teacherList`, `teacherRowHeader` (líneas 1045-1052) y cualquier clave de heatmap que quede sin referencias.

- [ ] **Step 3: Limpiar `DashboardPage.tsx`**

1. Borrar el import `import { useMyBookings } from '../hooks/useBookings';` (línea 7).
2. En `ROLE_LABELS`, borrar `[Role.TEACHER]: 'Profesor',` (línea 18).
3. En `ROLE_DESCRIPTION`, borrar la entrada `[Role.TEACHER]` (línea 25) y **reescribir la de `STUDENT` y la de `TUTOR`**, que mencionan reservas:

```ts
const ROLE_DESCRIPTION: Record<string, string> = {
  [Role.STUDENT]: 'Practica con teoría y ejercicios bajo demanda.',
  [Role.TUTOR]: 'Consulta el progreso de tus alumnos.',
  [Role.ADMIN]: 'Administra usuarios, cursos y visualiza las métricas globales de la plataforma.',
};
```

4. En `quickActions`, borrar la rama `user.role === Role.TEACHER` (líneas 55-59) por completo, dejando el ternario en dos ramas: `STUDENT` y el resto.
5. En `StudentRail`, borrar `const { data: bookings } = useMyBookings();` (línea 185), el bloque `const now = Date.now();` + `const nextBooking = …` (líneas 198-203) con su comentario, y quitar `!nextBooking &&` de la condición `isEmpty` (línea 211):

```ts
  const isEmpty = !nextLesson && activeChallenges.length === 0 && latestCerts.length === 0;
```

6. Borrar el bloque JSX `{nextBooking && ( <RailCard icon="calendar" label="Próxima clase" …> … )}` completo (líneas 258-275).

- [ ] **Step 4: Limpiar las etiquetas de rol**

En `apps/web/src/pages/ProfilePage.tsx`, borrar `TEACHER: 'Profesor',` del mapa `ROLE_LABELS`.

En `apps/web/src/pages/admin/AdminUsersPage.tsx`, borrar `[Role.TEACHER]: 'Profesor',` de `ROLE_LABELS` (línea 17) y `[Role.TEACHER]: '#10b981',` de `ROLE_COLORS` (línea 25). Ambos son `Record<Role, string>`, así que TypeScript exigirá que el mapa cuadre con el enum: quedarán correctos solo después de la Task 9, y hasta entonces darán error de "propiedad faltante". Es lo esperado.

En `apps/web/src/styles/global.css`, borrar la regla `.role-badge.TEACHER` (líneas 707-710).

- [ ] **Step 5: Actualizar el comentario obsoleto**

En `apps/web/src/utils/errorMessage.ts:3`, el comentario cita un fichero que ya no existe. Sustituir la referencia a `BookingsPage.tsx` por otra página real que use el helper, por ejemplo:

```ts
// en StudyPage.tsx, para no dejar mutaciones con fallo silencioso.
```

- [ ] **Step 5b: Quitar la tarjeta de sesiones del seguimiento del tutor**

La Task 6b eliminó la clave `sessions` de la respuesta de `GET /tutors/my-students/:id`. Hay que alinear el frontend, que por lo demás **se mantiene**: `TutorStudentsPage` es de la Fase 2.

En `apps/web/src/api/tutors.api.ts`, borrar del tipo de la respuesta el bloque `sessions` con sus dos campos (líneas ~75-78):

```ts
  sessions: {
    confirmed: number;
    totalHours: number;
  };
```

En `apps/web/src/pages/TutorStudentsPage.tsx`, borrar la tarjeta de estadística que consume `sessions` (líneas ~485-491): el componente completo con `value={sessions.confirmed}` y `sub={`${sessions.totalHours}h en total`}`. Si `sessions` se desestructuraba de la respuesta más arriba en el componente, quitarlo también de ahí.

- [ ] **Step 6: Verificar**

Run: `pnpm --filter @vkbacademy/web exec tsc --noEmit`
Expected: quedan **solo** los errores de `Record<Role, …>` en `AdminUsersPage.tsx` por la clave `TEACHER` que falta, que resuelve la Task 9. Cualquier otro error hay que arreglarlo aquí.

- [ ] **Step 7: NO commitear todavía**

Continuar con la Task 9, que cierra el ciclo con un único commit.

---

## Task 9: Shared — eliminar los tipos de reservas y el rol TEACHER

**Files:**
- Delete: `packages/shared/src/types/booking.types.ts`
- Modify: `packages/shared/src/index.ts:11-12`
- Modify: `packages/shared/src/types/user.types.ts:1-7,44-49`

**Interfaces:**
- Consumes: Tasks 7 y 8 ya eliminaron todos los consumidores web de estos tipos.
- Produces: `Role` queda como `STUDENT | TUTOR | ADMIN | SUPER_ADMIN` en el paquete compartido. `pnpm build` completa en los tres paquetes.

- [ ] **Step 1: Borrar los tipos de reservas**

```bash
git rm packages/shared/src/types/booking.types.ts
```

En `packages/shared/src/index.ts`, borrar el comentario y el export:

```ts
// Tipos de reservas
export * from './types/booking.types';
```

- [ ] **Step 2: Reducir el enum `Role`**

En `packages/shared/src/types/user.types.ts`:

```ts
export enum Role {
  STUDENT = 'STUDENT',
  TUTOR = 'TUTOR',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
}
```

- [ ] **Step 3: Borrar la interfaz `TeacherProfile`**

En el mismo fichero, borrar el bloque completo:

```ts
export interface TeacherProfile {
  id: string;
  userId: string;
  bio?: string | null;
  user: PublicUser;
}
```

`PublicUser` se conserva: lo usan otros tipos.

- [ ] **Step 4: Verificar que todo compila y construye**

Run: `pnpm --filter @vkbacademy/web exec tsc --noEmit`
Expected: **sin errores**. Los `Record<Role, string>` de `AdminUsersPage.tsx` ahora cuadran con el enum de cuatro valores.

Run: `pnpm --filter @vkbacademy/api test`
Expected: en verde. La API usa `Role` de `@prisma/client`, no de `shared`, así que no debería verse afectada.

Run: `pnpm build`
Expected: los tres paquetes construyen.

- [ ] **Step 5: Verificar que no quedan restos en el frontend**

Run: `grep -rniE "booking|teacherprofile|availabilityslot|role\.teacher" apps/web/src packages/shared/src`
Expected: sin salida.

- [ ] **Step 6: Commit único de las tasks 7, 8 y 9**

```bash
git add -A apps/web packages/shared
git commit -m "refactor(web): elimina reservas, portal docente, facturacion y rol TEACHER"
```

---

## Task 10: Schema y migración destructiva

**Punto de no retorno.** A partir de aquí no hay `git revert` que recupere los datos.

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_remove_bookings_and_teacher_role/migration.sql`

**Interfaces:**
- Consumes: Tasks 2-9 dejaron el código sin referencias a las tablas y al rol.
- Produces: el cliente Prisma regenerado ya no expone `prisma.booking`, `prisma.teacherProfile` ni `prisma.availabilitySlot`, y `Role` tiene cuatro valores. Task 11 depende de ello para ajustar la seed.

- [ ] **Step 1: Confirmar que los volcados de la Task 1 existen**

Run: `ls -la data/exports/legacy-*.json`
Expected: al menos un fichero para `pre` y otro para `prod`. **Si falta alguno, volver a la Task 1.** No continuar.

- [ ] **Step 2: Editar `schema.prisma`**

Borrar los tres modelos completos: `TeacherProfile` (línea 305), `AvailabilitySlot` (315) y `Booking` (339), y los dos enums `BookingStatus` (328) y `BookingMode` (334), junto con los comentarios de sección que solo les pertenezcan.

Quitar los campos de relación de los modelos que se quedan:

```prisma
// en model User — borrar estas dos líneas
  bookingsAsStudent Booking[]       @relation("StudentBookings")
  teacherProfile    TeacherProfile?

// en model Course — borrar
  bookings      Booking[]

// en model Academy — borrar
  bookings       Booking[]
```

Reducir el enum `Role`:

```prisma
enum Role {
  STUDENT
  TUTOR
  ADMIN
  SUPER_ADMIN
}
```

`BillingConfig` **se conserva** (D5). No tocarlo.

- [ ] **Step 3: Generar la migración sin aplicarla**

Run:
```bash
pnpm --filter @vkbacademy/api exec prisma migrate dev \
  --name remove_bookings_and_teacher_role --create-only
```
Expected: crea `apps/api/prisma/migrations/<timestamp>_remove_bookings_and_teacher_role/migration.sql` sin tocar la base de datos.

- [ ] **Step 4: Editar el SQL a mano**

Prisma no sabe que hay que borrar los usuarios antes de reducir el enum. Abrir el `migration.sql` generado y **añadir al principio del todo**, antes de cualquier `DROP`:

```sql
-- Elimina los usuarios con rol TEACHER. Todas las relaciones de User son
-- onDelete: Cascade, así que su contenido dependiente cae con ellos.
-- El volcado previo está en data/exports/legacy-<entorno>-<fecha>.json
DELETE FROM "User" WHERE role = 'TEACHER';
```

Verificar que el resto del fichero mantiene este orden: los `DROP TABLE` de `Booking`, `AvailabilitySlot` y `TeacherProfile` van antes de los `DROP TYPE` de `BookingStatus` y `BookingMode`, y el bloque `CREATE TYPE "Role_new" … ALTER TABLE … DROP TYPE "Role" … RENAME` va al final. Si Prisma ha generado los `DROP TABLE` en un orden que viola las claves foráneas (`TeacherProfile` antes que `Booking`, por ejemplo), reordenarlos.

- [ ] **Step 5: Aplicar en local y verificar**

Run:
```bash
docker compose up -d
pnpm --filter @vkbacademy/api exec prisma migrate dev
```
Expected: la migración aplica limpia contra la base de datos local.

Run: `pnpm --filter @vkbacademy/api exec prisma generate`
Expected: cliente regenerado.

- [ ] **Step 6: Verificar que el código sigue compilando con el cliente nuevo**

Run: `pnpm --filter @vkbacademy/api exec tsc --noEmit -p tsconfig.json && pnpm --filter @vkbacademy/api test`
Expected: compila y la suite en verde. Este es el momento en que aparecería cualquier `prisma.booking` o `Role.TEACHER` que se hubiera escapado de las tasks 2-6: ahora sería un error de compilación, no un fallo en runtime.

- [ ] **Step 7: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "refactor(db): elimina Booking, TeacherProfile, AvailabilitySlot y el rol TEACHER"
```

---

## Task 11: Seeds y limpieza del script temporal

**Files:**
- Modify: `apps/api/prisma/seed.ts:16-17,27,104-115`
- Delete: `apps/api/prisma/dump-legacy.ts`

**Interfaces:**
- Consumes: el cliente Prisma regenerado en la Task 10.
- Produces: `prisma db seed` corre limpio contra el schema nuevo. Los e2e que dependen de la seed vuelven a tener una base consistente.

- [ ] **Step 1: Quitar los borrados de tablas inexistentes**

En `apps/api/prisma/seed.ts`, borrar las tres líneas del bloque de limpieza inicial:

```ts
  await prisma.booking.deleteMany();          // línea 16
  await prisma.availabilitySlot.deleteMany(); // línea 17
  await prisma.teacherProfile.deleteMany();   // línea 27
```

- [ ] **Step 2: Quitar el usuario profesor**

Borrar el bloque de creación del usuario con `role: Role.TEACHER` (a partir de la línea 104), incluido su `teacherProfile: { create: { … availability: { … } } }` anidado. Si alguna constante o variable posterior de la seed referencia ese usuario (por ejemplo para crear reservas de ejemplo), borrar también esas referencias.

- [ ] **Step 3: Borrar el script temporal de volcado**

```bash
git rm apps/api/prisma/dump-legacy.ts
```

Ya cumplió su función; los JSON siguen en `data/exports/`, fuera del control de versiones.

- [ ] **Step 4: Verificar que la seed corre de principio a fin**

Run:
```bash
pnpm --filter @vkbacademy/api exec prisma migrate reset --force
```
Expected: reconstruye la base local, aplica todas las migraciones y ejecuta la seed sin errores.

Run: `pnpm --filter @vkbacademy/api exec prisma studio`
Expected: comprobar visualmente que no existen las tablas `Booking`, `AvailabilitySlot` ni `TeacherProfile`, y que ningún usuario tiene rol `TEACHER`. Cerrar Studio después.

- [ ] **Step 5: Ejecutar los e2e contra la base recién sembrada**

Run: `pnpm --filter @vkbacademy/api test:e2e`
Expected: en verde. Si algún test falla por buscar `teacher@vkbacademy.com`, es un resto de la Task 6 Step 6: arreglarlo aquí.

- [ ] **Step 6: Commit**

```bash
git add -A apps/api/prisma
git commit -m "chore(db): la seed deja de crear profesor, disponibilidad y reservas"
```

---

## Task 12: Documentación

`CLAUDE.md` es el contexto operativo del repo. Si queda desalineado, el próximo trabajo parte de premisas falsas.

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: el estado final de las tasks 2-11.
- Produces: documentación que refleja el código real.

- [ ] **Step 1: Actualizar la matriz de permisos (§5)**

Quitar la columna `teacher`. **La columna `tutor` se queda**: es Fase 2. Quitar también las dos filas que dejan de existir: *Gestionar disponibilidad* y *Crear reservas (sus alumnos)*.

Borrar la nota al pie `\*Solo en cursos donde estén asignados como autor.` y la marca `✅\*`: describe una regla que nunca existió en el schema (`Course` no tiene `authorId`).

Actualizar el párrafo final de la sección si menciona profesores o reservas.

- [ ] **Step 2: Actualizar el stack (§3) y las decisiones (§11)**

Quitar la fila `Videollamadas | Daily.co` de la tabla de stack.

En la lista de decisiones de arquitectura, borrar el punto 5 (`**Daily.co** para reservas online → sala creada al confirmar, borrada al cancelar.`) y renumerar los siguientes.

- [ ] **Step 3: Actualizar los módulos del backend (§4)**

En la lista de módulos, quitar `bookings`, `availability` y `daily`. Queda:

```
`auth`, `users`, `courses`, `quizzes`, `progress`, `media`, `notifications`, `admin`,
`challenges`, `certificates`, `school-years`, `tutors`, `academies`, `exams`, `ai`,
`exercises`, `study-plans`, `theory`, `tutor`, `username`, `youtube`
```

Añadir una nota que distinga los dos módulos de nombre parecido, que es una fuente real de confusión:

```markdown
> `tutor` (singular) es el **tutor IA** con chat en streaming. `tutors` (plural) es
> el rol TUTOR de los padres. No confundirlos.
```

- [ ] **Step 4: Actualizar los endpoints (§7)**

Borrar el bloque completo `### Reservas y disponibilidad` con sus 10 endpoints.

En el apartado de Admin, quitar `billing` de la lista de namespaces.

- [ ] **Step 5: Corregir el `ChallengeType` obsoleto (§6)**

El enum documentado no coincide con el schema desde antes de este refactor. Sustituirlo por el real:

```prisma
enum ChallengeType {
  EXERCISE_COMPLETED EXERCISE_SCORE THEORY_COMPLETED
  EXAM_COMPLETED EXAM_SCORE STREAK_WEEKLY
  TOTAL_HOURS_EXERCISE TOTAL_HOURS_THEORY TOTAL_HOURS_EXAM
}
```

Quitar `BookingStatus` y `BookingMode` del bloque de enums, y `Booking` de la lista de entidades principales. En la sección de multi-tenancy (§14), quitar `Booking` de la lista de modelos scoped por `academyId`.

- [ ] **Step 6: Actualizar las variables de entorno (§9) y el README**

Quitar las claves de Daily.co si aparecen en el bloque de ejemplo de `CLAUDE.md`.

`README.md:81` también documenta `DAILY_API_KEY`. Quitarla de ahí, junto con cualquier mención a videollamadas o clases particulares que quede en el README. Verificar después:

Run: `grep -rni "daily\|reserva\|videollamada" README.md CLAUDE.md`
Expected: sin salida, salvo menciones que no tengan nada que ver con reservas de clases.

- [ ] **Step 7: Añadir la fase al roadmap (§12)**

Añadir una fila a la tabla:

```markdown
| 10.7 | Poda de reservas y rol TEACHER ([spec](docs/superpowers/specs/2026-08-11-fase1-poda-reservas-teacher-design.md)) |   ✅   |
```

Actualizar la línea de *Última actualización* del pie.

- [ ] **Step 8: Verificación final del criterio de aceptación 1**

Run:
```bash
grep -rniE "booking|teacherprofile|availabilityslot|daily|role\.teacher" \
  apps/api/src apps/web/src packages/shared/src apps/api/prisma/schema.prisma
```
Expected: **sin salida**.

Run: `pnpm --filter @vkbacademy/api test && pnpm --filter @vkbacademy/web exec tsc --noEmit && pnpm build`
Expected: todo en verde.

- [ ] **Step 9: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: actualiza CLAUDE.md tras la poda de reservas y rol TEACHER"
```

---

## Task 12b: Marketing — dejar de vender un producto que ya no existe

> Añadida tras la revisión de las Tasks 7-9. Ni el spec ni el plan original cubrían `PublicLayout`, y el sitio público sigue anunciando reserva de clases particulares en tres páginas. **Debe resolverse antes de la Task 13**, o PROD anuncia una función inexistente.
>
> **El copy de sustitución que hay aquí es un borrador.** Está escrito para ser fiel a lo que la app hace de verdad, pero es texto comercial del negocio del propietario y debería revisarlo.

Esta es la única tarea del plan que toca `PublicLayout`. La regla dura del proyecto prohíbe hacerlo *desde tareas del app autenticado*; esta lo es de marketing, y es su cometido entero.

**Decisión de contenido:** el pilar de "Reserva clases particulares" se **sustituye**, no se borra, por el **tutor IA** (`apps/api/src/tutor/`, `TutorWidget.tsx`): existe, está en producción y hoy no se anuncia en ninguna parte. Así el número de pilares no cambia y la retícula de las páginas no se descuadra.

**Files:**
- Modify: `apps/web/src/pages/marketing/LandingPage.tsx:74-79,168,312,370,442`
- Modify: `apps/web/src/pages/marketing/AcademyLandingPage.tsx:83-87,305`
- Modify: `apps/web/src/pages/marketing/PricingPage.tsx:31,39,50-51,192,231-232`

**Interfaces:**
- Consumes: nada.
- Produces: ninguna mención a reserva de clases en `apps/web/src/pages/marketing/`.

- [ ] **Step 1: Añadir el icono de chat a los dos registros de iconos**

`LandingPage.tsx` tiene su registro de SVG en línea (`target`, `video`, `check`, `graduation`, `calendar`, `chart`, `trophy`). Ninguno sirve para el tutor IA. Añadir a ese registro, respetando el estilo de línea 24×24 del resto:

```ts
  chat: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
```

Hacer lo mismo en el registro equivalente de `AcademyLandingPage.tsx`.

Después de sustituir los pilares (Steps 2 y 3), comprobar si `calendar` queda sin uso en cada página; si es así, borrar su entrada del registro.

- [ ] **Step 2: Sustituir el pilar en `LandingPage.tsx`**

Sustituir el objeto de las líneas 74-79:

```ts
  {
    icon: 'calendar',
    title: 'Reserva clases con sus profes',
    description:
      'Tú gestionas las clases particulares directamente desde la plataforma, tanto presenciales como online.',
  },
```

por:

```ts
  {
    icon: 'chat',
    title: 'Un tutor que no se cansa',
    description:
      'Cuando se atasca a las once de la noche, pregunta y recibe una explicación al momento. Sin esperar a la próxima clase.',
  },
```

- [ ] **Step 3: Sustituir el pilar en `AcademyLandingPage.tsx`**

Sustituir el objeto de las líneas 83-87:

```ts
  {
    icon: 'calendar',
    title: 'Reserva clases particulares',
    desc: 'Gestiona clases particulares directamente desde la plataforma, presenciales u online.',
  },
```

por:

```ts
  {
    icon: 'chat',
    title: 'Un tutor que no se cansa',
    desc: 'Pregunta cualquier duda y recibe una explicación al momento, a cualquier hora.',
  },
```

- [ ] **Step 4: Corregir las enumeraciones de producto**

`LandingPage.tsx:312` — sustituir `clases particulares` por `un tutor de IA` en la enumeración, dejando el resto de la frase igual:

```
cualquier tema, exámenes con certificado y un tutor de IA — todo en un solo lugar,
```

`AcademyLandingPage.tsx:305` — mismo cambio:

```
interactivas, exámenes con certificado y un tutor de IA — todo en un solo lugar,
```

`LandingPage.tsx:168` — sustituir la frase entera:

```ts
      'Consulta su progreso, sus certificados y su actividad reciente desde tu propio panel.',
```

- [ ] **Step 5: Corregir las comparaciones de precio**

Las dos comparaciones con el precio de una clase particular **se conservan**: siguen siendo ciertas y son argumento de venta legítimo. Vallekas no vende clases en la app, pero una clase particular sigue costando lo que cuesta en el mercado.

`LandingPage.tsx:370` y `:442` se dejan **tal cual**. Verificar solo que no prometen que la plataforma las ofrezca; si al releerlas dan a entender que se pueden reservar ahí, ajustar la redacción mínimamente para que sea una comparación externa.

- [ ] **Step 6: Limpiar `PricingPage.tsx`**

Línea 31 — sustituir el bullet de características:

```ts
  { icon: '💬', text: 'Tutor de IA disponible a cualquier hora' },
```

Línea 39 — la respuesta de la FAQ menciona gestionar reservas. Sustituir el final:

```ts
    a: 'Contacta con la administración del club. Ellos crearán la cuenta de tu hijo/a y te asignarán como tutor. A partir de ahí, sigues su progreso desde tu propio panel.',
```

Líneas 50-51 — la pregunta entera es sobre clases particulares. **Borrar el objeto completo de esa FAQ**, pregunta y respuesta.

Línea 192 — sustituir la fila de la tabla comparativa:

```ts
                'Tutor de IA a cualquier hora',
```

Líneas 231-232 — sustituir el texto de la sección del tutor:

```
                  Tienes tu propio acceso para ver el progreso de tu hijo/a, sus certificados
                  y recibir notificaciones de avance.
```

Línea 242 se **conserva**: los profesores del club siguen creando el contenido, aunque no den clases por la plataforma.

- [ ] **Step 7: Verificar**

Run: `grep -rniE "reserva|clase particular|clases particulares" apps/web/src/pages/marketing/`
Expected: solo las dos comparaciones de precio del Step 5. Ninguna que prometa reservar.

Run: `pnpm --filter @vkbacademy/web exec tsc --noEmit`
Expected: sin errores.

Revisar visualmente que las retículas de pilares siguen teniendo el mismo número de elementos y que la FAQ borrada no deja un hueco raro.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/pages/marketing
git commit -m "refactor(web): el sitio publico deja de anunciar clases particulares"
```

---

## Task 12c: Mobile — podar el esqueleto de reservas

> Añadida tras la revisión de las Tasks 7-9. `apps/mobile` (711 LOC, roadmap fase 11, sin desplegar) conserva una pantalla de reservas y el rol `TEACHER`. No rompe nada —usa `Record<string, …>`, no el enum de `shared`, y el CI no la typechequea— pero es resto de la misma poda.

**Files:**
- Delete: `apps/mobile/app/(tabs)/bookings.tsx`
- Modify: `apps/mobile/app/(tabs)/_layout.tsx`
- Modify: `apps/mobile/app/(tabs)/profile.tsx:15,21`

**Interfaces:**
- Consumes: nada.
- Produces: `apps/mobile` sin referencias a reservas ni a `TEACHER`.

- [ ] **Step 1: Borrar la pantalla**

```bash
git rm "apps/mobile/app/(tabs)/bookings.tsx"
```

Son 14 líneas: un stub con el texto "Reservas — Fase 4".

- [ ] **Step 2: Quitar la pestaña**

En `apps/mobile/app/(tabs)/_layout.tsx`, borrar el `<Tabs.Screen>` completo de `bookings`:

```tsx
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'Reservas',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
```

Quedan dos pestañas: `index` (Cursos) y `profile` (Perfil).

- [ ] **Step 3: Quitar el rol TEACHER**

En `apps/mobile/app/(tabs)/profile.tsx`, borrar la línea 15 del mapa de etiquetas y la línea 21 del mapa de colores:

```ts
  TEACHER: 'Profesor',
  TEACHER: { bg: '#dbeafe', text: '#1e40af' },
```

- [ ] **Step 4: Verificar**

Run: `grep -rniE "booking|reserva|TEACHER" apps/mobile/app apps/mobile/src`
Expected: sin salida.

Run: `ls "apps/mobile/app/(tabs)"`
Expected: `_layout.tsx`, `index.tsx`, `profile.tsx`.

No ejecutar el build de mobile: requiere `eas`, que no está instalado en el entorno, y el CI no lo compila.

- [ ] **Step 5: Commit**

```bash
git add -A apps/mobile
git commit -m "refactor(mobile): elimina el esqueleto de reservas y el rol TEACHER"
```

---

## Task 13: Despliegue

**Files:** ninguno. Es operación.

**Interfaces:**
- Consumes: la rama `refactor/fase1-poda-reservas` completa y verificada.
- Produces: PRE y PROD sin reservas ni rol TEACHER.

- [ ] **Step 1: Abrir el PR**

```bash
git push -u origin refactor/fase1-poda-reservas
gh pr create --title "refactor: elimina reservas, facturacion y rol TEACHER (fase 1)" --body "$(cat <<'EOF'
Primera fase del refactor de simplificación previo a la salida a mercado.

Elimina las clases particulares (reservas, disponibilidad, Daily.co), el módulo
de facturación y el rol TEACHER. Unas 6.000 líneas fuera.

Spec: docs/superpowers/specs/2026-08-11-fase1-poda-reservas-teacher-design.md
Plan: docs/superpowers/plans/2026-08-11-fase1-poda-reservas-teacher.md

Migración destructiva: se eliminan las tablas Booking, AvailabilitySlot y
TeacherProfile, y los usuarios con rol TEACHER. Volcado previo guardado en
data/exports/ (no versionado).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: Esperar al CI**

Expected: los jobs `test` y de type-check en verde.

- [ ] **Step 3: Merge y despliegue a PRE**

Tras el merge a `main`, el pipeline ejecuta `test` → `migrate-pre` → `deploy-pre` → `smoke-pre`.

Expected: `migrate-pre` aplica la migración destructiva contra la BD de PRE y `smoke-pre` pasa.

- [ ] **Step 4: Verificación manual en PRE**

Entrar en PRE y recorrer, **como alumno**: Inicio, Asignaturas, Estudiar, Retos, Perfil. Comprobar que el rail del dashboard no muestra hueco donde estaba "Próxima clase" y que no hay enlaces muertos.

**Como admin**: Dashboard, Usuarios, Cursos, Retos, Canjes. Comprobar que el dashboard de métricas renderiza sin la sección de profesores ni el heatmap, que no hay entrada de Facturación en el menú, y que el alta de usuario no ofrece el rol Profesor.

- [ ] **Step 5: PARADA — gate de PROD**

Confirmar con el propietario antes de cruzar el gate manual. La migración de PROD borra datos de forma irreversible.

- [ ] **Step 6: Desplegar a PROD**

Aprobar los gates `migrate-prod` y `deploy-prod`. Esperar a `smoke-prod` y a `promote-prod`.

- [ ] **Step 7: Verificación en PROD**

Repetir el recorrido del Step 4 contra producción.

---

## Resumen de verificación

| Criterio del spec | Dónde se verifica |
| ----------------- | ----------------- |
| 1. Sin referencias a `Booking`/`TeacherProfile`/`AvailabilitySlot`/`Daily`/`Role.TEACHER` | Task 12 Step 8 |
| 2. Tests de API en verde | Tasks 2, 3, 4, 5, 6, 9, 10, 12 |
| 3. `tsc --noEmit` de web sin errores | Task 9 Step 4 |
| 4. `pnpm build` completa | Task 9 Step 4, Task 12 Step 8 |
| 5. `Role` con cuatro valores | Task 9 Step 2 (shared), Task 10 Step 2 (Prisma) |
| 6. Tablas inexistentes en PRE y PROD | Task 11 Step 4 (local), Task 13 Steps 3 y 6 |
| 7. Volcados JSON en `data/exports/` | Task 1 Steps 3-4, comprobado en Task 10 Step 1 |
| 8. Smoke tests de PRE y PROD | Task 13 Steps 3 y 6 |
| 9. Sin enlaces muertos | Task 13 Steps 4 y 7 |
| 10. `CLAUDE.md` alineado | Task 12 |
