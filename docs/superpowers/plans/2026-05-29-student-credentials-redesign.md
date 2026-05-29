# Rediseño de credenciales de alumnos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar el almacenamiento y la exposición de contraseñas de alumnos: cada alumno entra con un `username` legible y una contraseña global por defecto que debe cambiar en el primer login; el tutor puede crear alumnos y restablecer su contraseña sin ver nunca la real.

**Architecture:** Backend NestJS + Prisma. Se añade `username` y `mustChangePassword` a `User`, se elimina `viewablePassword` y todo `CryptoService`. El registro de tutor y un nuevo endpoint de alta crean alumnos con contraseña por defecto `DEFAULT_STUDENT_PASSWORD` + flag. Un interceptor global bloquea endpoints mutadores hasta que el alumno cambie la contraseña. Frontend React fuerza el cambio con una pantalla dedicada y reemplaza la tabla de credenciales por un panel de accesos (usuario + restablecer + añadir alumno).

**Tech Stack:** NestJS, Prisma, PostgreSQL, Jest (unit + e2e), React 18 + Vite, React Query, Zustand, Vitest.

---

## Convenciones del repo (leer antes de empezar)

- Comando API: `pnpm --filter @vkbacademy/api ...` (scope completo).
- Tests API unit: `pnpm --filter @vkbacademy/api test`. Type-check web: `pnpm --filter @vkbacademy/web exec tsc --noEmit`.
- Migraciones: `pnpm --filter @vkbacademy/api prisma migrate dev --name <nombre>`. **NO** corren en el contenedor de Render; se aplican vía pipeline. En local sí.
- Comentarios en español, identificadores en inglés. TS `strict`, sin `any` sin justificar.
- Guards/roles en guard/decorador, nunca en service.
- Commits estilo `feat(auth):`, `fix(web):`, etc. Nunca `--no-verify`.
- Rama de trabajo ya creada: `feat/student-credentials-redesign`.

## File Structure

**Backend — crear:**

- `apps/api/src/auth/auth.constants.ts` — constante `DEFAULT_STUDENT_PASSWORD`.
- `apps/api/src/username/username.service.ts` — slugify + asignación de usernames únicos.
- `apps/api/src/username/username.module.ts` — módulo `@Global` que exporta `UsernameService`.
- `apps/api/src/username/username.service.spec.ts` — tests unitarios.
- `apps/api/src/auth/dto/change-password.dto.ts` — DTO `{ newPassword }`.
- `apps/api/src/auth/decorators/allow-when-must-change.decorator.ts` — decorador + clave de metadata.
- `apps/api/src/auth/interceptors/must-change-password.interceptor.ts` — interceptor global.
- `apps/api/src/tutors/dto/add-student.dto.ts` — DTO `{ name, schoolYearId }`.

**Backend — modificar:**

- `apps/api/prisma/schema.prisma` — campos `username`, `mustChangePassword`; quitar `viewablePassword`; `email` nullable.
- `apps/api/src/auth/auth.service.ts` — `registerTutor`, `login`, `toPublic`, `changePassword`, quitar crypto y generación de email/contraseña.
- `apps/api/src/auth/auth.controller.ts` — endpoint `change-password`.
- `apps/api/src/auth/auth.module.ts` — quitar dependencia de Crypto si la hubiera (no la tiene en imports; se inyecta vía `@Global`).
- `apps/api/src/tutors/tutors.service.ts` — quitar `getStudentsCredentials`; añadir `addStudent`, `resetStudentPassword`; `getMyStudents` devuelve `username`.
- `apps/api/src/tutors/tutors.controller.ts` — quitar `my-students/credentials`; añadir `POST my-students` y `POST my-students/:id/reset-password`.
- `apps/api/src/tutors/tutors.module.ts` — sin cambios salvo que falle DI (UsernameService es global).
- `apps/api/src/admin/admin.service.ts` — quitar uso de `viewablePassword`/`CryptoService`.
- `apps/api/src/app.module.ts` — importar `UsernameModule`, registrar interceptor global, quitar `CryptoModule`.
- `apps/api/src/notifications/notifications.service.ts` + `.spec.ts` — email con usuario + contraseña por defecto.
- `apps/api/.env.example` — quitar `STUDENT_PASSWORD_ENC_KEY`.
- Specs afectadas: `auth-register-tutor.service.spec.ts`, `tutors.service.spec.ts`.

**Backend — eliminar:**

- `apps/api/src/crypto/crypto.service.ts`, `crypto.module.ts`, `crypto.service.spec.ts`.

**Frontend — crear:**

- `apps/web/src/pages/ChangePasswordPage.tsx` — pantalla de cambio obligatorio.
- `apps/web/src/components/tutor/StudentAccessPanel.tsx` — usuario + restablecer + añadir alumno (reemplaza `StudentCredentialsTable`).

**Frontend — modificar:**

- `packages/shared/src/types/user.types.ts` — `username`, `mustChangePassword`.
- `apps/web/src/api/auth.api.ts` — `changePassword`.
- `apps/web/src/api/tutors.api.ts` — quitar `getStudentsCredentials`; añadir `addStudent`, `resetStudentPassword`; `StudentSummary.username`.
- `apps/web/src/hooks/useAuth.ts` — redirigir a `/change-password` si `mustChangePassword`.
- `apps/web/src/App.tsx` — ruta `/change-password`.
- `apps/web/src/layouts/AppLayout.tsx` — gate que redirige a `/change-password`.
- `apps/web/src/pages/RegisterPage.tsx` — texto del hint.
- `apps/web/src/pages/TutorStudentsPage.tsx` — usar `StudentAccessPanel`; mostrar `username` en lugar de email.

**Frontend — eliminar:**

- `apps/web/src/components/tutor/StudentCredentialsTable.tsx`.

---

## FASE 1 — Modelo de datos

### Task 1: Migración Prisma (username, mustChangePassword, drop viewablePassword, email nullable)

**Files:**

- Modify: `apps/api/prisma/schema.prisma:72-90` (modelo `User`)
- Create: `apps/api/prisma/migrations/<timestamp>_student_credentials_redesign/migration.sql` (generada por Prisma + edición manual del backfill)

- [ ] **Step 1: Editar el modelo `User` en el schema**

En `apps/api/prisma/schema.prisma`, sustituir el bloque de credenciales/identidad del modelo `User`. Cambios:

- `email` pasa a opcional.
- borrar `viewablePassword`.
- añadir `username` (opcional, único) y `mustChangePassword`.

```prisma
model User {
  id           String   @id @default(cuid())
  email        String?  @unique
  username     String?  @unique // identificador de login del alumno (slug del nombre)
  passwordHash String
  mustChangePassword Boolean @default(false) // true tras crear/restablecer hasta que el alumno la cambie
  role         Role     @default(STUDENT)
  name         String
  avatarUrl    String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
```

(El resto del modelo `User` se mantiene igual. Asegúrate de borrar la línea `viewablePassword String?  // ...`.)

- [ ] **Step 2: Generar la migración**

Run: `pnpm --filter @vkbacademy/api prisma migrate dev --name student_credentials_redesign --create-only`
Expected: crea la carpeta de migración con `migration.sql` sin aplicarla todavía.

- [ ] **Step 3: Añadir el backfill al `migration.sql`**

Abre el `migration.sql` generado. Tras las sentencias `ALTER TABLE` que añaden `username` y `mustChangePassword` y **antes** de cualquier `DROP COLUMN`, añade el backfill de datos existentes. El resultado debe contener (orden importa):

```sql
-- Añadir columnas nuevas (generado por Prisma): username, mustChangePassword, email nullable
-- ... (sentencias ALTER de Prisma) ...

-- Backfill: los alumnos existentes adoptan como username el local-part de su email falso
-- (ya es un slug único) y quedan obligados a cambiar la contraseña.
UPDATE "User"
SET "username" = split_part("email", '@', 1),
    "mustChangePassword" = true
WHERE "role" = 'STUDENT' AND "email" IS NOT NULL;

-- Los alumnos dejan de tener email (su login es el username)
UPDATE "User"
SET "email" = NULL
WHERE "role" = 'STUDENT' AND "email" LIKE '%@vkbacademy.com';

-- Eliminar el almacenamiento reversible de contraseñas
-- ... (DROP COLUMN "viewablePassword" generado por Prisma) ...
```

Si Prisma colocó el `DROP COLUMN "viewablePassword"` antes de los UPDATE, muévelo después de los UPDATE (los UPDATE no dependen de esa columna, pero mantener el orden lógico evita confusión).

- [ ] **Step 4: Aplicar la migración**

Run: `pnpm --filter @vkbacademy/api prisma migrate dev`
Expected: aplica la migración y regenera Prisma Client sin errores.

- [ ] **Step 5: Regenerar Prisma Client (si no se hizo)**

Run: `pnpm --filter @vkbacademy/api prisma generate`
Expected: `Generated Prisma Client`.

- [ ] **Step 6: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(db): username y mustChangePassword en User; elimina viewablePassword"
```

---

### Task 2: `UsernameService` (slugify + asignación única)

**Files:**

- Create: `apps/api/src/username/username.service.ts`
- Create: `apps/api/src/username/username.module.ts`
- Test: `apps/api/src/username/username.service.spec.ts`

- [ ] **Step 1: Escribir el test que falla**

Crea `apps/api/src/username/username.service.spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { UsernameService } from './username.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsernameService', () => {
  let service: UsernameService;
  let mockPrisma: { user: { findUnique: jest.Mock } };

  beforeEach(async () => {
    mockPrisma = { user: { findUnique: jest.fn().mockResolvedValue(null) } };
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsernameService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get(UsernameService);
  });

  it('slugifica nombres con tildes y ñ a ASCII en minúsculas', () => {
    expect(service.slugify('María Pérez Ñoño')).toBe('maria-perez-nono');
  });

  it('asigna un username por nombre cuando no hay colisiones', async () => {
    const result = await service.allocate(['Juan García']);
    expect(result).toEqual(['juan-garcia']);
  });

  it('añade sufijo numérico cuando el username ya existe en BD', async () => {
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ id: 'x' }) // juan-garcia ocupado
      .mockResolvedValueOnce(null); // juan-garcia-2 libre
    const result = await service.allocate(['Juan García']);
    expect(result).toEqual(['juan-garcia-2']);
  });

  it('desambigua dos nombres iguales en la misma tanda', async () => {
    const result = await service.allocate(['Juan García', 'Juan García']);
    expect(result).toEqual(['juan-garcia', 'juan-garcia-2']);
  });

  it('usa "alumno" como base cuando el nombre no produce slug', async () => {
    const result = await service.allocate(['***']);
    expect(result).toEqual(['alumno']);
  });
});
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `pnpm --filter @vkbacademy/api test -- username.service`
Expected: FAIL — `Cannot find module './username.service'`.

- [ ] **Step 3: Implementar `UsernameService`**

Crea `apps/api/src/username/username.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Genera identificadores de login legibles y únicos para alumnos.
 * El username es el slug del nombre; las colisiones se resuelven con sufijo (-2, -3, ...).
 */
@Injectable()
export class UsernameService {
  constructor(private readonly prisma: PrismaService) {}

  /** "María Pérez Ñoño" → "maria-perez-nono" */
  slugify(name: string): string {
    return (
      name
        .normalize('NFD')
        // Marca de diacríticos: U+0300 a U+036F (tildes, virgulillas, etc.)
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
    );
  }

  /**
   * Asigna un username único por cada nombre recibido.
   * Comprueba colisiones contra BD y contra los ya asignados en esta misma tanda.
   */
  async allocate(names: string[]): Promise<string[]> {
    const used = new Set<string>();
    const result: string[] = [];

    for (const name of names) {
      const base = this.slugify(name) || 'alumno';
      let candidate = base;
      let suffix = 1;

      while (
        used.has(candidate) ||
        (await this.prisma.user.findUnique({ where: { username: candidate } }))
      ) {
        suffix++;
        candidate = `${base}-${suffix}`;
      }

      used.add(candidate);
      result.push(candidate);
    }

    return result;
  }
}
```

Crea `apps/api/src/username/username.module.ts`:

```ts
import { Global, Module } from '@nestjs/common';
import { UsernameService } from './username.service';

@Global()
@Module({
  providers: [UsernameService],
  exports: [UsernameService],
})
export class UsernameModule {}
```

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

Run: `pnpm --filter @vkbacademy/api test -- username.service`
Expected: PASS (5 tests).

- [ ] **Step 5: Registrar `UsernameModule` en `AppModule`**

En `apps/api/src/app.module.ts`, añade el import `import { UsernameModule } from './username/username.module';` y añádelo al array `imports` del `@Module` (junto a los demás módulos de feature).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/username apps/api/src/app.module.ts
git commit -m "feat(api): UsernameService para login legible de alumnos"
```

---

### Task 3: Constante `DEFAULT_STUDENT_PASSWORD`

**Files:**

- Create: `apps/api/src/auth/auth.constants.ts`

- [ ] **Step 1: Crear el archivo de constantes**

```ts
/**
 * Contraseña por defecto con la que nace o se restablece la cuenta de un alumno.
 * No es un secreto: el alumno está obligado a cambiarla en el primer login
 * (flag User.mustChangePassword). Cumple el mínimo de 8 caracteres del DTO.
 */
export const DEFAULT_STUDENT_PASSWORD = 'cambiar123';
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/auth/auth.constants.ts
git commit -m "feat(auth): constante DEFAULT_STUDENT_PASSWORD"
```

---

## FASE 2 — Registro y login

### Task 4: Refactor `registerTutor` (username + contraseña por defecto, sin crypto)

**Files:**

- Modify: `apps/api/src/auth/auth.service.ts:106-253` (registerTutor + helpers de email/contraseña)
- Modify: `apps/api/src/auth/auth.service.ts:40-48` (constructor: inyectar `UsernameService`, quitar `CryptoService`)
- Test: `apps/api/src/auth/auth-register-tutor.service.spec.ts`

- [ ] **Step 1: Actualizar el spec de `registerTutor` (TDD rojo)**

En `apps/api/src/auth/auth-register-tutor.service.spec.ts`:

1. Quitar el import y el mock de `CryptoService`. Borrar el bloque `mockCrypto` (líneas ~105, 142-145, 157) y, en `providers`, sustituir `{ provide: CryptoService, useValue: mockCrypto }` por `{ provide: UsernameService, useValue: mockUsername }`.
2. Añadir el import `import { UsernameService } from '../username/username.service';` y `import { DEFAULT_STUDENT_PASSWORD } from './auth.constants';`.
3. Declarar y construir el mock de usernames en `beforeEach`:

```ts
let mockUsername: { slugify: jest.Mock; allocate: jest.Mock };
// ... dentro de beforeEach, antes de crear el módulo:
mockUsername = {
  slugify: jest.fn((n: string) => n.toLowerCase().replace(/\s+/g, '-')),
  allocate: jest.fn((names: string[]) =>
    Promise.resolve(names.map((n) => n.toLowerCase().replace(/\s+/g, '-'))),
  ),
};
```

4. Reemplazar las aserciones que comprueban `email` autogenerado del alumno por aserciones de `username`. En el bloque "happy path: tutor + 1 alumno" cambia el test de email por:

```ts
it('el alumno se crea con username autogenerado a partir del nombre', async () => {
  await service.registerTutor(dto);
  const studentCreateCall = mockPrisma.user.create.mock.calls[1][0];
  expect(studentCreateCall.data.username).toBe('alumno-uno');
  expect(studentCreateCall.data.email).toBeUndefined();
});

it('el alumno nace con la contraseña por defecto hasheada y mustChangePassword', async () => {
  await service.registerTutor(dto);
  const studentCreateCall = mockPrisma.user.create.mock.calls[1][0];
  expect(studentCreateCall.data.mustChangePassword).toBe(true);
  expect(studentCreateCall.data).not.toHaveProperty('viewablePassword');
});
```

5. Borrar por completo el bloque `describe('cifra y guarda viewablePassword para cada alumno', ...)` (líneas ~488-554).
6. En el bloque de email consolidado, cambiar la aserción para que el email reciba `username` y `defaultPassword`:

```ts
it('envía un único email al tutor con el username del alumno y la contraseña por defecto', async () => {
  await service.registerTutor(dto);
  expect(mockNotifications.sendTutorWelcomeWithStudents).toHaveBeenCalledTimes(1);
  const call = mockNotifications.sendTutorWelcomeWithStudents.mock.calls[0][0];
  expect(call.tutorEmail).toBe(fakeTutor.email);
  expect(call.defaultPassword).toBe(DEFAULT_STUDENT_PASSWORD);
  expect(call.students).toHaveLength(1);
  expect(call.students[0].username).toBe('alumno-uno');
  expect(call.students[0]).not.toHaveProperty('password');
});
```

7. En las fixtures `fakeStudent1/2/3`, sustituir el campo `email: 'alumno-...@vkbacademy.com'` por `username: 'alumno-uno'` (etc.) y `email: null`. Ajustar los tests de "auto-generación de email" (renómbralos a username) para usar `mockUsername.allocate` en lugar de comprobar dominios; por ejemplo el test de sufijo numérico ahora se cubre en `username.service.spec.ts`, así que **borra** los tests `'añade sufijo numérico...'` y `'desambigua dos alumnos...'` y `'slugifica nombres...'` de este spec (ya viven en UsernameService). Conserva los tests de roles, tutorId, schoolYearId, transacción, membresías y "no expone passwordHash".

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `pnpm --filter @vkbacademy/api test -- auth-register-tutor`
Expected: FAIL (compila contra una firma de `registerTutor` que aún usa crypto/email).

- [ ] **Step 3: Implementar el refactor en `auth.service.ts`**

1. En los imports, **borrar** `import { CryptoService } from '../crypto/crypto.service';` y añadir:

```ts
import { UsernameService } from '../username/username.service';
import { DEFAULT_STUDENT_PASSWORD } from './auth.constants';
```

2. En el constructor, sustituir `private readonly crypto: CryptoService,` por `private readonly usernames: UsernameService,`.

3. Reemplazar el cuerpo de `registerTutor` (pasos 3-6 actuales) por:

```ts
// 3. Generar username único para cada alumno (slug del nombre + sufijo si colisiona)
const studentUsernames = await this.usernames.allocate(dto.students.map((s) => s.name));

// 4. Hashes de contraseñas: el tutor con la suya; los alumnos con la por defecto
const tutorPasswordHash = await bcrypt.hash(dto.password, 10);
const defaultStudentHash = await bcrypt.hash(DEFAULT_STUDENT_PASSWORD, 10);

// 5. Crear tutor y alumnos en transacción
const { tutor, students } = await this.prisma.$transaction(async (tx) => {
  const createdTutor = await tx.user.create({
    data: {
      email: dto.email,
      passwordHash: tutorPasswordHash,
      name: dto.name,
      role: 'TUTOR',
      academyMembers: { create: { academyId: academy.id } },
    },
    include: { schoolYear: true },
  });

  const createdStudents = await Promise.all(
    dto.students.map((studentDto, index) =>
      tx.user.create({
        data: {
          username: studentUsernames[index],
          passwordHash: defaultStudentHash,
          mustChangePassword: true,
          name: studentDto.name,
          role: 'STUDENT',
          tutorId: createdTutor.id,
          ...(studentDto.schoolYearId ? { schoolYearId: studentDto.schoolYearId } : {}),
          academyMembers: { create: { academyId: academy.id } },
        },
        include: { schoolYear: true },
      }),
    ),
  );

  return { tutor: createdTutor, students: createdStudents };
});

// 6. Enviar UN email al tutor con los usernames de los alumnos y la contraseña por defecto
const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:5173').split(',')[0];
const loginUrl = `${frontendUrl}/login`;

void this.notifications.sendTutorWelcomeWithStudents({
  tutorEmail: tutor.email!,
  tutorName: tutor.name,
  tutorPassword: dto.password,
  students: students.map((student, index) => ({
    name: student.name,
    username: studentUsernames[index],
  })),
  defaultPassword: DEFAULT_STUDENT_PASSWORD,
  academyName: academy.name,
  loginUrl,
});
```

4. **Borrar** los métodos privados `generatePassword`, `slugifyName` y `allocateStudentEmails` (líneas ~199-253): su responsabilidad vive ahora en `UsernameService` y la contraseña ya no se genera.

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `pnpm --filter @vkbacademy/api test -- auth-register-tutor`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/auth/auth.service.ts apps/api/src/auth/auth-register-tutor.service.spec.ts
git commit -m "feat(auth): registerTutor crea alumnos con username y contraseña por defecto"
```

---

### Task 5: Login por username + `toPublic` con campos nuevos + tipos compartidos

**Files:**

- Modify: `apps/api/src/auth/auth.service.ts:255-282` (login), `:401-432` (toPublic), `:19-38` (AuthResponse)
- Modify: `packages/shared/src/types/user.types.ts:9-22`
- Test: `apps/api/src/auth/auth.service.spec.ts`

- [ ] **Step 1: Test de login por username (TDD rojo)**

Abre `apps/api/src/auth/auth.service.spec.ts`. Localiza la suite de `login` (o créala si no existe) y añade un test. Usa el patrón de mocks existente del archivo (mockPrisma con `user.findUnique`/`findFirst`). Añade:

```ts
it('busca por username cuando el identificador no es un email', async () => {
  mockPrisma.user.findUnique.mockResolvedValue({
    id: 'st1',
    email: null,
    username: 'juan-garcia',
    name: 'Juan',
    role: 'STUDENT',
    passwordHash: 'h',
    avatarUrl: null,
    schoolYearId: null,
    schoolYear: null,
    mustChangePassword: true,
    academyMembers: [],
  });
  (bcrypt.compare as jest.Mock).mockResolvedValue(true);

  const result = await service.login({ identifier: 'juan-garcia', password: 'cambiar123' });

  expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
    expect.objectContaining({ where: { username: 'juan-garcia' } }),
  );
  expect(result.user.mustChangePassword).toBe(true);
  expect(result.user.username).toBe('juan-garcia');
});
```

Si el archivo aún no mockea `bcrypt`, sigue el patrón de `auth-register-tutor.service.spec.ts` (`jest.mock('bcrypt')`). Asegúrate de que el provider list del módulo de test incluya un mock de `UsernameService` si el constructor lo requiere (`{ provide: UsernameService, useValue: { slugify: jest.fn(), allocate: jest.fn() } }`) y **no** `CryptoService`.

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `pnpm --filter @vkbacademy/api test -- auth.service.spec`
Expected: FAIL — login busca por `name` (findFirst) y `toPublic` no devuelve `username`/`mustChangePassword`.

- [ ] **Step 3: Implementar login por username y ampliar `toPublic`**

En `auth.service.ts`, reemplaza la resolución del usuario en `login`:

```ts
  async login(dto: LoginDto): Promise<AuthResponse> {
    const isEmail = dto.identifier.includes('@');
    const user = isEmail
      ? await this.prisma.user.findUnique({
          where: { email: dto.identifier },
          include: { schoolYear: true, academyMembers: { take: 1, include: { academy: true } } },
        })
      : await this.prisma.user.findUnique({
          where: { username: dto.identifier.toLowerCase() },
          include: { schoolYear: true, academyMembers: { take: 1, include: { academy: true } } },
        });
    if (!user) throw new UnauthorizedException('Credenciales incorrectas');
```

(El resto de `login` se mantiene.)

Amplía `toPublic` para aceptar y devolver `username` y `mustChangePassword`, y `email` nullable. Cambia la firma del parámetro `user` y el `return`:

```ts
  private toPublic(
    user: {
      id: string;
      email: string | null;
      username?: string | null;
      name: string;
      role: string;
      avatarUrl: string | null;
      mustChangePassword?: boolean;
      schoolYearId?: string | null;
      schoolYear?: { id: string; name: string; label: string } | null;
    },
    academyId?: string | null,
    academy?: { id: string; slug: string; name: string; logoUrl: string | null; primaryColor: string | null; isActive: boolean } | null,
  ) {
    return {
      id: user.id,
      email: user.email,
      username: user.username ?? null,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl,
      mustChangePassword: user.mustChangePassword ?? false,
      schoolYearId: user.schoolYearId ?? null,
      schoolYear: user.schoolYear ?? null,
      academyId: academyId ?? null,
      academy: academy ?? null,
    };
  }
```

Actualiza el tipo `AuthResponse` (líneas 19-38): en `user`, cambia `email: string;` por `email: string | null;` y añade `username: string | null;` y `mustChangePassword: boolean;`.

- [ ] **Step 4: Actualizar el tipo compartido `User`**

En `packages/shared/src/types/user.types.ts`, dentro de `interface User`:

- cambia `email: string;` por `email: string | null;`
- añade `username?: string | null;`
- añade `mustChangePassword?: boolean;`

- [ ] **Step 5: Ejecutar tests y type-check**

Run: `pnpm --filter @vkbacademy/api test -- auth.service.spec`
Expected: PASS.
Run: `pnpm --filter @vkbacademy/api exec tsc --noEmit`
Expected: pueden aparecer errores en `tutors.service.ts`/`admin.service.ts` por `viewablePassword` y email nullable — se arreglan en sus tasks. Si hay errores SOLO en esos archivos, continúa; si hay errores en `auth.service.ts`, arréglalos ahora.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/auth/auth.service.ts apps/api/src/auth/auth.service.spec.ts packages/shared/src/types/user.types.ts
git commit -m "feat(auth): login por username y expone mustChangePassword"
```

---

### Task 6: Endpoint `change-password` + interceptor de cambio obligatorio

**Files:**

- Create: `apps/api/src/auth/dto/change-password.dto.ts`
- Create: `apps/api/src/auth/decorators/allow-when-must-change.decorator.ts`
- Create: `apps/api/src/auth/interceptors/must-change-password.interceptor.ts`
- Modify: `apps/api/src/auth/auth.service.ts` (método `changePassword`, limpiar `resetPassword`)
- Modify: `apps/api/src/auth/auth.controller.ts`
- Modify: `apps/api/src/app.module.ts` (registrar interceptor global)
- Test: `apps/api/src/auth/auth.service.spec.ts`

- [ ] **Step 1: Test de `changePassword` (TDD rojo)**

En `apps/api/src/auth/auth.service.spec.ts` añade:

```ts
describe('changePassword', () => {
  it('hashea la nueva contraseña y limpia mustChangePassword', async () => {
    (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$10$new');
    mockPrisma.user.update.mockResolvedValue({});

    await service.changePassword('user-1', 'nuevaPass123');

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { passwordHash: '$2b$10$new', mustChangePassword: false },
    });
  });
});
```

Asegúrate de que `mockPrisma.user` tenga `update: jest.fn()` en el setup del archivo.

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `pnpm --filter @vkbacademy/api test -- auth.service.spec`
Expected: FAIL — `service.changePassword is not a function`.

- [ ] **Step 3: Implementar `changePassword` y limpiar `resetPassword`**

En `auth.service.ts`, añade el método (junto a `resetPassword`):

```ts
  /** Cambia la contraseña del usuario autenticado y limpia el flag de cambio obligatorio */
  async changePassword(userId: string, newPassword: string): Promise<{ message: string }> {
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    });
    return { message: 'Contraseña actualizada correctamente' };
  }
```

En `resetPassword` (el flujo de token por email), **elimina** la sincronización de `viewablePassword`. Sustituye el bloque:

```ts
const data: { passwordHash: string; viewablePassword?: string } = { passwordHash };
if (user.role === 'STUDENT' && user.tutorId) {
  data.viewablePassword = this.crypto.encrypt(newPassword);
}
await this.prisma.user.update({ where: { id: user.id }, data });
```

por:

```ts
await this.prisma.user.update({
  where: { id: user.id },
  data: { passwordHash, mustChangePassword: false },
});
```

- [ ] **Step 4: Crear el DTO**

`apps/api/src/auth/dto/change-password.dto.ts`:

```ts
import { IsString, MinLength, MaxLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(72, { message: 'La contraseña es demasiado larga' })
  newPassword: string;
}
```

- [ ] **Step 5: Crear decorador e interceptor**

`apps/api/src/auth/decorators/allow-when-must-change.decorator.ts`:

```ts
import { SetMetadata } from '@nestjs/common';

/** Marca un endpoint como permitido aunque el usuario tenga mustChangePassword=true */
export const ALLOW_WHEN_MUST_CHANGE = 'allowWhenMustChange';
export const AllowWhenMustChange = () => SetMetadata(ALLOW_WHEN_MUST_CHANGE, true);
```

`apps/api/src/auth/interceptors/must-change-password.interceptor.ts`:

```ts
import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { ALLOW_WHEN_MUST_CHANGE } from '../decorators/allow-when-must-change.decorator';

const MUTATING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * Bloquea cualquier endpoint mutador para usuarios con mustChangePassword=true,
 * salvo los marcados con @AllowWhenMustChange (p.ej. el propio cambio de contraseña).
 * Se ejecuta después de los guards, por lo que request.user ya está poblado.
 */
@Injectable()
export class MustChangePasswordInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const user = req.user as { mustChangePassword?: boolean } | undefined;
    const allow = this.reflector.getAllAndOverride<boolean>(ALLOW_WHEN_MUST_CHANGE, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (user?.mustChangePassword && MUTATING_METHODS.includes(req.method) && !allow) {
      throw new ForbiddenException('Debes cambiar tu contraseña antes de continuar');
    }
    return next.handle();
  }
}
```

- [ ] **Step 6: Registrar endpoint y guard en el controller**

En `apps/api/src/auth/auth.controller.ts`:

- imports: `import { UseGuards } from '@nestjs/common';`, `import { JwtAuthGuard } from './guards/jwt-auth.guard';`, `import { CurrentUser } from './decorators/current-user.decorator';`, `import { AllowWhenMustChange } from './decorators/allow-when-must-change.decorator';`, `import { ChangePasswordDto } from './dto/change-password.dto';`, y el tipo `import { User } from '@prisma/client';`.
- añade el endpoint:

```ts
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @AllowWhenMustChange()
  changePassword(@CurrentUser() user: User, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.id, dto.newPassword);
  }
```

También marca `logout` con `@AllowWhenMustChange()` (no requiere guard, pero por si en el futuro lo tuviera) — opcional; el método logout es POST público, no pasa por JwtAuthGuard, así que `req.user` es undefined y el interceptor no lo bloquea. Déjalo sin decorar.

- [ ] **Step 7: Registrar el interceptor global**

En `apps/api/src/app.module.ts`:

- import: `import { APP_INTERCEPTOR } from '@nestjs/core';` (junto a `APP_GUARD`) y `import { MustChangePasswordInterceptor } from './auth/interceptors/must-change-password.interceptor';`.
- en `providers`, añade: `{ provide: APP_INTERCEPTOR, useClass: MustChangePasswordInterceptor },`.

- [ ] **Step 8: Ejecutar tests**

Run: `pnpm --filter @vkbacademy/api test -- auth.service.spec`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/auth apps/api/src/app.module.ts
git commit -m "feat(auth): change-password + interceptor de cambio obligatorio"
```

---

## FASE 3 — Panel del tutor (backend)

### Task 7: Tutors — quitar credenciales, añadir alta y restablecer

**Files:**

- Modify: `apps/api/src/tutors/tutors.service.ts` (constructor, `getMyStudents`, quitar `getStudentsCredentials`, añadir `addStudent` + `resetStudentPassword`)
- Modify: `apps/api/src/tutors/tutors.controller.ts`
- Create: `apps/api/src/tutors/dto/add-student.dto.ts`
- Test: `apps/api/src/tutors/tutors.service.spec.ts`

- [ ] **Step 1: Actualizar el spec de tutors (TDD rojo)**

En `apps/api/src/tutors/tutors.service.spec.ts`:

1. Quitar import/uso de `CryptoService`; en `providers` sustituir `{ provide: CryptoService, useValue: mockCrypto }` por `{ provide: UsernameService, useValue: mockUsername }` y añadir `import { UsernameService } from '../username/username.service';`. Borrar el objeto `mockCrypto` y el `mockCrypto.decrypt.mockImplementation(...)` del `beforeEach`.
2. Declarar el mock de usernames y ampliar `mockPrisma.user` con `create`:

```ts
const mockUsername = {
  slugify: jest.fn((n: string) => n.toLowerCase().replace(/\s+/g, '-')),
  allocate: jest.fn((names: string[]) =>
    Promise.resolve(names.map((n) => n.toLowerCase().replace(/\s+/g, '-'))),
  ),
};
// en mockPrisma.user añadir: create: jest.fn(), update: jest.fn(),
```

3. **Borrar** todo el bloque `describe('getStudentsCredentials', ...)`.
4. Añadir nuevos bloques:

```ts
describe('addStudent', () => {
  it('crea un alumno bajo el tutor con username y contraseña por defecto', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: TUTOR_ID,
      role: 'TUTOR',
      academyMembers: [{ academyId: 'ac1' }],
    });
    mockUsername.allocate.mockResolvedValue(['nuevo-alumno']);
    mockPrisma.user.create.mockResolvedValue({
      id: 'new1',
      name: 'Nuevo Alumno',
      username: 'nuevo-alumno',
      schoolYear: { id: 'sy1', name: '1eso', label: '1º ESO' },
    });

    const result = await service.addStudent(TUTOR_ID, {
      name: 'Nuevo Alumno',
      schoolYearId: 'sy1',
    });

    const createArg = mockPrisma.user.create.mock.calls[0][0];
    expect(createArg.data.role).toBe('STUDENT');
    expect(createArg.data.username).toBe('nuevo-alumno');
    expect(createArg.data.tutorId).toBe(TUTOR_ID);
    expect(createArg.data.mustChangePassword).toBe(true);
    expect(createArg.data.academyMembers.create.academyId).toBe('ac1');
    expect(result.username).toBe('nuevo-alumno');
  });
});

describe('resetStudentPassword', () => {
  it('restablece a la contraseña por defecto y reactiva mustChangePassword', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: STUDENT_ID,
      tutorId: TUTOR_ID,
      schoolYearId: 'sy1',
    });
    mockPrisma.user.update.mockResolvedValue({});

    await service.resetStudentPassword(TUTOR_ID, STUDENT_ID);

    const updateArg = mockPrisma.user.update.mock.calls[0][0];
    expect(updateArg.where).toEqual({ id: STUDENT_ID });
    expect(updateArg.data.mustChangePassword).toBe(true);
    expect(typeof updateArg.data.passwordHash).toBe('string');
  });

  it('lanza ForbiddenException si el alumno no es del tutor', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: STUDENT_ID, tutorId: 'otro' });
    await expect(service.resetStudentPassword(TUTOR_ID, STUDENT_ID)).rejects.toThrow(
      ForbiddenException,
    );
  });
});
```

5. En el test existente `getMyStudents › devuelve la lista...`, añade `username: 'alumno'` al objeto esperado y verifica que `select` incluye `username: true` (ajusta el fixture `students`).

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `pnpm --filter @vkbacademy/api test -- tutors.service`
Expected: FAIL — métodos inexistentes y `CryptoService` ausente.

- [ ] **Step 3: Implementar en `tutors.service.ts`**

1. Imports: quitar `import { CryptoService } from '../crypto/crypto.service';`. Añadir:

```ts
import * as bcrypt from 'bcrypt';
import { UsernameService } from '../username/username.service';
import { DEFAULT_STUDENT_PASSWORD } from '../auth/auth.constants';
```

2. Constructor: sustituir `private readonly crypto: CryptoService,` por `private readonly usernames: UsernameService,`.

3. **Borrar** el método `getStudentsCredentials` completo (líneas ~48-76).

4. En `getMyStudents`, añadir `username: true,` al `select`.

5. Añadir los dos métodos nuevos (al final de la sección de matrículas o tras `getMyStudents`):

```ts
  /** Crea un alumno bajo el tutor, con username generado y contraseña por defecto */
  async addStudent(tutorId: string, dto: { name: string; schoolYearId: string }) {
    const tutor = await this.prisma.user.findUnique({
      where: { id: tutorId },
      select: { id: true, role: true, academyMembers: { take: 1, select: { academyId: true } } },
    });
    if (!tutor) throw new ForbiddenException('Tutor no encontrado');

    const [username] = await this.usernames.allocate([dto.name]);
    const passwordHash = await bcrypt.hash(DEFAULT_STUDENT_PASSWORD, 10);
    const academyId = tutor.academyMembers[0]?.academyId ?? null;

    return this.prisma.user.create({
      data: {
        username,
        passwordHash,
        mustChangePassword: true,
        name: dto.name,
        role: 'STUDENT',
        tutorId,
        ...(dto.schoolYearId ? { schoolYearId: dto.schoolYearId } : {}),
        ...(academyId ? { academyMembers: { create: { academyId } } } : {}),
      },
      select: {
        id: true,
        name: true,
        username: true,
        avatarUrl: true,
        totalPoints: true,
        currentStreak: true,
        schoolYear: { select: { id: true, name: true, label: true } },
      },
    });
  }

  /** Restablece la contraseña del alumno a la por defecto (sin exponerla) */
  async resetStudentPassword(tutorId: string, studentId: string) {
    await this.getStudentForTutor(tutorId, studentId);
    const passwordHash = await bcrypt.hash(DEFAULT_STUDENT_PASSWORD, 10);
    await this.prisma.user.update({
      where: { id: studentId },
      data: { passwordHash, mustChangePassword: true },
    });
    return { message: 'Contraseña restablecida a la contraseña por defecto' };
  }
```

- [ ] **Step 4: Crear el DTO de alta**

`apps/api/src/tutors/dto/add-student.dto.ts`:

```ts
import { IsString, MinLength, MaxLength } from 'class-validator';

export class AddStudentDto {
  @IsString()
  @MinLength(2, { message: 'El nombre del alumno debe tener al menos 2 caracteres' })
  @MaxLength(100)
  name: string;

  @IsString({ message: 'Debes indicar el curso del alumno' })
  @MinLength(1, { message: 'Debes indicar el curso del alumno' })
  schoolYearId: string;
}
```

- [ ] **Step 5: Actualizar el controller**

En `apps/api/src/tutors/tutors.controller.ts`:

- import `import { AddStudentDto } from './dto/add-student.dto';`.
- **borrar** el endpoint `getMyStudentsCredentials` (líneas 27-31).
- añadir:

```ts
  @Post('my-students')
  @Roles(Role.TUTOR, Role.ADMIN)
  addStudent(@Body() dto: AddStudentDto, @CurrentUser() user: User) {
    return this.tutorsService.addStudent(user.id, dto);
  }

  @Post('my-students/:studentId/reset-password')
  @Roles(Role.TUTOR, Role.ADMIN)
  resetStudentPassword(@Param('studentId') studentId: string, @CurrentUser() user: User) {
    return this.tutorsService.resetStudentPassword(user.id, studentId);
  }
```

(`Post` ya está importado; `Body`, `Param`, `CurrentUser`, `Role`, `User` también.)

- [ ] **Step 6: Ejecutar tests**

Run: `pnpm --filter @vkbacademy/api test -- tutors.service`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/tutors
git commit -m "feat(tutors): alta de alumnos y restablecer contraseña; elimina credenciales"
```

---

### Task 8: Admin — eliminar `viewablePassword`/Crypto

**Files:**

- Modify: `apps/api/src/admin/admin.service.ts:19,27,118-136`

- [ ] **Step 1: Quitar crypto del admin service**

1. Borrar `import { CryptoService } from '../crypto/crypto.service';` (línea 19).
2. Borrar `private readonly crypto: CryptoService,` del constructor (línea 27).
3. En `updateUser`, sustituir el bloque:

```ts
if (dto.password) {
  data.passwordHash = await bcrypt.hash(dto.password, 10);
  if (user.role === 'STUDENT' && user.tutorId) {
    data.viewablePassword = this.crypto.encrypt(dto.password);
  }
}
```

por:

```ts
if (dto.password) {
  data.passwordHash = await bcrypt.hash(dto.password, 10);
}
```

- [ ] **Step 2: Comprobar que no hay otros usos**

Run: `grep -rn "viewablePassword\|CryptoService" apps/api/src --include=*.ts | grep -v ".spec.ts"`
Expected: solo aparecen `apps/api/src/crypto/*` (que se borran en la Task 9). Si aparece algo más, corrígelo igual.

- [ ] **Step 3: Ejecutar tests del admin (si existen) y type-check**

Run: `pnpm --filter @vkbacademy/api exec tsc --noEmit`
Expected: sin errores en `admin.service.ts`. (Puede quedar el error del `crypto.service.spec.ts` hasta la Task 9.)

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/admin/admin.service.ts
git commit -m "refactor(admin): elimina viewablePassword del alta/edición de usuarios"
```

---

### Task 9: Eliminar CryptoModule, env var y actualizar email de bienvenida

**Files:**

- Delete: `apps/api/src/crypto/crypto.service.ts`, `apps/api/src/crypto/crypto.module.ts`, `apps/api/src/crypto/crypto.service.spec.ts`
- Modify: `apps/api/src/app.module.ts` (quitar `CryptoModule`)
- Modify: `apps/api/.env.example` (quitar `STUDENT_PASSWORD_ENC_KEY`)
- Modify: `apps/api/src/notifications/notifications.service.ts:143-198`
- Test: `apps/api/src/notifications/notifications.service.spec.ts`

- [ ] **Step 1: Actualizar el spec de notifications (TDD rojo)**

Primero **lee** `apps/api/src/notifications/notifications.service.spec.ts` para identificar cómo se mockea el envío (spy sobre `sendEmail` o sobre el cliente Resend) y replicar ese patrón exacto. Localiza el/los tests de `sendTutorWelcomeWithStudents`. Ajusta el payload de prueba para la nueva firma (`students: [{ name, username }]`, más `defaultPassword`) y cambia las aserciones del HTML para que comprueben que aparece el `username` y la `defaultPassword`, y que **no** se pasa `password` por alumno. Ejemplo de aserción:

```ts
await service.sendTutorWelcomeWithStudents({
  tutorEmail: 't@x.com',
  tutorName: 'Tutor',
  tutorPassword: 'pass1234',
  students: [{ name: 'Juan', username: 'juan' }],
  defaultPassword: 'cambiar123',
  academyName: 'VKB',
  loginUrl: 'http://x/login',
});
const html = sendEmailSpy.mock.calls[0][2]; // 3er argumento de sendEmail
expect(html).toContain('juan');
expect(html).toContain('cambiar123');
```

(Adapta `sendEmailSpy` al patrón real del archivo: probablemente se mockea `this.sendEmail` o el cliente Resend. Sigue el patrón existente del spec.)

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `pnpm --filter @vkbacademy/api test -- notifications.service`
Expected: FAIL (firma antigua con `password` por alumno).

- [ ] **Step 3: Actualizar `sendTutorWelcomeWithStudents`**

En `apps/api/src/notifications/notifications.service.ts`, cambia la firma y el cuerpo:

```ts
  async sendTutorWelcomeWithStudents(params: {
    tutorEmail: string;
    tutorName: string;
    tutorPassword: string;
    students: Array<{ name: string; username: string }>;
    defaultPassword: string;
    academyName: string;
    loginUrl: string;
  }) {
    const studentRows = params.students
      .map(
        (s) => `
         <tr>
           <td style="padding:8px 14px;border-bottom:1px solid #eee">${s.name}</td>
           <td style="padding:8px 14px;border-bottom:1px solid #eee"><code>${s.username}</code></td>
         </tr>`,
      )
      .join('');

    const studentsBlock =
      params.students.length > 0
        ? `<h3 style="margin-top:2rem">Accesos de tus alumnos</h3>
       <p>Cada alumno entra con su <strong>usuario</strong> y la contraseña por defecto
          <code>${params.defaultPassword}</code>. En el primer acceso deberá cambiarla.</p>
       <table style="border-collapse:collapse;margin:1rem 0;width:100%;max-width:560px">
         <thead>
           <tr style="background:#f8fafc">
             <th style="padding:10px 14px;text-align:left;color:#475569;font-size:0.85rem">Alumno</th>
             <th style="padding:10px 14px;text-align:left;color:#475569;font-size:0.85rem">Usuario</th>
           </tr>
         </thead>
         <tbody>${studentRows}</tbody>
       </table>`
        : '';

    await this.sendEmail(
      params.tutorEmail,
      `Bienvenido a ${params.academyName} — VKB Academy`,
      `<h2>¡Bienvenido a ${params.academyName}!</h2>
       <p>Hola <strong>${params.tutorName}</strong>, tu cuenta de tutor y la de tus alumnos se han creado correctamente.</p>

       <h3>Tus credenciales</h3>
       <table style="border-collapse:collapse;margin:1rem 0">
         <tr><td style="padding:4px 12px 4px 0;color:#666">Email:</td><td><strong>${params.tutorEmail}</strong></td></tr>
         <tr><td style="padding:4px 12px 4px 0;color:#666">Contraseña:</td><td><strong>${params.tutorPassword}</strong></td></tr>
       </table>

       ${studentsBlock}

       <p style="margin:1.5rem 0">
         <a href="${params.loginUrl}" style="background:#f5911e;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">
           Acceder a la plataforma
         </a>
       </p>`,
    );
  }
```

- [ ] **Step 4: Borrar CryptoModule y env var**

```bash
git rm apps/api/src/crypto/crypto.service.ts apps/api/src/crypto/crypto.module.ts apps/api/src/crypto/crypto.service.spec.ts
```

En `apps/api/src/app.module.ts`: borra `import { CryptoModule } from './crypto/crypto.module';` y quita `CryptoModule,` del array `imports`.

En `apps/api/.env.example`: borra la línea `STUDENT_PASSWORD_ENC_KEY=""`.

- [ ] **Step 5: Ejecutar tests + type-check completo**

Run: `pnpm --filter @vkbacademy/api test`
Expected: PASS (toda la suite). Si algún spec aún importa CryptoService, elimínalo.
Run: `pnpm --filter @vkbacademy/api exec tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src apps/api/.env.example
git commit -m "refactor(api): elimina CryptoModule y STUDENT_PASSWORD_ENC_KEY"
```

---

## FASE 4 — Frontend

### Task 10: API web + redirección por mustChangePassword

**Files:**

- Modify: `apps/web/src/api/auth.api.ts`
- Modify: `apps/web/src/hooks/useAuth.ts`

- [ ] **Step 1: Añadir `changePassword` al api de auth**

En `apps/web/src/api/auth.api.ts`, dentro de `authApi`, añade:

```ts
  changePassword: (newPassword: string) =>
    api.post<{ message: string }>('/auth/change-password', { newPassword }).then((r) => r.data),
```

- [ ] **Step 2: Redirigir a /change-password tras login/registro**

En `apps/web/src/hooks/useAuth.ts`, en los tres `onSuccess` (`useLogin`, `useRegister`, `useRegisterTutor`), sustituye `navigate('/dashboard', { replace: true });` por:

```ts
navigate(user.mustChangePassword ? '/change-password' : '/dashboard', { replace: true });
```

(En `useRegisterTutor` el usuario es el tutor, que no tiene el flag, así que irá a `/dashboard`; mantener la misma línea es correcto y uniforme.)

- [ ] **Step 3: Type-check**

Run: `pnpm --filter @vkbacademy/web exec tsc --noEmit`
Expected: sin errores nuevos (puede haber errores pendientes de tutors.api/TutorStudentsPage hasta sus tasks).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/api/auth.api.ts apps/web/src/hooks/useAuth.ts
git commit -m "feat(web): redirige a cambio de contraseña cuando es obligatorio"
```

---

### Task 11: Pantalla de cambio obligatorio + ruta + gate

**Files:**

- Create: `apps/web/src/pages/ChangePasswordPage.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/layouts/AppLayout.tsx`

- [ ] **Step 1: Crear `ChangePasswordPage`**

`apps/web/src/pages/ChangePasswordPage.tsx`:

```tsx
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '../api/auth.api';
import { useAuthStore } from '../store/auth.store';

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (newPassword: string) => authApi.changePassword(newPassword),
    onSuccess: () => {
      if (user) setUser({ ...user, mustChangePassword: false });
      navigate('/dashboard', { replace: true });
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres');
    if (password !== confirm) return setError('Las contraseñas no coinciden');
    mutation.mutate(password);
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'linear-gradient(135deg, #080e1a 0%, #0d1b2a 60%, #152233 100%)',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: 420,
          background: 'rgba(8,14,26,0.88)',
          border: '1.5px solid rgba(234,88,12,0.20)',
          borderRadius: 20,
          padding: '36px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
        noValidate
      >
        <h1 style={{ color: '#fff', fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>
          Crea tu contraseña
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.9rem', margin: 0 }}>
          Por seguridad, elige una contraseña nueva antes de continuar.
        </p>
        {error && <div style={{ color: '#fca5a5', fontSize: '0.85rem' }}>{error}</div>}
        <div className="field field-dark">
          <label htmlFor="new-pass">Nueva contraseña</label>
          <input
            id="new-pass"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres"
            required
          />
        </div>
        <div className="field field-dark">
          <label htmlFor="confirm-pass">Repite la contraseña</label>
          <input
            id="confirm-pass"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>
        <button
          type="submit"
          className="btn btn-primary btn-full"
          disabled={mutation.isPending}
          style={{ padding: '13px 22px', fontSize: '1rem' }}
        >
          {mutation.isPending ? <span className="spinner" /> : 'Guardar y continuar'}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Añadir la ruta**

En `apps/web/src/App.tsx`:

- import: `import ChangePasswordPage from './pages/ChangePasswordPage';`.
- dentro del bloque `<PrivateRoute>` pero **fuera** de `AppLayout` (para que no aplique el gate ni el sidebar), añade una ruta privada. La forma más simple: añade una ruta hermana de las de auth que exija token:

```tsx
<Route
  path="/change-password"
  element={
    <PrivateRoute>
      <ChangePasswordPage />
    </PrivateRoute>
  }
/>
```

Colócala junto a `/forgot-password` / `/reset-password` (líneas ~96-97).

- [ ] **Step 3: Gate en AppLayout**

**Lee** primero `apps/web/src/layouts/AppLayout.tsx` para ubicar el componente y sus imports actuales. Al inicio del componente (tras obtener el usuario del store), añade la redirección. Necesitas `useAuthStore` y `Navigate`:

```tsx
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
// ... dentro del componente, antes del return principal:
const mustChange = useAuthStore((s) => s.user?.mustChangePassword);
if (mustChange) return <Navigate to="/change-password" replace />;
```

(Si `AppLayout` ya importa `useAuthStore`/`Navigate`, reutilízalos. Si usa otro nombre para el layout, aplica la misma lógica al componente que envuelve las rutas privadas con sidebar.)

- [ ] **Step 4: Type-check**

Run: `pnpm --filter @vkbacademy/web exec tsc --noEmit`
Expected: sin errores nuevos relacionados con estos archivos.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/ChangePasswordPage.tsx apps/web/src/App.tsx apps/web/src/layouts/AppLayout.tsx
git commit -m "feat(web): pantalla y gate de cambio de contraseña obligatorio"
```

---

### Task 12: RegisterPage — texto del hint

**Files:**

- Modify: `apps/web/src/pages/RegisterPage.tsx:209-211`

- [ ] **Step 1: Cambiar el hint del alumno**

Sustituye el `<span style={s.fieldHint}>...</span>` (líneas 209-211) por:

```tsx
<span style={s.fieldHint}>
  Le crearemos un usuario de acceso. La primera vez entrará con la contraseña{' '}
  <code>cambiar123</code> y deberá cambiarla.
</span>
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter @vkbacademy/web exec tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/RegisterPage.tsx
git commit -m "fix(web): hint de registro explica contraseña por defecto y cambio"
```

---

### Task 13: Panel de accesos del tutor (reemplaza tabla de credenciales)

**Files:**

- Modify: `apps/web/src/api/tutors.api.ts`
- Create: `apps/web/src/components/tutor/StudentAccessPanel.tsx`
- Delete: `apps/web/src/components/tutor/StudentCredentialsTable.tsx`
- Modify: `apps/web/src/pages/TutorStudentsPage.tsx`

- [ ] **Step 1: Actualizar `tutors.api.ts`**

En `apps/web/src/api/tutors.api.ts`:

1. En `interface StudentSummary` añade `username?: string | null;`.
2. **Borra** la `interface StudentCredential` y el método `getStudentsCredentials`.
3. Añade dos métodos a `tutorsApi`:

```ts
  addStudent: (name: string, schoolYearId: string) =>
    api.post<StudentSummary>('/tutors/my-students', { name, schoolYearId }).then((r) => r.data),

  resetStudentPassword: (studentId: string) =>
    api.post<{ message: string }>(`/tutors/my-students/${studentId}/reset-password`).then((r) => r.data),
```

- [ ] **Step 2: Crear `StudentAccessPanel`**

`apps/web/src/components/tutor/StudentAccessPanel.tsx` — lista alumnos con su usuario, botón "Restablecer contraseña" y formulario "Añadir alumno". Usa `useSchoolYears` para el desplegable de nivel (igual que RegisterPage).

```tsx
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tutorsApi, type StudentSummary } from '../../api/tutors.api';
import { useSchoolYears } from '../../hooks/useCourses';

const ORANGE = '#ea580c';

export function StudentAccessPanel() {
  const qc = useQueryClient();
  const { data: students } = useQuery({
    queryKey: ['tutor', 'students'],
    queryFn: tutorsApi.getMyStudents,
  });
  const { data: schoolYears = [] } = useSchoolYears();

  const [name, setName] = useState('');
  const [schoolYearId, setSchoolYearId] = useState('');
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['tutor', 'students'] });

  const addMut = useMutation({
    mutationFn: () => tutorsApi.addStudent(name.trim(), schoolYearId),
    onSuccess: () => {
      setName('');
      setSchoolYearId('');
      void invalidate();
    },
  });

  const resetMut = useMutation({
    mutationFn: (id: string) => tutorsApi.resetStudentPassword(id),
    onSuccess: () =>
      setResetMsg('Contraseña restablecida a "cambiar123". El alumno la cambiará al entrar.'),
  });

  return (
    <section
      style={{
        background: '#fff',
        borderRadius: 12,
        padding: 20,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        color: '#0f172a',
      }}
    >
      <h2
        style={{
          fontSize: '1.1rem',
          fontWeight: 700,
          margin: 0,
          marginBottom: 4,
          color: '#0d1b2a',
        }}
      >
        Accesos de mis alumnos
      </h2>
      <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0, marginBottom: 16 }}>
        Cada alumno entra con su usuario. La primera vez usa la contraseña <code>cambiar123</code> y
        deberá cambiarla.
      </p>

      <table
        style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', color: '#0f172a' }}
      >
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
            <th style={{ padding: '8px 4px', fontWeight: 600, color: '#334155' }}>Nombre</th>
            <th style={{ padding: '8px 4px', fontWeight: 600, color: '#334155' }}>Usuario</th>
            <th style={{ padding: '8px 4px', fontWeight: 600, width: 180, color: '#334155' }}>
              Acciones
            </th>
          </tr>
        </thead>
        <tbody>
          {students?.map((s: StudentSummary) => (
            <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '8px 4px' }}>{s.name}</td>
              <td style={{ padding: '8px 4px', fontFamily: 'monospace' }}>{s.username ?? '—'}</td>
              <td style={{ padding: '8px 4px' }}>
                <button
                  type="button"
                  onClick={() => resetMut.mutate(s.id)}
                  disabled={resetMut.isPending}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: `1px solid ${ORANGE}`,
                    background: 'transparent',
                    color: ORANGE,
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                  }}
                >
                  Restablecer contraseña
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {resetMsg && (
        <p style={{ marginTop: 12, fontSize: '0.85rem', color: '#16a34a' }}>{resetMsg}</p>
      )}

      <div style={{ marginTop: 20, borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, marginBottom: 10 }}>
          Añadir alumno
        </h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre del alumno"
            style={{
              flex: 1,
              minWidth: 160,
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
            }}
          />
          <select
            value={schoolYearId}
            onChange={(e) => setSchoolYearId(e.target.value)}
            style={{
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              fontSize: 16,
            }}
          >
            <option value="">Curso</option>
            {schoolYears.map((sy) => (
              <option key={sy.id} value={sy.id}>
                {sy.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!name.trim() || !schoolYearId || addMut.isPending}
            onClick={() => addMut.mutate()}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              background: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
              color: '#fff',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Añadir
          </button>
        </div>
        {addMut.isError && (
          <p style={{ marginTop: 8, fontSize: '0.85rem', color: '#b91c1c' }}>
            No se pudo añadir el alumno.
          </p>
        )}
      </div>
    </section>
  );
}
```

(Nota: el `<select>` usa `fontSize: 16` para evitar el zoom de iOS Safari, en línea con el fix de `global.css`.)

- [ ] **Step 3: Reemplazar el uso en `TutorStudentsPage`**

En `apps/web/src/pages/TutorStudentsPage.tsx`:

1. Cambia el import `import { StudentCredentialsTable } from '../components/tutor/StudentCredentialsTable';` por `import { StudentAccessPanel } from '../components/tutor/StudentAccessPanel';`.
2. En el bloque de estado vacío (línea ~883) sustituye `<StudentCredentialsTable />` por `<StudentAccessPanel />`.
3. En `StudentDetail`, la cabecera muestra `stats.student.email` (línea ~415). Como los alumnos ya no tienen email, cámbialo por el usuario. Sustituye `{stats.student.email}` por `{stats.student.username ?? '—'}`. Para que el tipo exista, en `apps/web/src/api/tutors.api.ts` añade `username?: string | null;` dentro de `StudentStats['student']` (interfaz `StudentStats`, objeto `student`).

   > El backend `getStudentStats` ya selecciona `email`; añade también `username` a su `select` y al objeto `student` devuelto en `apps/api/src/tutors/tutors.service.ts` (método `getStudentStats`, `select` de la línea ~114 y el `return` de la línea ~313). Añade `username: true` al select y `username: student.username` al objeto retornado.

- [ ] **Step 4: Borrar el componente viejo**

```bash
git rm apps/web/src/components/tutor/StudentCredentialsTable.tsx
```

- [ ] **Step 5: Type-check + tests web**

Run: `pnpm --filter @vkbacademy/web exec tsc --noEmit`
Expected: sin errores.
Run: `pnpm --filter @vkbacademy/web test` (si el proyecto tiene script de test)
Expected: PASS (o sin tests asociados a estos archivos).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/api/tutors.api.ts apps/web/src/components/tutor apps/web/src/pages/TutorStudentsPage.tsx apps/api/src/tutors/tutors.service.ts
git commit -m "feat(web): panel de accesos del tutor con usuario, restablecer y añadir alumno"
```

---

## FASE 5 — Verificación final

### Task 14: Suite completa + e2e + documentación

**Files:**

- Modify: `apps/api/test/e2e/01-auth.e2e-spec.ts`, `apps/api/test/e2e/14-tutors.e2e-spec.ts` (si referencian credenciales/email de alumno)
- Modify: `CLAUDE.md:231` (quitar mención a `STUDENT_PASSWORD_ENC_KEY`)

- [ ] **Step 1: Revisar e2e por referencias obsoletas**

Run: `grep -rn "credentials\|viewablePassword\|@vkbacademy.com\|STUDENT_PASSWORD_ENC_KEY" apps/api/test`
Expected: si hay referencias en e2e de auth/tutors, actualízalas: el alumno se crea con `username` (no email), no existe `GET /tutors/my-students/credentials`, y `register-tutor` ya no devuelve/usa contraseñas por alumno. Ajusta las aserciones a la nueva realidad.

- [ ] **Step 2: Ejecutar la suite unitaria completa**

Run: `pnpm --filter @vkbacademy/api test`
Expected: PASS (toda la suite).

- [ ] **Step 3: Ejecutar e2e (requiere BD de test levantada)**

Run: `pnpm --filter @vkbacademy/api test:e2e`
Expected: PASS. Si falla por secretos JWT cortos (problema conocido del entorno), documenta el estado y continúa; no es regresión de esta tarea.

- [ ] **Step 4: Type-check web**

Run: `pnpm --filter @vkbacademy/web exec tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Actualizar CLAUDE.md**

En `CLAUDE.md`, borra la línea de `STUDENT_PASSWORD_ENC_KEY` (sección 9, variables de entorno) ya que la variable se ha eliminado.

- [ ] **Step 6: Commit**

```bash
git add apps/api/test CLAUDE.md
git commit -m "test(api): adapta e2e al nuevo modelo de credenciales; limpia CLAUDE.md"
```

- [ ] **Step 7: Verificación manual (opcional, recomendada)**

Con `docker compose up -d` y `pnpm dev`:

1. Registra un tutor con 1 alumno → confirma que el tutor entra al dashboard y el email de bienvenida muestra el usuario + `cambiar123`.
2. En "Mis Alumnos", verifica que aparece el usuario del alumno y los botones "Restablecer contraseña" y "Añadir alumno".
3. Cierra sesión, entra como el alumno (usuario + `cambiar123`) → debe forzar la pantalla de cambio de contraseña y no dejar navegar hasta cambiarla.
4. Tras cambiarla, navega normal. Cierra sesión y vuelve a entrar con la nueva contraseña.
5. Como tutor, pulsa "Restablecer contraseña" del alumno → el alumno vuelve a entrar con `cambiar123` y se le exige cambiarla.

---

## Notas de cierre

- **Reglas duras respetadas:** guards/roles en decoradores; sin `isCorrect` afectado; sin tocar `PublicLayout`; `checkAndAward` no interviene aquí; scope con `@vkbacademy/api`.
- **Fuera de alcance:** cobro/pago del tutor; auto-inscripción del alumno; verificación de contraseña actual en `change-password` (el flujo se basa en el token autenticado).
- **Despliegue:** la migración Prisma se aplica vía el job `migrate-pre`/`migrate-prod` del pipeline, no en el contenedor. Como PRE/PROD tienen poca data, el backfill del `migration.sql` es suficiente.
