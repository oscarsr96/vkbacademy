# CLAUDE.md — VKB Academy

> Contexto operativo para Claude Code. Historial detallado de fases completadas en [`docs/history/`](docs/history/).

---

## 1. Descripción

App educativa web y móvil para jugadores de Vallekas Basket (y otras academias). Similar a Moodle: cursos con vídeos, ejercicios y tests, reserva de clases particulares, gamificación con retos y tienda. Multi-tenant.

Usuarios: alumnos, tutores (padres), profesores, admins, super_admin.

---

## 2. Reglas duras — no romper nunca

- `isCorrect` de `Answer` / `ExamAnswer` nunca en respuestas GET — solo en el POST de submit.
- Nunca devolver URLs S3 directas: siempre **presigned URLs** con ~1h de expiración.
- Nunca tocar `PublicLayout` desde tareas del app autenticado, ni viceversa.
- `checkAndAward` (gamificación) siempre con `void`, nunca `await` — no bloquear HTTP.
- Usar `pnpm --filter @vkbacademy/api` (nombre con scope), no `--filter api`.
- Contenido interactivo (MATCH/SORT/FILL_BLANK) vive en `Lesson.content: Json` — no crear modelos nuevos.
- No crear archivos `.md` en el repo sin pedirlo explícitamente.
- TypeScript `strict: true`. Sin `any` salvo justificación.
- Guards antes de services: lógica de roles en guard/decorador, nunca en service.
- Errores: `HttpException` de NestJS con mensaje descriptivo; el cliente recibe `{ message, statusCode }`.

---

## 3. Stack

| Capa                 | Tecnología                                   |
| -------------------- | -------------------------------------------- |
| Web frontend         | React 18 + Vite + TypeScript                 |
| Mobile               | React Native + Expo (SDK 51+) — pendiente    |
| Backend              | NestJS + TypeScript                          |
| Base de datos        | PostgreSQL 16                                |
| ORM                  | Prisma                                       |
| Caché / sesiones     | Redis (no desplegado en producción)          |
| Autenticación        | JWT + Refresh tokens (implementación propia) |
| Almacenamiento vídeo | AWS S3 + URLs firmadas                       |
| Email transaccional  | Resend                                       |
| Videollamadas        | Daily.co                                     |
| Estado global (web)  | Zustand                                      |
| Data fetching        | React Query (TanStack Query v5)              |
| HTTP client          | Axios                                        |
| Monorepo             | Turborepo + pnpm workspaces                  |
| Contenedores locales | Docker Compose                               |

---

## 4. Estructura del monorepo

```
/
├── apps/
│   ├── web/          # React + Vite
│   ├── mobile/       # React Native + Expo (pendiente)
│   └── api/          # NestJS
├── packages/
│   └── shared/       # Tipos TypeScript compartidos
├── docs/history/     # Detalle de fases completadas
├── docker-compose.yml
├── turbo.json
├── package.json
└── CLAUDE.md
```

### Módulos del backend (`apps/api/src/`)

`auth`, `users`, `courses`, `quizzes`, `progress`, `bookings`, `availability`, `media`, `notifications`, `admin`, `challenges`, `certificates`, `school-years`, `tutors`, `academies`, `exams`. Cada módulo sigue `controller → service → repository (Prisma)`.

---

## 5. Roles y permisos

| Acción                       | student | tutor | teacher | admin | super_admin |
| ---------------------------- | :-----: | :---: | :-----: | :---: | :---------: |
| Ver cursos asignados         |   ✅    |  ✅   |   ✅    |  ✅   |     ✅      |
| Ver todos los cursos         |   ❌    |  ✅   |   ✅    |  ✅   |     ✅      |
| Crear / editar cursos        |   ❌    |  ❌   |  ✅\*   |  ✅   |     ✅      |
| Subir vídeos                 |   ❌    |  ❌   |  ✅\*   |  ✅   |     ✅      |
| Realizar tests               |   ✅    |  ✅   |   ✅    |  ✅   |     ✅      |
| Ver resultados de todos      |   ❌    |  ✅   |   ✅    |  ✅   |     ✅      |
| Crear reservas (sus alumnos) |   ❌    |  ✅   |   ❌    |  ✅   |     ✅      |
| Gestionar disponibilidad     |   ❌    |  ❌   |   ✅    |  ✅   |     ✅      |
| Gestionar usuarios           |   ❌    |  ❌   |   ❌    |  ✅   |     ✅      |
| Ver métricas globales        |   ❌    |  ❌   |   ❌    |  ✅   |     ✅      |
| Canjear puntos               |   ✅    |  ✅   |   ❌    |  ❌   |     ❌      |
| Gestionar retos (CRUD)       |   ❌    |  ❌   |   ❌    |  ✅   |     ✅      |
| Gestionar academias          |   ❌    |  ❌   |   ❌    |  ❌   |     ✅      |

\*Solo en cursos donde estén asignados como autor.

**Filtrado por nivel:** `GET /courses` para STUDENT devuelve solo los cursos del `schoolYear` asignado. `GET /courses/:id` devuelve 403 si STUDENT intenta acceder a un curso de otro nivel.

---

## 6. Modelo de datos — enums y relaciones clave

```prisma
enum Role          { STUDENT TUTOR TEACHER ADMIN SUPER_ADMIN }
enum LessonType    { VIDEO QUIZ EXERCISE MATCH SORT FILL_BLANK }
enum BookingStatus { PENDING CONFIRMED CANCELLED }
enum BookingMode   { IN_PERSON ONLINE }
enum ChallengeType {
  LESSON_COMPLETED MODULE_COMPLETED COURSE_COMPLETED
  QUIZ_SCORE BOOKING_ATTENDED STREAK_WEEKLY TOTAL_HOURS
}
enum CertificateType {
  MODULE_COMPLETION COURSE_COMPLETION MODULE_EXAM COURSE_EXAM
}
```

Entidades principales: `User`, `SchoolYear`, `Academy`, `AcademyMember`, `Course`, `Module`, `Lesson`, `Quiz`, `Question`, `Answer`, `ExamQuestion`, `ExamAnswer`, `ExamAttempt`, `Booking`, `Challenge`, `UserChallenge`, `Redemption`, `Certificate`.

Campo crítico: `Lesson.content: Json?` almacena la estructura de MATCH/SORT/FILL_BLANK (no hay modelos separados). Tipos en `packages/shared/src/types/course.types.ts`.

Para schema completo: `apps/api/prisma/schema.prisma`.

---

## 7. API REST — endpoints principales

### Auth

```
POST /auth/register
POST /auth/login      → { accessToken, refreshToken }
POST /auth/refresh
POST /auth/logout
```

### Cursos y lecciones

```
GET  /courses                    → filtrada por schoolYear para STUDENT
GET  /courses/:id                → detalle con módulos
POST /courses                    [TEACHER, ADMIN]
GET  /courses/:id/progress
GET  /lessons/:id                → sin isCorrect en answers
POST /lessons/:id/complete
POST /media/upload-url           [TEACHER, ADMIN]
GET  /media/view-url/:key        → presigned URL 1h
```

### Tests y exámenes

```
GET  /quizzes/:id                → preguntas SIN isCorrect
POST /quizzes/:id/submit         → score + correcciones
GET  /quizzes/:id/attempts

GET  /exams/available
GET  /exams/info?courseId=&moduleId=
POST /exams/start                → Fisher-Yates shuffle + snapshot
POST /exams/:attemptId/submit    → corrección server-side
GET  /exams/history
```

### Reservas y disponibilidad

```
GET    /teachers
GET    /teachers/:id/slots?from=&to=
POST   /bookings                 [TUTOR, ADMIN]
PATCH  /bookings/:id/confirm     [TEACHER, ADMIN]
PATCH  /bookings/:id/cancel
GET    /bookings/mine
GET    /availability/mine        [TEACHER, ADMIN]
POST   /availability             [TEACHER, ADMIN]
DELETE /availability/:id         [TEACHER, ADMIN]
```

### Niveles, tutores, retos, certificados

```
GET  /school-years
GET  /tutors/my-students                 [TUTOR, ADMIN]
GET  /tutors/my-students/:id/courses     [TUTOR, ADMIN]
GET  /challenges
GET  /challenges/summary
POST /challenges/redeem
GET  /certificates
GET  /certificates/:id
GET  /certificates/verify/:code          → público, sin JWT
```

### Academias (multi-tenancy)

```
GET    /academies/by-slug/:slug          → público (branding)
GET    /academies                        [SUPER_ADMIN]
POST   /academies                        [SUPER_ADMIN]
PATCH  /academies/:id                    [SUPER_ADMIN]
GET    /academies/:id/members            [ADMIN, SUPER_ADMIN]
POST   /academies/:id/members            [ADMIN, SUPER_ADMIN]
DELETE /academies/:id/members/:userId    [ADMIN, SUPER_ADMIN]
```

### Admin (prefijo `/admin/*`)

Namespaces: `users`, `courses`, `courses/:id/modules`, `modules/:id/lessons`, `lessons/:id/quiz`, `quizzes/:id/questions`, `exam-questions`, `exam-attempts`, `challenges`, `redemptions`, `certificates`, `metrics`, `analytics`, `billing`. Todos `[ADMIN, SUPER_ADMIN]` salvo `super-admin-only`.

Ver swagger o los controllers de `apps/api/src/admin/` para firmas exactas.

---

## 8. Convenciones de código

- **Nombres en inglés**: variables, funciones, clases, rutas API, columnas BD.
- **Comentarios en español**: equipo hispanohablante.
- **DTOs con `class-validator`** en todos los endpoints.
- **Health endpoint** (`GET /api/health`) no consulta BD — un fallo de Postgres no debe tumbar la readiness probe.
- `User.totalPoints` denormalizado (incremento directo) para consultas O(1).

---

## 9. Variables de entorno

Ver `apps/api/.env.example`. Claves críticas:

```env
DATABASE_URL="postgresql://..."
REDIS_URL="redis://localhost:6379"
JWT_SECRET / JWT_REFRESH_SECRET         # openssl rand -hex 32
AWS_REGION / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_S3_BUCKET
AWS_SIGNED_URL_EXPIRES=3600
RESEND_API_KEY / EMAIL_FROM
YOUTUBE_API_KEY                          # secret "YT" en GCP Secret Manager
STUDENT_PASSWORD_ENC_KEY                 # 32 bytes hex; cifra contraseñas visibles para tutor
PORT=3001
FRONTEND_URL="http://localhost:5173"     # acepta múltiples separados por coma
NODE_ENV=development
```

---

## 10. Comandos útiles

```bash
# Desarrollo local
docker compose up -d                                    # PostgreSQL + Redis
pnpm dev                                                # todos los apps

# Base de datos
pnpm --filter @vkbacademy/api prisma migrate dev
pnpm --filter @vkbacademy/api prisma studio
pnpm --filter @vkbacademy/api prisma db seed

# Tests y type-check
pnpm --filter @vkbacademy/api test
pnpm --filter @vkbacademy/api test:e2e
pnpm --filter @vkbacademy/api test:smoke               # requiere SMOKE_API_URL y SMOKE_WEB_URL
pnpm --filter @vkbacademy/web exec tsc --noEmit

# Build
pnpm build
```

---

## 11. Decisiones de arquitectura (resumen)

1. **Monorepo Turborepo** → compartir tipos web/mobile/api.
2. **JWT + refresh propio** → sin dependencia de Auth0.
3. **Corrección de tests en servidor** → el cliente nunca ve respuestas correctas.
4. **Presigned URLs S3** → contenido protegido.
5. **Daily.co** para reservas online → sala creada al confirmar, borrada al cancelar.
6. **Gamificación event-driven** con `void checkAndAward(...)` → no bloquea HTTP.
7. **Puntos denormalizados** en `User.totalPoints`.
8. **Contenido interactivo como JSON** (no modelos separados) → validación en TypeScript.
9. **Health endpoint sin BD** → readiness probe robusto.

---

## 12. Roadmap

| Fase | Descripción                                                                       | Estado |
| ---- | --------------------------------------------------------------------------------- | :----: |
| 0    | Setup monorepo, Docker, Prisma                                                    |   ✅   |
| 1    | Autenticación y roles                                                             |   ✅   |
| 2    | Cursos, módulos, vídeos                                                           |   ✅   |
| 3    | Tests y progreso                                                                  |   ✅   |
| 4    | Reservas + rol TUTOR                                                              |   ✅   |
| 5    | Notificaciones                                                                    |   ✅   |
| 6    | Panel admin ([detalle](docs/history/phase-6-admin-panel.md))                      |   ✅   |
| 7    | Gamificación ([detalle](docs/history/phase-7-gamification.md))                    |   ✅   |
| 7.5  | Lecciones interactivas ([detalle](docs/history/phase-7.5-interactive-lessons.md)) |   ✅   |
| 8    | Exámenes ([detalle](docs/history/phase-8-exams.md))                               |   ✅   |
| 8.5  | Certificados ([detalle](docs/history/phase-8.5-certificates.md))                  |   ✅   |
| 8.6  | Marketing ([detalle](docs/history/phase-8.6-marketing.md))                        |   ✅   |
| 9    | Deployment parcial (Vercel + Render + Neon)                                       |   ✅   |
| 10   | Multi-tenancy                                                                     |   ✅   |
| 10.5 | Entorno PRE + pipeline progresivo (#11)                                           |   ✅   |
| 10.6 | Auto-asignación de vídeos YouTube (#22)                                           |   ✅   |
| 11   | App móvil                                                                         |   ⬜   |
| 12   | Testing completo                                                                  |   ⬜   |
| 13   | Deployment completo                                                               |   ⬜   |

---

## 13. Deployment (fase 9)

| Capa                    | Plataforma                 | Plan    |
| ----------------------- | -------------------------- | ------- |
| `apps/web` (React/Vite) | Vercel                     | Gratis  |
| `apps/api` (NestJS)     | Render (Docker)            | Starter |
| PostgreSQL              | Neon (serverless Postgres) | Free    |

**Archivos clave:**

- `vercel.json` — build command + rewrite SPA
- `apps/api/Dockerfile` — build en 2 etapas, contexto = raíz
- `apps/api/src/main.ts` — CORS multi-origen via `FRONTEND_URL` separado por comas

**Variables por plataforma:**

- Vercel: `VITE_API_URL=https://<api>.onrender.com/api`
- Render: `FRONTEND_URL`, `DATABASE_URL` (Neon pooler), `NODE_ENV=production`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `YOUTUBE_API_KEY`

**Notas Render**: Dockerfile Path = `apps/api/Dockerfile`, Build Context = `.`. Migraciones **NO** corren en el contenedor — se aplican desde el job `migrate-pre`/`migrate-prod` del pipeline. Cold start ~30-60s en Starter.

**Notas Vercel**: rewrite `/(.*) → /index.html` obligatorio para SPA. Skew protection mantiene la versión previa 24h.

---

## 14. Multi-tenancy (fase 10)

BD compartida con columna discriminadora `academyId`. Profesores y cursos son globales; alumnos, tutores y admins pertenecen a una academia vía `AcademyMember`.

**Rol `SUPER_ADMIN`**: gestiona todas las academias, pasa por chequeos de `ADMIN`, puede operar en contexto de cualquier academia vía header `X-Academy-Id`.

**Scoped por `academyId`**: `Enrollment`, `Booking`, `Redemption`, `UserChallenge`, `BillingConfig`.
**Globales**: `User`, `Course`, `Module`, `Lesson`, `Quiz`, `Challenge`, `Certificate`, `SchoolYear`, `ExamQuestion`.

Resolución: JWT → payload con `academyId` → `AcademyGuard` lo adjunta a `request.academyId` → decorador `@CurrentAcademy()`.

Seed crea academias `vallekas-basket` y `cb-oscar`.

---

## 15. Pipeline PRE → PROD (fase 10.5, issue #11)

```
push main → tests → deploy PRE → smoke PRE
         → (aprobación) → migrate PROD → deploy PROD → smoke PROD → promote
```

**Infraestructura separada**:

| Capa       | PRE                           | PROD                      |
| ---------- | ----------------------------- | ------------------------- |
| Vercel     | proyecto `vkbacademy-web-pre` | proyecto `vkbacademy-web` |
| Render     | servicio API PRE              | servicio API PROD         |
| PostgreSQL | BD dedicada Neon              | BD dedicada Neon          |

**Crítico**: PRE tiene BD propia — nunca compartir con PROD.

**Jobs del workflow** (`.github/workflows/deploy-pipeline.yml`): `test` → `migrate-pre` → `deploy-pre` → `smoke-pre` → `migrate-prod` (gate) → `deploy-prod` (gate) → `smoke-prod` → `promote-prod` (gate).

**Vercel PROD no se despliega vía pipeline** — su Git integration detecta el push a main y despliega automáticamente. El pipeline solo verifica que responde. Para PRE sí usamos `vercel deploy --prod` por CLI.

**Smoke tests** (`apps/api/test/smoke/`): peticiones HTTP con `fetch` nativo. No arrancan Nest ni tocan BD. Ejecutables localmente con `SMOKE_API_URL=... SMOKE_WEB_URL=... pnpm --filter @vkbacademy/api test:smoke`.

**Health endpoint** (`GET /api/health`): devuelve `{ status, timestamp, uptime, node, env }`, no consulta BD.

---

## 16. Flujo de trabajo

- **Commits**: estilo `fix(ci):`, `feat(exams):`, `refactor:`, `chore(ai):`. Seguir git log existente; no mezclar estilos.
- **Branch `main`** → push automático a PRE. Para fixes pequeños, push directo OK. Para features grandes, PR.
- **Tests locales antes de push**:
  - Tocaste API → `pnpm --filter @vkbacademy/api test`
  - Tocaste web → `pnpm --filter @vkbacademy/web exec tsc --noEmit`
- **Nunca `--no-verify`** ni skip de hooks.
- **Issues**: GitHub Issues del repo (no Jira/Linear).
- **Acciones irreversibles** (force push, reset --hard, cambios en prod, borrar ramas): confirmar con el usuario antes de ejecutar.

---

_Última actualización: abril 2026. Infra: Render + Vercel + Neon. CLAUDE.md condensado — histórico por fase en [`docs/history/`](docs/history/)._
