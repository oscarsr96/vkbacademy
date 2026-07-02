# "Estudiar" — Unidad de estudio unificada — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sustituir los menús Teoría/Ejercicios/Exámenes del alumno por uno solo, "Estudiar", que crea una unidad de estudio personal por tema agrupando Teoría + Ejercicios + Examen generados por IA.

**Architecture:** Entidad nueva `StudyUnit` (personal, `userId`-scoped) con FK `studyUnitId` _nullable_ en `TheoryModule` y `AiExamBank` y los ejercicios persistidos como JSON. Un `StudyService` orquesta los tres generadores IA existentes (`TheoryService`, `ExercisesService`, `AiExamsService`) vía `Promise.allSettled` y enlaza cada resultado a la unidad. El frontend reemplaza tres páginas por dos (`StudyPage`, `StudyUnitPage`) reutilizando los componentes existentes.

**Tech Stack:** NestJS + Prisma (PostgreSQL) en `apps/api`; React 18 + Vite + React Query + Zustand en `apps/web`; tipos compartidos en `packages/shared`. Monorepo pnpm/Turborepo.

## Global Constraints

- Regla dura: `isCorrect` de respuestas de examen **nunca** en respuestas GET — solo en submit. (Se hereda del flujo `AiExamBank`; no se toca la corrección.)
- `checkAndAward` de gamificación siempre con `void`, nunca `await` (se hereda de los generadores reutilizados).
- TypeScript `strict: true`. Sin `any` salvo justificación (en tests, mocks con `as never` siguiendo el patrón del repo).
- Guards antes de services: lógica de roles en guard/decorador (`@UseGuards(JwtAuthGuard)`, `@CurrentUser()`), nunca en service.
- DTOs con `class-validator` en todos los endpoints.
- Nombres en inglés (variables, rutas API, columnas BD); comentarios en español.
- `StudyUnit` es `userId`-scoped, **sin** `academyId` (mismo patrón que `TheoryModule`/`AiExamBank`).
- Usar `pnpm --filter @vkbacademy/api` (scope), no `--filter api`.
- Gate backend: `pnpm --filter @vkbacademy/api test`. Gate web: `pnpm --filter @vkbacademy/web exec tsc --noEmit` (convención del repo; estas páginas no tienen harness de test de componentes).
- No `--no-verify` ni skip de hooks. Commits estilo `feat(...)`, `feat(api):`, `feat(web):`.

---

## File Structure

**packages/shared**

- Create: `packages/shared/src/types/study.types.ts` — tipos de la unidad de estudio (request + detail + summary).
- Modify: `packages/shared/src/index.ts` — re-exportar `study.types`.

**apps/api (backend)**

- Modify: `apps/api/prisma/schema.prisma` — modelo `StudyUnit` + FKs en `TheoryModule`/`AiExamBank` + back-relations en `User`/`Course`.
- Modify: `apps/api/src/theory/theory.module.ts` — `exports: [TheoryService]`.
- Modify: `apps/api/src/exercises/exercises.module.ts` — `exports: [ExercisesService]`.
- Modify: `apps/api/src/exams/exams.module.ts` — `exports: [ExamsService, AiExamsService]`.
- Create: `apps/api/src/study/dto/create-study-unit.dto.ts`
- Create: `apps/api/src/study/dto/regenerate-exercises.dto.ts`
- Create: `apps/api/src/study/dto/regenerate-exam.dto.ts`
- Create: `apps/api/src/study/study.service.ts`
- Create: `apps/api/src/study/study.service.spec.ts`
- Create: `apps/api/src/study/study.controller.ts`
- Create: `apps/api/src/study/study.module.ts`
- Modify: `apps/api/src/app.module.ts` — registrar `StudyModule`.

**apps/web (frontend)**

- Create: `apps/web/src/api/study.api.ts`
- Create: `apps/web/src/hooks/useStudy.ts`
- Create: `apps/web/src/components/theory/TheoryView.tsx` (presentacional extraído de `TheoryModulePage`).
- Create: `apps/web/src/components/exercises/ExercisePractice.tsx` (extraído de `ExercisesPage`).
- Create: `apps/web/src/pages/StudyUnitPage.tsx`
- Create: `apps/web/src/pages/StudyPage.tsx`
- Modify: `apps/web/src/pages/ExamPage.tsx` — soporte de `returnTo`.
- Modify: `apps/web/src/layouts/AppLayout.tsx` — navegación STUDENT.
- Modify: `apps/web/src/pages/DashboardPage.tsx` — accesos rápidos.
- Modify: `apps/web/src/App.tsx` — rutas.
- Delete: `apps/web/src/pages/TheoryPage.tsx`, `apps/web/src/pages/TheoryModulePage.tsx`, `apps/web/src/pages/ExercisesPage.tsx`, `apps/web/src/pages/ExamsListPage.tsx`.

---

## Task 1: Tipos compartidos `study.types.ts`

**Files:**

- Create: `packages/shared/src/types/study.types.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**

- Produces: `CreateStudyUnitRequest`, `RegenerateExercisesRequest`, `RegenerateExamRequest`, `StudyExercise`, `StudyExam`, `StudySections`, `StudyUnitSummary`, `StudyUnitDetail`.
- Consumes: `TheoryModuleWithLessons` de `./theory.types`.

- [ ] **Step 1: Crear el fichero de tipos**

Create `packages/shared/src/types/study.types.ts`:

```ts
import type { TheoryModuleWithLessons } from './theory.types';

// Ejercicio persistido en la unidad (misma forma que genera ExercisesService).
export type StudyExerciseType = 'SINGLE' | 'TRUE_FALSE' | 'OPEN';

export interface StudyExercise {
  statement: string;
  type: StudyExerciseType;
  options: string[];
  solution: string;
  explanation: string;
}

// Examen de la unidad (serializado SIN isCorrect, como getBank).
export interface StudyExamAnswer {
  id: string;
  text: string;
  order: number;
}

export interface StudyExamQuestion {
  id: string;
  text: string;
  type: 'SINGLE' | 'MULTIPLE' | 'TRUE_FALSE';
  order: number;
  answers: StudyExamAnswer[];
}

export interface StudyExam {
  id: string;
  title: string;
  topic: string;
  numQuestions: number;
  timeLimit: number | null;
  onlyOnce: boolean;
  attemptCount: number;
  questions: StudyExamQuestion[];
}

// Qué secciones se generaron con éxito.
export interface StudySections {
  theory: boolean;
  exercises: boolean;
  exam: boolean;
}

export interface StudyUnitSummary {
  id: string;
  topic: string;
  title: string;
  summary: string;
  createdAt: string;
  course: { id: string; title: string };
  sections: StudySections;
}

export interface StudyUnitDetail extends StudyUnitSummary {
  theory: TheoryModuleWithLessons | null;
  exercises: StudyExercise[] | null;
  exam: StudyExam | null;
}

// ── Requests ──
export interface CreateStudyUnitRequest {
  courseId: string;
  topic: string;
  numExercises: number;
  numQuestions: 5 | 10;
  timeLimit?: number; // segundos
  onlyOnce?: boolean;
}

export interface RegenerateExercisesRequest {
  count?: number;
}

export interface RegenerateExamRequest {
  numQuestions?: 5 | 10;
  timeLimit?: number;
  onlyOnce?: boolean;
}
```

- [ ] **Step 2: Re-exportar desde el índice**

Confirm the export pattern in `packages/shared/src/index.ts` (it re-exports each `./types/*`). Add this line alongside the others:

```ts
export * from './types/study.types';
```

- [ ] **Step 3: Verificar build de tipos compartidos**

Run: `pnpm --filter @vkbacademy/shared build`
Expected: compila sin errores. (Si el paquete no tiene script `build`, usar `pnpm --filter @vkbacademy/shared exec tsc --noEmit`.)

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types/study.types.ts packages/shared/src/index.ts
git commit -m "feat(shared): tipos de la unidad de estudio (StudyUnit)"
```

---

## Task 2: Modelo Prisma `StudyUnit` + migración

**Files:**

- Modify: `apps/api/prisma/schema.prisma`

**Interfaces:**

- Produces: modelos Prisma `StudyUnit`, columnas `TheoryModule.studyUnitId`, `AiExamBank.studyUnitId` disponibles en `@prisma/client`.

- [ ] **Step 1: Añadir el modelo `StudyUnit`**

En `apps/api/prisma/schema.prisma`, añadir (junto a los demás modelos de teoría/examen):

```prisma
// ─────────────────────────────────────────────────────────
// UNIDAD DE ESTUDIO (alumno) — agrupa Teoría + Ejercicios + Examen
// generados por IA a partir de un tema. Personal (scoped por userId).
// ─────────────────────────────────────────────────────────
model StudyUnit {
  id        String   @id @default(cuid())
  userId    String
  courseId  String
  topic     String // input crudo del alumno
  title     String // título limpio (se toma de la teoría generada)
  summary   String   @db.Text
  /// Ejercicios generados por IA, persistidos como JSON. Estructura:
  /// [{ statement, type: 'SINGLE'|'TRUE_FALSE'|'OPEN', options: string[], solution, explanation }]
  exercises Json?
  createdAt DateTime @default(now())

  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  course Course @relation("CourseStudyUnits", fields: [courseId], references: [id], onDelete: Cascade)

  theoryModule TheoryModule?
  examBank     AiExamBank?

  @@index([userId, createdAt])
  @@index([userId, courseId])
}
```

- [ ] **Step 2: Añadir la FK en `TheoryModule`**

Dentro de `model TheoryModule`, añadir estos dos campos (después de la relación `course`):

```prisma
  studyUnitId String?    @unique
  studyUnit   StudyUnit? @relation(fields: [studyUnitId], references: [id], onDelete: Cascade)
```

- [ ] **Step 3: Añadir la FK en `AiExamBank`**

Dentro de `model AiExamBank`, añadir (después de la relación `module`):

```prisma
  studyUnitId String?    @unique
  studyUnit   StudyUnit? @relation(fields: [studyUnitId], references: [id], onDelete: Cascade)
```

- [ ] **Step 4: Añadir back-relations en `User` y `Course`**

En `model User`, junto a las demás colecciones (p.ej. donde declara `theoryModules TheoryModule[]`), añadir:

```prisma
  studyUnits StudyUnit[]
```

En `model Course`, junto a `@relation("CourseTheoryModules")` y `@relation("CourseAiExamBanks")`, añadir:

```prisma
  studyUnits StudyUnit[] @relation("CourseStudyUnits")
```

- [ ] **Step 5: Crear la migración y regenerar el cliente**

Run: `pnpm --filter @vkbacademy/api prisma migrate dev --name add_study_unit`
Expected: crea `apps/api/prisma/migrations/<timestamp>_add_study_unit/migration.sql` y regenera el cliente. La migración es aditiva (tabla nueva + columnas nullable), sin borrado de datos.

Run: `pnpm --filter @vkbacademy/api prisma generate`
Expected: cliente Prisma regenerado con el tipo `StudyUnit`.

- [ ] **Step 6: Verificar que el proyecto compila con el nuevo cliente**

Run: `pnpm --filter @vkbacademy/api exec tsc --noEmit`
Expected: sin errores (el cliente Prisma incluye `prisma.studyUnit`).

- [ ] **Step 7: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(api): modelo StudyUnit + FKs en TheoryModule/AiExamBank"
```

---

## Task 3: Exportar los servicios generadores desde sus módulos

**Files:**

- Modify: `apps/api/src/theory/theory.module.ts`
- Modify: `apps/api/src/exercises/exercises.module.ts`
- Modify: `apps/api/src/exams/exams.module.ts`

**Interfaces:**

- Produces: `TheoryService`, `ExercisesService`, `AiExamsService` inyectables desde otros módulos que importen `TheoryModule`/`ExercisesModule`/`ExamsModule`.

- [ ] **Step 1: Exportar `TheoryService`**

En `apps/api/src/theory/theory.module.ts`, añadir la propiedad `exports` al decorador `@Module` (junto a `providers`):

```ts
  exports: [TheoryService],
```

- [ ] **Step 2: Exportar `ExercisesService`**

En `apps/api/src/exercises/exercises.module.ts`:

```ts
  exports: [ExercisesService],
```

- [ ] **Step 3: Exportar los servicios de exámenes**

En `apps/api/src/exams/exams.module.ts`:

```ts
  exports: [ExamsService, AiExamsService],
```

- [ ] **Step 4: Verificar compilación**

Run: `pnpm --filter @vkbacademy/api exec tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/theory/theory.module.ts apps/api/src/exercises/exercises.module.ts apps/api/src/exams/exams.module.ts
git commit -m "feat(api): exporta TheoryService/ExercisesService/AiExamsService para reuso"
```

---

## Task 4: `StudyService` + DTOs (TDD)

**Files:**

- Create: `apps/api/src/study/dto/create-study-unit.dto.ts`
- Create: `apps/api/src/study/dto/regenerate-exercises.dto.ts`
- Create: `apps/api/src/study/dto/regenerate-exam.dto.ts`
- Create: `apps/api/src/study/study.service.ts`
- Test: `apps/api/src/study/study.service.spec.ts`

**Interfaces:**

- Consumes: `TheoryService.generate(userId, { courseId, topic })` → `{ id, title, summary, lessons }`; `TheoryService.getById(userId, id)`; `TheoryService.deleteById(userId, id)`; `ExercisesService.generate(userId, { courseId, topic, count })` → `{ exercises: GeneratedExercise[] }`; `AiExamsService.generate(userId, { courseId, topic, numQuestions, timeLimit?, onlyOnce? })` → `{ id, ... }`; `AiExamsService.getBank(userId, bankId)`; `AiExamsService.deleteBank(userId, bankId)`.
- Produces: `StudyService` con `create`, `listMine`, `getById`, `deleteById`, `regenerateTheory`, `regenerateExercises`, `regenerateExam`.

- [ ] **Step 1: Crear los DTOs**

Create `apps/api/src/study/dto/create-study-unit.dto.ts`:

```ts
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateStudyUnitDto {
  @IsString()
  courseId: string;

  @IsString()
  @MinLength(3, { message: 'El tema debe tener al menos 3 caracteres' })
  @MaxLength(500, { message: 'El tema es demasiado largo' })
  topic: string;

  @IsInt()
  @Min(1, { message: 'Mínimo 1 ejercicio' })
  @Max(20, { message: 'Máximo 20 ejercicios' })
  numExercises: number;

  @IsInt()
  @IsIn([5, 10], { message: 'numQuestions debe ser 5 o 10' })
  numQuestions: 5 | 10;

  @IsInt()
  @Min(60, { message: 'El tiempo mínimo es 60 segundos' })
  @Max(10800, { message: 'El tiempo máximo es 10800 segundos (3 h)' })
  @IsOptional()
  timeLimit?: number;

  @IsBoolean()
  @IsOptional()
  onlyOnce?: boolean;
}
```

Create `apps/api/src/study/dto/regenerate-exercises.dto.ts`:

```ts
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class RegenerateExercisesDto {
  @IsInt()
  @Min(1, { message: 'Mínimo 1 ejercicio' })
  @Max(20, { message: 'Máximo 20 ejercicios' })
  @IsOptional()
  count?: number;
}
```

Create `apps/api/src/study/dto/regenerate-exam.dto.ts`:

```ts
import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class RegenerateExamDto {
  @IsInt()
  @IsIn([5, 10], { message: 'numQuestions debe ser 5 o 10' })
  @IsOptional()
  numQuestions?: 5 | 10;

  @IsInt()
  @Min(60)
  @Max(10800)
  @IsOptional()
  timeLimit?: number;

  @IsBoolean()
  @IsOptional()
  onlyOnce?: boolean;
}
```

- [ ] **Step 2: Escribir el test que falla**

Create `apps/api/src/study/study.service.spec.ts`:

```ts
import {
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { StudyService } from './study.service';

describe('StudyService', () => {
  let prisma: {
    course: { findUnique: jest.Mock };
    enrollment: { findFirst: jest.Mock };
    studyUnit: {
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
    };
    theoryModule: { update: jest.Mock };
    aiExamBank: { update: jest.Mock };
  };
  let theory: { generate: jest.Mock; getById: jest.Mock; deleteById: jest.Mock };
  let exercises: { generate: jest.Mock };
  let aiExams: { generate: jest.Mock; getBank: jest.Mock; deleteBank: jest.Mock };
  let service: StudyService;

  const theoryResult = { id: 'tm-1', title: 'Logaritmos', summary: 'resumen', lessons: [] };
  const examResult = {
    id: 'bank-1',
    title: 'Examen',
    topic: 't',
    numQuestions: 5,
    timeLimit: null,
    onlyOnce: false,
    attemptCount: 0,
    questions: [],
  };
  const exercisesResult = {
    exercises: [{ statement: 'x', type: 'OPEN', options: [], solution: 'y', explanation: 'z' }],
  };

  function stubUnitForGetById(over: Record<string, unknown> = {}) {
    prisma.studyUnit.findUnique.mockResolvedValue({
      id: 'unit-1',
      userId: 'user-1',
      courseId: 'course-1',
      topic: 't',
      title: 'Logaritmos',
      summary: 'resumen',
      createdAt: new Date(),
      exercises: exercisesResult.exercises,
      course: { id: 'course-1', title: 'Mates' },
      theoryModule: { id: 'tm-1' },
      examBank: { id: 'bank-1' },
      ...over,
    });
  }

  beforeEach(() => {
    prisma = {
      course: { findUnique: jest.fn().mockResolvedValue({ id: 'course-1', title: 'Mates' }) },
      enrollment: { findFirst: jest.fn().mockResolvedValue({ id: 'enr-1' }) },
      studyUnit: {
        create: jest.fn().mockResolvedValue({ id: 'unit-1' }),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      theoryModule: { update: jest.fn().mockResolvedValue({}) },
      aiExamBank: { update: jest.fn().mockResolvedValue({}) },
    };
    theory = {
      generate: jest.fn().mockResolvedValue(theoryResult),
      getById: jest.fn().mockResolvedValue(theoryResult),
      deleteById: jest.fn().mockResolvedValue(undefined),
    };
    exercises = { generate: jest.fn().mockResolvedValue(exercisesResult) };
    aiExams = {
      generate: jest.fn().mockResolvedValue(examResult),
      getBank: jest.fn().mockResolvedValue(examResult),
      deleteBank: jest.fn().mockResolvedValue({ ok: true }),
    };
    service = new StudyService(
      prisma as never,
      theory as never,
      exercises as never,
      aiExams as never,
    );
  });

  describe('create', () => {
    it('crea la unidad y enlaza las 3 secciones cuando todas se generan', async () => {
      stubUnitForGetById();
      const result = await service.create('user-1', {
        courseId: 'course-1',
        topic: 't',
        numExercises: 1,
        numQuestions: 5,
      });
      expect(prisma.studyUnit.create).toHaveBeenCalled();
      expect(prisma.theoryModule.update).toHaveBeenCalledWith({
        where: { id: 'tm-1' },
        data: { studyUnitId: 'unit-1' },
      });
      expect(prisma.aiExamBank.update).toHaveBeenCalledWith({
        where: { id: 'bank-1' },
        data: { studyUnitId: 'unit-1' },
      });
      expect(result.sections).toEqual({ theory: true, exercises: true, exam: true });
    });

    it('crea la unidad aunque falle una sección (examen) y la marca ausente', async () => {
      aiExams.generate.mockRejectedValue(new Error('IA caída'));
      stubUnitForGetById({ examBank: null });
      const result = await service.create('user-1', {
        courseId: 'course-1',
        topic: 't',
        numExercises: 1,
        numQuestions: 5,
      });
      expect(prisma.aiExamBank.update).not.toHaveBeenCalled();
      expect(result.sections.exam).toBe(false);
      expect(result.sections.theory).toBe(true);
    });

    it('borra la unidad y lanza error si fallan las 3 secciones', async () => {
      theory.generate.mockRejectedValue(new Error('x'));
      exercises.generate.mockRejectedValue(new Error('y'));
      aiExams.generate.mockRejectedValue(new Error('z'));
      await expect(
        service.create('user-1', {
          courseId: 'course-1',
          topic: 't',
          numExercises: 1,
          numQuestions: 5,
        }),
      ).rejects.toThrow(InternalServerErrorException);
      expect(prisma.studyUnit.delete).toHaveBeenCalledWith({ where: { id: 'unit-1' } });
    });

    it('lanza ForbiddenException si el alumno no está matriculado', async () => {
      prisma.enrollment.findFirst.mockResolvedValue(null);
      await expect(
        service.create('user-1', {
          courseId: 'course-1',
          topic: 't',
          numExercises: 1,
          numQuestions: 5,
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.studyUnit.create).not.toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('lanza ForbiddenException si la unidad es de otro alumno', async () => {
      stubUnitForGetById({ userId: 'someone-else' });
      await expect(service.getById('user-1', 'unit-1')).rejects.toThrow(ForbiddenException);
    });

    it('lanza NotFoundException si no existe', async () => {
      prisma.studyUnit.findUnique.mockResolvedValue(null);
      await expect(service.getById('user-1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });
});
```

- [ ] **Step 3: Ejecutar el test y verificar que falla**

Run: `pnpm --filter @vkbacademy/api test -- study.service`
Expected: FALLA con "Cannot find module './study.service'" (aún no existe).

- [ ] **Step 4: Implementar `StudyService`**

Create `apps/api/src/study/study.service.ts`:

```ts
import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TheoryService } from '../theory/theory.service';
import { ExercisesService, GeneratedExercise } from '../exercises/exercises.service';
import { AiExamsService } from '../exams/ai-exams.service';
import { CreateStudyUnitDto } from './dto/create-study-unit.dto';
import { RegenerateExercisesDto } from './dto/regenerate-exercises.dto';
import { RegenerateExamDto } from './dto/regenerate-exam.dto';

/**
 * Orquesta la creación de unidades de estudio: a partir de una asignatura y un
 * tema genera Teoría + Ejercicios + Examen (reutilizando los servicios IA
 * existentes) y los agrupa en una StudyUnit personal (scoped por userId).
 */
@Injectable()
export class StudyService {
  private readonly logger = new Logger(StudyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly theory: TheoryService,
    private readonly exercises: ExercisesService,
    private readonly aiExams: AiExamsService,
  ) {}

  private async assertEnrolled(userId: string, courseId: string): Promise<void> {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException(`Curso "${courseId}" no encontrado`);
    const enrollment = await this.prisma.enrollment.findFirst({ where: { userId, courseId } });
    if (!enrollment) throw new ForbiddenException('No estás matriculado en este curso');
  }

  async create(userId: string, dto: CreateStudyUnitDto) {
    await this.assertEnrolled(userId, dto.courseId);

    // Unidad "cáscara": título/summary provisionales, se completan desde la teoría.
    const unit = await this.prisma.studyUnit.create({
      data: { userId, courseId: dto.courseId, topic: dto.topic, title: dto.topic, summary: '' },
    });

    // Las 3 secciones a la vez. allSettled: una que falle no tumba las demás.
    const [theoryRes, exercisesRes, examRes] = await Promise.allSettled([
      this.theory.generate(userId, { courseId: dto.courseId, topic: dto.topic }),
      this.exercises.generate(userId, {
        courseId: dto.courseId,
        topic: dto.topic,
        count: dto.numExercises,
      }),
      this.aiExams.generate(userId, {
        courseId: dto.courseId,
        topic: dto.topic,
        numQuestions: dto.numQuestions,
        timeLimit: dto.timeLimit,
        onlyOnce: dto.onlyOnce,
      }),
    ]);

    if (
      theoryRes.status === 'rejected' &&
      exercisesRes.status === 'rejected' &&
      examRes.status === 'rejected'
    ) {
      this.logger.error('Las 3 secciones fallaron al generar la unidad de estudio');
      await this.prisma.studyUnit.delete({ where: { id: unit.id } });
      throw new InternalServerErrorException(
        'No se pudo generar ninguna sección. Inténtalo de nuevo en unos segundos.',
      );
    }

    const data: Prisma.StudyUnitUpdateInput = {};
    if (theoryRes.status === 'fulfilled') {
      await this.prisma.theoryModule.update({
        where: { id: theoryRes.value.id },
        data: { studyUnitId: unit.id },
      });
      data.title = theoryRes.value.title;
      data.summary = theoryRes.value.summary;
    }
    if (exercisesRes.status === 'fulfilled') {
      data.exercises = exercisesRes.value.exercises as unknown as Prisma.InputJsonValue;
    }
    if (examRes.status === 'fulfilled') {
      await this.prisma.aiExamBank.update({
        where: { id: examRes.value.id },
        data: { studyUnitId: unit.id },
      });
    }
    await this.prisma.studyUnit.update({ where: { id: unit.id }, data });

    return this.getById(userId, unit.id);
  }

  async listMine(userId: string) {
    const units = await this.prisma.studyUnit.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        course: { select: { id: true, title: true } },
        theoryModule: { select: { id: true } },
        examBank: { select: { id: true } },
      },
    });
    return units.map((u) => ({
      id: u.id,
      topic: u.topic,
      title: u.title,
      summary: u.summary,
      createdAt: u.createdAt.toISOString(),
      course: u.course,
      sections: {
        theory: !!u.theoryModule,
        exercises: Array.isArray(u.exercises) && (u.exercises as unknown[]).length > 0,
        exam: !!u.examBank,
      },
    }));
  }

  async getById(userId: string, id: string) {
    const unit = await this.prisma.studyUnit.findUnique({
      where: { id },
      include: {
        course: { select: { id: true, title: true } },
        theoryModule: { select: { id: true } },
        examBank: { select: { id: true } },
      },
    });
    if (!unit) throw new NotFoundException('Unidad de estudio no encontrada');
    if (unit.userId !== userId) throw new ForbiddenException('No tienes acceso a esta unidad');

    const theory = unit.theoryModule
      ? await this.theory.getById(userId, unit.theoryModule.id)
      : null;
    const exam = unit.examBank ? await this.aiExams.getBank(userId, unit.examBank.id) : null;
    const exercises = Array.isArray(unit.exercises)
      ? (unit.exercises as unknown as GeneratedExercise[])
      : null;

    return {
      id: unit.id,
      topic: unit.topic,
      title: unit.title,
      summary: unit.summary,
      createdAt: unit.createdAt.toISOString(),
      course: unit.course,
      sections: {
        theory: !!theory,
        exercises: !!exercises && exercises.length > 0,
        exam: !!exam,
      },
      theory,
      exercises,
      exam,
    };
  }

  async deleteById(userId: string, id: string): Promise<void> {
    const unit = await this.prisma.studyUnit.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });
    if (!unit) throw new NotFoundException('Unidad de estudio no encontrada');
    if (unit.userId !== userId) throw new ForbiddenException('No tienes acceso a esta unidad');
    await this.prisma.studyUnit.delete({ where: { id } });
  }

  // ── Regeneración por sección (para reintentar tras un fallo de IA) ──

  async regenerateTheory(userId: string, id: string) {
    const unit = await this.requireOwnedUnit(userId, id);
    if (unit.theoryModule) await this.theory.deleteById(userId, unit.theoryModule.id);
    const theory = await this.theory.generate(userId, {
      courseId: unit.courseId,
      topic: unit.topic,
    });
    await this.prisma.theoryModule.update({
      where: { id: theory.id },
      data: { studyUnitId: unit.id },
    });
    await this.prisma.studyUnit.update({
      where: { id: unit.id },
      data: { title: theory.title, summary: theory.summary },
    });
    return this.getById(userId, id);
  }

  async regenerateExercises(userId: string, id: string, dto: RegenerateExercisesDto) {
    const unit = await this.requireOwnedUnit(userId, id);
    const prevCount = Array.isArray(unit.exercises) ? (unit.exercises as unknown[]).length : 0;
    const count = dto.count ?? (prevCount > 0 ? prevCount : 5);
    const res = await this.exercises.generate(userId, {
      courseId: unit.courseId,
      topic: unit.topic,
      count,
    });
    await this.prisma.studyUnit.update({
      where: { id: unit.id },
      data: { exercises: res.exercises as unknown as Prisma.InputJsonValue },
    });
    return this.getById(userId, id);
  }

  async regenerateExam(userId: string, id: string, dto: RegenerateExamDto) {
    const unit = await this.requireOwnedUnit(userId, id);
    if (unit.examBank) await this.aiExams.deleteBank(userId, unit.examBank.id);
    const bank = await this.aiExams.generate(userId, {
      courseId: unit.courseId,
      topic: unit.topic,
      numQuestions: dto.numQuestions ?? 5,
      timeLimit: dto.timeLimit,
      onlyOnce: dto.onlyOnce,
    });
    await this.prisma.aiExamBank.update({
      where: { id: bank.id },
      data: { studyUnitId: unit.id },
    });
    return this.getById(userId, id);
  }

  private async requireOwnedUnit(userId: string, id: string) {
    const unit = await this.prisma.studyUnit.findUnique({
      where: { id },
      include: {
        theoryModule: { select: { id: true } },
        examBank: { select: { id: true } },
      },
    });
    if (!unit) throw new NotFoundException('Unidad de estudio no encontrada');
    if (unit.userId !== userId) throw new ForbiddenException('No tienes acceso a esta unidad');
    return unit;
  }
}
```

- [ ] **Step 5: Ejecutar los tests y verificar que pasan**

Run: `pnpm --filter @vkbacademy/api test -- study.service`
Expected: PASS (6 tests verdes).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/study/dto apps/api/src/study/study.service.ts apps/api/src/study/study.service.spec.ts
git commit -m "feat(api): StudyService orquesta teoría+ejercicios+examen (allSettled)"
```

---

## Task 5: `StudyController` + `StudyModule` + registro en la app

**Files:**

- Create: `apps/api/src/study/study.controller.ts`
- Create: `apps/api/src/study/study.module.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**

- Consumes: `StudyService` (Task 4); `JwtAuthGuard`, `CurrentUser` (existentes).
- Produces: endpoints HTTP `POST /study`, `GET /study/mine`, `GET /study/:id`, `DELETE /study/:id`, `POST /study/:id/theory`, `POST /study/:id/exercises`, `POST /study/:id/exam`.

- [ ] **Step 1: Crear el controlador**

Create `apps/api/src/study/study.controller.ts`:

```ts
import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StudyService } from './study.service';
import { CreateStudyUnitDto } from './dto/create-study-unit.dto';
import { RegenerateExercisesDto } from './dto/regenerate-exercises.dto';
import { RegenerateExamDto } from './dto/regenerate-exam.dto';

@Controller('study')
@UseGuards(JwtAuthGuard)
export class StudyController {
  constructor(private readonly study: StudyService) {}

  /** Crea una unidad de estudio generando las 3 secciones a partir de un tema. */
  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateStudyUnitDto) {
    return this.study.create(user.id, dto);
  }

  /** Lista las unidades de estudio del alumno. */
  @Get('mine')
  listMine(@CurrentUser() user: User) {
    return this.study.listMine(user.id);
  }

  /** Detalle completo de una unidad (solo el dueño). */
  @Get(':id')
  getById(@CurrentUser() user: User, @Param('id') id: string) {
    return this.study.getById(user.id, id);
  }

  /** Borra una unidad (cascade a teoría/examen). */
  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: User, @Param('id') id: string) {
    await this.study.deleteById(user.id, id);
  }

  /** Regenera la sección de teoría. */
  @Post(':id/theory')
  regenTheory(@CurrentUser() user: User, @Param('id') id: string) {
    return this.study.regenerateTheory(user.id, id);
  }

  /** Regenera los ejercicios (acepta count opcional). */
  @Post(':id/exercises')
  regenExercises(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: RegenerateExercisesDto,
  ) {
    return this.study.regenerateExercises(user.id, id, dto);
  }

  /** Regenera el examen (acepta numQuestions/timeLimit/onlyOnce opcionales). */
  @Post(':id/exam')
  regenExam(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: RegenerateExamDto) {
    return this.study.regenerateExam(user.id, id, dto);
  }
}
```

- [ ] **Step 2: Crear el módulo**

Create `apps/api/src/study/study.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TheoryModule } from '../theory/theory.module';
import { ExercisesModule } from '../exercises/exercises.module';
import { ExamsModule } from '../exams/exams.module';
import { StudyController } from './study.controller';
import { StudyService } from './study.service';

@Module({
  imports: [PrismaModule, TheoryModule, ExercisesModule, ExamsModule],
  controllers: [StudyController],
  providers: [StudyService],
})
export class StudyModule {}
```

- [ ] **Step 3: Registrar `StudyModule` en `app.module.ts`**

En `apps/api/src/app.module.ts`, añadir el import al principio (junto a los demás módulos de feature):

```ts
import { StudyModule } from './study/study.module';
```

Y añadir `StudyModule` al array `imports` del `@Module` (p.ej. justo después de `TheoryModule`):

```ts
    TheoryModule,
    StudyModule,
```

- [ ] **Step 4: Verificar compilación y arranque de tests**

Run: `pnpm --filter @vkbacademy/api exec tsc --noEmit`
Expected: sin errores.

Run: `pnpm --filter @vkbacademy/api test`
Expected: toda la suite en verde (incluido `study.service`).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/study/study.controller.ts apps/api/src/study/study.module.ts apps/api/src/app.module.ts
git commit -m "feat(api): endpoints /study (crear, listar, detalle, borrar, regenerar)"
```

---

## Task 6: Cliente API web + hooks (`study.api.ts`, `useStudy.ts`)

**Files:**

- Create: `apps/web/src/api/study.api.ts`
- Create: `apps/web/src/hooks/useStudy.ts`

**Interfaces:**

- Consumes: tipos de `@vkbacademy/shared` (Task 1); `api` de `../lib/axios`.
- Produces: `studyApi`; hooks `useMyStudyUnits`, `useStudyUnit`, `useCreateStudyUnit`, `useDeleteStudyUnit`, `useRegenerateTheory`, `useRegenerateExercises`, `useRegenerateExam`.

- [ ] **Step 1: Crear el cliente API**

Create `apps/web/src/api/study.api.ts`:

```ts
import api from '../lib/axios';
import type {
  StudyUnitSummary,
  StudyUnitDetail,
  CreateStudyUnitRequest,
  RegenerateExercisesRequest,
  RegenerateExamRequest,
} from '@vkbacademy/shared';

export const studyApi = {
  create: (payload: CreateStudyUnitRequest) =>
    api.post<StudyUnitDetail>('/study', payload).then((r) => r.data),

  listMine: () => api.get<StudyUnitSummary[]>('/study/mine').then((r) => r.data),

  getById: (id: string) => api.get<StudyUnitDetail>(`/study/${id}`).then((r) => r.data),

  delete: (id: string) => api.delete<void>(`/study/${id}`).then((r) => r.data),

  regenerateTheory: (id: string) =>
    api.post<StudyUnitDetail>(`/study/${id}/theory`).then((r) => r.data),

  regenerateExercises: (id: string, payload: RegenerateExercisesRequest) =>
    api.post<StudyUnitDetail>(`/study/${id}/exercises`, payload).then((r) => r.data),

  regenerateExam: (id: string, payload: RegenerateExamRequest) =>
    api.post<StudyUnitDetail>(`/study/${id}/exam`, payload).then((r) => r.data),
};
```

- [ ] **Step 2: Crear los hooks**

Create `apps/web/src/hooks/useStudy.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { studyApi } from '../api/study.api';
import type { CreateStudyUnitRequest } from '@vkbacademy/shared';

export function useMyStudyUnits() {
  return useQuery({ queryKey: ['study', 'mine'], queryFn: () => studyApi.listMine() });
}

export function useStudyUnit(id: string) {
  return useQuery({
    queryKey: ['study', id],
    queryFn: () => studyApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateStudyUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateStudyUnitRequest) => studyApi.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['study', 'mine'] }),
  });
}

export function useDeleteStudyUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => studyApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['study', 'mine'] }),
  });
}

export function useRegenerateTheory(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => studyApi.regenerateTheory(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['study', id] }),
  });
}

export function useRegenerateExercises(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (count?: number) => studyApi.regenerateExercises(id, { count }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['study', id] }),
  });
}

export function useRegenerateExam(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => studyApi.regenerateExam(id, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['study', id] }),
  });
}
```

- [ ] **Step 3: Verificar tipos**

Run: `pnpm --filter @vkbacademy/web exec tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/api/study.api.ts apps/web/src/hooks/useStudy.ts
git commit -m "feat(web): cliente API y hooks de unidades de estudio"
```

---

## Task 7: Extraer `TheoryView` (presentacional)

**Files:**

- Create: `apps/web/src/components/theory/TheoryView.tsx`

**Interfaces:**

- Consumes: `TheoryModuleWithLessons` de `@vkbacademy/shared`; `TheoryMarkdown`, `THEORY_CALLOUT_CSS` de `./theoryMarkdown`; `TheorySlides` de `./TheorySlides`; `downloadTheoryPdf`, `shareTheoryPdf` de `../../utils/theoryPdf`.
- Produces: componente por defecto `TheoryView` con prop `{ module: TheoryModuleWithLessons }` que renderiza cabecera de acciones (Presentación, PDF, WhatsApp), el deck de slides bajo demanda y el artículo de lecciones. Sin fetch, sin borrado, sin back-link (eso vive en la página contenedora).

- [ ] **Step 1: Crear el componente extraído**

Create `apps/web/src/components/theory/TheoryView.tsx`. Es el cuerpo presentacional de la antigua `TheoryModulePage` (sin `useQuery`/`useMutation`/back-link/footer de borrado):

```tsx
import { useState } from 'react';
import type {
  TheoryLesson,
  TheoryLessonKind,
  TheoryModuleWithLessons,
  TheoryVideoCandidate,
} from '@vkbacademy/shared';
import { TheoryMarkdown, THEORY_CALLOUT_CSS } from './theoryMarkdown';
import TheorySlides from './TheorySlides';
import { downloadTheoryPdf, shareTheoryPdf } from '../../utils/theoryPdf';

const KIND_ICON: Record<TheoryLessonKind, string> = {
  INTRO: '🧭',
  CONTENT: '📚',
  EXAMPLE: '💡',
  VIDEO: '▶️',
};

export default function TheoryView({ module }: { module: TheoryModuleWithLessons }) {
  const [showSlides, setShowSlides] = useState(false);
  const [pdfBusy, setPdfBusy] = useState<'download' | 'share' | null>(null);

  async function handleDownload() {
    if (pdfBusy) return;
    setPdfBusy('download');
    try {
      await downloadTheoryPdf(module);
    } catch {
      window.alert('No se pudo generar el PDF. Inténtalo de nuevo.');
    } finally {
      setPdfBusy(null);
    }
  }

  async function handleShare() {
    if (pdfBusy) return;
    setPdfBusy('share');
    try {
      await shareTheoryPdf(module);
    } catch {
      window.alert('No se pudo compartir el PDF. Inténtalo de nuevo.');
    } finally {
      setPdfBusy(null);
    }
  }

  return (
    <div style={s.wrap}>
      <style>
        {ANIMATIONS}
        {THEORY_CALLOUT_CSS}
      </style>

      <div style={s.actions}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setShowSlides(true)}
          style={s.presentBtn}
        >
          ▶ Presentación
        </button>
        <button
          type="button"
          onClick={handleDownload}
          disabled={pdfBusy !== null}
          style={s.secondaryBtn}
        >
          {pdfBusy === 'download' ? '⏳ Generando…' : '⬇️ Descargar PDF'}
        </button>
        <button
          type="button"
          onClick={handleShare}
          disabled={pdfBusy !== null}
          style={s.secondaryBtn}
        >
          {pdfBusy === 'share' ? '⏳ Generando…' : '📲 Enviar por WhatsApp'}
        </button>
      </div>

      {showSlides && <TheorySlides module={module} onClose={() => setShowSlides(false)} />}

      <article style={s.article}>
        {module.lessons.map((lesson, idx) => (
          <LessonSection key={lesson.id} lesson={lesson} index={idx} />
        ))}
      </article>
    </div>
  );
}

function LessonSection({ lesson, index }: { lesson: TheoryLesson; index: number }) {
  return (
    <section className="theory-section" style={{ ...s.section, animationDelay: `${index * 90}ms` }}>
      <h2 style={s.sectionTitle}>
        <span aria-hidden>{KIND_ICON[lesson.kind]}</span> {lesson.heading}
      </h2>
      {lesson.kind === 'VIDEO' ? (
        <VideoLesson lesson={lesson} />
      ) : (
        <div style={s.markdown}>
          <TheoryMarkdown>{lesson.body ?? ''}</TheoryMarkdown>
        </div>
      )}
    </section>
  );
}

const ANIMATIONS = `
  @keyframes theory-fade-in-up {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .theory-section {
    animation: theory-fade-in-up 0.55s cubic-bezier(0.2, 0.8, 0.25, 1) backwards;
  }
  @media (prefers-reduced-motion: reduce) {
    .theory-section { animation: none; }
  }
`;

function VideoLesson({ lesson }: { lesson: TheoryLesson }) {
  const candidates: TheoryVideoCandidate[] =
    lesson.videoCandidates && lesson.videoCandidates.length > 0
      ? lesson.videoCandidates
      : lesson.youtubeId
        ? [
            {
              youtubeId: lesson.youtubeId,
              title: lesson.heading,
              channelTitle: '',
              durationSeconds: 0,
              thumbnailUrl: `https://img.youtube.com/vi/${lesson.youtubeId}/mqdefault.jpg`,
            },
          ]
        : [];

  const [selected, setSelected] = useState(0);

  if (candidates.length === 0) {
    return <p style={s.muted}>No se encontró un vídeo adecuado para este tema.</p>;
  }

  const current = candidates[Math.min(selected, candidates.length - 1)];

  return (
    <div style={s.videoBlock}>
      <div style={s.videoWrapper}>
        <iframe
          key={current.youtubeId}
          style={s.videoIframe}
          src={`https://www.youtube.com/embed/${current.youtubeId}`}
          title={current.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      {candidates.length > 1 && (
        <>
          <p style={s.candidatesLabel}>{candidates.length} vídeos sugeridos — pulsa para cambiar</p>
          <ul style={s.candidatesList}>
            {candidates.map((c, idx) => {
              const isActive = idx === selected;
              return (
                <li key={c.youtubeId}>
                  <button
                    type="button"
                    onClick={() => setSelected(idx)}
                    style={{ ...s.candidate, ...(isActive ? s.candidateActive : {}) }}
                    aria-pressed={isActive}
                  >
                    <img src={c.thumbnailUrl} alt="" style={s.candidateThumb} loading="lazy" />
                    <span style={s.candidateMeta}>
                      <span style={s.candidateTitle}>{c.title}</span>
                      <span style={s.candidateChannel}>
                        {c.channelTitle}
                        {c.durationSeconds > 0 && ` · ${formatDuration(c.durationSeconds)}`}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

const s: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 24 },
  actions: { display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  presentBtn: { padding: '10px 18px', fontSize: '0.9rem', fontWeight: 700 },
  secondaryBtn: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text)',
    padding: '10px 16px',
    borderRadius: 8,
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  article: { display: 'flex', flexDirection: 'column', gap: 32 },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 14,
    padding: 24,
  },
  sectionTitle: { fontSize: '1.25rem', fontWeight: 700, margin: 0 },
  markdown: { fontSize: '1rem', lineHeight: 1.7, color: 'var(--color-text)' },
  muted: { color: 'var(--color-text-muted)', fontSize: '0.95rem', margin: 0 },
  videoBlock: { display: 'flex', flexDirection: 'column', gap: 12 },
  videoWrapper: {
    position: 'relative',
    paddingTop: '56.25%',
    borderRadius: 10,
    overflow: 'hidden',
    background: '#000',
  },
  videoIframe: { position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 },
  candidatesLabel: { fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: '4px 0 0' },
  candidatesList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 10,
  },
  candidate: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: 8,
    background: 'var(--color-bg)',
    border: '1.5px solid var(--color-border)',
    borderRadius: 10,
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
    color: 'var(--color-text)',
    transition: 'border-color 0.15s, transform 0.15s',
  },
  candidateActive: { borderColor: '#f97316', background: 'rgba(234,88,12,0.08)' },
  candidateThumb: {
    width: '100%',
    aspectRatio: '16 / 9',
    objectFit: 'cover',
    borderRadius: 6,
    background: '#000',
  },
  candidateMeta: { display: 'flex', flexDirection: 'column', gap: 2 },
  candidateTitle: {
    fontSize: '0.85rem',
    fontWeight: 600,
    lineHeight: 1.3,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  candidateChannel: { fontSize: '0.7rem', color: 'var(--color-text-muted)' },
};
```

- [ ] **Step 2: Verificar tipos**

Run: `pnpm --filter @vkbacademy/web exec tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/theory/TheoryView.tsx
git commit -m "feat(web): componente TheoryView reutilizable (extraído de TheoryModulePage)"
```

---

## Task 8: Extraer `ExercisePractice` (práctica de ejercicios)

**Files:**

- Create: `apps/web/src/components/exercises/ExercisePractice.tsx`

**Interfaces:**

- Consumes: `StudyExercise` de `@vkbacademy/shared`; `api` de `../../lib/axios`.
- Produces: componente por defecto `ExercisePractice` con prop `{ exercises: StudyExercise[] }` que renderiza las tarjetas de ejercicio con estado local (seleccionado/revelado/respuesta) y evalúa las respuestas abiertas contra `POST /exercises/evaluate`.

- [ ] **Step 1: Crear el componente**

Create `apps/web/src/components/exercises/ExercisePractice.tsx`. Reutiliza la lógica de tarjetas y evaluación de la antigua `ExercisesPage` (sin el formulario de generación ni el selector de curso):

```tsx
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { StudyExercise } from '@vkbacademy/shared';
import api from '../../lib/axios';

type Verdict = 'correct' | 'partial' | 'incorrect';

interface EvaluationResult {
  verdict: Verdict;
  feedback: string;
}

interface EvaluatePayload {
  statement: string;
  studentAnswer: string;
  solution: string;
}

export default function ExercisePractice({ exercises }: { exercises: StudyExercise[] }) {
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [selected, setSelected] = useState<Record<number, number | null>>({});
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [evaluations, setEvaluations] = useState<Record<number, EvaluationResult>>({});
  const [evalErrors, setEvalErrors] = useState<Record<number, string>>({});

  const evalMutation = useMutation({
    mutationFn: ({ index, ...payload }: EvaluatePayload & { index: number }) =>
      api
        .post<EvaluationResult>('/exercises/evaluate', payload)
        .then((r) => ({ index, data: r.data })),
    onSuccess: ({ index, data }) => {
      setEvaluations((prev) => ({ ...prev, [index]: data }));
      setRevealed((prev) => ({ ...prev, [index]: true }));
      setEvalErrors((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    },
    onError: (err, variables) => {
      const msg = (err as { response?: { data?: { message?: string | string[] } } } | null)
        ?.response?.data?.message;
      const text = Array.isArray(msg) ? msg.join(' · ') : msg;
      setEvalErrors((prev) => ({
        ...prev,
        [variables.index]:
          text ?? 'No se pudo evaluar la respuesta. Inténtalo de nuevo en unos segundos.',
      }));
    },
  });

  const evaluatingIdx =
    evalMutation.isPending && evalMutation.variables ? evalMutation.variables.index : null;

  function toggleSolution(index: number) {
    setRevealed((prev) => ({ ...prev, [index]: !prev[index] }));
  }
  function chooseOption(exerciseIndex: number, optionIndex: number) {
    setSelected((prev) => ({ ...prev, [exerciseIndex]: optionIndex }));
  }
  function updateAnswer(index: number, value: string) {
    setAnswers((prev) => ({ ...prev, [index]: value }));
  }
  function evaluateOpen(index: number, ex: StudyExercise) {
    const answer = (answers[index] ?? '').trim();
    if (!answer) return;
    evalMutation.mutate({
      index,
      statement: ex.statement,
      studentAnswer: answer,
      solution: ex.solution,
    });
  }

  if (exercises.length === 0) {
    return <p style={s.muted}>No hay ejercicios en esta unidad.</p>;
  }

  return (
    <div style={s.exerciseList}>
      {exercises.map((ex, i) => (
        <ExerciseCard
          key={i}
          exercise={ex}
          index={i}
          revealed={!!revealed[i]}
          selected={selected[i] ?? null}
          answer={answers[i] ?? ''}
          evaluation={evaluations[i] ?? null}
          evaluationError={evalErrors[i] ?? null}
          evaluating={evaluatingIdx === i}
          onChoose={(optIdx) => chooseOption(i, optIdx)}
          onAnswerChange={(value) => updateAnswer(i, value)}
          onEvaluate={() => evaluateOpen(i, ex)}
          onToggle={() => toggleSolution(i)}
        />
      ))}
    </div>
  );
}

function ExerciseCard({
  exercise,
  index,
  revealed,
  selected,
  answer,
  evaluation,
  evaluationError,
  evaluating,
  onChoose,
  onAnswerChange,
  onEvaluate,
  onToggle,
}: {
  exercise: StudyExercise;
  index: number;
  revealed: boolean;
  selected: number | null;
  answer: string;
  evaluation: EvaluationResult | null;
  evaluationError: string | null;
  evaluating: boolean;
  onChoose: (optionIndex: number) => void;
  onAnswerChange: (value: string) => void;
  onEvaluate: () => void;
  onToggle: () => void;
}) {
  const hasOptions = exercise.options.length > 0;
  const correctIndex = hasOptions
    ? exercise.options.findIndex((o) => o.trim() === exercise.solution.trim())
    : -1;
  const canCheck = hasOptions ? selected !== null : answer.trim().length > 0;

  function optionStyle(j: number): React.CSSProperties {
    if (revealed) {
      if (j === correctIndex) return { ...s.option, ...s.optionCorrect };
      if (j === selected) return { ...s.option, ...s.optionWrong };
      return s.option;
    }
    if (j === selected) return { ...s.option, ...s.optionSelected };
    return s.option;
  }

  function handleCheckClick() {
    if (revealed) {
      onToggle();
      return;
    }
    if (hasOptions) onToggle();
    else onEvaluate();
  }

  const buttonLabel = evaluating
    ? '⏳ Evaluando...'
    : revealed
      ? '🙈 Ocultar solución'
      : '✓ Comprobar';

  return (
    <article style={s.card}>
      <header style={s.cardHeader}>
        <span style={s.cardNumber}>#{index + 1}</span>
        <span style={s.cardType}>{labelForType(exercise.type)}</span>
      </header>

      <p style={s.statement}>{exercise.statement}</p>

      {hasOptions && (
        <ul style={s.options}>
          {exercise.options.map((opt, j) => (
            <li
              key={j}
              style={{ ...optionStyle(j), cursor: revealed ? 'default' : 'pointer' }}
              onClick={revealed ? undefined : () => onChoose(j)}
            >
              <span style={s.optionLetter}>{String.fromCharCode(65 + j)}.</span>
              {opt}
            </li>
          ))}
        </ul>
      )}

      {!hasOptions && (
        <textarea
          value={answer}
          onChange={(e) => onAnswerChange(e.target.value)}
          disabled={revealed || evaluating}
          placeholder="Escribe aquí tu respuesta..."
          rows={3}
          style={s.openAnswer}
        />
      )}

      <button
        onClick={handleCheckClick}
        style={{ ...s.revealBtn, opacity: (!revealed && !canCheck) || evaluating ? 0.5 : 1 }}
        disabled={(!revealed && !canCheck) || evaluating}
      >
        {buttonLabel}
      </button>

      {evaluationError && !evaluating && (
        <div style={s.errorBox}>
          <strong>!</strong> {evaluationError}
        </div>
      )}

      {revealed && evaluation && (
        <div style={{ ...s.verdictBox, ...VERDICT_STYLES[evaluation.verdict] }}>
          <div style={s.verdictHeader}>{verdictLabel(evaluation.verdict)}</div>
          <div style={s.verdictFeedback}>{evaluation.feedback}</div>
        </div>
      )}

      {revealed && (
        <div style={s.solution}>
          <div style={s.solutionLine}>
            <strong style={s.solutionLabel}>Solución:</strong> {exercise.solution}
          </div>
          {exercise.explanation && (
            <div style={s.solutionLine}>
              <strong style={s.solutionLabel}>Explicación:</strong> {exercise.explanation}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function verdictLabel(verdict: Verdict): string {
  switch (verdict) {
    case 'correct':
      return '✅ Correcto';
    case 'partial':
      return '⚠️ Parcialmente correcto';
    case 'incorrect':
      return '❌ Incorrecto';
  }
}

function labelForType(type: StudyExercise['type']): string {
  switch (type) {
    case 'SINGLE':
      return 'Opción múltiple';
    case 'TRUE_FALSE':
      return 'Verdadero/Falso';
    case 'OPEN':
      return 'Respuesta abierta';
  }
}

const GREEN = '#16a34a';
const RED = '#dc2626';
const YELLOW = '#eab308';

const VERDICT_STYLES: Record<Verdict, React.CSSProperties> = {
  correct: { background: '#dcfce7', border: `1px solid ${GREEN}`, color: '#166534' },
  partial: { background: '#fef9c3', border: `1px solid ${YELLOW}`, color: '#854d0e' },
  incorrect: { background: '#fee2e2', border: `1px solid ${RED}`, color: '#991b1b' },
};

const s: Record<string, React.CSSProperties> = {
  muted: { color: 'var(--color-text-muted)', fontSize: '0.95rem', margin: 0 },
  exerciseList: { display: 'flex', flexDirection: 'column', gap: 16 },
  card: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 12,
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  cardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  cardNumber: { fontSize: '0.9rem', fontWeight: 700, color: '#f97316' },
  cardType: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    background: 'rgba(0,0,0,0.05)',
    padding: '2px 8px',
    borderRadius: 6,
  },
  statement: { margin: 0, fontSize: '1rem', lineHeight: 1.5, color: 'var(--color-text)' },
  options: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  option: {
    background: 'var(--color-bg)',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: '0.95rem',
    color: 'var(--color-text)',
    display: 'flex',
    gap: 10,
    transition: 'background 0.15s, border-color 0.15s',
  },
  optionSelected: { background: '#fef9c3', border: `1px solid ${YELLOW}` },
  optionCorrect: { background: '#dcfce7', border: `1px solid ${GREEN}` },
  optionWrong: { background: '#fee2e2', border: `1px solid ${RED}` },
  optionLetter: { color: '#f97316', fontWeight: 700, minWidth: 20 },
  revealBtn: {
    alignSelf: 'flex-start',
    background: 'transparent',
    border: '1px solid rgba(234,88,12,0.4)',
    color: '#f97316',
    padding: '8px 16px',
    borderRadius: 8,
    fontSize: '0.875rem',
    cursor: 'pointer',
    fontWeight: 600,
  },
  solution: {
    background: 'rgba(16,185,129,0.08)',
    border: '1px solid rgba(16,185,129,0.25)',
    borderRadius: 8,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    fontSize: '0.92rem',
    lineHeight: 1.5,
  },
  solutionLine: { color: 'var(--color-text)' },
  solutionLabel: { color: '#10b981' },
  openAnswer: {
    width: '100%',
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    color: 'var(--color-text)',
    padding: '10px 12px',
    fontSize: '0.95rem',
    fontFamily: 'inherit',
    resize: 'vertical',
    minHeight: 80,
  },
  errorBox: {
    background: 'rgba(220,38,38,0.15)',
    borderLeft: '4px solid #dc2626',
    color: 'var(--color-error)',
    padding: '12px 14px',
    borderRadius: 8,
    fontSize: '0.875rem',
  },
  verdictBox: {
    borderRadius: 8,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    fontSize: '0.92rem',
    lineHeight: 1.5,
  },
  verdictHeader: { fontWeight: 700, fontSize: '0.95rem' },
  verdictFeedback: { color: 'var(--color-text)' },
};
```

- [ ] **Step 2: Verificar tipos**

Run: `pnpm --filter @vkbacademy/web exec tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/exercises/ExercisePractice.tsx
git commit -m "feat(web): componente ExercisePractice reutilizable (extraído de ExercisesPage)"
```

---

## Task 9: `ExamPage` — retorno configurable (`returnTo`)

**Files:**

- Modify: `apps/web/src/pages/ExamPage.tsx`

**Interfaces:**

- Produces: `ExamPage` navega de vuelta a `searchParams.get('returnTo')` (por defecto `/study`) en lugar de `/my-exams`, permitiendo volver a la unidad de estudio tras el examen.

- [ ] **Step 1: Leer el parámetro `returnTo`**

En `apps/web/src/pages/ExamPage.tsx`, tras la línea `const aiBankId = searchParams.get('aiBankId') ?? undefined;` (≈ línea 754), añadir:

```ts
const returnTo = searchParams.get('returnTo') ?? '/study';
```

- [ ] **Step 2: Redirigir con `returnTo` (dos usos)**

Reemplazar las dos ocurrencias de `navigate('/my-exams')` (≈ líneas 836 y 881) por:

```ts
navigate(returnTo);
```

- [ ] **Step 3: Verificar tipos**

Run: `pnpm --filter @vkbacademy/web exec tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/ExamPage.tsx
git commit -m "feat(web): ExamPage vuelve a returnTo (unidad de estudio) tras el examen"
```

---

## Task 10: `StudyUnitPage` (pestañas Teoría / Ejercicios / Examen)

**Files:**

- Create: `apps/web/src/pages/StudyUnitPage.tsx`

**Interfaces:**

- Consumes: `useStudyUnit`, `useDeleteStudyUnit`, `useRegenerateTheory`, `useRegenerateExercises`, `useRegenerateExam` (Task 6); `TheoryView` (Task 7); `ExercisePractice` (Task 8).
- Produces: página `/study/:id` con navegación de pestañas y, en la pestaña Examen, un botón que navega a `/exam?aiBankId=<exam.id>&returnTo=/study/<id>`.

- [ ] **Step 1: Crear la página**

Create `apps/web/src/pages/StudyUnitPage.tsx`:

```tsx
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { StudyUnitDetail } from '@vkbacademy/shared';
import {
  useStudyUnit,
  useDeleteStudyUnit,
  useRegenerateTheory,
  useRegenerateExercises,
  useRegenerateExam,
} from '../hooks/useStudy';
import TheoryView from '../components/theory/TheoryView';
import ExercisePractice from '../components/exercises/ExercisePractice';

type Tab = 'theory' | 'exercises' | 'exam';

const TABS: { key: Tab; label: string }[] = [
  { key: 'theory', label: '📖 Teoría' },
  { key: 'exercises', label: '🧮 Ejercicios' },
  { key: 'exam', label: '🎓 Examen' },
];

export default function StudyUnitPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = useStudyUnit(id);
  const remove = useDeleteStudyUnit();
  const [tab, setTab] = useState<Tab>('theory');

  if (isLoading) {
    return (
      <div style={s.page}>
        <p style={s.muted}>Cargando unidad…</p>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div style={s.page}>
        <p style={s.muted}>No se encontró la unidad de estudio.</p>
        <Link to="/study" style={s.backLink}>
          ← Volver a Estudiar
        </Link>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <Link to="/study" style={s.backLink}>
        ← Volver a Estudiar
      </Link>

      <header style={s.header}>
        <span style={s.eyebrow}>
          {data.course.title} · Tema: {data.topic}
        </span>
        <h1 style={s.title}>{data.title}</h1>
        {data.summary && <p style={s.summary}>{data.summary}</p>}
      </header>

      <nav style={s.tabs}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            style={{ ...s.tab, ...(tab === t.key ? s.tabActive : {}) }}
            aria-pressed={tab === t.key}
          >
            {t.label}
            {!data.sections[t.key] && (
              <span style={s.tabWarn} title="Sección no generada">
                {' '}
                !
              </span>
            )}
          </button>
        ))}
      </nav>

      <div style={s.content}>
        {tab === 'theory' && <TheoryTab unit={data} />}
        {tab === 'exercises' && <ExercisesTab unit={data} />}
        {tab === 'exam' && (
          <ExamTab
            unit={data}
            onStart={(bankId) => navigate(`/exam?aiBankId=${bankId}&returnTo=/study/${id}`)}
          />
        )}
      </div>

      <footer style={s.footer}>
        <button
          type="button"
          onClick={() => {
            if (window.confirm('¿Borrar esta unidad de estudio?')) {
              remove.mutate(id, { onSuccess: () => navigate('/study') });
            }
          }}
          disabled={remove.isPending}
          style={s.deleteBtn}
        >
          {remove.isPending ? 'Borrando…' : '🗑️ Borrar unidad'}
        </button>
      </footer>
    </div>
  );
}

function MissingSection({
  label,
  onRetry,
  retrying,
}: {
  label: string;
  onRetry: () => void;
  retrying: boolean;
}) {
  return (
    <div style={s.missing}>
      <p style={s.muted}>No se pudo generar {label}. Puedes reintentarlo.</p>
      <button type="button" className="btn btn-primary" onClick={onRetry} disabled={retrying}>
        {retrying ? '⏳ Generando…' : '🔄 Reintentar generación'}
      </button>
    </div>
  );
}

function TheoryTab({ unit }: { unit: StudyUnitDetail }) {
  const regen = useRegenerateTheory(unit.id);
  if (!unit.theory) {
    return (
      <MissingSection label="la teoría" onRetry={() => regen.mutate()} retrying={regen.isPending} />
    );
  }
  return <TheoryView module={unit.theory} />;
}

function ExercisesTab({ unit }: { unit: StudyUnitDetail }) {
  const regen = useRegenerateExercises(unit.id);
  if (!unit.exercises || unit.exercises.length === 0) {
    return (
      <MissingSection
        label="los ejercicios"
        onRetry={() => regen.mutate(undefined)}
        retrying={regen.isPending}
      />
    );
  }
  return <ExercisePractice exercises={unit.exercises} />;
}

function ExamTab({ unit, onStart }: { unit: StudyUnitDetail; onStart: (bankId: string) => void }) {
  const regen = useRegenerateExam(unit.id);
  if (!unit.exam) {
    return (
      <MissingSection label="el examen" onRetry={() => regen.mutate()} retrying={regen.isPending} />
    );
  }
  const { exam } = unit;
  const timeMinutes = exam.timeLimit ? Math.round(exam.timeLimit / 60) : null;
  return (
    <div className="vkb-card" style={s.examCard}>
      <div>
        <div style={s.examTitle}>{exam.title}</div>
        <div style={s.examMeta}>
          {exam.questions.length} preguntas
          {timeMinutes !== null && ` · ⏱ ${timeMinutes} min`}
          {exam.onlyOnce && ' · 🔒 1 intento'}
          {exam.attemptCount > 0 &&
            ` · ${exam.attemptCount} ${exam.attemptCount === 1 ? 'intento' : 'intentos'}`}
        </div>
      </div>
      <button className="btn btn-primary" style={s.examStart} onClick={() => onStart(exam.id)}>
        {exam.attemptCount > 0 ? 'Repetir' : 'Empezar'}
      </button>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 900,
    margin: '0 auto',
    padding: '24px 16px 64px',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  backLink: { color: '#f97316', fontSize: '0.875rem', textDecoration: 'none', fontWeight: 600 },
  header: { display: 'flex', flexDirection: 'column', gap: 8 },
  eyebrow: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  title: { fontSize: '2rem', fontWeight: 800, margin: 0, lineHeight: 1.15 },
  summary: { fontSize: '1.05rem', color: 'var(--color-text-muted)', lineHeight: 1.6, margin: 0 },
  tabs: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    borderBottom: '1px solid var(--color-border)',
    paddingBottom: 4,
  },
  tab: {
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: 'var(--color-text-muted)',
    padding: '8px 12px',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  tabActive: { color: '#f97316', borderBottomColor: '#f97316' },
  tabWarn: { color: '#dc2626', fontWeight: 800 },
  content: { display: 'flex', flexDirection: 'column', gap: 16 },
  missing: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    alignItems: 'flex-start',
    padding: 24,
    background: 'var(--color-surface)',
    border: '1px dashed var(--color-border)',
    borderRadius: 12,
  },
  muted: { color: 'var(--color-text-muted)', fontSize: '0.95rem', margin: 0 },
  examCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: '20px 24px',
    flexWrap: 'wrap',
  },
  examTitle: { fontWeight: 700, color: 'var(--color-text)', marginBottom: 6, fontSize: '1rem' },
  examMeta: { fontSize: '0.8rem', color: 'var(--color-text-muted)' },
  examStart: { padding: '9px 20px', fontSize: '0.875rem', flexShrink: 0 },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: 12, flexWrap: 'wrap' },
  deleteBtn: {
    background: 'transparent',
    border: '1px solid rgba(220,38,38,0.4)',
    color: '#dc2626',
    padding: '10px 18px',
    borderRadius: 8,
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
};
```

- [ ] **Step 2: Verificar tipos**

Run: `pnpm --filter @vkbacademy/web exec tsc --noEmit`
Expected: sin errores (referencias a rutas nuevas se resolverán en Task 12; la página en sí compila).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/StudyUnitPage.tsx
git commit -m "feat(web): StudyUnitPage con pestañas Teoría/Ejercicios/Examen"
```

---

## Task 11: `StudyPage` (lista + creación)

**Files:**

- Create: `apps/web/src/pages/StudyPage.tsx`

**Interfaces:**

- Consumes: `useMyStudyUnits`, `useCreateStudyUnit`, `useDeleteStudyUnit` (Task 6); `useCourses` de `../hooks/useCourses`.
- Produces: página `/study` con formulario breve de creación y lista de unidades del alumno.

- [ ] **Step 1: Crear la página**

Create `apps/web/src/pages/StudyPage.tsx`:

```tsx
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCourses } from '../hooks/useCourses';
import { useMyStudyUnits, useCreateStudyUnit, useDeleteStudyUnit } from '../hooks/useStudy';

export default function StudyPage() {
  const navigate = useNavigate();
  const { data: coursesData } = useCourses(1);
  const courses = coursesData?.data ?? [];

  const { data: units, isLoading: unitsLoading } = useMyStudyUnits();
  const create = useCreateStudyUnit();
  const remove = useDeleteStudyUnit();

  const [courseId, setCourseId] = useState('');
  const [topic, setTopic] = useState('');
  const [numExercises, setNumExercises] = useState(5);
  const [numQuestions, setNumQuestions] = useState<5 | 10>(5);
  const [useTimer, setUseTimer] = useState(false);
  const [timerMins, setTimerMins] = useState(15);
  const [onlyOnce, setOnlyOnce] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!courseId || topic.trim().length < 3) return;
    create.mutate(
      {
        courseId,
        topic: topic.trim(),
        numExercises,
        numQuestions,
        timeLimit: useTimer ? Math.round(timerMins * 60) : undefined,
        onlyOnce,
      },
      { onSuccess: (unit) => navigate(`/study/${unit.id}`) },
    );
  }

  const apiError = (
    create.error as { response?: { data?: { message?: string | string[] } } } | null
  )?.response?.data?.message;
  const apiErrorText = Array.isArray(apiError) ? apiError.join(' · ') : apiError;

  return (
    <div style={s.page}>
      <header style={s.header}>
        <h1 style={s.title}>🧠 Estudiar</h1>
        <p style={s.subtitle}>
          Escribe un tema de una de tus asignaturas y se creará un curso con teoría, ejercicios y un
          examen, todo generado para ti.
        </p>
      </header>

      <form onSubmit={handleSubmit} style={s.form}>
        <div style={s.row}>
          <div className="field" style={{ flex: 2 }}>
            <label htmlFor="courseId">Asignatura</label>
            <select
              id="courseId"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              required
            >
              <option value="">Selecciona una asignatura</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="numExercises">Nº de ejercicios</label>
            <input
              id="numExercises"
              type="number"
              min={1}
              max={20}
              value={numExercises}
              onChange={(e) =>
                setNumExercises(Math.max(1, Math.min(20, Number(e.target.value) || 1)))
              }
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="topic">¿Sobre qué tema quieres estudiar?</label>
          <textarea
            id="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Ej: propiedades de logaritmos, el Renacimiento, análisis sintáctico..."
            rows={3}
            style={s.textarea}
            required
          />
        </div>

        <div className="field">
          <label>Preguntas del examen</label>
          <div style={{ display: 'flex', gap: 10 }}>
            {([5, 10] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNumQuestions(n)}
                style={{ ...s.pill, ...(numQuestions === n ? s.pillActive : {}) }}
              >
                {n} preguntas
              </button>
            ))}
          </div>
        </div>

        <label style={s.toggle}>
          <input
            type="checkbox"
            checked={useTimer}
            onChange={(e) => setUseTimer(e.target.checked)}
          />
          <span>⏱ Límite de tiempo</span>
          {useTimer && (
            <input
              type="number"
              min={1}
              max={180}
              value={timerMins}
              onChange={(e) =>
                setTimerMins(Math.min(180, Math.max(1, Number(e.target.value) || 1)))
              }
              style={s.timerInput}
            />
          )}
          {useTimer && <span style={s.muted}>minutos</span>}
        </label>

        <label style={s.toggle}>
          <input
            type="checkbox"
            checked={onlyOnce}
            onChange={(e) => setOnlyOnce(e.target.checked)}
          />
          <span>🔒 Examen de un solo intento</span>
        </label>

        {apiErrorText && (
          <div style={s.errorBox}>
            <strong>!</strong> {apiErrorText}
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={create.isPending || !courseId || topic.trim().length < 3}
          style={{ alignSelf: 'flex-start', padding: '12px 24px' }}
        >
          {create.isPending ? '⏳ Generando tu curso…' : '✨ Crear curso de estudio'}
        </button>
      </form>

      <section style={s.results}>
        <h2 style={s.resultsTitle}>Mis cursos de estudio</h2>
        {unitsLoading && <p style={s.muted}>Cargando…</p>}
        {!unitsLoading && (units?.length ?? 0) === 0 && (
          <p style={s.muted}>
            Aún no has creado ningún curso. Escribe un tema arriba para empezar.
          </p>
        )}
        <ul style={s.list}>
          {(units ?? []).map((u) => (
            <li key={u.id} style={s.item}>
              <Link to={`/study/${u.id}`} style={s.itemLink}>
                <strong>{u.title}</strong>
                <span style={s.itemMeta}>
                  {u.course.title} · Tema: {u.topic}
                </span>
                <span style={s.itemDate}>
                  {new Date(u.createdAt).toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </Link>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`¿Borrar "${u.title}"?`)) remove.mutate(u.id);
                }}
                style={s.deleteBtn}
                aria-label="Borrar unidad"
              >
                🗑️
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 900,
    margin: '0 auto',
    padding: '32px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 32,
  },
  header: { display: 'flex', flexDirection: 'column', gap: 8 },
  title: { fontSize: '1.8rem', fontWeight: 800, margin: 0 },
  subtitle: { color: 'var(--color-text-muted)', fontSize: '0.95rem', lineHeight: 1.5, margin: 0 },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 14,
    padding: 24,
  },
  row: { display: 'flex', gap: 16, flexWrap: 'wrap' },
  textarea: {
    width: '100%',
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    color: 'var(--color-text)',
    padding: '10px 12px',
    fontSize: '0.95rem',
    fontFamily: 'inherit',
    resize: 'vertical',
  },
  pill: {
    flex: 1,
    padding: '10px 16px',
    borderRadius: 8,
    border: '1.5px solid var(--color-border)',
    background: 'var(--color-bg)',
    color: 'var(--color-text)',
    fontSize: '0.9rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  pillActive: {
    border: '2px solid var(--color-primary)',
    background: 'rgba(234,88,12,0.10)',
    color: 'var(--color-primary)',
  },
  toggle: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: '0.9rem',
    color: 'var(--color-text)',
  },
  timerInput: {
    width: 80,
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    color: 'var(--color-text)',
    padding: '6px 10px',
  },
  muted: { color: 'var(--color-text-muted)', fontSize: '0.9rem', margin: 0 },
  errorBox: {
    background: 'rgba(220,38,38,0.15)',
    borderLeft: '4px solid #dc2626',
    color: 'var(--color-error)',
    padding: '12px 14px',
    borderRadius: 8,
    fontSize: '0.875rem',
  },
  results: { display: 'flex', flexDirection: 'column', gap: 12 },
  resultsTitle: { fontSize: '1.2rem', fontWeight: 700, margin: 0 },
  list: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  item: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 12,
    display: 'flex',
    alignItems: 'stretch',
    gap: 8,
  },
  itemLink: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '14px 16px',
    color: 'var(--color-text)',
    textDecoration: 'none',
  },
  itemMeta: { fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: 1.4 },
  itemDate: { fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 },
  deleteBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--color-text-muted)',
    padding: '0 14px',
    cursor: 'pointer',
    fontSize: '1.1rem',
  },
};
```

- [ ] **Step 2: Verificar tipos**

Run: `pnpm --filter @vkbacademy/web exec tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/StudyPage.tsx
git commit -m "feat(web): StudyPage (lista + formulario de creación de unidad)"
```

---

## Task 12: Rutas, navegación, dashboard y retirada de páginas antiguas

**Files:**

- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/layouts/AppLayout.tsx`
- Modify: `apps/web/src/pages/DashboardPage.tsx`
- Delete: `apps/web/src/pages/TheoryPage.tsx`, `apps/web/src/pages/TheoryModulePage.tsx`, `apps/web/src/pages/ExercisesPage.tsx`, `apps/web/src/pages/ExamsListPage.tsx`

**Interfaces:**

- Consumes: `StudyPage` (Task 11), `StudyUnitPage` (Task 10).
- Produces: rutas `/study` y `/study/:id`; ítem de menú "🧠 Estudiar"; acceso rápido del dashboard a `/study`. Rutas `/theory`, `/theory/:id`, `/exercises`, `/my-exams` eliminadas.

- [ ] **Step 1: Actualizar el menú del alumno**

En `apps/web/src/layouts/AppLayout.tsx`, en la rama `// STUDENT por defecto` (≈ líneas 61-69), reemplazar los tres ítems (`/exercises`, `/theory`, `/my-exams`) por uno solo. El bloque queda:

```tsx
// STUDENT por defecto
return [
  ...base,
  { to: '/subjects', label: '📚 Asignaturas' },
  { to: '/study', label: '🧠 Estudiar' },
  { to: '/challenges', label: '🏆 Retos' },
  { to: '/profile', label: '👤 Mi perfil' },
];
```

- [ ] **Step 2: Actualizar los accesos rápidos del Dashboard**

En `apps/web/src/pages/DashboardPage.tsx`, localizar el array de accesos rápidos que contiene los objetos con `to: '/theory'`, `to: '/exercises'` y `to: '/my-exams'` (≈ líneas 36-48). Reemplazar esos tres objetos por uno solo:

```tsx
          { emoji: '🧠', label: 'Estudiar', desc: 'Crea un curso con teoría, ejercicios y examen', to: '/study' },
```

(Mantener el resto de accesos rápidos del array intactos.)

- [ ] **Step 3: Actualizar las rutas en `App.tsx`**

En `apps/web/src/App.tsx`:

Eliminar los imports de páginas retiradas:

```tsx
import ExamsListPage from './pages/ExamsListPage';
import ExercisesPage from './pages/ExercisesPage';
import TheoryPage from './pages/TheoryPage';
import TheoryModulePage from './pages/TheoryModulePage';
```

Añadir los imports nuevos (junto al resto de páginas):

```tsx
import StudyPage from './pages/StudyPage';
import StudyUnitPage from './pages/StudyUnitPage';
```

Eliminar las rutas antiguas (`my-exams`, `exercises`, `theory`, `theory/:id`):

```tsx
        <Route path="my-exams" element={<ExamsListPage />} />
        <Route path="exercises" element={<ExercisesPage />} />
        <Route path="theory" element={<TheoryPage />} />
        <Route path="theory/:id" element={<TheoryModulePage />} />
```

Y añadir las nuevas (mantener `<Route path="exam" element={<ExamPage />} />` intacta):

```tsx
        <Route path="study" element={<StudyPage />} />
        <Route path="study/:id" element={<StudyUnitPage />} />
```

- [ ] **Step 4: Borrar las páginas antiguas**

```bash
git rm apps/web/src/pages/TheoryPage.tsx apps/web/src/pages/TheoryModulePage.tsx apps/web/src/pages/ExercisesPage.tsx apps/web/src/pages/ExamsListPage.tsx
```

- [ ] **Step 5: Verificar que no quedan referencias colgantes**

Run: `grep -rn "TheoryPage\|TheoryModulePage\|ExercisesPage\|ExamsListPage\|/my-exams\|/theory'\|/theory\"" apps/web/src`
Expected: sin resultados. (No se busca `/exercises` a secas porque `ExercisePractice.tsx` usa legítimamente el endpoint `/exercises/evaluate`; eso debe permanecer.) Si aparece alguna referencia a las páginas o rutas borradas, corregirla.

- [ ] **Step 6: Verificar tipos y build**

Run: `pnpm --filter @vkbacademy/web exec tsc --noEmit`
Expected: sin errores.

Run: `pnpm --filter @vkbacademy/web build`
Expected: build correcto.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/layouts/AppLayout.tsx apps/web/src/pages/DashboardPage.tsx
git commit -m "feat(web): menú 'Estudiar' unificado; retira Teoría/Ejercicios/Exámenes"
```

---

## Verificación final (manual, tras implementar)

1. `pnpm --filter @vkbacademy/api test` — toda la suite verde.
2. `pnpm --filter @vkbacademy/web exec tsc --noEmit` — sin errores.
3. Arrancar (`docker compose up -d` + `pnpm dev`), entrar como alumno:
   - El menú muestra "🧠 Estudiar" y ya no Teoría/Ejercicios/Exámenes.
   - Crear una unidad con una asignatura + tema → espera de generación → aterriza en `/study/:id`.
   - Pestaña Teoría: slides + descargar PDF (con footer VKB) + WhatsApp.
   - Pestaña Ejercicios: comprobar opción múltiple y evaluar una respuesta abierta.
   - Pestaña Examen: "Empezar" → hacer el examen → al terminar vuelve a `/study/:id`.
   - Borrar la unidad → desaparece de la lista.

## Notas de implementación

- **TDD:** el backend (`StudyService`) se implementa test-first (Task 4). El frontend usa `tsc --noEmit` + build como gate, siguiendo la convención del repo (estas páginas no tienen harness de test de componentes; añadirlo queda fuera de alcance).
- **Fallos parciales:** cubiertos por `allSettled` en `create` y por los endpoints de regeneración por sección + la UI `MissingSection`.
- **Datos previos:** no se migran; las unidades arrancan vacías (decisión "empezar de cero").

```

```
