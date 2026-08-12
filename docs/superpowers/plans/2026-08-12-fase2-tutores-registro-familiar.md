# Fase 2 — Fuera tutores, registro por familia · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar el rol `TUTOR` y su portal, sustituir el registro en dos niveles por un registro por familia donde el padre no tiene cuenta, y dar al admin la única vía de recuperación de un alumno sin email.

**Architecture:** Se construye antes de podar. Primero el reset de contraseña del admin, para que nunca exista una ventana en la que un alumno no pueda recuperar el acceso. Después el registro nuevo. Solo entonces se poda el rol `TUTOR` y el flujo `mustChangePassword`. Todo el código va con el schema intacto; la migración destructiva es la penúltima tarea y el único punto de no retorno.

**Tech Stack:** NestJS + Prisma + PostgreSQL 16 (API) · React 18 + Vite + React Query (web) · Jest (unit y e2e) · pnpm workspaces + Turborepo.

**Spec:** [`docs/superpowers/specs/2026-08-12-fase2-tutores-registro-familiar-design.md`](../specs/2026-08-12-fase2-tutores-registro-familiar-design.md)

## Global Constraints

- TypeScript `strict: true` según CLAUDE.md. Sin `any` salvo justificación en comentario. Nota: `apps/api/tsconfig.json` solo tiene `strictNullChecks` y `noImplicitAny`, así que el compilador da menos red de la que parece.
- Nombres de código en inglés; comentarios en español.
- Usar siempre `pnpm --filter @vkbacademy/api` y `pnpm --filter @vkbacademy/web` (nombres con scope).
- Estilo de commit del repo: `feat(auth):`, `refactor(api):`, `refactor(web):`, `chore(db):`, `docs:`. Seguir el git log existente.
- **Nunca `--no-verify`** ni saltarse hooks de git.
- Las migraciones no corren en el contenedor: se aplican desde los jobs `migrate-pre` / `migrate-prod`.
- Rama de trabajo: `refactor/fase2-tutores-registro` (ya creada, con el spec commiteado).
- **El tutor IA (`apps/api/src/tutor/`, `TutorMessage`, `TutorWidget.tsx`, `tutor.types.ts`) no se toca en ninguna tarea.** Solo cambia la condición que lo monta en `AppLayout`. No confundir con `apps/api/src/tutors/` (plural), que es el rol de los padres y sí se elimina.
- `UsernameService` es `@Global()`: se puede inyectar sin importar `UsernameModule`.

---

## File Structure

**Se crea**

| Ruta | Responsabilidad |
| ---- | --------------- |
| `apps/api/src/auth/dto/register-students.dto.ts` | Cuerpo del registro por familia |
| `apps/api/src/auth/auth-register-students.service.spec.ts` | Tests del registro nuevo |
| `apps/api/src/admin/dto/reset-password.dto.ts` | Cuerpo del reset de contraseña |

**Se borra**

| Ruta | LOC |
| ---- | --: |
| `apps/api/src/tutors/` | 1.058 |
| `apps/api/src/auth/auth-register-tutor.service.spec.ts` | 510 |
| `apps/api/src/auth/dto/register.dto.ts` · `register-tutor.dto.ts` | — |
| `apps/api/src/auth/interceptors/must-change-password.interceptor.ts` | 36 |
| `apps/api/src/auth/decorators/allow-when-must-change.decorator.ts` | 5 |
| `apps/api/src/auth/dto/change-password.dto.ts` | — |
| `apps/api/src/admin/dto/assign-tutor.dto.ts` | 7 |
| `apps/api/test/e2e/14-tutors.e2e-spec.ts` | 233 |
| `apps/web/src/pages/TutorStudentsPage.tsx` | 967 |
| `apps/web/src/components/tutor/StudentAccessPanel.tsx` | 182 |
| `apps/web/src/pages/ChangePasswordPage.tsx` | 118 |
| `apps/web/src/api/tutors.api.ts` · `hooks/useTutors.ts` | 136 |

**Se modifica:** ver el inventario del spec §4.2.

---

## Task 1: Pre-vuelo — conteos y volcado

**Files:**
- Create: `apps/api/prisma/dump-tutors.ts` *(temporal; se borra en Task 8)*

**Interfaces:**
- Consumes: nada.
- Produces: `data/exports/tutors-<entorno>-<fecha>.json` y unos conteos que se reportan al propietario.

- [ ] **Step 1: Crear el script de volcado**

Crear `apps/api/prisma/dump-tutors.ts`:

```ts
/**
 * Volcado de solo lectura de lo que la fase 2 va a eliminar: los usuarios con
 * rol TUTOR, con su email y la lista de hijos que cuelgan de cada uno.
 *
 * Uso:
 *   DATABASE_URL="<url del entorno>" ENV_NAME=pre \
 *     pnpm --filter @vkbacademy/api exec ts-node prisma/dump-tutors.ts
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

  const tutors = await prisma.user.findMany({
    where: { role: 'TUTOR' },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      students: {
        select: { id: true, name: true, username: true, schoolYearId: true },
      },
    },
  });

  const roleCounts = await prisma.user.groupBy({ by: ['role'], _count: { role: true } });

  const studentsWithTutor = await prisma.user.count({
    where: { role: 'STUDENT', tutorId: { not: null } },
  });
  const studentsWithoutTutor = await prisma.user.count({
    where: { role: 'STUDENT', tutorId: null },
  });

  const payload = {
    env: envName,
    dumpedAt: new Date().toISOString(),
    roleCounts: roleCounts.map((r) => ({ role: r.role, count: r._count.role })),
    counts: { tutors: tutors.length, studentsWithTutor, studentsWithoutTutor },
    tutors,
  };

  const outDir = resolve(process.cwd(), '../../data/exports');
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, `tutors-${envName}-${today}.json`);
  writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');

  console.log(`Volcado escrito en ${outPath}`);
  console.log('Roles:', payload.roleCounts);
  console.log('Conteos:', payload.counts);
  console.log(
    'ATENCIÓN — alumnos que se quedarán sin guardianEmail:',
    studentsWithoutTutor,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
```

- [ ] **Step 2: Ejecutar contra PRE y PROD**

Run, sustituyendo la URL de cada entorno:
```bash
DATABASE_URL="<url PRE>"  ENV_NAME=pre  pnpm --filter @vkbacademy/api exec ts-node prisma/dump-tutors.ts
DATABASE_URL="<url PROD>" ENV_NAME=prod pnpm --filter @vkbacademy/api exec ts-node prisma/dump-tutors.ts
```
Expected: dos ficheros en `data/exports/` (que está en `.gitignore`) y los conteos por consola.

- [ ] **Step 3: PARADA — reportar al propietario**

Presentar, por entorno: número de tutores, alumnos con tutor, y **alumnos sin tutor** (esos se quedarán sin `guardianEmail`). No continuar sin visto bueno.

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/dump-tutors.ts
git commit -m "chore(db): script temporal de volcado de tutores previo a la fase 2"
```

---

## Task 2: Admin — reset de contraseña y username visible

Se construye **antes** de podar nada, para que la vía de recuperación exista en todo momento (spec §3).

**Files:**
- Create: `apps/api/src/admin/dto/reset-password.dto.ts`
- Modify: `apps/api/src/admin/admin-users.service.ts`, `apps/api/src/admin/admin-users.service.spec.ts`, `apps/api/src/admin/admin.controller.ts`
- Modify: `apps/web/src/api/admin.api.ts`, `apps/web/src/pages/admin/AdminUsersPage.tsx`

**Interfaces:**
- Consumes: nada.
- Produces: `PATCH /admin/users/:id/password` con cuerpo `{ password: string }` que devuelve `{ message: string }`. `GET /admin/users` incluye `username: string | null` en cada elemento y su `search` también busca por username.

- [ ] **Step 1: Escribir el test que falla**

En `apps/api/src/admin/admin-users.service.spec.ts`, añadir dentro del `describe` principal:

```ts
  describe('resetPassword', () => {
    it('hashea la contraseña nueva y la guarda', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...fakeUser, role: 'STUDENT' });
      mockPrisma.user.update.mockResolvedValue({ ...fakeUser });

      await service.resetPassword('user-1', 'nuevaClave123');

      const updateArgs = mockPrisma.user.update.mock.calls[0][0];
      expect(updateArgs.where).toEqual({ id: 'user-1' });
      expect(updateArgs.data.passwordHash).toEqual(expect.any(String));
      expect(updateArgs.data.passwordHash).not.toBe('nuevaClave123');
    });

    it('lanza NotFoundException si el usuario no existe', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.resetPassword('nope', 'nuevaClave123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
```

Comprobar que `NotFoundException` está importado en el fichero; si no, añadirlo a la importación de `@nestjs/common`.

- [ ] **Step 2: Ejecutar el test para verlo fallar**

Run: `pnpm --filter @vkbacademy/api test -- admin-users`
Expected: FALLA con `service.resetPassword is not a function`.

- [ ] **Step 3: Implementar el servicio**

En `apps/api/src/admin/admin-users.service.ts`, añadir:

```ts
  /** Restablece la contraseña de un usuario. Es la única vía de recuperación
   *  para alumnos, que no tienen email con el que usar forgot-password. */
  async resetPassword(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const passwordHash = await bcrypt.hash(password, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return { message: 'Contraseña restablecida' };
  }
```

- [ ] **Step 4: Ejecutar el test para verlo pasar**

Run: `pnpm --filter @vkbacademy/api test -- admin-users`
Expected: PASA.

- [ ] **Step 5: Exponer el endpoint**

Crear `apps/api/src/admin/dto/reset-password.dto.ts`:

```ts
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(72, { message: 'La contraseña es demasiado larga' })
  password: string;
}
```

En `apps/api/src/admin/admin.controller.ts`, importar el DTO como `ResetPasswordDto as AdminResetPasswordDto` si ya existe otro con ese nombre en el fichero (comprobarlo primero) y añadir el endpoint junto al resto de rutas de `users`:

```ts
  @Patch('users/:id/password')
  resetPassword(@Param('id') id: string, @Body() dto: AdminResetPasswordDto) {
    return this.adminUsersService.resetPassword(id, dto.password);
  }
```

El controller ya es `@Roles(Role.ADMIN)` a nivel de clase y `RolesGuard` deja pasar a `SUPER_ADMIN`, así que no hace falta anotación adicional.

- [ ] **Step 6: Exponer el username (D15)**

En `apps/api/src/admin/admin-users.service.ts`, dentro del `select` de `getUsers` (líneas ~39-51), añadir junto a `email`:

```ts
          username: true,
```

Y en el filtro `search` del `where` (líneas ~24-31), añadir una tercera condición al `OR`:

```ts
              { username: { contains: params.search, mode: 'insensitive' as const } },
```

- [ ] **Step 7: Alinear el frontend**

En `apps/web/src/api/admin.api.ts`, añadir `username: string | null;` al tipo de usuario que devuelve `getUsers` (buscar la interfaz que declara `email`, `name`, `role`) y añadir la función:

```ts
  resetUserPassword: (userId: string, password: string) =>
    api.patch<{ message: string }>(`/admin/users/${userId}/password`, { password }).then((r) => r.data),
```

En `apps/web/src/pages/admin/AdminUsersPage.tsx`:
- Mostrar el `username` en la ficha del usuario, junto al email. Si es `null`, no renderizar nada.
- Añadir un botón «Restablecer contraseña» que pida la contraseña nueva y llame a `adminApi.resetUserPassword`. Seguir el patrón de mutación con `useMutation` + invalidación de `['admin','users']` que ya usan las otras acciones del fichero.

- [ ] **Step 8: Verificar**

Run: `pnpm --filter @vkbacademy/api test && pnpm --filter @vkbacademy/web exec tsc --noEmit`
Expected: en verde y sin errores.

- [ ] **Step 9: Commit**

```bash
git add -A apps/api/src/admin apps/web/src/api/admin.api.ts apps/web/src/pages/admin/AdminUsersPage.tsx
git commit -m "feat(admin): restablecer contrasena de alumno y ver su username"
```

---

## Task 3: Backend — registro por familia

**Files:**
- Create: `apps/api/src/auth/dto/register-students.dto.ts`, `apps/api/src/auth/auth-register-students.service.spec.ts`
- Modify: `apps/api/src/auth/auth.service.ts`, `apps/api/src/auth/auth.controller.ts`

**Interfaces:**
- Consumes: `UsernameService.allocate(names: string[]): Promise<string[]>`, que resuelve colisiones con sufijo.
- Produces: `POST /auth/register-students` → `{ students: { name: string; username: string; schoolYear: string | null }[] }`. **Sin tokens.** Task 4 consume exactamente esa forma.

- [ ] **Step 1: Crear el DTO**

Crear `apps/api/src/auth/dto/register-students.dto.ts`:

```ts
import {
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class NewStudentDto {
  @IsString()
  @MinLength(2, { message: 'El nombre del alumno debe tener al menos 2 caracteres' })
  @MaxLength(100)
  name: string;

  @IsString({ message: 'Debes indicar el curso del alumno' })
  @MinLength(1, { message: 'Debes indicar el curso del alumno' })
  schoolYearId: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(72, { message: 'La contraseña es demasiado larga' })
  password: string;
}

export class RegisterStudentsDto {
  /** Email del padre o la madre. Solo dato de contacto: no crea cuenta. */
  @IsEmail({}, { message: 'Email inválido' })
  guardianEmail: string;

  @IsOptional()
  @IsString()
  academySlug?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Debes registrar al menos un alumno' })
  @ValidateNested({ each: true })
  @Type(() => NewStudentDto)
  students: NewStudentDto[];
}
```

- [ ] **Step 2: Escribir los tests que fallan**

Crear `apps/api/src/auth/auth-register-students.service.spec.ts`. Copiar la estructura de mocks de `auth-register-tutor.service.spec.ts` (que aún existe) y escribir estos cuatro tests:

```ts
  it('crea un alumno por cada entrada, con su propio username', async () => {
    mockUsernames.allocate.mockResolvedValue(['ana-perez', 'luis-perez']);
    const result = await service.registerStudents({
      guardianEmail: 'padre@example.com',
      academySlug: 'vallekas-basket',
      students: [
        { name: 'Ana Pérez', schoolYearId: 'sy1', password: 'clave12345' },
        { name: 'Luis Pérez', schoolYearId: 'sy1', password: 'otraClave99' },
      ],
    });

    expect(result.students).toHaveLength(2);
    expect(result.students.map((s) => s.username)).toEqual(['ana-perez', 'luis-perez']);
  });

  it('no devuelve tokens: nadie inicia sesión al registrarse', async () => {
    mockUsernames.allocate.mockResolvedValue(['ana-perez']);
    const result = await service.registerStudents({
      guardianEmail: 'padre@example.com',
      academySlug: 'vallekas-basket',
      students: [{ name: 'Ana Pérez', schoolYearId: 'sy1', password: 'clave12345' }],
    });

    expect(result).not.toHaveProperty('accessToken');
    expect(result).not.toHaveProperty('refreshToken');
  });

  it('hashea cada contraseña por separado', async () => {
    mockUsernames.allocate.mockResolvedValue(['ana-perez', 'luis-perez']);
    await service.registerStudents({
      guardianEmail: 'padre@example.com',
      academySlug: 'vallekas-basket',
      students: [
        { name: 'Ana Pérez', schoolYearId: 'sy1', password: 'clave12345' },
        { name: 'Luis Pérez', schoolYearId: 'sy1', password: 'otraClave99' },
      ],
    });

    expect(mockedBcrypt.hash).toHaveBeenCalledWith('clave12345', 10);
    expect(mockedBcrypt.hash).toHaveBeenCalledWith('otraClave99', 10);
  });

  it('guarda el guardianEmail en cada alumno y no crea usuario para el padre', async () => {
    mockUsernames.allocate.mockResolvedValue(['ana-perez']);
    await service.registerStudents({
      guardianEmail: 'padre@example.com',
      academySlug: 'vallekas-basket',
      students: [{ name: 'Ana Pérez', schoolYearId: 'sy1', password: 'clave12345' }],
    });

    const creates = mockTx.user.create.mock.calls;
    expect(creates).toHaveLength(1);
    expect(creates[0][0].data.guardianEmail).toBe('padre@example.com');
    expect(creates[0][0].data.role).toBe('STUDENT');
  });
```

**Nota importante:** `guardianEmail` todavía no existe en el schema de Prisma (se añade en la Task 8). El cuarto test comprueba el argumento pasado a un `create` mockeado, así que **pasa igualmente**: no toca la base de datos real. El campo se escribirá en el `data` del `create` y Prisma lo aceptará en cuanto exista la columna.

- [ ] **Step 3: Ejecutar los tests para verlos fallar**

Run: `pnpm --filter @vkbacademy/api test -- auth-register-students`
Expected: FALLA con `service.registerStudents is not a function`.

- [ ] **Step 4: Implementar el servicio**

En `apps/api/src/auth/auth.service.ts`, añadir el método. Usar `registerTutor` (que aún existe, línea ~110) como referencia para la resolución de academia y la transacción, pero **sin crear ningún usuario tutor**:

```ts
  /**
   * Registro por familia: el padre o la madre da de alta a sus hijos y no
   * obtiene cuenta. Su email queda como dato de contacto en cada alumno.
   * Devuelve los usernames generados — es el único momento en que se muestran.
   */
  async registerStudents(dto: RegisterStudentsDto): Promise<{
    students: { name: string; username: string; schoolYear: string | null }[];
  }> {
    // 1. Resolver academia si se indicó
    let academyId: string | null = null;
    if (dto.academySlug) {
      const academy = await this.prisma.academy.findUnique({
        where: { slug: dto.academySlug },
      });
      if (!academy) {
        throw new NotFoundException(`La academia "${dto.academySlug}" no existe`);
      }
      if (!academy.isActive) {
        throw new BadRequestException(`La academia "${dto.academySlug}" no está activa`);
      }
      academyId = academy.id;
    }

    // 2. Usernames únicos, también entre hermanos del mismo formulario
    const usernames = await this.usernames.allocate(dto.students.map((s) => s.name));

    // 3. Hash independiente por alumno
    const passwordHashes = await Promise.all(
      dto.students.map((s) => bcrypt.hash(s.password, 10)),
    );

    // 4. Todos los hermanos o ninguno
    const created = await this.prisma.$transaction((tx) =>
      Promise.all(
        dto.students.map((studentDto, index) =>
          tx.user.create({
            data: {
              username: usernames[index],
              passwordHash: passwordHashes[index],
              name: studentDto.name,
              role: 'STUDENT',
              guardianEmail: dto.guardianEmail,
              ...(studentDto.schoolYearId ? { schoolYearId: studentDto.schoolYearId } : {}),
              ...(academyId ? { academyMembers: { create: { academyId } } } : {}),
            },
            include: { schoolYear: true },
          }),
        ),
      ),
    );

    return {
      students: created.map((u) => ({
        name: u.name,
        username: u.username!,
        schoolYear: u.schoolYear?.label ?? null,
      })),
    };
  }
```

Comprobar que `NotFoundException` y `BadRequestException` están importados en el fichero.

- [ ] **Step 5: Ejecutar los tests para verlos pasar**

Run: `pnpm --filter @vkbacademy/api test -- auth-register-students`
Expected: los cuatro PASAN.

- [ ] **Step 6: Exponer el endpoint**

En `apps/api/src/auth/auth.controller.ts`, añadir el import del DTO y el endpoint. **No borrar todavía** `register` ni `register-tutor`: caen en la Task 5, cuando el frontend ya no los use.

```ts
  @Post('register-students')
  registerStudents(@Body() dto: RegisterStudentsDto) {
    return this.authService.registerStudents(dto);
  }
```

- [ ] **Step 7: Verificar**

Run: `pnpm --filter @vkbacademy/api test && pnpm --filter @vkbacademy/api exec tsc --noEmit -p tsconfig.json`
Expected: en verde y sin errores.

- [ ] **Step 8: Commit**

```bash
git add -A apps/api/src/auth
git commit -m "feat(auth): registro por familia sin cuenta para el tutor"
```

---

## Task 4: Frontend — `RegisterPage` reescrita

**Files:**
- Modify: `apps/web/src/api/auth.api.ts`, `apps/web/src/hooks/useAuth.ts`, `apps/web/src/pages/RegisterPage.tsx`

**Interfaces:**
- Consumes: `POST /auth/register-students` con la forma exacta de la Task 3.
- Produces: `RegisterPage` ya no llama a `register` ni a `register-tutor`. Task 5 puede borrar esos endpoints.

- [ ] **Step 1: Cliente HTTP y hook**

En `apps/web/src/api/auth.api.ts`, añadir los tipos y la función, y borrar `register` y `registerTutor` con sus tipos `RegisterPayload` y `RegisterTutorPayload`:

```ts
export interface NewStudentPayload {
  name: string;
  schoolYearId: string;
  password: string;
}

export interface RegisterStudentsPayload {
  guardianEmail: string;
  academySlug?: string;
  students: NewStudentPayload[];
}

export interface RegisteredStudent {
  name: string;
  username: string;
  schoolYear: string | null;
}
```

```ts
  registerStudents: (payload: RegisterStudentsPayload) =>
    api
      .post<{ students: RegisteredStudent[] }>('/auth/register-students', payload)
      .then((r) => r.data),
```

En `apps/web/src/hooks/useAuth.ts`, borrar `useRegister` y `useRegisterTutor` enteros y añadir:

```ts
export function useRegisterStudents() {
  return useMutation({
    mutationFn: (payload: RegisterStudentsPayload) => authApi.registerStudents(payload),
  });
}
```

No hay `onSuccess` con navegación: el registro ya no inicia sesión. La página se encarga de mostrar el resultado. Ajustar los imports del fichero.

- [ ] **Step 2: Reescribir la página**

`apps/web/src/pages/RegisterPage.tsx` pasa a tener dos estados: el formulario y la confirmación.

**Formulario** — conservar la estructura de lista dinámica de alumnos que ya existe (añadir y quitar hijos), y cambiar los campos:
- Un único campo arriba: **email del padre o la madre**, con la validación de formato que ya tiene el fichero (`isValidEmail`). Etiquetarlo explícitamente como dato de contacto, no como usuario.
- Fuera los campos de nombre y contraseña del tutor.
- Por cada hijo: **nombre**, **curso** (el selector de `schoolYear` que ya existe) y **contraseña**, con el mínimo de 8 caracteres.
- Validación antes de enviar: email válido, al menos un hijo, y cada hijo con nombre, curso y contraseña de 8+ caracteres.

**Confirmación** — al resolver la mutación, sustituir el formulario por esta pantalla. Adaptar los estilos al resto del fichero (usa objetos `S.*` en línea), pero el contenido y el aviso deben ser estos:

```tsx
function RegistrationDone({ students }: { students: RegisteredStudent[] }) {
  const [copied, setCopied] = useState(false);

  const plainText = students
    .map((s) => `${s.name} — usuario: ${s.username}`)
    .join('\n');

  return (
    <div>
      <h1>Cuentas creadas</h1>

      {/* El aviso va ARRIBA, antes de la lista: si el padre cierra la pestaña
          sin apuntar los usuarios, solo un admin podrá consultarlos. */}
      <p role="alert">
        <strong>Apunta estos datos antes de cerrar esta página.</strong> No te los
        enviamos por email y no se vuelven a mostrar. Si los pierdes, tendrás que
        pedírselos a la academia.
      </p>

      <ul>
        {students.map((s) => (
          <li key={s.username}>
            <span>{s.name}</span>
            <code>{s.username}</code>
            {s.schoolYear && <span>{s.schoolYear}</span>}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(plainText);
          setCopied(true);
        }}
      >
        {copied ? 'Copiado' : 'Copiar usuarios'}
      </button>

      <Link to="/login">Ir a iniciar sesión</Link>
    </div>
  );
}
```

La contraseña **no** se muestra aquí: la eligió el padre y ya la conoce. Solo los usuarios, que son lo generado.

- [ ] **Step 3: Verificar**

Run: `pnpm --filter @vkbacademy/web exec tsc --noEmit`
Expected: sin errores.

Comprobar a mano en el navegador (`pnpm dev`): registrar dos hijos, ver dos usernames distintos, y que cada uno entra con su contraseña.

- [ ] **Step 4: Commit**

```bash
git add -A apps/web/src/api/auth.api.ts apps/web/src/hooks/useAuth.ts apps/web/src/pages/RegisterPage.tsx
git commit -m "feat(web): registro por familia con usernames en pantalla"
```

---

## Task 5: Backend — poda del rol TUTOR

**Files:**
- Delete: `apps/api/src/tutors/`, `apps/api/src/auth/auth-register-tutor.service.spec.ts`, `apps/api/src/auth/dto/register.dto.ts`, `apps/api/src/auth/dto/register-tutor.dto.ts`, `apps/api/src/admin/dto/assign-tutor.dto.ts`, `apps/api/test/e2e/14-tutors.e2e-spec.ts`
- Modify: `app.module.ts`, `auth/auth.service.ts`, `auth/auth.controller.ts`, `auth/auth.constants.ts`, `notifications/notifications.service.ts` (+spec), `admin/admin.controller.ts`, `admin/admin-users.service.ts` (+spec), `admin/admin-analytics.service.ts`, `admin/dto/create-admin-user.dto.ts`, `admin/dto/update-role.dto.ts`, `courses/courses.controller.ts`, `courses/courses.service.ts` (+spec), `academies/academies.service.ts` (+spec)

**Interfaces:**
- Consumes: Task 3 y 4 dejaron el registro nuevo funcionando.
- Produces: ningún fichero de `apps/api/src` referencia `Role.TUTOR`, `tutorId`, `registerTutor` ni `DEFAULT_STUDENT_PASSWORD`. `getMetrics` devuelve `users` sin la clave `tutors`.

- [ ] **Step 1: Borrar ficheros**

```bash
git rm -r apps/api/src/tutors
git rm apps/api/src/auth/auth-register-tutor.service.spec.ts \
       apps/api/src/auth/dto/register.dto.ts \
       apps/api/src/auth/dto/register-tutor.dto.ts \
       apps/api/src/admin/dto/assign-tutor.dto.ts \
       apps/api/test/e2e/14-tutors.e2e-spec.ts
```

- [ ] **Step 2: Desregistrar el módulo**

En `apps/api/src/app.module.ts`, quitar el import de `TutorsModule` y su entrada del array `imports`. **Ojo: no confundir con `TutorModule` (singular), el tutor IA, que se queda.**

- [ ] **Step 3: Limpiar `auth`**

En `apps/api/src/auth/auth.controller.ts`: borrar los endpoints `register` y `register-tutor` con sus imports de DTO.

En `apps/api/src/auth/auth.service.ts`: borrar los métodos `register` (línea ~53) y `registerTutor` (~110) enteros, sus imports de DTO, la llamada a `sendTutorWelcomeWithStudents` y el import de `DEFAULT_STUDENT_PASSWORD`.

Borrar `apps/api/src/auth/auth.constants.ts` si `DEFAULT_STUDENT_PASSWORD` era su único contenido; si tiene algo más, quitar solo esa constante.

Comprobar si `NotificationsService` sigue inyectándose en `auth.service.ts`: `sendPasswordReset` lo usa, así que debería quedarse. No quitar el import a ciegas.

- [ ] **Step 4: Limpiar notificaciones**

En `apps/api/src/notifications/notifications.service.ts`, borrar `sendTutorWelcomeWithStudents` (línea ~39) y su plantilla. En su `.spec.ts`, borrar el test `'sendTutorWelcomeWithStudents incluye username y contraseña por defecto en el HTML'`.

- [ ] **Step 5: Limpiar admin**

En `apps/api/src/admin/admin.controller.ts`: borrar el endpoint `@Patch('users/:id/tutor')` (línea ~83) y el import de `AssignTutorDto`.

En `apps/api/src/admin/admin-users.service.ts`: borrar `assignTutor` (línea ~61), quitar `tutorId` y `tutor` del `select` de `getUsers` junto con `_count: { select: { students: true } }`, y quitar `tutorId` del `data` de `createUser`.

En `apps/api/src/admin/admin-users.service.spec.ts`: borrar los tests de `assignTutor`.

En `apps/api/src/admin/dto/create-admin-user.dto.ts` y `update-role.dto.ts`: quitar `Role.TUTOR` de las listas `@IsIn`. Quitar también el campo `tutorId` del primero.

- [ ] **Step 6: Limpiar analytics — cuidado con el `Promise.all` posicional**

En `apps/api/src/admin/admin-analytics.service.ts`, `getMetrics` desestructura **por posición**:
- Quitar `totalTutors` de la lista de nombres (línea ~332).
- Quitar su consulta `this.prisma.user.count({ where: { role: Role.TUTOR } })` (línea ~340).
- Quitar la clave `tutors: totalTutors` del objeto de retorno (línea ~351).

**Después de editar, contar los nombres y contar las consultas y comprobar uno a uno que siguen emparejados en el mismo orden.** Un desajuste asigna datos a la variable equivocada sin error de compilación ni test rojo. Anotarlo en el informe.

El retorno debe quedar:

```ts
    return {
      users: {
        total: totalUsers,
        students: totalStudents,
      },
      courses: { total: totalCourses, published: publishedCourses },
      enrollments: totalEnrollments,
      quizAttempts: totalQuizAttempts,
    };
```

- [ ] **Step 7: Limpiar cursos y academias**

En `apps/api/src/courses/courses.controller.ts`: quitar `Role.TUTOR` de los `@Roles`. El endpoint `student-progress` queda `@Roles(Role.ADMIN)`.

En `apps/api/src/courses/courses.service.ts`: borrar la rama `if (requester.role === Role.TUTOR) { … }` de `assertCanViewStudentProgress` (con su consulta a `tutorId`) y actualizar el docblock. Quitar `TUTOR` del comentario de visibilidad de cursos.

En `apps/api/src/courses/courses.service.spec.ts`: borrar o reescribir los tests que usan `Role.TUTOR`.

En `apps/api/src/academies/academies.service.ts` (línea ~134): al crear una academia se crea un usuario `tutor@<sufijo>` con rol `TUTOR`. Borrar ese bloque del array de usuarios sembrados. Ajustar su `.spec.ts` si asertaba sobre el número de usuarios creados.

- [ ] **Step 8: Verificar**

Run: `grep -rn "Role.TUTOR\|'TUTOR'\|tutorId\|registerTutor\|DEFAULT_STUDENT_PASSWORD\|sendTutorWelcome" apps/api/src apps/api/test`
Expected: sin salida.

Run: `pnpm --filter @vkbacademy/api exec tsc --noEmit -p tsconfig.json && pnpm --filter @vkbacademy/api test`
Expected: compila y la suite en verde.

- [ ] **Step 9: Commit**

```bash
git add -A apps/api
git commit -m "refactor(api): elimina el rol TUTOR y el registro en dos niveles"
```

---

## Task 6: Backend — poda de `mustChangePassword`

**Files:**
- Delete: `apps/api/src/auth/interceptors/must-change-password.interceptor.ts`, `apps/api/src/auth/decorators/allow-when-must-change.decorator.ts`, `apps/api/src/auth/dto/change-password.dto.ts`
- Modify: `apps/api/src/auth/auth.service.ts`, `apps/api/src/auth/auth.controller.ts`, `apps/api/src/auth/auth.module.ts` o `app.module.ts` (donde esté registrado el interceptor)

**Interfaces:**
- Consumes: Task 5 eliminó lo único que ponía el flag a `true`.
- Produces: la API no expone `mustChangePassword` en ninguna respuesta y no queda ningún endpoint `change-password`.

- [ ] **Step 1: Localizar el registro del interceptor**

Run: `grep -rn "MustChangePasswordInterceptor" apps/api/src`
Anotar dónde está registrado (módulo o `main.ts`) antes de borrar el fichero.

- [ ] **Step 2: Borrar ficheros y desregistrar**

```bash
git rm apps/api/src/auth/interceptors/must-change-password.interceptor.ts \
       apps/api/src/auth/decorators/allow-when-must-change.decorator.ts \
       apps/api/src/auth/dto/change-password.dto.ts
```

Quitar el registro del interceptor del sitio localizado en el Step 1, y borrar el directorio `interceptors/` si queda vacío.

- [ ] **Step 3: Limpiar `auth`**

En `apps/api/src/auth/auth.controller.ts`: borrar el endpoint `change-password`, el import de `ChangePasswordDto` y el de `AllowWhenMustChange`. Comprobar si `JwtAuthGuard`, `CurrentUser` y `User` siguen usándose en el fichero antes de quitar sus imports.

En `apps/api/src/auth/auth.service.ts`: borrar el método `changePassword`, quitar `mustChangePassword` del tipo de respuesta de usuario (línea ~28) y de la construcción de esa respuesta (~386), y quitar `mustChangePassword: false` de `resetPassword` (~314, ~325).

- [ ] **Step 4: Verificar**

Run: `grep -rn "mustChangePassword\|MustChange\|change-password" apps/api/src apps/api/test`
Expected: sin salida.

Run: `pnpm --filter @vkbacademy/api exec tsc --noEmit -p tsconfig.json && pnpm --filter @vkbacademy/api test`
Expected: compila y la suite en verde.

- [ ] **Step 5: Commit**

```bash
git add -A apps/api/src/auth
git commit -m "refactor(api): elimina el flujo mustChangePassword"
```

---

## Task 7: Frontend y shared — poda de TUTOR y `mustChangePassword`

**Commit único**, como en la fase 1: el árbol no compila entre los pasos intermedios y es a propósito.

**Files:**
- Delete: `apps/web/src/pages/TutorStudentsPage.tsx`, `apps/web/src/components/tutor/StudentAccessPanel.tsx`, `apps/web/src/pages/ChangePasswordPage.tsx`, `apps/web/src/api/tutors.api.ts`, `apps/web/src/hooks/useTutors.ts`
- Modify: `App.tsx`, `layouts/AppLayout.tsx`, `hooks/useAuth.ts`, `pages/DashboardPage.tsx`, `pages/ProfilePage.tsx`, `pages/admin/AdminUsersPage.tsx`, `api/admin.api.ts`, `styles/global.css`, `packages/shared/src/types/user.types.ts`

**Interfaces:**
- Consumes: la forma de `getMetrics` sin `tutors` que dejó la Task 5.
- Produces: `Role` con tres valores en `packages/shared`. `pnpm build` completa.

- [ ] **Step 1: Borrar ficheros**

```bash
git rm apps/web/src/pages/TutorStudentsPage.tsx \
       apps/web/src/components/tutor/StudentAccessPanel.tsx \
       apps/web/src/pages/ChangePasswordPage.tsx \
       apps/web/src/api/tutors.api.ts \
       apps/web/src/hooks/useTutors.ts
```

Borrar el directorio `apps/web/src/components/tutor/` si queda vacío. **No confundir con `apps/web/src/components/TutorWidget.tsx`** (el tutor IA), que se queda.

- [ ] **Step 2: Rutas y menú**

En `apps/web/src/App.tsx`: borrar los imports y las rutas `tutor/students` y `change-password`.

En `apps/web/src/layouts/AppLayout.tsx`:
- Borrar el bloque `if (role === Role.TUTOR) { … }` (línea ~15).
- Borrar la línea `if (user?.mustChangePassword) return <Navigate to="/change-password" replace />;` (~66). Comprobar si `Navigate` sigue usándose en el fichero antes de quitar su import.
- En la línea ~189, la condición que monta el tutor IA pasa a:

```tsx
      {user?.role === Role.STUDENT && <TutorWidget />}
```

- [ ] **Step 3: Hooks de auth**

En `apps/web/src/hooks/useAuth.ts`: en `useLogin`, sustituir la navegación condicional por:

```ts
      navigate('/dashboard', { replace: true });
```

(`useRegister` y `useRegisterTutor` ya se borraron en la Task 4.)

- [ ] **Step 4: Dashboard**

En `apps/web/src/pages/DashboardPage.tsx`:
- Borrar el import de `tutors.api` (línea 9).
- Borrar `[Role.TUTOR]` de `ROLE_LABELS` (16) y de `ROLE_DESCRIPTION` (22).
- Borrar `const isTutor = …` (30), el bloque `{isTutor && <TutorStudentsOverview … />}` (105-106) y la condición `!isTutor` del bloque de accesos rápidos (109), que pasa a renderizarse siempre.
- Borrar los componentes `TutorStudentsOverview` y `StudentMetricCard` enteros (a partir de la línea ~318) y las claves de estilo que solo ellos usaran.

- [ ] **Step 5: Resto del frontend**

En `apps/web/src/pages/ProfilePage.tsx`: borrar `TUTOR: 'Tutor'` de `ROLE_LABELS`.

En `apps/web/src/pages/admin/AdminUsersPage.tsx`: borrar `[Role.TUTOR]` de `ROLE_LABELS` y `ROLE_COLORS`, la constante `tutors` (línea ~149) y toda la UI de asignar tutor. **No tocar** el botón de restablecer contraseña ni la visualización del username que añadió la Task 2.

En `apps/web/src/api/admin.api.ts`: quitar `tutors` de `AdminMetrics` y las funciones de asignar tutor.

En `apps/web/src/styles/global.css`: borrar la regla `.role-badge.TUTOR`.

- [ ] **Step 6: Paquete compartido**

En `packages/shared/src/types/user.types.ts`:

```ts
export enum Role {
  STUDENT = 'STUDENT',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
}
```

En la interfaz `User`: borrar `tutorId`, `tutor` y `mustChangePassword`, y añadir:

```ts
  guardianEmail?: string | null;
```

- [ ] **Step 7: Verificar**

Run: `pnpm --filter @vkbacademy/web exec tsc --noEmit`
Expected: sin errores.

Run: `grep -rniE "role\.tutor|tutorid|mustchangepassword|tutors\.api|useTutors" apps/web/src packages/shared/src`
Expected: sin salida.

Run: `pnpm build`
Expected: shared, api y web construyen. `mobile` falla por `eas` no instalado, que es preexistente y ajeno.

- [ ] **Step 8: Commit**

```bash
git add -A apps/web packages/shared
git commit -m "refactor(web): elimina el portal del tutor y el flujo mustChangePassword"
```

---

## Task 8: Schema, migración y seed

**Punto de no retorno.**

**Files:**
- Modify: `apps/api/prisma/schema.prisma`, `apps/api/prisma/seed.ts`
- Create: `apps/api/prisma/migrations/<timestamp>_remove_tutor_role/migration.sql`
- Delete: `apps/api/prisma/dump-tutors.ts`

**Interfaces:**
- Consumes: Tasks 5-7 dejaron el código sin referencias.
- Produces: el cliente Prisma sin `tutorId` ni `mustChangePassword`, con `guardianEmail`, y `Role` con tres valores.

- [ ] **Step 1: Confirmar los volcados**

Run: `ls -la data/exports/tutors-*.json`
Expected: un fichero por entorno. **Si falta alguno, volver a la Task 1.**

- [ ] **Step 2: Editar el schema**

En `apps/api/prisma/schema.prisma`, modelo `User`: borrar las tres líneas de la self-relation y la de `mustChangePassword`, y añadir el campo nuevo:

```prisma
  /// Email de contacto del padre o la madre. No crea cuenta (fase 2).
  guardianEmail String?
```

Borrar también `@@index([tutorId])`. Reducir el enum:

```prisma
enum Role {
  STUDENT
  ADMIN
  SUPER_ADMIN
}
```

- [ ] **Step 3: Generar la migración sin aplicarla**

Run:
```bash
pnpm --filter @vkbacademy/api exec prisma migrate dev --name remove_tutor_role --create-only
```

Si el comando aborta por falta de TTY (pide confirmar la pérdida de datos), ejecutarlo bajo un pty: `script -q /dev/null <comando>`.

- [ ] **Step 4: Editar el SQL a mano**

Abrir el `migration.sql` generado y reordenarlo. El orden correcto es:

```sql
-- 1. Añadir la columna nueva ANTES de nada, para poder rellenarla
ALTER TABLE "User" ADD COLUMN "guardianEmail" TEXT;

-- 2. Rescatar el email del padre en cada hijo. IMPRESCINDIBLE antes del DELETE:
--    si se invierte el orden, el contacto de cada familia se pierde para siempre.
UPDATE "User" s SET "guardianEmail" = t.email
  FROM "User" t
  WHERE s."tutorId" = t.id AND t.role = 'TUTOR';

-- 3. Ahora sí, borrar los tutores. Sus relaciones son onDelete: Cascade.
DELETE FROM "User" WHERE role = 'TUTOR';

-- 4. Columnas e índice
DROP INDEX IF EXISTS "User_tutorId_idx";
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_tutorId_fkey";
ALTER TABLE "User" DROP COLUMN "tutorId";
ALTER TABLE "User" DROP COLUMN "mustChangePassword";

-- 5. Enum, SIEMPRE al final (su COMMIT cierra la transacción envolvente de Prisma)
CREATE TYPE "Role_new" AS ENUM ('STUDENT', 'ADMIN', 'SUPER_ADMIN');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'STUDENT';
```

Añadir un comentario al final advirtiendo de que **no se puede añadir ninguna sentencia después del bloque del enum**, porque su `COMMIT` cierra la transacción que Prisma abre alrededor del fichero.

Verificar que el nombre real del índice y de la clave foránea coinciden con los del schema anterior: consultarlos con `git show HEAD~1:apps/api/prisma/schema.prisma` y con la migración que los creó.

- [ ] **Step 5: Arreglar el seed en la misma tarea**

`apps/api/prisma/seed.ts` **está fuera del typecheck** (`apps/api/tsconfig.json` excluye `prisma`), así que no dará error de compilación: reventaría en ejecución.

- Borrar el usuario con `role: Role.TUTOR` y cualquier `tutorId` que se asigne a los alumnos.
- Quitar `mustChangePassword` de las creaciones de usuario.
- Dar a cada alumno de ejemplo un `guardianEmail` verosímil.
- Comprobar con `grep -n "TUTOR\|tutorId\|mustChangePassword" apps/api/prisma/seed.ts` que no queda nada.

- [ ] **Step 6: Aplicar y verificar**

```bash
docker compose up -d
pnpm --filter @vkbacademy/api exec prisma migrate dev
pnpm --filter @vkbacademy/api exec prisma generate
```

Run: `pnpm --filter @vkbacademy/api exec prisma migrate reset --force`
Expected: reconstruye, aplica todas las migraciones y siembra sin errores. **Esta es la prueba de que el seed funciona.**

Run: `pnpm --filter @vkbacademy/api exec tsc --noEmit -p tsconfig.json && pnpm --filter @vkbacademy/api test`
Expected: compila y la suite en verde con el cliente regenerado.

- [ ] **Step 7: Probar la migración contra datos reales**

Sobre un esquema desechable, aplicar el historial completo, insertar un tutor con dos hijos, aplicar la migración nueva y comprobar que **los dos hijos conservan el email del padre en `guardianEmail`** y que el tutor ha desaparecido. Borrar el esquema al terminar. No tocar la base local principal.

- [ ] **Step 8: Borrar el script temporal y commitear**

```bash
git rm apps/api/prisma/dump-tutors.ts
git add -A apps/api/prisma
git commit -m "chore(db): elimina el rol TUTOR y migra su email a guardianEmail"
```

---

## Task 9: Documentación

**Files:**
- Modify: `CLAUDE.md`, `README.md`

**Interfaces:**
- Consumes: el estado final de las tasks 2-8.
- Produces: documentación que describe la app que existe.

- [ ] **Step 1: `CLAUDE.md`**

- §5 matriz de permisos: quitar la columna `tutor` y las filas que dejan de existir. Quedan tres roles.
- §6: `enum Role` con tres valores; quitar `tutorId` de las relaciones de `User` y añadir `guardianEmail`.
- §4: quitar `tutors` de la lista de módulos. **Mantener y actualizar la nota que distingue `tutor` (IA) de `tutors`**: ahora que el plural desaparece, la nota debe explicar que solo existe `tutor`, el tutor IA.
- §7: quitar el bloque de endpoints de tutores; documentar `POST /auth/register-students` y `PATCH /admin/users/:id/password`; quitar `POST /auth/register`, `register-tutor` y `change-password`.
- §12: añadir la fila de la fase y actualizar la fecha del pie.

- [ ] **Step 2: `README.md`**

Aplicar el mismo criterio que en la fase 1: **que no mencione ningún fichero, endpoint, rol o valor de enum que no exista.** Revisar en particular la tabla de cuentas del seed (contrastarla contra `seed.ts`), la tabla «Visibilidad por rol», el árbol de páginas web, y el listado de endpoints de auth y admin.

- [ ] **Step 3: Verificación final**

Run:
```bash
grep -rniE "role\.tutor|tutorid|mustchangepassword|register-tutor|DEFAULT_STUDENT_PASSWORD" \
  apps/api/src apps/web/src packages/shared/src apps/api/prisma/schema.prisma
```
Expected: sin salida. (Excluir `apps/api/prisma/migrations/`, que legítimamente contiene esos términos: son historia.)

Run: `pnpm --filter @vkbacademy/api test && pnpm --filter @vkbacademy/web exec tsc --noEmit && pnpm build`
Expected: todo en verde.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: actualiza la documentacion tras la eliminacion del rol TUTOR"
```

---

## Task 10: Despliegue

**Files:** ninguno. Es operación.

- [ ] **Step 1: Comprobar el estado de las migraciones**

Run `prisma migrate status` contra **PRE y PROD** por separado. Ambos deben estar al día y **sin filas con `finished_at NULL`**.

- [ ] **Step 2: Abrir el PR**

```bash
git push -u origin refactor/fase2-tutores-registro
gh pr create --title "refactor: elimina el rol TUTOR y el registro en dos niveles (fase 2)" --body "$(cat <<'EOF'
Segunda y última fase del refactor de simplificación previo a la salida a mercado.

El padre deja de tener cuenta: registra a sus hijos y su email queda como
`guardianEmail`. Caen el rol TUTOR, su portal y el flujo `mustChangePassword`.
Se construye el reset de contraseña por el admin, que pasa a ser la única vía
de recuperación de un alumno sin email.

Spec: docs/superpowers/specs/2026-08-12-fase2-tutores-registro-familiar-design.md
Plan: docs/superpowers/plans/2026-08-12-fase2-tutores-registro-familiar.md

⚠️ Migración destructiva. El `UPDATE` que rescata el email de cada familia va
antes del `DELETE` de los tutores: si se invierte, el contacto se pierde para
siempre. Volcado previo en data/exports/ (no versionado).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: PRE y verificación manual**

Tras `smoke-pre` (que, como en la fase 1, no prueba casi nada):
- Registrar una familia con dos hijos y comprobar que salen dos usernames distintos.
- Entrar con cada hijo usando su contraseña.
- Como admin: ver el username de un alumno, restablecerle la contraseña y entrar con la nueva.
- Comprobar que no queda ningún enlace muerto en el menú.

- [ ] **Step 4: PARADA — gate de PROD**

Confirmar con el propietario. Recordar que `migrate-prod` corre antes que `deploy-prod`: **aprobar los dos seguidos**.

- [ ] **Step 5: Verificación en PROD**

Repetir el recorrido del Step 3.

---

## Resumen de verificación

| Criterio del spec | Dónde se verifica |
| ----------------- | ----------------- |
| 1. Sin referencias a `Role.TUTOR`/`tutorId`/`mustChangePassword`/`DEFAULT_STUDENT_PASSWORD`/`registerTutor` | Task 9 Step 3 |
| 2. `Role` con tres valores en Prisma y en shared | Task 7 Step 6, Task 8 Step 2 |
| 3. `User` con `guardianEmail`, sin `tutorId` ni `mustChangePassword` | Task 8 Step 2 |
| 4. `register-students` crea N alumnos, usernames únicos, sin tokens | Task 3 Steps 2 y 5 |
| 5. `PATCH /admin/users/:id/password` restringido a `[ADMIN, SUPER_ADMIN]` | Task 2 Steps 1-5 |
| 5b. El admin ve el username y puede buscar por él | Task 2 Step 6 |
| 6. Los alumnos conservan el email de su padre | Task 8 Step 7 |
| 7. Tests y `tsc` en verde | Tasks 2, 3, 5, 6, 7, 8, 9 |
| 8. `pnpm build` completa | Task 7 Step 7 |
| 9. `prisma migrate reset --force` funciona | Task 8 Step 6 |
| 10. Registro de dos hijos y login de cada uno | Task 4 Step 3, Task 10 Step 3 |
| 11. Reset de contraseña por el admin | Task 10 Step 3 |
| 12. Documentación al día | Task 9 |
