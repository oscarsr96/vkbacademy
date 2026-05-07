# Tutor Student Credentials Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que el tutor vea, en cualquier momento desde su dashboard, las credenciales (email + contraseña en plano) de cada uno de sus alumnos.

**Architecture:** Añadir un campo `viewablePassword` al modelo `User`, cifrado con AES-256-GCM (clave en env). Sincronizarlo en los tres flujos que mutan la contraseña de un alumno (`registerTutor`, `resetPassword`, `admin.updateUser`). Exponer un endpoint `GET /tutors/my-students/credentials` que descifra y devuelve las credenciales solo para los alumnos del tutor solicitante.

**Tech Stack:** NestJS, Prisma, PostgreSQL, Node `crypto` (AES-256-GCM nativo), React + React Query, Vite.

**Spec:** `docs/superpowers/specs/2026-05-07-tutor-student-credentials-design.md`

---

## File Structure

**Crear:**

- `apps/api/src/crypto/crypto.module.ts` — módulo Nest exportable
- `apps/api/src/crypto/crypto.service.ts` — `encrypt` / `decrypt` con AES-256-GCM
- `apps/api/src/crypto/crypto.service.spec.ts` — round-trip, manipulación, validación de clave
- `apps/api/prisma/migrations/<timestamp>_add_user_viewable_password/migration.sql` — Prisma genera
- `apps/web/src/components/tutor/StudentCredentialsTable.tsx` — tabla con copiar al portapapeles + botón restablecer

**Modificar:**

- `apps/api/prisma/schema.prisma` — añade `viewablePassword String?` al `User`
- `apps/api/src/auth/auth.module.ts` — importar `CryptoModule`
- `apps/api/src/auth/auth.service.ts` — `registerTutor`, `resetPassword`
- `apps/api/src/auth/auth-register-tutor.service.spec.ts` — verifica encriptación
- `apps/api/src/auth/auth.service.spec.ts` — verifica resetPassword sync
- `apps/api/src/admin/admin.module.ts` — importar `CryptoModule`
- `apps/api/src/admin/admin.service.ts` — `updateUser`
- `apps/api/src/admin/admin.service.spec.ts` — verifica sync condicionada al rol
- `apps/api/src/tutors/tutors.module.ts` — importar `CryptoModule`
- `apps/api/src/tutors/tutors.controller.ts` — nuevo route handler
- `apps/api/src/tutors/tutors.service.ts` — nuevo método `getStudentsCredentials`
- `apps/api/src/tutors/tutors.service.spec.ts` — verifica filtro y descifrado
- `apps/api/.env.example` — `STUDENT_PASSWORD_ENC_KEY`
- `apps/web/src/api/tutors.api.ts` — añade `getStudentsCredentials`
- `apps/web/src/pages/TutorStudentsPage.tsx` — integra `StudentCredentialsTable`
- `CLAUDE.md` — sección 9 documenta nueva env var

---

## Task 1: CryptoService

**Files:**

- Create: `apps/api/src/crypto/crypto.service.ts`
- Create: `apps/api/src/crypto/crypto.service.spec.ts`
- Create: `apps/api/src/crypto/crypto.module.ts`

- [ ] **Step 1: Write failing tests**

Crear `apps/api/src/crypto/crypto.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CryptoService } from './crypto.service';

const VALID_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

async function buildService(keyValue: string | undefined): Promise<CryptoService> {
  const moduleRef = await Test.createTestingModule({
    providers: [
      CryptoService,
      {
        provide: ConfigService,
        useValue: { get: jest.fn().mockReturnValue(keyValue) },
      },
    ],
  }).compile();
  return moduleRef.get(CryptoService);
}

describe('CryptoService', () => {
  it('encrypt + decrypt preserva el plaintext', async () => {
    const service = await buildService(VALID_KEY);
    const plain = 'aB3xY7Q9';
    const encrypted = service.encrypt(plain);
    expect(service.decrypt(encrypted)).toBe(plain);
  });

  it('produce ciphertext distinto en cada llamada con el mismo input (IV aleatorio)', async () => {
    const service = await buildService(VALID_KEY);
    const a = service.encrypt('same');
    const b = service.encrypt('same');
    expect(a).not.toBe(b);
    expect(service.decrypt(a)).toBe('same');
    expect(service.decrypt(b)).toBe('same');
  });

  it('detecta manipulación del ciphertext mediante el auth tag', async () => {
    const service = await buildService(VALID_KEY);
    const encrypted = service.encrypt('secret');
    const tampered = encrypted.slice(0, -1) + (encrypted.endsWith('0') ? '1' : '0');
    expect(() => service.decrypt(tampered)).toThrow();
  });

  it('falla al construirse si la clave tiene longitud incorrecta', async () => {
    await expect(buildService('tooshort')).rejects.toThrow('STUDENT_PASSWORD_ENC_KEY');
  });

  it('falla al construirse si la clave no está definida', async () => {
    await expect(buildService(undefined)).rejects.toThrow('STUDENT_PASSWORD_ENC_KEY');
  });

  it('rechaza payload con formato inválido al descifrar', async () => {
    const service = await buildService(VALID_KEY);
    expect(() => service.decrypt('no-colons')).toThrow();
    expect(() => service.decrypt('only:two')).toThrow();
  });
});
```

- [ ] **Step 2: Run tests, expect FAIL**

Run: `pnpm --filter @vkbacademy/api test crypto.service.spec`
Expected: FAIL — `CryptoService` no existe.

- [ ] **Step 3: Implement CryptoService and CryptoModule**

Crear `apps/api/src/crypto/crypto.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ENV_VAR = 'STUDENT_PASSWORD_ENC_KEY';
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_HEX_LENGTH = 64; // 32 bytes

@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const raw = config.get<string>(ENV_VAR);
    if (!raw || raw.length !== KEY_HEX_LENGTH || !/^[0-9a-fA-F]+$/.test(raw)) {
      throw new Error(
        `${ENV_VAR} debe ser una cadena hex de ${KEY_HEX_LENGTH} caracteres (32 bytes). Genérala con \`openssl rand -hex 32\`.`,
      );
    }
    this.key = Buffer.from(raw, 'hex');
  }

  /**
   * Cifra un texto plano con AES-256-GCM. Devuelve "iv:authTag:ciphertext" en hex.
   * Cada llamada produce un IV nuevo, por lo que la salida no es determinista.
   */
  encrypt(plain: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  /**
   * Descifra un payload "iv:authTag:ciphertext". Lanza si el auth tag no
   * cuadra (datos manipulados o clave incorrecta) o si el formato es inválido.
   */
  decrypt(payload: string): string {
    const parts = payload.split(':');
    if (parts.length !== 3) {
      throw new Error('Formato de payload inválido');
    }
    const [ivHex, tagHex, dataHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const data = Buffer.from(dataHex, 'hex');
    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString('utf8');
  }
}
```

Crear `apps/api/src/crypto/crypto.module.ts`:

```ts
import { Global, Module } from '@nestjs/common';
import { CryptoService } from './crypto.service';

@Global()
@Module({
  providers: [CryptoService],
  exports: [CryptoService],
})
export class CryptoModule {}
```

- [ ] **Step 4: Run tests, expect PASS**

Run: `pnpm --filter @vkbacademy/api test crypto.service.spec`
Expected: PASS — los 6 tests verdes.

- [ ] **Step 5: Register CryptoModule globally in AppModule**

Modificar `apps/api/src/app.module.ts`. Añadir junto a los otros imports:

```ts
import { CryptoModule } from './crypto/crypto.module';
```

Y añadirlo al array `imports`. Búscalo entre los otros (orden alfabético si se sigue, si no al final). Como `CryptoModule` está marcado `@Global()`, basta con importarlo una vez aquí.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/crypto/ apps/api/src/app.module.ts
git commit -m "feat(crypto): add CryptoService for AES-256-GCM symmetric encryption"
```

---

## Task 2: Prisma schema migration — add `viewablePassword`

**Files:**

- Modify: `apps/api/prisma/schema.prisma:75`
- Create: `apps/api/prisma/migrations/<timestamp>_add_user_viewable_password/migration.sql` (Prisma genera)

- [ ] **Step 1: Add field to schema**

En `apps/api/prisma/schema.prisma`, dentro del `model User { ... }`, justo después de la línea `passwordHash String`, añadir:

```prisma
  viewablePassword String?  // AES-256-GCM (iv:tag:ciphertext). Solo poblado para STUDENT con tutorId.
```

- [ ] **Step 2: Generar migración**

Ejecutar (necesita Postgres en local levantado vía `docker compose up -d`):

```bash
pnpm --filter @vkbacademy/api prisma migrate dev --name add_user_viewable_password
```

Esto:

- Genera `apps/api/prisma/migrations/<timestamp>_add_user_viewable_password/migration.sql`
- Aplica la migración a la BD local
- Regenera el cliente Prisma (`@prisma/client`) con el campo nuevo

- [ ] **Step 3: Verificar que el cliente compila**

Run: `pnpm --filter @vkbacademy/api exec tsc --noEmit`
Expected: PASS, sin errores. (Pueden persistir errores preexistentes ajenos a esta feature; el cambio no debe introducir nuevos errores.)

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat(db): add User.viewablePassword for tutor-visible student passwords"
```

---

## Task 3: `auth.service.registerTutor` cifra `viewablePassword`

**Files:**

- Modify: `apps/api/src/auth/auth.service.ts:104-191`
- Modify: `apps/api/src/auth/auth-register-tutor.service.spec.ts`
- Modify: `apps/api/src/auth/auth.module.ts`

- [ ] **Step 1: Inspeccionar el spec existente**

Run: `head -80 apps/api/src/auth/auth-register-tutor.service.spec.ts`

Familiarízate con cómo mockea `PrismaService` y `NotificationsService`. Busca el bloque que configura la transacción y los `tx.user.create` para tutor + alumnos.

- [ ] **Step 2: Ampliar el mock para inyectar CryptoService**

En `auth-register-tutor.service.spec.ts`, en la sección de mocks/providers añadir:

```ts
import { CryptoService } from '../crypto/crypto.service';

const mockCrypto = {
  encrypt: jest.fn((plain: string) => `enc(${plain})`),
  decrypt: jest.fn((cipher: string) => cipher.replace(/^enc\(|\)$/g, '')),
};
```

Y en el `Test.createTestingModule({ providers: [...] })` añadir:

```ts
{ provide: CryptoService, useValue: mockCrypto },
```

- [ ] **Step 3: Write failing test**

Añadir al final del `describe('registerTutor')`:

```ts
it('guarda viewablePassword cifrado para cada alumno creado', async () => {
  // Reaprovecha el setup del happy path existente: mocks de academy, prisma.$transaction,
  // notifications, etc. Si el spec usa un helper, llámalo. Lo importante son las
  // assertions sobre tx.user.create de cada alumno.

  // Configurar:
  // - prisma.academy.findUnique → academy activa
  // - prisma.user.findUnique (chequeo email tutor) → null
  // - prisma.$transaction ejecuta la callback con un tx mockeado
  // - tx.user.create (tutor) y (alumnos) devuelven entidades con id

  // Llamar:
  await service.registerTutor({
    email: 'tutor@x.com',
    password: 'tutorPass',
    name: 'Tutor',
    academySlug: 'vallekas-basket',
    students: [{ name: 'Alumno Uno' }, { name: 'Alumno Dos' }],
  });

  // Assert: encrypt fue llamado dos veces (una por alumno) con la password generada
  expect(mockCrypto.encrypt).toHaveBeenCalledTimes(2);

  // Assert: cada tx.user.create de un alumno (role STUDENT) recibió viewablePassword = `enc(${plain})`
  const studentCreateCalls = txMock.user.create.mock.calls.filter(
    ([arg]: [{ data: { role: string } }]) => arg.data.role === 'STUDENT',
  );
  expect(studentCreateCalls).toHaveLength(2);
  for (const [arg] of studentCreateCalls) {
    expect(arg.data.viewablePassword).toBeDefined();
    expect(arg.data.viewablePassword).toMatch(/^enc\(.+\)$/);
  }
});
```

> Nota: el nombre exacto del mock `txMock` depende de cómo esté escrito el spec actual. Si usa otra variable, ajústalo. Si el spec no usa `tx.user.create` separable, configura `prisma.$transaction.mockImplementation(async (cb) => cb(tx))` con un `tx` local antes de llamar al servicio.

- [ ] **Step 4: Run test, expect FAIL**

Run: `pnpm --filter @vkbacademy/api test auth-register-tutor.service.spec`
Expected: FAIL — `viewablePassword` no se está pasando al `tx.user.create`.

- [ ] **Step 5: Implementar**

Modificar `apps/api/src/auth/auth.service.ts`:

1. Importar al inicio:

   ```ts
   import { CryptoService } from '../crypto/crypto.service';
   ```

2. Inyectar en el constructor (añadir como dependencia más):

   ```ts
   constructor(
     // ...dependencias existentes
     private readonly crypto: CryptoService,
   ) {}
   ```

3. En `registerTutor`, justo después de generar las contraseñas (`studentPasswords`) y antes de la transacción, cifrarlas:

   ```ts
   const studentViewable = studentPasswords.map((pw) => this.crypto.encrypt(pw));
   ```

4. Dentro de `tx.user.create` para cada alumno, añadir el campo:
   ```ts
   data: {
     email: studentEmails[index],
     passwordHash: studentPasswordHashes[index],
     viewablePassword: studentViewable[index],  // ← nuevo
     name: studentDto.name,
     role: 'STUDENT',
     tutorId: createdTutor.id,
     // ...resto sin cambios
   }
   ```

Modificar `apps/api/src/auth/auth.module.ts`. Si `CryptoModule` ya está como `@Global()` en `AppModule` no hay que tocar `auth.module.ts`. Verifícalo: si `CryptoService` se resuelve en runtime sin importar nada en `auth.module.ts`, perfecto. Si Nest pide que se importe explícitamente, añadir:

```ts
import { CryptoModule } from '../crypto/crypto.module';
// ...
@Module({ imports: [..., CryptoModule], ... })
```

- [ ] **Step 6: Run test, expect PASS**

Run: `pnpm --filter @vkbacademy/api test auth-register-tutor.service.spec`
Expected: PASS.

Run también la suite completa de auth para no regresar:
`pnpm --filter @vkbacademy/api test auth`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/auth/
git commit -m "feat(auth): encrypt and store viewablePassword on tutor-driven student creation"
```

---

## Task 4: `auth.service.resetPassword` sincroniza `viewablePassword`

**Files:**

- Modify: `apps/api/src/auth/auth.service.ts:332-360`
- Modify: `apps/api/src/auth/auth.service.spec.ts`

- [ ] **Step 1: Write failing tests**

En `apps/api/src/auth/auth.service.spec.ts`, en el describe de `resetPassword` (créalo si no existe), añadir:

```ts
describe('resetPassword', () => {
  it('actualiza viewablePassword cuando el usuario es STUDENT con tutor', async () => {
    const student = {
      id: 'st1',
      email: 's@x.com',
      role: 'STUDENT',
      tutorId: 'tut1',
      passwordHash: 'oldhash',
    };
    mockPrisma.user.findUnique.mockResolvedValue(student);
    // El secret incluye el passwordHash actual; firmar token de reset:
    const token = jwt.sign(
      { sub: student.id, email: student.email },
      mockConfig.get('JWT_SECRET') + student.passwordHash,
      { expiresIn: '1h' },
    );
    mockCrypto.encrypt.mockReturnValue('enc(newSecret)');

    await service.resetPassword(token, 'newSecret');

    expect(mockCrypto.encrypt).toHaveBeenCalledWith('newSecret');
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: student.id },
        data: expect.objectContaining({
          passwordHash: expect.any(String),
          viewablePassword: 'enc(newSecret)',
        }),
      }),
    );
  });

  it('NO toca viewablePassword cuando el usuario es TUTOR', async () => {
    const tutor = {
      id: 'tut1',
      email: 't@x.com',
      role: 'TUTOR',
      tutorId: null,
      passwordHash: 'oldhash',
    };
    mockPrisma.user.findUnique.mockResolvedValue(tutor);
    const token = jwt.sign(
      { sub: tutor.id, email: tutor.email },
      mockConfig.get('JWT_SECRET') + tutor.passwordHash,
      { expiresIn: '1h' },
    );

    await service.resetPassword(token, 'newSecret');

    expect(mockCrypto.encrypt).not.toHaveBeenCalled();
    const updateArg = mockPrisma.user.update.mock.calls[0][0];
    expect(updateArg.data).not.toHaveProperty('viewablePassword');
  });

  it('NO toca viewablePassword cuando el usuario es STUDENT sin tutor', async () => {
    const orphan = {
      id: 's2',
      email: 'o@x.com',
      role: 'STUDENT',
      tutorId: null,
      passwordHash: 'oldhash',
    };
    mockPrisma.user.findUnique.mockResolvedValue(orphan);
    const token = jwt.sign(
      { sub: orphan.id, email: orphan.email },
      mockConfig.get('JWT_SECRET') + orphan.passwordHash,
      { expiresIn: '1h' },
    );

    await service.resetPassword(token, 'newSecret');

    expect(mockCrypto.encrypt).not.toHaveBeenCalled();
    const updateArg = mockPrisma.user.update.mock.calls[0][0];
    expect(updateArg.data).not.toHaveProperty('viewablePassword');
  });
});
```

> Nota: el spec usa `jwt.sign` con el secret real para que `verify` en el servicio acepte el token. Asegúrate de que `mockConfig.get('JWT_SECRET')` devuelve un string fijo (p. ej. `'test-secret'`). Si `auth.service.spec.ts` ya tiene un mock de Config, reusa ese valor.

> Si el spec actual no inyecta `CryptoService`, añade el provider mock como en Task 3:
>
> ```ts
> const mockCrypto = { encrypt: jest.fn(), decrypt: jest.fn() };
> // ...providers: [{ provide: CryptoService, useValue: mockCrypto }]
> ```

- [ ] **Step 2: Run tests, expect FAIL**

Run: `pnpm --filter @vkbacademy/api test auth.service.spec`
Expected: FAIL — el primer test falla porque `viewablePassword` no se incluye en el update.

- [ ] **Step 3: Implementar**

En `apps/api/src/auth/auth.service.ts`, dentro de `resetPassword`, sustituir la sección final (`const passwordHash = await bcrypt.hash(...); await this.prisma.user.update(...)`) por:

```ts
const passwordHash = await bcrypt.hash(newPassword, 10);

const data: { passwordHash: string; viewablePassword?: string } = { passwordHash };
if (user.role === 'STUDENT' && user.tutorId) {
  data.viewablePassword = this.crypto.encrypt(newPassword);
}

await this.prisma.user.update({ where: { id: user.id }, data });
```

- [ ] **Step 4: Run tests, expect PASS**

Run: `pnpm --filter @vkbacademy/api test auth.service.spec`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/auth/
git commit -m "feat(auth): sync viewablePassword on resetPassword for student-with-tutor"
```

---

## Task 5: `admin.service.updateUser` sincroniza `viewablePassword`

**Files:**

- Modify: `apps/api/src/admin/admin.service.ts:116-135`
- Modify: `apps/api/src/admin/admin.service.spec.ts`
- Modify: `apps/api/src/admin/admin.module.ts` (si `CryptoModule` no se resuelve global)

- [ ] **Step 1: Write failing tests**

En `apps/api/src/admin/admin.service.spec.ts`, añadir mock `CryptoService` (como en Task 3) y en el describe de `updateUser` añadir:

```ts
describe('updateUser viewablePassword sync', () => {
  it('actualiza viewablePassword cuando target es STUDENT con tutor y dto trae password', async () => {
    const student = { id: 'st1', role: 'STUDENT', tutorId: 'tut1', passwordHash: 'old' };
    mockPrisma.user.findUnique.mockResolvedValue(student);
    mockPrisma.user.update.mockResolvedValue({ ...student, passwordHash: 'new' });
    mockCrypto.encrypt.mockReturnValue('enc(secret)');

    await service.updateUser('st1', { password: 'secret' });

    expect(mockCrypto.encrypt).toHaveBeenCalledWith('secret');
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'st1' },
        data: expect.objectContaining({
          passwordHash: expect.any(String),
          viewablePassword: 'enc(secret)',
        }),
      }),
    );
  });

  it('NO toca viewablePassword cuando target NO es STUDENT', async () => {
    const teacher = { id: 'tch1', role: 'TEACHER', tutorId: null, passwordHash: 'old' };
    mockPrisma.user.findUnique.mockResolvedValue(teacher);
    mockPrisma.user.update.mockResolvedValue(teacher);

    await service.updateUser('tch1', { password: 'secret' });

    expect(mockCrypto.encrypt).not.toHaveBeenCalled();
    const updateArg = mockPrisma.user.update.mock.calls[0][0];
    expect(updateArg.data).not.toHaveProperty('viewablePassword');
  });

  it('NO toca viewablePassword cuando dto NO trae password (cambio de email/nombre)', async () => {
    const student = { id: 'st1', role: 'STUDENT', tutorId: 'tut1', passwordHash: 'old' };
    mockPrisma.user.findUnique.mockResolvedValue(student);
    mockPrisma.user.update.mockResolvedValue(student);

    await service.updateUser('st1', { name: 'Otro Nombre' });

    expect(mockCrypto.encrypt).not.toHaveBeenCalled();
    const updateArg = mockPrisma.user.update.mock.calls[0][0];
    expect(updateArg.data).not.toHaveProperty('viewablePassword');
  });
});
```

- [ ] **Step 2: Run tests, expect FAIL**

Run: `pnpm --filter @vkbacademy/api test admin.service.spec`
Expected: FAIL — primer test fallará porque `updateUser` no setea `viewablePassword`.

- [ ] **Step 3: Implementar**

En `apps/api/src/admin/admin.service.ts`, modificar `updateUser` para inyectar `CryptoService` (constructor) y actualizar el bloque de password:

```ts
import { CryptoService } from '../crypto/crypto.service';

// constructor:
constructor(
  // ...existentes
  private readonly crypto: CryptoService,
) {}

// dentro de updateUser, sustituir:
//   if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 10);
// por:
if (dto.password) {
  data.passwordHash = await bcrypt.hash(dto.password, 10);
  // Cargar el usuario para conocer rol y tutorId (si no está ya en scope)
  const target = await this.prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, tutorId: true },
  });
  if (target?.role === 'STUDENT' && target.tutorId) {
    data.viewablePassword = this.crypto.encrypt(dto.password);
  }
}
```

> Si `updateUser` ya hace un `findUnique` previo del usuario, reutilízalo en vez de hacer otra query.

- [ ] **Step 4: Run tests, expect PASS**

Run: `pnpm --filter @vkbacademy/api test admin.service.spec`
Expected: PASS — incluyendo los 21 tests previos.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/admin/
git commit -m "feat(admin): sync viewablePassword on updateUser for student-with-tutor"
```

---

## Task 6: Endpoint `GET /tutors/my-students/credentials`

**Files:**

- Modify: `apps/api/src/tutors/tutors.service.ts`
- Modify: `apps/api/src/tutors/tutors.service.spec.ts`
- Modify: `apps/api/src/tutors/tutors.controller.ts`
- Modify: `apps/api/src/tutors/tutors.module.ts` (si `CryptoModule` no es global)

- [ ] **Step 1: Write failing tests**

En `apps/api/src/tutors/tutors.service.spec.ts`:

1. Añadir el mock de `CryptoService`:

```ts
import { CryptoService } from '../crypto/crypto.service';

const mockCrypto = {
  encrypt: jest.fn(),
  decrypt: jest.fn((cipher: string) => cipher.replace(/^enc\(|\)$/g, '')),
};
```

Y registrarlo en el `providers` del `Test.createTestingModule`:

```ts
{ provide: CryptoService, useValue: mockCrypto },
```

Limpiar `mockCrypto.decrypt` en `beforeEach` (`jest.clearAllMocks()` ya está, así que basta con resetear el `mockImplementation` si lo cambiamos en algún test).

2. Añadir el describe nuevo:

```ts
describe('getStudentsCredentials', () => {
  it('devuelve credenciales descifradas solo de alumnos del tutor', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 's1', name: 'Pepe', email: 'pepe@x.com', viewablePassword: 'enc(aB3xY7Q9)' },
      { id: 's2', name: 'Ana', email: 'ana@x.com', viewablePassword: 'enc(M9pQrS2t)' },
    ]);

    const result = await service.getStudentsCredentials(TUTOR_ID);

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tutorId: TUTOR_ID },
        select: expect.objectContaining({
          id: true,
          name: true,
          email: true,
          viewablePassword: true,
        }),
      }),
    );
    expect(result).toEqual([
      { id: 's1', name: 'Pepe', email: 'pepe@x.com', password: 'aB3xY7Q9' },
      { id: 's2', name: 'Ana', email: 'ana@x.com', password: 'M9pQrS2t' },
    ]);
  });

  it('devuelve password=null cuando viewablePassword es null (alumno preexistente)', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 's3', name: 'Old', email: 'old@x.com', viewablePassword: null },
    ]);

    const result = await service.getStudentsCredentials(TUTOR_ID);

    expect(mockCrypto.decrypt).not.toHaveBeenCalled();
    expect(result).toEqual([{ id: 's3', name: 'Old', email: 'old@x.com', password: null }]);
  });

  it('devuelve password=null y loguea warning si descifrar falla', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 's4', name: 'Corrupt', email: 'c@x.com', viewablePassword: 'broken' },
    ]);
    mockCrypto.decrypt.mockImplementationOnce(() => {
      throw new Error('bad tag');
    });

    const result = await service.getStudentsCredentials(TUTOR_ID);

    expect(result).toEqual([{ id: 's4', name: 'Corrupt', email: 'c@x.com', password: null }]);
  });

  it('devuelve [] cuando el tutor no tiene alumnos', async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);

    const result = await service.getStudentsCredentials(TUTOR_ID);

    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests, expect FAIL**

Run: `pnpm --filter @vkbacademy/api test tutors.service.spec`
Expected: FAIL — `service.getStudentsCredentials` no existe.

- [ ] **Step 3: Implementar el servicio**

En `apps/api/src/tutors/tutors.service.ts`:

1. Importar e inyectar `CryptoService` en el constructor:

```ts
import { CryptoService } from '../crypto/crypto.service';

constructor(
  private readonly prisma: PrismaService,
  private readonly crypto: CryptoService,
) {}
```

2. Añadir el método (al final de la clase):

```ts
async getStudentsCredentials(tutorId: string) {
  const students = await this.prisma.user.findMany({
    where: { tutorId },
    select: {
      id: true,
      name: true,
      email: true,
      viewablePassword: true,
    },
    orderBy: { name: 'asc' },
  });

  return students.map((s) => {
    if (!s.viewablePassword) {
      return { id: s.id, name: s.name, email: s.email, password: null };
    }
    try {
      const password = this.crypto.decrypt(s.viewablePassword);
      return { id: s.id, name: s.name, email: s.email, password };
    } catch (err) {
      // No loguear el ciphertext ni el plaintext; solo el id afectado.
      this.logger.warn(`No se pudo descifrar viewablePassword del alumno ${s.id}`);
      return { id: s.id, name: s.name, email: s.email, password: null };
    }
  });
}
```

> Si `TutorsService` no tiene `private readonly logger = new Logger(TutorsService.name);`, añádelo en la clase.

- [ ] **Step 4: Run service tests, expect PASS**

Run: `pnpm --filter @vkbacademy/api test tutors.service.spec`
Expected: PASS.

- [ ] **Step 5: Añadir el route handler**

En `apps/api/src/tutors/tutors.controller.ts`, añadir como nuevo método (mismo patrón que `getMyStudents`):

```ts
@Get('my-students/credentials')
@Roles(Role.TUTOR, Role.ADMIN)
getMyStudentsCredentials(@CurrentUser() user: User) {
  return this.tutorsService.getStudentsCredentials(user.id);
}
```

> Importante: este `@Get` debe quedar **antes** de `@Get('my-students/:studentId/...')` en el archivo, porque NestJS hace matching ordenado y `:studentId` capturaría `credentials`. Confírmalo: en el orden del archivo, ponlo justo después del `getMyStudents()` y antes de cualquier ruta con `:studentId`.

- [ ] **Step 6: Verificar end-to-end con el smoke del API**

Run: `pnpm --filter @vkbacademy/api test`
Expected: PASS — toda la suite verde.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/tutors/
git commit -m "feat(tutors): GET /tutors/my-students/credentials returns decrypted student credentials"
```

---

## Task 7: Cliente API web

**Files:**

- Modify: `apps/web/src/api/tutors.api.ts`

- [ ] **Step 1: Añadir tipo y método**

Al final de `apps/web/src/api/tutors.api.ts`, antes del cierre del objeto `tutorsApi`:

1. Añadir tipo (junto a las otras interfaces):

```ts
export interface StudentCredential {
  id: string;
  name: string;
  email: string;
  password: string | null;
}
```

2. Añadir método dentro del objeto exportado:

```ts
getStudentsCredentials: () =>
  api
    .get<StudentCredential[]>('/tutors/my-students/credentials')
    .then((r) => r.data),
```

- [ ] **Step 2: Verificar tsc**

Run: `pnpm --filter @vkbacademy/web exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/api/tutors.api.ts
git commit -m "feat(web): add tutorsApi.getStudentsCredentials"
```

---

## Task 8: Componente `StudentCredentialsTable` en TutorStudentsPage

**Files:**

- Create: `apps/web/src/components/tutor/StudentCredentialsTable.tsx`
- Modify: `apps/web/src/pages/TutorStudentsPage.tsx`
- Modify: `apps/web/src/api/auth.api.ts` (si no existe ya `forgotPassword`)

- [ ] **Step 1: Confirmar disponibilidad del cliente forgotPassword**

Run: `grep -n "forgotPassword\|forgot-password" apps/web/src/api/auth.api.ts`
Expected: ya existe (lo usa la página de recuperación). Si no existe, añadir:

```ts
forgotPassword: (email: string) =>
  api.post('/auth/forgot-password', { email }).then((r) => r.data),
```

- [ ] **Step 2: Crear el componente**

Crear `apps/web/src/components/tutor/StudentCredentialsTable.tsx`:

```tsx
import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { tutorsApi, type StudentCredential } from '../../api/tutors.api';
import { authApi } from '../../api/auth.api';

const ORANGE = '#ea580c';

export function StudentCredentialsTable() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['tutor', 'students', 'credentials'],
    queryFn: () => tutorsApi.getStudentsCredentials(),
    staleTime: 0,
  });

  const resetMutation = useMutation({
    mutationFn: (email: string) => authApi.forgotPassword(email),
  });

  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (isLoading) return <div style={{ padding: 16 }}>Cargando credenciales…</div>;
  if (isError)
    return <div style={{ padding: 16, color: '#b91c1c' }}>Error al cargar credenciales.</div>;
  if (!data || data.length === 0) return null;

  const onCopy = async (item: StudentCredential) => {
    if (!item.password) return;
    await navigator.clipboard.writeText(item.password);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId((id) => (id === item.id ? null : id)), 1500);
  };

  return (
    <section
      style={{
        background: '#fff',
        borderRadius: 12,
        padding: 20,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
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
        Credenciales de mis alumnos
      </h2>
      <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0, marginBottom: 16 }}>
        Estas credenciales son privadas. No las compartas en sitios públicos.
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
            <th style={{ padding: '8px 4px', fontWeight: 600 }}>Nombre</th>
            <th style={{ padding: '8px 4px', fontWeight: 600 }}>Email</th>
            <th style={{ padding: '8px 4px', fontWeight: 600 }}>Contraseña</th>
            <th style={{ padding: '8px 4px', fontWeight: 600, width: 140 }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '8px 4px' }}>{item.name}</td>
              <td style={{ padding: '8px 4px', fontFamily: 'monospace' }}>{item.email}</td>
              <td style={{ padding: '8px 4px', fontFamily: 'monospace' }}>
                {item.password ? (
                  <>
                    {item.password}
                    <button
                      type="button"
                      onClick={() => onCopy(item)}
                      title="Copiar al portapapeles"
                      style={{
                        marginLeft: 8,
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: ORANGE,
                      }}
                    >
                      {copiedId === item.id ? '✓ copiada' : '📋'}
                    </button>
                  </>
                ) : (
                  <span style={{ color: '#94a3b8' }}>—</span>
                )}
              </td>
              <td style={{ padding: '8px 4px' }}>
                {!item.password && (
                  <button
                    type="button"
                    onClick={() => resetMutation.mutate(item.email)}
                    disabled={resetMutation.isPending}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: `1px solid ${ORANGE}`,
                      background: 'transparent',
                      color: ORANGE,
                      cursor: resetMutation.isPending ? 'wait' : 'pointer',
                      fontSize: '0.8rem',
                    }}
                  >
                    Restablecer
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {resetMutation.isSuccess && (
        <p style={{ marginTop: 12, fontSize: '0.85rem', color: '#16a34a' }}>
          Email de restablecimiento enviado. Revisa la bandeja del alumno.
        </p>
      )}
      {resetMutation.isError && (
        <p style={{ marginTop: 12, fontSize: '0.85rem', color: '#b91c1c' }}>
          Error al solicitar el restablecimiento. Inténtalo de nuevo.
        </p>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Integrar en TutorStudentsPage**

Modificar `apps/web/src/pages/TutorStudentsPage.tsx`:

1. Importar el componente:

   ```tsx
   import { StudentCredentialsTable } from '../components/tutor/StudentCredentialsTable';
   ```

2. Renderizar `<StudentCredentialsTable />` en algún punto visible del layout principal de la página. Si la página tiene una sección de "panel principal" tras seleccionar alumno, ponlo arriba; si no, ubícalo en la parte superior del área de contenido (no en el sidebar).

- [ ] **Step 4: Verificar tsc**

Run: `pnpm --filter @vkbacademy/web exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Smoke manual**

Levanta el dev server (`pnpm dev`), entra como tutor, verifica:

- La tabla carga con los alumnos del tutor.
- Click en 📋 copia la contraseña al portapapeles (verifica con Cmd+V en cualquier campo).
- Si hay un alumno sin `viewablePassword`, aparece "Restablecer" y al pulsar dispara la llamada (verifica en Network tab que se llama a `/auth/forgot-password`).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/tutor/ apps/web/src/pages/TutorStudentsPage.tsx
git commit -m "feat(web): show student credentials table on TutorStudentsPage"
```

---

## Task 9: Documentación y env

**Files:**

- Modify: `apps/api/.env.example`
- Modify: `CLAUDE.md` (sección 9)

- [ ] **Step 1: Añadir variable a .env.example**

Añadir al final de `apps/api/.env.example`:

```env
# Clave de cifrado para contraseñas visibles de alumnos por su tutor.
# Generar con: openssl rand -hex 32
STUDENT_PASSWORD_ENC_KEY=
```

- [ ] **Step 2: Documentar en CLAUDE.md**

En `CLAUDE.md` sección 9 ("Variables de entorno"), añadir tras `RESEND_API_KEY / EMAIL_FROM` o donde haga sentido:

```env
STUDENT_PASSWORD_ENC_KEY                 # 32 bytes hex; cifra contraseñas visibles para tutor
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/.env.example CLAUDE.md
git commit -m "docs: document STUDENT_PASSWORD_ENC_KEY env var"
```

---

## Task 10: Verificación final integrada

- [ ] **Step 1: Backend tests completos**

Run: `pnpm --filter @vkbacademy/api test`
Expected: PASS (todas las suites). El número de tests debe haber aumentado vs. la línea base por los añadidos en Tasks 1, 3, 4, 5, 6.

- [ ] **Step 2: Web typecheck**

Run: `pnpm --filter @vkbacademy/web exec tsc --noEmit`
Expected: PASS sin nuevos errores.

- [ ] **Step 3: Verificar que la env var falta hace fallar el arranque**

Levantar el API sin `STUDENT_PASSWORD_ENC_KEY` definida. Esperado: el `CryptoService` lanza al construirse, Nest no arranca, mensaje claro.

Restaurar la env var. Levantar de nuevo: arranca normal.

- [ ] **Step 4: Smoke manual end-to-end**

1. Crear un tutor nuevo desde `/register-tutor` con 2 alumnos.
2. Loguearse como ese tutor.
3. Ir a la página de alumnos. Verificar que la tabla muestra las 2 contraseñas en plano.
4. Cambiar la contraseña de uno de los alumnos vía panel admin (con cuenta admin) → loguearse de nuevo como tutor → la tabla refleja la nueva contraseña.
5. Intentar `forgot-password` para un alumno → seguir el link → cambiar contraseña → verificar que la tabla del tutor muestra la nueva.

- [ ] **Step 5: Push**

```bash
git push origin main
```

> El pipeline `deploy-pipeline.yml` corre tests, despliega a PRE y se queda en gate antes de PROD. Migración a Neon PRE corre en `migrate-pre`. Verificar en GitHub Actions.

---

## Notas de implementación

- **Orden estricto:** Task 1 (CryptoService) y Task 2 (schema) son requisitos para 3-6. No se pueden paralelizar.
- **Tasks 3-5** podrían paralelizarse si trabajara más de un agente, pero comparten `auth.service.ts` (Tasks 3 y 4) por lo que conviene ejecutarlas en serie para evitar conflictos de merge.
- **Task 7-8** (frontend) dependen del Task 6 (endpoint).
- **No introducir nuevos errores `tsc`** en el repo: hay errores preexistentes en otras partes (helmet types) ajenos a esta feature; no tocarlos.
- **Nunca loguear** el plaintext de la contraseña ni el ciphertext en error paths.
- **No escribir** la env var en commits, README, ni Cypress fixtures.
