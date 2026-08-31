# Instrumentación de retención — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recoger una fila por alumno y día activo, distinguiendo "abrió la app" de "hizo algo", y mostrar en el panel de admin qué porcentaje de cada cohorte semanal vuelve al día siguiente y sigue en la primera semana.

**Architecture:** Tabla nueva `UserActivityDay` con `@@unique([userId, day])`, escrita por dos caminos: un interceptor global de NestJS para la visita (con deduplicación en un `Map` en memoria) y la rama `dayChanged` que ya existe en `ChallengesService.updateStreak` para el trabajo. El cálculo de cohortes es una función pura sobre las filas, expuesta en `GET /admin/analytics/retention` y pintada como una sección más de `AdminDashboardPage`.

**Tech Stack:** NestJS 10, Prisma, PostgreSQL 16, React 18 + Vite, React Query v5, Jest (API), Vitest + Testing Library (web).

**Spec:** `docs/superpowers/specs/2026-08-31-instrumentacion-retencion-design.md`

## Global Constraints

- TypeScript `strict: true`. Sin `any` salvo justificación escrita en el propio código.
- Nombres en inglés (variables, funciones, clases, rutas, columnas); comentarios en español.
- Guards y lógica de roles antes que services, nunca dentro del service.
- La instrumentación **nunca** puede tumbar ni retrasar una petición: toda escritura va con `void` y su propio `catch` que solo loguea, igual que `checkAndAward`.
- El día se calcula **siempre** con `madridDay()` de `apps/api/src/challenges/challenge-periods.ts`, formato `"2026-08-31"`. Nunca `new Date().toISOString().slice(0,10)`.
- Comandos con el nombre con scope: `pnpm --filter @vkbacademy/api`, `pnpm --filter @vkbacademy/web`.
- Cada test nuevo se verifica **por mutación**: romper lo que vigila y comprobar que se pone rojo. Un test en verde no demuestra nada.
- Nunca `--no-verify`.

---

### Task 1: Modelo `UserActivityDay` y migración

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (modelo `User`, zona de relaciones; y modelo nuevo al final)
- Create: `apps/api/prisma/migrations/<timestamp>_add_user_activity_day/migration.sql` (la genera Prisma)

**Interfaces:**
- Consumes: nada.
- Produces: modelo Prisma `UserActivityDay` con campos `id: string`, `userId: string`, `day: string`, `worked: boolean`, `academyId: string | null`, `createdAt: Date`; y la relación `User.activityDays`.

- [ ] **Step 1: Añadir el modelo al schema**

En `apps/api/prisma/schema.prisma`, dentro de `model User`, en el bloque de relaciones (junto a `exerciseAttempts`):

```prisma
  activityDays     UserActivityDay[]
```

Y como modelo nuevo:

```prisma
/// Un registro por alumno y día con actividad. Es el histórico que
/// `User.lastActiveDay` no puede dar: aquel es un escalar y solo dice cuándo
/// fue la última vez, no si el alumno volvió al día siguiente.
model UserActivityDay {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  /// "2026-08-31" en Europe/Madrid — mismo formato y mismo helper que User.lastActiveDay
  day       String
  /// false = solo abrió la app; true = además hizo algo (ejercicio, tema, examen, tutor)
  worked    Boolean  @default(false)
  academyId String?
  createdAt DateTime @default(now())

  @@unique([userId, day])
  @@index([day])
}
```

- [ ] **Step 2: Generar la migración**

Run: `pnpm --filter @vkbacademy/api prisma migrate dev --name add_user_activity_day`

- [ ] **Step 3: Comprobar que la migración es aditiva**

Run: `cat apps/api/prisma/migrations/*add_user_activity_day/migration.sql`

Expected: solo `CREATE TABLE "UserActivityDay"`, `CREATE UNIQUE INDEX`, `CREATE INDEX` y un `ALTER TABLE ... ADD CONSTRAINT` de clave foránea. **Ningún `DROP`, ningún `ALTER TYPE`.** Si aparece cualquier otra cosa, parar: el schema local ha divergido y hay que resolverlo antes de seguir.

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(retencion): tabla UserActivityDay para el histórico de días activos (#126)"
```

---

### Task 2: `ActivityService` — las dos escrituras

**Files:**
- Create: `apps/api/src/activity/activity.service.ts`
- Create: `apps/api/src/activity/activity.service.spec.ts`
- Create: `apps/api/src/activity/activity.module.ts`

**Interfaces:**
- Consumes: `PrismaService`; `madridDay(date: Date): string` de `../challenges/challenge-periods`.
- Produces: `ActivityService` con dos métodos públicos:
  - `recordVisit(userId: string): Promise<void>` — crea la fila del día con `worked: false` si no existe; si existe, no la toca.
  - `recordWork(userId: string): Promise<void>` — crea la fila del día con `worked: true`, o la marca si ya existía.
  Ambos resuelven `academyId` desde `AcademyMember` y **nunca lanzan**.
  `ActivityModule` exporta `ActivityService`.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `apps/api/src/activity/activity.service.spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { ActivityService } from './activity.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ActivityService', () => {
  let service: ActivityService;
  let mockPrisma: {
    userActivityDay: { upsert: jest.Mock };
    academyMember: { findFirst: jest.Mock };
  };

  beforeEach(async () => {
    mockPrisma = {
      userActivityDay: { upsert: jest.fn() },
      academyMember: { findFirst: jest.fn().mockResolvedValue({ academyId: 'academy1' }) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ActivityService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get(ActivityService);
    jest.clearAllMocks();
    mockPrisma.academyMember.findFirst.mockResolvedValue({ academyId: 'academy1' });
  });

  describe('recordVisit', () => {
    it('crea la fila del día como visita, sin trabajo', async () => {
      await service.recordVisit('user1');

      const args = mockPrisma.userActivityDay.upsert.mock.calls[0][0];
      expect(args.create).toMatchObject({ userId: 'user1', worked: false });
    });

    it('no pisa el trabajo ya registrado ese día', async () => {
      await service.recordVisit('user1');

      // Un update vacío: si el alumno ya trabajó hoy, la visita posterior no
      // puede devolver worked a false.
      const args = mockPrisma.userActivityDay.upsert.mock.calls[0][0];
      expect(args.update).toEqual({});
    });

    it('usa el día de Madrid como clave, no la fecha UTC', async () => {
      // 00:30 del 1 de septiembre en Madrid son las 22:30 del 31 de agosto UTC:
      // esa sesión pertenece al día de Madrid o la racha se parte sola.
      jest.useFakeTimers().setSystemTime(new Date('2026-08-31T22:30:00.000Z'));

      await service.recordVisit('user1');

      const args = mockPrisma.userActivityDay.upsert.mock.calls[0][0];
      expect(args.where.userId_day.day).toBe('2026-09-01');
      jest.useRealTimers();
    });

    it('guarda la academia del alumno', async () => {
      await service.recordVisit('user1');

      const args = mockPrisma.userActivityDay.upsert.mock.calls[0][0];
      expect(args.create.academyId).toBe('academy1');
    });

    it('deja la academia a null si el alumno no es miembro de ninguna', async () => {
      mockPrisma.academyMember.findFirst.mockResolvedValue(null);

      await service.recordVisit('user1');

      const args = mockPrisma.userActivityDay.upsert.mock.calls[0][0];
      expect(args.create.academyId).toBeNull();
    });

    it('no propaga el error si la escritura falla', async () => {
      mockPrisma.userActivityDay.upsert.mockRejectedValue(new Error('BD caída'));

      // Medir no puede tumbar la petición de un alumno.
      await expect(service.recordVisit('user1')).resolves.toBeUndefined();
    });
  });

  describe('recordWork', () => {
    it('marca el día como trabajado, lo hubiera visitado antes o no', async () => {
      await service.recordWork('user1');

      const args = mockPrisma.userActivityDay.upsert.mock.calls[0][0];
      expect(args.create).toMatchObject({ userId: 'user1', worked: true });
      expect(args.update).toEqual({ worked: true });
    });

    it('no propaga el error si la escritura falla', async () => {
      mockPrisma.userActivityDay.upsert.mockRejectedValue(new Error('BD caída'));

      await expect(service.recordWork('user1')).resolves.toBeUndefined();
    });
  });
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `pnpm --filter @vkbacademy/api test -- activity.service.spec`
Expected: FAIL — `Cannot find module './activity.service'`.

- [ ] **Step 3: Implementar el servicio**

Crear `apps/api/src/activity/activity.service.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { madridDay } from '../challenges/challenge-periods';

/**
 * Histórico de días activos, la materia prima de las cohortes de retención.
 *
 * Dos caminos deliberadamente distintos: `recordVisit` lo llama el interceptor
 * en cuanto un alumno hace cualquier petición autenticada, y `recordWork` sale
 * de la racha, que ya sabe cuándo un día es nuevo para ese alumno. De la misma
 * fila salen las dos métricas: cuántos vuelven a abrir y cuántos vuelven a
 * trabajar.
 *
 * Ninguno de los dos lanza: medir no puede tumbar la petición de un alumno.
 */
@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recordVisit(userId: string): Promise<void> {
    // update vacío a propósito: si el alumno ya trabajó hoy, una visita
    // posterior no puede devolver worked a false.
    await this.record(userId, false);
  }

  async recordWork(userId: string): Promise<void> {
    await this.record(userId, true);
  }

  private async record(userId: string, worked: boolean): Promise<void> {
    try {
      const day = madridDay(new Date());
      const membership = await this.prisma.academyMember.findFirst({
        where: { userId },
        select: { academyId: true },
      });

      await this.prisma.userActivityDay.upsert({
        where: { userId_day: { userId, day } },
        create: { userId, day, worked, academyId: membership?.academyId ?? null },
        update: worked ? { worked: true } : {},
      });
    } catch (err) {
      this.logger.error(`No se pudo registrar la actividad de userId=${userId}`, err);
    }
  }
}
```

Crear `apps/api/src/activity/activity.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ActivityService } from './activity.service';

@Module({
  providers: [ActivityService],
  exports: [ActivityService],
})
export class ActivityModule {}
```

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `pnpm --filter @vkbacademy/api test -- activity.service.spec`
Expected: PASS, 8 tests.

- [ ] **Step 5: Verificar por mutación**

Cambiar `update: worked ? { worked: true } : {}` por `update: { worked }` y volver a ejecutar.
Expected: rojo en *"no pisa el trabajo ya registrado ese día"*. Deshacer el cambio.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/activity
git commit -m "feat(retencion): ActivityService registra visita y trabajo por día (#126)"
```

---

### Task 3: Interceptor global de visita

**Files:**
- Create: `apps/api/src/activity/activity.interceptor.ts`
- Create: `apps/api/src/activity/activity.interceptor.spec.ts`
- Modify: `apps/api/src/activity/activity.module.ts` (registrar el interceptor como `APP_INTERCEPTOR`)
- Modify: `apps/api/src/app.module.ts` (importar `ActivityModule`)

**Interfaces:**
- Consumes: `ActivityService.recordVisit(userId)`; `madridDay`.
- Produces: `ActivityInterceptor implements NestInterceptor`. No expone nada a tareas posteriores.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `apps/api/src/activity/activity.interceptor.spec.ts`:

```ts
import { of } from 'rxjs';
import { Role } from '@prisma/client';
import { ActivityInterceptor } from './activity.interceptor';
import { ActivityService } from './activity.service';

describe('ActivityInterceptor', () => {
  let interceptor: ActivityInterceptor;
  let activity: { recordVisit: jest.Mock };

  const next = { handle: () => of('ok') };

  const ctxFor = (user: unknown) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as never;

  const run = async (user: unknown) => {
    const result$ = interceptor.intercept(ctxFor(user), next as never);
    await new Promise((resolve) => result$.subscribe({ complete: resolve }));
  };

  beforeEach(() => {
    activity = { recordVisit: jest.fn().mockResolvedValue(undefined) };
    interceptor = new ActivityInterceptor(activity as unknown as ActivityService);
  });

  it('registra la visita de un alumno autenticado', async () => {
    await run({ id: 'user1', role: Role.STUDENT });

    expect(activity.recordVisit).toHaveBeenCalledWith('user1');
  });

  it('no escribe dos veces el mismo día para el mismo alumno', async () => {
    await run({ id: 'user1', role: Role.STUDENT });
    await run({ id: 'user1', role: Role.STUDENT });
    await run({ id: 'user1', role: Role.STUDENT });

    // Sin esta memoria, cada petición de la app sería una consulta más a la BD
    // para un dato que solo cambia una vez al día.
    expect(activity.recordVisit).toHaveBeenCalledTimes(1);
  });

  it('distingue entre alumnos', async () => {
    await run({ id: 'user1', role: Role.STUDENT });
    await run({ id: 'user2', role: Role.STUDENT });

    expect(activity.recordVisit).toHaveBeenCalledTimes(2);
  });

  it('ignora las rutas públicas, sin usuario', async () => {
    await run(undefined);

    expect(activity.recordVisit).not.toHaveBeenCalled();
  });

  it('ignora a quien no es alumno', async () => {
    await run({ id: 'admin1', role: Role.ADMIN });

    // La retención que se mide es la de los alumnos; un admin entrando a
    // diario inflaría las cohortes sin significar nada.
    expect(activity.recordVisit).not.toHaveBeenCalled();
  });

  it('deja pasar la respuesta intacta', async () => {
    const values: unknown[] = [];
    const result$ = interceptor.intercept(
      ctxFor({ id: 'user1', role: Role.STUDENT }),
      next as never,
    );
    await new Promise((resolve) =>
      result$.subscribe({ next: (v) => values.push(v), complete: resolve }),
    );

    expect(values).toEqual(['ok']);
  });
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `pnpm --filter @vkbacademy/api test -- activity.interceptor.spec`
Expected: FAIL — `Cannot find module './activity.interceptor'`.

- [ ] **Step 3: Implementar el interceptor**

Crear `apps/api/src/activity/activity.interceptor.ts`:

```ts
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Observable } from 'rxjs';
import { ActivityService } from './activity.service';
import { madridDay } from '../challenges/challenge-periods';

/**
 * Marca como "visitado" el día de cada alumno que hace cualquier petición
 * autenticada. Los guards corren antes que los interceptores, así que
 * `request.user` ya está resuelto; en las rutas públicas simplemente no hay.
 *
 * La memoria evita una consulta por petición para un dato que cambia una vez
 * al día. Es local al proceso: si hubiera más de una instancia de la API, o si
 * Render reinicia, lo peor que pasa es repetir un upsert idempotente.
 */
@Injectable()
export class ActivityInterceptor implements NestInterceptor {
  private readonly seen = new Map<string, string>();

  constructor(private readonly activity: ActivityService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const user = context.switchToHttp().getRequest<{ user?: { id: string; role: Role } }>().user;

    if (user?.id && user.role === Role.STUDENT) {
      const today = madridDay(new Date());
      if (this.seen.get(user.id) !== today) {
        this.seen.set(user.id, today);
        void this.activity.recordVisit(user.id);
      }
    }

    return next.handle();
  }
}
```

- [ ] **Step 4: Registrar el interceptor**

Reescribir `apps/api/src/activity/activity.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ActivityService } from './activity.service';
import { ActivityInterceptor } from './activity.interceptor';

@Module({
  providers: [ActivityService, { provide: APP_INTERCEPTOR, useClass: ActivityInterceptor }],
  exports: [ActivityService],
})
export class ActivityModule {}
```

En `apps/api/src/app.module.ts`, añadir `ActivityModule` al array `imports` (detrás de `UsernameModule`) y su `import` correspondiente.

- [ ] **Step 5: Ejecutar y ver que pasa**

Run: `pnpm --filter @vkbacademy/api test -- activity.interceptor.spec`
Expected: PASS, 6 tests.

- [ ] **Step 6: Verificar por mutación**

Quitar la condición `user.role === Role.STUDENT` y volver a ejecutar.
Expected: rojo en *"ignora a quien no es alumno"*. Deshacer.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/activity apps/api/src/app.module.ts
git commit -m "feat(retencion): interceptor que registra la visita diaria del alumno (#126)"
```

---

### Task 4: Marcar el trabajo desde la racha

**Files:**
- Modify: `apps/api/src/challenges/challenges.service.ts` (constructor y rama `dayChanged` de `updateStreak`, líneas ~71-79)
- Modify: `apps/api/src/challenges/challenges.module.ts` (importar `ActivityModule`)
- Modify: `apps/api/src/challenges/challenges.service.spec.ts`

**Interfaces:**
- Consumes: `ActivityService.recordWork(userId)`.
- Produces: nada nuevo. `updateStreak` mantiene su firma `(userId: string): Promise<void>`.

- [ ] **Step 1: Escribir el test que falla**

En `apps/api/src/challenges/challenges.service.spec.ts`, añadir un `describe` nuevo. El mock de `ActivityService` hay que inyectarlo en el `TestingModule` existente del fichero (buscar `Test.createTestingModule` y añadir el provider `{ provide: ActivityService, useValue: mockActivity }` con `const mockActivity = { recordWork: jest.fn(), recordVisit: jest.fn() }` declarado junto a los demás mocks).

```ts
describe('updateStreak — histórico de días activos', () => {
  it('registra el día como trabajado la primera vez que el alumno hace algo', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      currentStreak: 0,
      longestStreak: 0,
      lastActiveWeek: null,
      currentDailyStreak: 0,
      longestDailyStreak: 0,
      lastActiveDay: null,
    });
    mockPrisma.user.update.mockResolvedValue({});

    await service.updateStreak('user1');

    expect(mockActivity.recordWork).toHaveBeenCalledWith('user1');
  });

  it('no vuelve a escribir si ya se contabilizó ese día', async () => {
    const hoy = madridDay(new Date());
    mockPrisma.user.findUnique.mockResolvedValue({
      currentStreak: 1,
      longestStreak: 1,
      lastActiveWeek: isoWeek(new Date()),
      currentDailyStreak: 1,
      longestDailyStreak: 1,
      lastActiveDay: hoy,
    });

    await service.updateStreak('user1');

    // La rama dayChanged es lo que hace que esto cueste una escritura al día
    // y no una por ejercicio resuelto.
    expect(mockActivity.recordWork).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `pnpm --filter @vkbacademy/api test -- challenges.service.spec`
Expected: FAIL — `mockActivity.recordWork` no ha sido llamado.

- [ ] **Step 3: Implementar**

En `apps/api/src/challenges/challenges.service.ts`:

```ts
// import nuevo
import { ActivityService } from '../activity/activity.service';

// constructor
constructor(
  private readonly prisma: PrismaService,
  private readonly activity: ActivityService,
) {}
```

Y dentro de `updateStreak`, en la rama `dayChanged`, detrás de las tres asignaciones que ya hay:

```ts
    if (dayChanged) {
      const nextDaily =
        user.lastActiveDay === previousDay(currentDay) ? user.currentDailyStreak + 1 : 1;
      data.lastActiveDay = currentDay;
      data.currentDailyStreak = nextDaily;
      data.longestDailyStreak = Math.max(user.longestDailyStreak, nextDaily);
      // Primera vez que este alumno hace algo hoy: el histórico de retención se
      // engancha aquí porque esta rama ya entra una vez al día y no más.
      void this.activity.recordWork(userId);
    }
```

En `apps/api/src/challenges/challenges.module.ts`, añadir `ActivityModule` al array `imports`.

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `pnpm --filter @vkbacademy/api test -- challenges.service.spec`
Expected: PASS, toda la suite del fichero.

- [ ] **Step 5: Verificar por mutación**

Mover el `void this.activity.recordWork(userId)` fuera del `if (dayChanged)`, al final del método, y ejecutar.
Expected: rojo en *"no vuelve a escribir si ya se contabilizó ese día"*. Deshacer.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/challenges
git commit -m "feat(retencion): la racha marca el día como trabajado (#126)"
```

---

### Task 5: Cálculo de cohortes (función pura)

**Files:**
- Create: `apps/api/src/admin/retention.ts`
- Create: `apps/api/src/admin/retention.spec.ts`

**Interfaces:**
- Consumes: `madridDay`, `isoWeek` de `../challenges/challenge-periods`.
- Produces:

```ts
export interface RetentionStudent { id: string; createdAt: Date }
export interface RetentionActivity { userId: string; day: string; worked: boolean }
export interface RetentionCohort {
  week: string;          // "2026-W35"
  signups: number;
  d1Opened: number | null;   // porcentaje 0-100, null si la cohorte aún no ha cerrado el plazo
  d1Worked: number | null;
  d7Opened: number | null;
  d7Worked: number | null;
  d1Complete: boolean;
  d7Complete: boolean;
}
export function buildRetentionCohorts(
  students: RetentionStudent[],
  activity: RetentionActivity[],
  now: Date,
): RetentionCohort[]
```

Devuelve las cohortes ordenadas de la más reciente a la más antigua.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `apps/api/src/admin/retention.spec.ts`:

```ts
import { buildRetentionCohorts } from './retention';

/** 12:00 de Madrid del día indicado, para que la fecha no baile con la zona. */
const at = (day: string) => new Date(`${day}T10:00:00.000Z`);

describe('buildRetentionCohorts', () => {
  const now = at('2026-09-30');

  it('agrupa a los alumnos por la semana ISO en que se dieron de alta', () => {
    const cohorts = buildRetentionCohorts(
      [
        { id: 'a', createdAt: at('2026-08-31') }, // lunes, W36
        { id: 'b', createdAt: at('2026-09-02') }, // miércoles, misma semana
        { id: 'c', createdAt: at('2026-09-07') }, // semana siguiente
      ],
      [],
      now,
    );

    expect(cohorts.map((c) => [c.week, c.signups])).toEqual([
      ['2026-W37', 1],
      ['2026-W36', 2],
    ]);
  });

  it('cuenta como D1 al que vuelve exactamente al día siguiente', () => {
    const cohorts = buildRetentionCohorts(
      [
        { id: 'a', createdAt: at('2026-09-01') },
        { id: 'b', createdAt: at('2026-09-01') },
      ],
      [{ userId: 'a', day: '2026-09-02', worked: false }],
      now,
    );

    expect(cohorts[0].d1Opened).toBe(50);
  });

  it('separa al que solo abrió del que además trabajó', () => {
    const cohorts = buildRetentionCohorts(
      [
        { id: 'a', createdAt: at('2026-09-01') },
        { id: 'b', createdAt: at('2026-09-01') },
      ],
      [
        { userId: 'a', day: '2026-09-02', worked: false },
        { userId: 'b', day: '2026-09-02', worked: true },
      ],
      now,
    );

    expect(cohorts[0].d1Opened).toBe(100);
    expect(cohorts[0].d1Worked).toBe(50);
  });

  it('no cuenta como vuelta la actividad del propio día de alta', () => {
    const cohorts = buildRetentionCohorts(
      [{ id: 'a', createdAt: at('2026-09-01') }],
      [{ userId: 'a', day: '2026-09-01', worked: true }],
      now,
    );

    // Volver es volver otro día; si no, todo alumno que se registra y prueba
    // la app cuenta como retenido y la métrica no dice nada.
    expect(cohorts[0].d1Opened).toBe(0);
  });

  it('cuenta como D7 al que vuelve cualquier día de la primera semana', () => {
    const cohorts = buildRetentionCohorts(
      [{ id: 'a', createdAt: at('2026-09-01') }],
      [{ userId: 'a', day: '2026-09-06', worked: true }],
      now,
    );

    // Con cohortes de diez alumnos, "el día 7 exacto" es ruido, no señal.
    expect(cohorts[0].d1Opened).toBe(0);
    expect(cohorts[0].d7Opened).toBe(100);
  });

  it('deja fuera de la ventana D7 lo que pasa al octavo día', () => {
    const cohorts = buildRetentionCohorts(
      [{ id: 'a', createdAt: at('2026-09-01') }],
      [{ userId: 'a', day: '2026-09-09', worked: true }],
      now,
    );

    expect(cohorts[0].d7Opened).toBe(0);
  });

  it('marca como incompleta la cohorte cuyo plazo aún no ha cerrado', () => {
    const cohorts = buildRetentionCohorts(
      [{ id: 'a', createdAt: at('2026-09-29') }],
      [],
      at('2026-10-01'),
    );

    // El alta fue anteayer: el día D1 (el 30) ya terminó y se puede saber; los
    // siete primeros días no. Pintar un 0% que solo puede subir se lee como un
    // mal dato, no como un dato pendiente.
    expect(cohorts[0].d1Complete).toBe(true);
    expect(cohorts[0].d7Complete).toBe(false);
    expect(cohorts[0].d7Opened).toBeNull();
  });

  it('no da por cerrado el D1 mientras el día siguiente sigue en curso', () => {
    const cohorts = buildRetentionCohorts(
      [{ id: 'a', createdAt: at('2026-09-29') }],
      [],
      at('2026-09-30'),
    );

    expect(cohorts[0].d1Complete).toBe(false);
    expect(cohorts[0].d1Opened).toBeNull();
  });

  it('devuelve las cohortes de la más reciente a la más antigua', () => {
    const cohorts = buildRetentionCohorts(
      [
        { id: 'a', createdAt: at('2026-08-10') },
        { id: 'b', createdAt: at('2026-09-14') },
      ],
      [],
      now,
    );

    expect(cohorts[0].week > cohorts[1].week).toBe(true);
  });

  it('devuelve lista vacía si no hay alumnos', () => {
    expect(buildRetentionCohorts([], [], now)).toEqual([]);
  });
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `pnpm --filter @vkbacademy/api test -- retention.spec`
Expected: FAIL — `Cannot find module './retention'`.

- [ ] **Step 3: Implementar**

Crear `apps/api/src/admin/retention.ts`:

```ts
import { isoWeek, madridDay } from '../challenges/challenge-periods';

export interface RetentionStudent {
  id: string;
  createdAt: Date;
}

export interface RetentionActivity {
  userId: string;
  day: string;
  worked: boolean;
}

export interface RetentionCohort {
  week: string;
  signups: number;
  /** Porcentaje 0-100, o null mientras el plazo de la cohorte no haya cerrado. */
  d1Opened: number | null;
  d1Worked: number | null;
  d7Opened: number | null;
  d7Worked: number | null;
  d1Complete: boolean;
  d7Complete: boolean;
}

/** Suma n días a un día "2026-08-31" y devuelve el mismo formato. */
function addDays(day: string, n: number): string {
  const [year, month, date] = day.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, date + n));
  return d.toISOString().slice(0, 10);
}

const pct = (part: number, total: number) => (total === 0 ? 0 : Math.round((part / total) * 100));

/**
 * Cohortes semanales de retención.
 *
 * "Volver" es tener actividad **otro** día distinto al del alta: si contara el
 * propio día, todo alumno que se registra y prueba la app aparecería retenido.
 * D7 es "alguna vez entre el día 1 y el 7", no "el día 7 exacto", porque con
 * cohortes de diez alumnos el día exacto es ruido.
 */
export function buildRetentionCohorts(
  students: RetentionStudent[],
  activity: RetentionActivity[],
  now: Date,
): RetentionCohort[] {
  const opened = new Set(activity.map((a) => `${a.userId}|${a.day}`));
  const worked = new Set(activity.filter((a) => a.worked).map((a) => `${a.userId}|${a.day}`));
  const today = madridDay(now);

  const byWeek = new Map<string, RetentionStudent[]>();
  for (const student of students) {
    const week = isoWeek(student.createdAt);
    const list = byWeek.get(week);
    if (list) list.push(student);
    else byWeek.set(week, [student]);
  }

  const returnedWithin = (student: RetentionStudent, from: number, to: number, set: Set<string>) => {
    const signupDay = madridDay(student.createdAt);
    for (let offset = from; offset <= to; offset++) {
      if (set.has(`${student.id}|${addDays(signupDay, offset)}`)) return true;
    }
    return false;
  };

  return [...byWeek.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([week, cohort]) => {
      // El plazo cierra cuando el último alumno de la cohorte ha tenido tiempo.
      const lastSignup = cohort.reduce(
        (max, s) => (madridDay(s.createdAt) > max ? madridDay(s.createdAt) : max),
        '',
      );
      const d1Complete = today > addDays(lastSignup, 1);
      const d7Complete = today > addDays(lastSignup, 7);

      const count = (from: number, to: number, set: Set<string>) =>
        cohort.filter((s) => returnedWithin(s, from, to, set)).length;

      return {
        week,
        signups: cohort.length,
        d1Opened: d1Complete ? pct(count(1, 1, opened), cohort.length) : null,
        d1Worked: d1Complete ? pct(count(1, 1, worked), cohort.length) : null,
        d7Opened: d7Complete ? pct(count(1, 7, opened), cohort.length) : null,
        d7Worked: d7Complete ? pct(count(1, 7, worked), cohort.length) : null,
        d1Complete,
        d7Complete,
      };
    });
}
```

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `pnpm --filter @vkbacademy/api test -- retention.spec`
Expected: PASS, 9 tests.

- [ ] **Step 5: Verificar por mutación**

Cambiar `returnedWithin(s, 1, 1, ...)` por `returnedWithin(s, 0, 1, ...)` y ejecutar.
Expected: rojo en *"no cuenta como vuelta la actividad del propio día de alta"*. Deshacer.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/admin/retention.ts apps/api/src/admin/retention.spec.ts
git commit -m "feat(retencion): cálculo de cohortes D1/D7 como función pura (#126)"
```

---

### Task 6: Endpoint `GET /admin/analytics/retention`

**Files:**
- Create: `apps/api/src/admin/admin-retention.service.ts`
- Create: `apps/api/src/admin/admin-retention.service.spec.ts`
- Modify: `apps/api/src/admin/admin.controller.ts` (constructor y ruta nueva junto a `@Get('analytics')`, línea ~126)
- Modify: `apps/api/src/admin/admin.module.ts` (registrar el provider)

**Interfaces:**
- Consumes: `buildRetentionCohorts`, `RetentionCohort` de `./retention`; `PrismaService`.
- Produces: `AdminRetentionService.getRetention(weeks?: number): Promise<{ cohorts: RetentionCohort[] }>`. Por defecto 8 semanas.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `apps/api/src/admin/admin-retention.service.spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { AdminRetentionService } from './admin-retention.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AdminRetentionService', () => {
  let service: AdminRetentionService;
  let mockPrisma: {
    user: { findMany: jest.Mock };
    userActivityDay: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    mockPrisma = {
      user: { findMany: jest.fn().mockResolvedValue([]) },
      userActivityDay: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminRetentionService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get(AdminRetentionService);
    jest.clearAllMocks();
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.userActivityDay.findMany.mockResolvedValue([]);
  });

  it('solo mira a los alumnos', async () => {
    await service.getRetention();

    // Un admin entrando a diario inflaría las cohortes sin significar nada.
    const args = mockPrisma.user.findMany.mock.calls[0][0];
    expect(args.where.role).toBe(Role.STUDENT);
  });

  it('limita la ventana a las semanas pedidas', async () => {
    await service.getRetention(4);

    const args = mockPrisma.user.findMany.mock.calls[0][0];
    const desde = args.where.createdAt.gte as Date;
    const dias = (Date.now() - desde.getTime()) / 86_400_000;
    expect(Math.round(dias)).toBe(28);
  });

  it('devuelve las cohortes calculadas', async () => {
    const hace10dias = new Date(Date.now() - 10 * 86_400_000);
    mockPrisma.user.findMany.mockResolvedValue([{ id: 'a', createdAt: hace10dias }]);
    mockPrisma.userActivityDay.findMany.mockResolvedValue([]);

    const result = await service.getRetention();

    expect(result.cohorts).toHaveLength(1);
    expect(result.cohorts[0].signups).toBe(1);
  });

  it('no consulta la actividad si no hay alumnos en la ventana', async () => {
    await service.getRetention();

    expect(mockPrisma.userActivityDay.findMany).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `pnpm --filter @vkbacademy/api test -- admin-retention.service.spec`
Expected: FAIL — `Cannot find module './admin-retention.service'`.

- [ ] **Step 3: Implementar el servicio**

Crear `apps/api/src/admin/admin-retention.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildRetentionCohorts, RetentionCohort } from './retention';

const DEFAULT_WEEKS = 8;

/**
 * Retención por cohortes semanales. Vive fuera de `AdminAnalyticsService` a
 * propósito: aquel método ya hace nueve cosas y devuelve un payload grande.
 */
@Injectable()
export class AdminRetentionService {
  constructor(private readonly prisma: PrismaService) {}

  async getRetention(weeks = DEFAULT_WEEKS): Promise<{ cohorts: RetentionCohort[] }> {
    const since = new Date(Date.now() - weeks * 7 * 86_400_000);

    const students = await this.prisma.user.findMany({
      where: { role: Role.STUDENT, createdAt: { gte: since } },
      select: { id: true, createdAt: true },
    });
    if (students.length === 0) return { cohorts: [] };

    const activity = await this.prisma.userActivityDay.findMany({
      where: { userId: { in: students.map((s) => s.id) } },
      select: { userId: true, day: true, worked: true },
    });

    return { cohorts: buildRetentionCohorts(students, activity, new Date()) };
  }
}
```

- [ ] **Step 4: Exponer la ruta**

En `apps/api/src/admin/admin.module.ts`, añadir `AdminRetentionService` al array `providers` y su `import`.

En `apps/api/src/admin/admin.controller.ts`, añadir el `import`, el parámetro del constructor
(`private readonly adminRetentionService: AdminRetentionService,`) y la ruta, justo detrás de `@Get('analytics')`:

```ts
  @Get('analytics/retention')
  getRetention() {
    return this.adminRetentionService.getRetention();
  }
```

La clase ya lleva `@UseGuards(JwtAuthGuard, RolesGuard, AcademyGuard)` y `@Roles(Role.ADMIN)`, así que la ruta hereda los permisos sin tocar nada.

- [ ] **Step 5: Ejecutar y ver que pasa**

Run: `pnpm --filter @vkbacademy/api test -- admin-retention.service.spec`
Expected: PASS, 4 tests.

- [ ] **Step 6: Verificar por mutación**

Quitar `role: Role.STUDENT` del `where` y ejecutar.
Expected: rojo en *"solo mira a los alumnos"*. Deshacer.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/admin
git commit -m "feat(retencion): GET /admin/analytics/retention con cohortes semanales (#126)"
```

---

### Task 7: Sección "Retención" en el panel

**Files:**
- Modify: `apps/web/src/api/admin.api.ts` (tipo + función, junto a `getAnalytics`, línea ~470)
- Modify: `apps/web/src/pages/admin/AdminDashboardPage.tsx` (sección nueva detrás de "Alumnos en riesgo", línea ~356)
- Create: `apps/web/src/pages/admin/AdminDashboardPage.retention.test.tsx`

**Interfaces:**
- Consumes: `GET /admin/analytics/retention` de la Task 6.
- Produces: `AdminRetentionCohort` y `adminApi.getRetention()` en `admin.api.ts`.

- [ ] **Step 1: Añadir el contrato del cliente**

En `apps/web/src/api/admin.api.ts`:

```ts
export interface AdminRetentionCohort {
  week: string;
  signups: number;
  /** Porcentaje 0-100, o null mientras el plazo de la cohorte no haya cerrado. */
  d1Opened: number | null;
  d1Worked: number | null;
  d7Opened: number | null;
  d7Worked: number | null;
  d1Complete: boolean;
  d7Complete: boolean;
}
```

Y junto a `getAnalytics`:

```ts
  getRetention: () =>
    api
      .get<{ cohorts: AdminRetentionCohort[] }>('/admin/analytics/retention')
      .then((r) => r.data),
```

- [ ] **Step 2: Escribir el test que falla**

Crear `apps/web/src/pages/admin/AdminDashboardPage.retention.test.tsx`. Copiar el bloque de
mocks del fichero `AdminUsersPage.test.tsx` como referencia de estilo, mockeando
`adminApi.getAnalytics`, `adminApi.getMetrics`, `adminApi.listCertificates` (lo que la página
consuma) y `adminApi.getRetention`:

```tsx
it('pinta una fila por cohorte con sus porcentajes', async () => {
  mockGetRetention.mockResolvedValue({
    cohorts: [
      { week: '2026-W36', signups: 12, d1Opened: 58, d1Worked: 33, d7Opened: 75,
        d7Worked: 50, d1Complete: true, d7Complete: true },
    ],
  });

  renderPage();

  const fila = within((await screen.findByText('2026-W36')).closest('tr')!);
  expect(fila.getByText('12')).toBeInTheDocument();
  expect(fila.getByText('58%')).toBeInTheDocument();
  expect(fila.getByText('33%')).toBeInTheDocument();
});

it('no inventa un porcentaje para la cohorte cuyo plazo no ha cerrado', async () => {
  mockGetRetention.mockResolvedValue({
    cohorts: [
      { week: '2026-W40', signups: 3, d1Opened: 66, d1Worked: 33, d7Opened: null,
        d7Worked: null, d1Complete: true, d7Complete: false },
    ],
  });

  renderPage();

  // Un 0% que solo puede subir se lee como un mal dato, no como un dato pendiente.
  const fila = within((await screen.findByText('2026-W40')).closest('tr')!);
  expect(fila.queryByText('0%')).not.toBeInTheDocument();
  expect(fila.getAllByText('—').length).toBeGreaterThan(0);
});
```

- [ ] **Step 3: Ejecutar y ver que falla**

Run: `pnpm --filter @vkbacademy/web exec vitest run src/pages/admin/AdminDashboardPage.retention.test.tsx`
Expected: FAIL — no encuentra el texto de la cohorte.

- [ ] **Step 4: Implementar la sección**

En `AdminDashboardPage.tsx`, añadir la query y la sección, siguiendo el patrón que ya usa la página (`s.section`, `s.sectionTitle`, `className="vkb-card"`):

```tsx
  const { data: retention } = useQuery({
    queryKey: ['admin', 'retention'],
    queryFn: adminApi.getRetention,
  });
```

```tsx
      {/* ── Retención por cohortes ── */}
      {retention && retention.cohorts.length > 0 && (
        <section style={s.section}>
          <h2 style={s.sectionTitle}>Retención por semana de alta</h2>
          <div className="vkb-card" style={{ padding: '20px 24px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>Semana</th>
                  <th>Altas</th>
                  <th>Vuelve al día siguiente</th>
                  <th>Sigue la primera semana</th>
                </tr>
              </thead>
              <tbody>
                {retention.cohorts.map((c) => (
                  <tr key={c.week}>
                    <td>{c.week}</td>
                    <td>{c.signups}</td>
                    <td>
                      <RetentionCell opened={c.d1Opened} worked={c.d1Worked} />
                    </td>
                    <td>
                      <RetentionCell opened={c.d7Opened} worked={c.d7Worked} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
```

Y el componente auxiliar, al final del fichero junto a `AtRiskRow`:

```tsx
/** Abrió / trabajó. El guion es "todavía no se puede saber", no "cero". */
function RetentionCell({ opened, worked }: { opened: number | null; worked: number | null }) {
  if (opened === null) return <span style={{ opacity: 0.5 }}>—</span>;
  return (
    <span>
      {opened}% <span style={{ opacity: 0.6, fontSize: '0.8em' }}>({worked}% trabajó)</span>
    </span>
  );
}
```

- [ ] **Step 5: Ejecutar y ver que pasa**

Run: `pnpm --filter @vkbacademy/web exec vitest run src/pages/admin/AdminDashboardPage.retention.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 6: Verificar por mutación**

Cambiar `if (opened === null)` por `if (false)` y ejecutar.
Expected: rojo en *"no inventa un porcentaje para la cohorte cuyo plazo no ha cerrado"*. Deshacer.

- [ ] **Step 7: Comprobación completa**

```bash
pnpm --filter @vkbacademy/api test
pnpm --filter @vkbacademy/web exec tsc --noEmit
pnpm --filter @vkbacademy/web exec vitest run
```

Expected: las tres en verde.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src
git commit -m "feat(retencion): sección de retención por cohortes en el panel (#126)"
```
