# Resumen semanal a la familia — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la familia que lo pida reciba, una vez por semana, un correo con lo que ha hecho cada uno de sus hijos en la app — con consentimiento explícito, baja en cada correo y sin comparar a nadie con nadie.

**Architecture:** Entidad `GuardianSubscription` con el email de la familia como clave única y un `token` para la baja sin login. El consentimiento se recoge con una casilla desmarcada en el registro. El envío lo hace `GuardianDigestService` dentro de la API (testeable con Jest), invocado por un script que arranca un contexto de Nest desde un workflow de GitHub Actions con `schedule:` — el mismo patrón que `seed-curriculum.yml`, que se conecta a la BD con `secrets.DATABASE_URL`.

**Tech Stack:** NestJS 10, Prisma, PostgreSQL 16, Resend, React 18 + Vite, Jest (API), Vitest + Testing Library (web), GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-31-resumen-semanal-familia-design.md`

## Global Constraints

- **La rama sale de `feat/instrumentacion-retencion`, no de `main`.** Esto lee `UserActivityDay`, que llega en #126 (PR #131). #131 tiene que entrar antes.
- TypeScript `strict: true`. Sin `any` salvo justificación escrita en el código.
- Nombres en inglés; comentarios en español.
- Guards y roles antes que services, nunca dentro del service.
- El email de la familia va **siempre** normalizado (`trim().toLowerCase()`), como ya hace `RegisterStudentsDto`: es la única clave que agrupa a los hermanos.
- Los días se calculan **siempre** con `madridDay()` / `isoWeek()` de `apps/api/src/challenges/challenge-periods.ts`.
- **El correo enlaza a la página web de baja, nunca al endpoint.** Un `GET` que da de baja lo disparan solos los escáneres de los clientes de correo.
- Ningún contenido del correo compara alumnos entre sí, ni hermanos entre sí, ni menciona puestos.
- Cada test nuevo se verifica **por mutación**.
- Comandos con scope: `pnpm --filter @vkbacademy/api`, `pnpm --filter @vkbacademy/web`. Nunca `--no-verify`.

---

### Task 1: Modelo `GuardianSubscription` y migración

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_add_guardian_subscription/migration.sql`

**Interfaces:**
- Produces: modelo `GuardianSubscription` con `id`, `email` (único), `consentAt`, `unsubscribedAt`, `token` (único), `lastSentWeek`, `createdAt`.

- [ ] **Step 1: Añadir el modelo**

```prisma
/// Suscripción de una familia al resumen semanal. La clave es el email porque
/// `guardianEmail` está copiado en cada hermano y no hay ninguna entidad que
/// represente a la familia; atarla a un User obligaría a elegir un hermano
/// como titular.
model GuardianSubscription {
  id String @id @default(cuid())

  /// Normalizado (trim + lowercase) igual que en RegisterStudentsDto.
  email          String    @unique
  consentAt      DateTime
  unsubscribedAt DateTime?

  /// Permite darse de baja sin cuenta ni login: el tutor no tiene ninguna.
  token String @unique

  /// "2026-W36" de la última semana enviada. Si Actions dispara dos veces, la
  /// segunda no envía.
  lastSentWeek String?

  createdAt DateTime @default(now())
}
```

- [ ] **Step 2: Generar la migración**

Run: `pnpm --filter @vkbacademy/api exec prisma migrate dev --name add_guardian_subscription`

- [ ] **Step 3: Comprobar que es aditiva**

Run: `cat apps/api/prisma/migrations/*add_guardian_subscription/migration.sql`
Expected: solo `CREATE TABLE` y dos `CREATE UNIQUE INDEX`. Ningún `DROP`, ningún `ALTER TYPE`.

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma
git commit -m "feat(digest): modelo GuardianSubscription con consentimiento y baja (#129)"
```

---

### Task 2: Consentimiento en el registro

**Files:**
- Modify: `apps/api/src/auth/dto/register-students.dto.ts`
- Modify: `apps/api/src/auth/auth.service.ts` (`registerStudents`)
- Modify: `apps/api/src/auth/auth.service.spec.ts`

**Interfaces:**
- Consumes: `RegisterStudentsDto`.
- Produces: `RegisterStudentsDto.guardianDigestConsent?: boolean`; `registerStudents` hace `upsert` de `GuardianSubscription` cuando llega `true`.

- [ ] **Step 1: Escribir los tests que fallan**

En `apps/api/src/auth/auth.service.spec.ts`, dentro del `describe` de `registerStudents` (añadir `guardianSubscription: { upsert: jest.fn() }` al mock de Prisma):

```ts
it('no crea suscripción si no se marca la casilla', async () => {
  await service.registerStudents(dtoBase);

  // El email sigue siendo solo un dato de contacto, como hasta ahora.
  expect(mockPrisma.guardianSubscription.upsert).not.toHaveBeenCalled();
});

it('crea la suscripción cuando se marca la casilla', async () => {
  await service.registerStudents({ ...dtoBase, guardianDigestConsent: true });

  const args = mockPrisma.guardianSubscription.upsert.mock.calls[0][0];
  expect(args.where.email).toBe(dtoBase.guardianEmail);
  expect(args.create.consentAt).toBeInstanceOf(Date);
  expect(typeof args.create.token).toBe('string');
});

it('reactiva una baja anterior si la familia vuelve a marcar la casilla', async () => {
  await service.registerStudents({ ...dtoBase, guardianDigestConsent: true });

  const args = mockPrisma.guardianSubscription.upsert.mock.calls[0][0];
  expect(args.update.unsubscribedAt).toBeNull();
});

it('el token es distinto en cada suscripción', async () => {
  await service.registerStudents({ ...dtoBase, guardianDigestConsent: true });
  await service.registerStudents({ ...dtoBase, guardianDigestConsent: true });

  const t1 = mockPrisma.guardianSubscription.upsert.mock.calls[0][0].create.token;
  const t2 = mockPrisma.guardianSubscription.upsert.mock.calls[1][0].create.token;
  expect(t1).not.toBe(t2);
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `pnpm --filter @vkbacademy/api test -- auth.service.spec`

- [ ] **Step 3: Implementar**

En el DTO:

```ts
  /**
   * Consentimiento explícito para el resumen semanal. Por defecto false: el
   * email es un dato de contacto y registrar a un hijo no es suscribirse.
   */
  @IsOptional()
  @IsBoolean()
  guardianDigestConsent?: boolean;
```

En `registerStudents`, después de crear los alumnos (fuera de la transacción: que falle el
correo no puede tumbar el alta):

```ts
    if (dto.guardianDigestConsent) {
      await this.prisma.guardianSubscription.upsert({
        where: { email: dto.guardianEmail },
        create: {
          email: dto.guardianEmail,
          consentAt: new Date(),
          token: randomBytes(32).toString('hex'),
        },
        // Volver a marcar la casilla reactiva una baja anterior. No se toca el
        // token: los enlaces ya enviados siguen sirviendo para darse de baja.
        update: { consentAt: new Date(), unsubscribedAt: null },
      });
    }
```

Con `import { randomBytes } from 'crypto';`.

- [ ] **Step 4: Ejecutar y ver que pasa** — `pnpm --filter @vkbacademy/api test -- auth.service.spec`

- [ ] **Step 5: Verificar por mutación**

Quitar el `if (dto.guardianDigestConsent)` → rojo en *"no crea suscripción si no se marca la casilla"*. Deshacer.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/auth
git commit -m "feat(digest): consentimiento explícito del tutor en el registro (#129)"
```

---

### Task 3: La casilla y el propósito en el formulario

**Files:**
- Modify: `apps/web/src/pages/RegisterPage.tsx`
- Modify: `apps/web/src/api/auth.api.ts` (payload de registro)
- Create: `apps/web/src/pages/RegisterPage.consent.test.tsx`

**Interfaces:**
- Consumes: `POST /auth/register-students` con `guardianDigestConsent`.

- [ ] **Step 1: Escribir los tests que fallan**

```tsx
it('no pide el resumen si no se marca la casilla', async () => {
  renderPage();
  await rellenarFormularioMinimo();

  await userEvent.click(screen.getByRole('button', { name: /crear/i }));

  expect(mockRegister.mock.calls[0][0].guardianDigestConsent).toBe(false);
});

it('pide el resumen cuando se marca', async () => {
  renderPage();
  await rellenarFormularioMinimo();
  await userEvent.click(screen.getByLabelText(/resumen semanal/i));

  await userEvent.click(screen.getByRole('button', { name: /crear/i }));

  expect(mockRegister.mock.calls[0][0].guardianDigestConsent).toBe(true);
});

it('dice para qué se usa el email del tutor', async () => {
  renderPage();

  // Hoy el campo se pide sin decir para qué, y la pantalla siguiente llega a
  // decir que no se envían correos. Si se va a escribir, hay que declararlo.
  expect(screen.getByText(/te escribiremos|resumen semanal/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Ejecutar y ver que falla** — `pnpm --filter @vkbacademy/web exec vitest run src/pages/RegisterPage.consent.test.tsx`

- [ ] **Step 3: Implementar**

Estado `const [digestConsent, setDigestConsent] = useState(false);`, incluirlo en el payload, y bajo el campo del email:

```tsx
<label htmlFor="digestConsent" style={s.checkboxRow}>
  <input
    id="digestConsent"
    type="checkbox"
    checked={digestConsent}
    onChange={(e) => setDigestConsent(e.target.checked)}
  />
  <span>
    Quiero recibir un <strong>resumen semanal</strong> de lo que estudian mis hijos. Puedes
    darte de baja desde cualquiera de esos correos.
  </span>
</label>
```

Y ajustar el texto de ayuda del campo del email para que diga para qué se usa.

- [ ] **Step 4: Ejecutar y ver que pasa**
- [ ] **Step 5: Verificar por mutación** — mandar siempre `true` → rojo en *"no pide el resumen si no se marca la casilla"*.
- [ ] **Step 6: Commit**

```bash
git add apps/web/src
git commit -m "feat(digest): casilla de consentimiento y propósito del email en el registro (#129)"
```

---

### Task 4: Baja sin login

**Files:**
- Create: `apps/api/src/guardians/guardians.controller.ts`, `guardians.service.ts`, `guardians.service.spec.ts`, `guardians.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Create: `apps/web/src/pages/marketing/UnsubscribePage.tsx`
- Modify: `apps/web/src/App.tsx` (ruta `/baja/:token` dentro de `PublicLayout`)
- Create: `apps/web/src/pages/marketing/UnsubscribePage.test.tsx`

**Interfaces:**
- Produces: `POST /guardians/unsubscribe/:token` → `{ ok: true }`. Público, sin `@UseGuards`, como `GET /certificates/verify/:code`.
- `GuardiansService.unsubscribe(token: string): Promise<{ ok: true }>`.

- [ ] **Step 1: Escribir los tests que fallan**

```ts
it('marca la baja con la fecha actual', async () => {
  mockPrisma.guardianSubscription.updateMany.mockResolvedValue({ count: 1 });

  await service.unsubscribe('tok');

  const args = mockPrisma.guardianSubscription.updateMany.mock.calls[0][0];
  expect(args.where.token).toBe('tok');
  expect(args.data.unsubscribedAt).toBeInstanceOf(Date);
});

it('no pisa la fecha de una baja anterior', async () => {
  await service.unsubscribe('tok');

  // Darse de baja dos veces no puede parecer una baja nueva.
  const args = mockPrisma.guardianSubscription.updateMany.mock.calls[0][0];
  expect(args.where.unsubscribedAt).toBeNull();
});

it('responde igual con un token que no existe', async () => {
  mockPrisma.guardianSubscription.updateMany.mockResolvedValue({ count: 0 });

  // No filtrar si el token es válido: el endpoint es público.
  await expect(service.unsubscribe('inventado')).resolves.toEqual({ ok: true });
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

- [ ] **Step 3: Implementar el servicio y el controller**

```ts
// guardians.service.ts
async unsubscribe(token: string): Promise<{ ok: true }> {
  await this.prisma.guardianSubscription.updateMany({
    where: { token, unsubscribedAt: null },
    data: { unsubscribedAt: new Date() },
  });
  // Siempre ok: el endpoint es público y decir "ese token no existe" convertiría
  // la baja en un oráculo de qué tokens son válidos.
  return { ok: true };
}
```

```ts
// guardians.controller.ts
@Controller('guardians')
export class GuardiansController {
  constructor(private readonly guardians: GuardiansService) {}

  /** Baja del resumen semanal — pública, sin JWT: el tutor no tiene cuenta. */
  @Post('unsubscribe/:token')
  unsubscribe(@Param('token') token: string) {
    return this.guardians.unsubscribe(token);
  }
}
```

Registrar `GuardiansModule` en `app.module.ts`.

- [ ] **Step 4: La página pública**

`UnsubscribePage.tsx`: muestra un botón "Darme de baja" que hace el `POST`, y tras la
respuesta un mensaje de confirmación. **No hace la llamada al montarse**: el correo enlaza
aquí, y los escáneres de los clientes de correo abrirían la página sola.

Ruta en `App.tsx`, dentro del bloque `<Route element={<PublicLayout />}>`:

```tsx
<Route path="/baja/:token" element={<UnsubscribePage />} />
```

Test de la web:

```tsx
it('no da de baja solo por abrir la página', async () => {
  renderPage('/baja/tok');

  await screen.findByRole('button', { name: /darme de baja/i });
  // Los escáneres de correo abren los enlaces solos: si bastara con abrir,
  // darían de baja a familias que no lo han pedido.
  expect(mockUnsubscribe).not.toHaveBeenCalled();
});

it('da de baja al pulsar el botón', async () => {
  renderPage('/baja/tok');

  await userEvent.click(await screen.findByRole('button', { name: /darme de baja/i }));

  expect(mockUnsubscribe).toHaveBeenCalledWith('tok');
  expect(await screen.findByText(/no volverás a recibir/i)).toBeInTheDocument();
});
```

- [ ] **Step 5: Ejecutar y ver que pasan** (API y web)
- [ ] **Step 6: Verificar por mutación** — llamar al `POST` en un `useEffect` al montar → rojo en *"no da de baja solo por abrir la página"*.
- [ ] **Step 7: Commit**

```bash
git add apps/api/src apps/web/src
git commit -m "feat(digest): baja del resumen semanal sin login (#129)"
```

---

### Task 5: `GuardianDigestService`

**Files:**
- Modify: `apps/api/src/challenges/challenge-periods.ts` (exportar `addDays`)
- Modify: `apps/api/src/admin/retention.ts` (usar el `addDays` compartido en vez del local)
- Create: `apps/api/src/guardians/guardian-digest.service.ts`, `guardian-digest.service.spec.ts`
- Modify: `apps/api/src/guardians/guardians.module.ts` (proveerlo; importar `NotificationsModule`)

**Interfaces:**
- Consumes: `NotificationsService.sendEmail(to, subject, html)`; `isoWeek`, `previousIsoWeek`, `currentWeekStart`, `madridDay`, `addDays`.
- Produces: `GuardianDigestService.sendWeeklyDigests(opts?: { dryRun?: boolean }): Promise<{ sent: number; skipped: number }>`.

- [ ] **Step 1: Escribir los tests que fallan**

```ts
it('solo mira suscripciones vivas', async () => {
  mockPrisma.guardianSubscription.findMany.mockResolvedValue([]);

  await service.sendWeeklyDigests();

  const args = mockPrisma.guardianSubscription.findMany.mock.calls[0][0];
  expect(args.where.unsubscribedAt).toBeNull();
});

it('salta las familias ya enviadas esta semana', async () => {
  // Idempotencia: Actions puede disparar dos veces.
  darFamiliaConDosHijos({ lastSentWeek: isoWeek(new Date()) });

  const result = await service.sendWeeklyDigests();

  expect(mockNotifications.sendEmail).not.toHaveBeenCalled();
  expect(result.skipped).toBe(1);
});

it('envía a la familia que nunca ha recibido nada', async () => {
  // El filtro va en código y no como `NOT: { lastSentWeek: semana }`: en SQL,
  // NOT sobre una columna NULL da desconocido, así que una familia nueva
  // quedaría excluida para siempre sin que nada fallara.
  darFamiliaConDosHijos({ lastSentWeek: null });

  await service.sendWeeklyDigests();

  expect(mockNotifications.sendEmail).toHaveBeenCalledTimes(1);
});

it('manda un solo correo por familia, no uno por hermano', async () => {
  darFamiliaConDosHijos();

  await service.sendWeeklyDigests();

  expect(mockNotifications.sendEmail).toHaveBeenCalledTimes(1);
});

it('incluye a los dos hermanos en el mismo correo', async () => {
  darFamiliaConDosHijos();

  await service.sendWeeklyDigests();

  const html = mockNotifications.sendEmail.mock.calls[0][2] as string;
  expect(html).toContain('Ana');
  expect(html).toContain('Bruno');
});

it('incluye el enlace de baja apuntando a la página, no al endpoint', async () => {
  darFamiliaConDosHijos();

  await service.sendWeeklyDigests();

  const html = mockNotifications.sendEmail.mock.calls[0][2] as string;
  expect(html).toContain('/baja/tok');
  expect(html).not.toContain('/guardians/unsubscribe');
});

it('dice sin juicio que un hijo no ha entrado', async () => {
  darFamiliaSinActividad();

  await service.sendWeeklyDigests();

  const html = mockNotifications.sendEmail.mock.calls[0][2] as string;
  expect(html).toContain('no ha entrado');
});

it('no compara a los hermanos entre sí', async () => {
  darFamiliaConDosHijos();

  await service.sendWeeklyDigests();

  const html = mockNotifications.sendEmail.mock.calls[0][2] as string;
  expect(html).not.toMatch(/más que|menos que|mejor que|puesto/i);
});

it('marca la semana después de enviar, no antes', async () => {
  darFamiliaConDosHijos();
  mockNotifications.sendEmail.mockRejectedValue(new Error('Resend caído'));

  await service.sendWeeklyDigests();

  // Si se marcara antes, un fallo de Resend daría la semana por enviada y esa
  // familia se quedaría sin correo hasta la siguiente.
  expect(mockPrisma.guardianSubscription.update).not.toHaveBeenCalled();
});

it('en dry-run no envía nada ni marca la semana', async () => {
  darFamiliaConDosHijos();

  const result = await service.sendWeeklyDigests({ dryRun: true });

  expect(mockNotifications.sendEmail).not.toHaveBeenCalled();
  expect(mockPrisma.guardianSubscription.update).not.toHaveBeenCalled();
  expect(result.sent).toBe(1);
});

it('salta la familia cuyos alumnos ya no existen', async () => {
  mockPrisma.user.findMany.mockResolvedValue([]);

  const result = await service.sendWeeklyDigests();

  expect(mockNotifications.sendEmail).not.toHaveBeenCalled();
  expect(result.skipped).toBe(1);
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

- [ ] **Step 3: Implementar**

`addDays` pasa a `challenge-periods.ts` (exportada, con su test ya cubierto por `retention.spec.ts`) y `retention.ts` la importa en vez de declararla.

El servicio, en orden: resolver semana actual (`isoWeek`) y la semana que se reporta
(lunes anterior, vía `currentWeekStart` menos 7 días); traer las suscripciones vivas y no
enviadas; por cada una, los alumnos con ese `guardianEmail`; su actividad de esa semana
(`UserActivityDay` con `worked: true` y `day` entre los siete días) y sus certificados
(`issuedAt` dentro de la ventana); construir el HTML; enviar; y **solo entonces** marcar
`lastSentWeek`.

El HTML lo construye una función aparte, `buildDigestHtml(children, unsubscribeUrl)`, para
poder probar el contenido sin tocar Prisma. La URL de baja sale de `FRONTEND_URL` (primer
origen si viene separado por comas) + `/baja/<token>`.

- [ ] **Step 4: Ejecutar y ver que pasan**
- [ ] **Step 5: Verificar por mutación** — marcar `lastSentWeek` antes de enviar → rojo en *"marca la semana después de enviar"*; mandar un correo por alumno → rojo en *"un solo correo por familia"*.
- [ ] **Step 6: Commit**

```bash
git add apps/api/src
git commit -m "feat(digest): resumen semanal por familia, con baja y sin comparaciones (#129)"
```

---

### Task 6: Script y workflow

**Files:**
- Create: `apps/api/scripts/send-weekly-digest.ts`
- Create: `.github/workflows/weekly-digest.yml`

**Interfaces:**
- Consumes: `GuardianDigestService.sendWeeklyDigests({ dryRun })`.

- [ ] **Step 1: El script**

```ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { GuardianDigestService } from '../src/guardians/guardian-digest.service';

/**
 * Envío del resumen semanal. Lo lanza `.github/workflows/weekly-digest.yml`.
 * La lógica vive en el servicio, dentro de la API, para poder testearla; aquí
 * solo se arranca el contexto de Nest y se llama.
 */
async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['warn', 'error'] });
  try {
    const result = await app.get(GuardianDigestService).sendWeeklyDigests({ dryRun });
    console.log(`Resumen semanal: ${result.sent} enviados, ${result.skipped} saltados${dryRun ? ' (dry-run)' : ''}`);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: El workflow**

`.github/workflows/weekly-digest.yml`, copiando la estructura de `seed-curriculum.yml`
(checkout, pnpm 9.14.4, node 20, `pnpm install --frozen-lockfile`, `prisma generate`):

```yaml
on:
  schedule:
    # Lunes a las 07:00 UTC. El cron de Actions no entiende de horario de
    # verano: en invierno llega una hora antes en Madrid.
    - cron: '0 7 * * 1'
  workflow_dispatch:
    inputs:
      environment:
        description: 'Entorno al que se envía'
        type: choice
        options: [pre, prod]
        default: pre
      dryRun:
        description: 'Dry-run: no envía nada, solo cuenta'
        type: boolean
        default: true
```

El job usa `environment: ${{ inputs.environment == 'prod' && 'prod-canary' || 'pre' }}` y pasa
`DATABASE_URL`, `RESEND_API_KEY`, `EMAIL_FROM` y `FRONTEND_URL` desde `secrets`/`vars`.

**El disparo programado no tiene `inputs`**, así que hay que dar valores por defecto
explícitos (`inputs.dryRun || false`) o el cron enviaría en dry-run para siempre.

- [ ] **Step 3: Comprobar el YAML**

Run: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/weekly-digest.yml'))" && echo OK`

- [ ] **Step 4: Comprobación completa**

```bash
pnpm --filter @vkbacademy/api test
pnpm --filter @vkbacademy/web exec tsc --noEmit
pnpm --filter @vkbacademy/web exec vitest run
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/scripts .github/workflows
git commit -m "feat(digest): workflow semanal que envía el resumen (#129)"
```
