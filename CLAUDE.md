# CLAUDE.md — Educational App

> Este archivo es leído automáticamente por Claude Code al inicio de cada sesión.
> Contiene el contexto completo del proyecto para mantener consistencia entre sesiones.

---

## 1. Descripción del proyecto

App educativa web y móvil para jugadores de un club de baloncesto. Similar a Moodle: módulos de cursos con vídeos, ejercicios y tests, más sistema de reserva de clases particulares con profesores, y un sistema de gamificación con retos y tienda de merchandising.

**Usuarios objetivo:** alumnos, tutores (padres/responsables), profesores y administradores.

---

## 2. Stack tecnológico

| Capa                 | Tecnología                                   |
| -------------------- | -------------------------------------------- |
| Web frontend         | React 18 + Vite + TypeScript                 |
| Mobile               | React Native + Expo (SDK 51+)                |
| Backend              | NestJS + TypeScript                          |
| Base de datos        | PostgreSQL 16                                |
| ORM                  | Prisma                                       |
| Caché / sesiones     | Redis                                        |
| Autenticación        | JWT + Refresh tokens (implementación propia) |
| Almacenamiento vídeo | AWS S3 + URLs firmadas                       |
| Email transaccional  | Resend                                       |
| Push notifications   | Expo Notifications                           |
| Videollamadas        | Daily.co                                     |
| Estado global (web)  | Zustand                                      |
| Data fetching        | React Query (TanStack Query v5)              |
| HTTP client          | Axios                                        |
| Monorepo             | Turborepo                                    |
| Contenedores locales | Docker Compose                               |

---

## 3. Estructura del monorepo

```
/
├── apps/
│   ├── web/          # React + Vite (panel web)
│   ├── mobile/       # React Native + Expo
│   └── api/          # NestJS (backend)
├── packages/
│   └── shared/       # Tipos TypeScript compartidos entre web, mobile y api
├── docker-compose.yml
├── turbo.json
├── package.json      # Root (workspaces)
└── CLAUDE.md         # Este archivo
```

---

## 4. Arquitectura del backend (NestJS)

Cada módulo sigue la estructura: `controller → service → repository (Prisma)`.

```
apps/api/src/
├── auth/             # JWT, refresh tokens, guards, decoradores de rol
├── users/            # CRUD usuarios, perfiles
├── courses/          # Cursos, módulos, lecciones
├── quizzes/          # Tests, preguntas, intentos, corrección
├── progress/         # Progreso del usuario por lección y curso
├── bookings/         # Reservas de clases particulares
├── availability/     # Disponibilidad horaria de profesores
├── media/            # Upload a S3, generación de URLs firmadas
├── notifications/    # Emails (Resend) + push (Expo)
├── admin/            # Métricas, gestión de usuarios, contenido, retos y canjes
├── challenges/       # Retos, puntos, rachas y canje de merchandising
├── certificates/     # Certificados digitales (MODULE/COURSE_COMPLETION y MODULE/COURSE_EXAM)
├── school-years/     # Niveles educativos (1eso … 2bach)
├── tutors/           # Gestión de alumnos asignados a un tutor
└── academies/        # Multi-tenancy: CRUD de academias y membresías
```

---

## 5. Roles y permisos

| Acción                            | student | tutor | teacher | admin | super_admin |
| --------------------------------- | ------- | ----- | ------- | ----- | ----------- |
| Ver cursos asignados              | ✅      | ✅    | ✅      | ✅    |
| Ver todos los cursos              | ❌      | ✅    | ✅      | ✅    |
| Crear / editar cursos             | ❌      | ❌    | ✅\*    | ✅    |
| Subir vídeos                      | ❌      | ❌    | ✅\*    | ✅    |
| Realizar tests                    | ✅      | ✅    | ✅      | ✅    |
| Ver resultados propios            | ✅      | ✅    | ✅      | ✅    |
| Ver resultados de todos           | ❌      | ✅    | ✅      | ✅    |
| Ver progreso de alumnos           | ❌      | ✅    | ✅      | ✅    |
| Crear reservas (para sus alumnos) | ❌      | ✅    | ❌      | ✅    |
| Gestionar disponibilidad          | ❌      | ❌    | ✅      | ✅    |
| Gestionar usuarios                | ❌      | ❌    | ❌      | ✅    |
| Asignar tutores a alumnos         | ❌      | ❌    | ❌      | ✅    |
| Ver métricas globales             | ❌      | ❌    | ❌      | ✅    |
| Ver retos y canjear puntos        | ✅      | ✅    | ❌      | ❌    |
| Gestionar retos (CRUD)            | ❌      | ❌    | ❌      | ✅    |
| Ver y gestionar canjes            | ❌      | ❌    | ❌      | ✅    |

\*Solo en cursos donde estén asignados como autor.

**Filtrado por nivel:** `GET /courses` para STUDENT devuelve solo los cursos del `schoolYear` asignado al usuario. TEACHER, TUTOR y ADMIN ven todos los cursos (TUTOR puede filtrar por `schoolYearId` via query param). `GET /courses/:id` devuelve 403 si el STUDENT intenta acceder a un curso de otro nivel.

---

## 6. Modelo de datos (Prisma schema resumido)

```prisma
// NIVEL EDUCATIVO
model SchoolYear {
  id    String @id @default(cuid())
  name  String @unique  // "1eso", "2eso", "3eso", "4eso", "1bach", "2bach"
  label String          // "1º ESO", "2º ESO", ...
  users   User[]
  courses Course[]
}

// USUARIOS
model User {
  id             String   @id @default(cuid())
  email          String   @unique
  passwordHash   String
  role           Role     @default(STUDENT)
  name           String
  avatarUrl      String?
  createdAt      DateTime @default(now())
  // Gamificación
  currentStreak  Int      @default(0)   // semanas consecutivas con actividad
  longestStreak  Int      @default(0)
  lastActiveWeek String?                // "2026-W07" (ISO week)
  totalPoints    Int      @default(0)   // puntos acumulados
  // relaciones (resumidas)
  userChallenges UserChallenge[]
  redemptions    Redemption[]
  ...
}

enum Role { STUDENT TUTOR TEACHER ADMIN }

// LECCIONES INTERACTIVAS
enum LessonType {
  VIDEO       // vídeo de YouTube embebido
  QUIZ        // test de preguntas y respuestas
  EXERCISE    // ejercicio libre (placeholder)
  MATCH       // emparejar columnas
  SORT        // ordenar elementos
  FILL_BLANK  // rellenar huecos en un texto
}

model Lesson {
  id        String     @id @default(cuid())
  title     String
  type      LessonType
  order     Int
  moduleId  String
  youtubeId String?
  content   Json?      // estructura de datos para tipos MATCH, SORT y FILL_BLANK
  ...
}

// GAMIFICACIÓN — RETOS
enum ChallengeType {
  LESSON_COMPLETED   // completa N lecciones en total
  MODULE_COMPLETED   // completa N módulos enteros
  COURSE_COMPLETED   // completa N cursos completos
  QUIZ_SCORE         // consigue ≥ N% en cualquier quiz
  BOOKING_ATTENDED   // asiste a N clases confirmadas
  STREAK_WEEKLY      // racha activa de N semanas consecutivas
  TOTAL_HOURS        // acumula N horas (bookings + lecciones VIDEO × 20min)
}

model Challenge {
  id          String        @id @default(cuid())
  title       String
  description String
  type        ChallengeType
  target      Int
  points      Int
  badgeIcon   String        @default("🏅")
  badgeColor  String        @default("#6366f1")
  isActive    Boolean       @default(true)
  userChallenges UserChallenge[]
}

model UserChallenge {
  id            String    @id @default(cuid())
  userId        String
  challengeId   String
  progress      Int       @default(0)
  completed     Boolean   @default(false)
  completedAt   DateTime?
  awardedPoints Int       @default(0)
  @@unique([userId, challengeId])
}

// GAMIFICACIÓN — CANJES
model Redemption {
  id          String    @id @default(cuid())
  userId      String
  itemName    String
  cost        Int
  redeemedAt  DateTime  @default(now())
  delivered   Boolean   @default(false)
  deliveredAt DateTime?
  user        User      @relation(...)
}

// RESERVAS
model Booking {
  id        String        @id @default(cuid())
  studentId String
  teacherId String
  startAt   DateTime
  endAt     DateTime
  status    BookingStatus @default(PENDING)
  mode      BookingMode   @default(IN_PERSON)
  meetingUrl String?      // sala Daily.co; solo si mode=ONLINE y status=CONFIRMED
  ...
}

enum BookingStatus { PENDING CONFIRMED CANCELLED }
enum BookingMode   { IN_PERSON ONLINE }
```

---

## 7. API REST — Endpoints principales

### Auth

```
POST   /auth/register
POST   /auth/login          → { accessToken, refreshToken }
POST   /auth/refresh
POST   /auth/logout
```

### Cursos

```
GET    /courses             → lista paginada (filtrada por schoolYear para STUDENT)
GET    /courses/:id         → detalle con módulos
POST   /courses             → [TEACHER, ADMIN]
PATCH  /courses/:id         → [TEACHER autor, ADMIN]
GET    /courses/:id/progress → progreso del usuario autenticado
```

### Lecciones y vídeos

```
GET    /lessons/:id         → detalle (sin isCorrect en answers)
POST   /lessons/:id/complete → marcar como completada
POST   /media/upload-url    → genera presigned URL para subir a S3 [TEACHER, ADMIN]
GET    /media/view-url/:key → genera URL firmada temporal para ver vídeo
```

### Tests

```
GET    /quizzes/:id         → preguntas SIN isCorrect
POST   /quizzes/:id/submit  → [{questionId, answerId}] → devuelve score y correcciones
GET    /quizzes/:id/attempts → historial de intentos del usuario
```

### Reservas

```
GET    /teachers                          → lista de teachers con disponibilidad
GET    /teachers/:id/slots?from=&to=      → slots libres en un rango de fechas
POST   /bookings                          → crear reserva [TUTOR, ADMIN]
PATCH  /bookings/:id/confirm              → confirmar [TEACHER, ADMIN]
PATCH  /bookings/:id/cancel               → cancelar [TUTOR, TEACHER, ADMIN]
GET    /bookings/mine                     → mis reservas (filtrado por rol)
```

### Disponibilidad del profesor

```
GET    /availability/mine    → slots propios [TEACHER, ADMIN]
POST   /availability         → añadir slot [TEACHER, ADMIN]
DELETE /availability/:id     → eliminar slot [TEACHER, ADMIN]
```

### Niveles educativos

```
GET    /school-years         → lista de niveles disponibles [autenticado]
```

### Tutores

```
GET    /tutors/my-students                 → alumnos del tutor autenticado [TUTOR, ADMIN]
GET    /tutors/my-students/:id/courses     → cursos matriculados del alumno [TUTOR, ADMIN]
```

### Retos y gamificación

```
GET    /challenges           → retos activos con progreso del usuario [JWT]
GET    /challenges/summary   → { totalPoints, currentStreak, longestStreak, completedCount, recentBadges } [JWT]
POST   /challenges/redeem    → body: { itemName, cost } → descuenta puntos y registra canje [JWT]
```

### Certificados

```
GET  /certificates               → mis certificados [JWT]
GET  /certificates/:id           → un certificado [JWT]
GET  /certificates/verify/:code  → verificación pública sin JWT
```

### Admin — Usuarios

```
GET    /admin/users
POST   /admin/users                        body: { name, email, password, role, schoolYearId?, tutorId? }
PATCH  /admin/users/:id                    body: { name?, email?, password?, schoolYearId? }
PATCH  /admin/users/:id/role               body: { role }
PATCH  /admin/users/:id/tutor              body: { tutorId?: string | null }
DELETE /admin/users/:id
```

### Admin — Cursos

```
GET    /admin/courses?page=&limit=&schoolYearId=&search=
GET    /admin/courses/:courseId/detail     → árbol completo (módulos, lecciones, quizzes)
POST   /admin/courses/generate             body: { name, schoolYearId } → generación IA
DELETE /admin/courses/:id
POST   /admin/courses/:courseId/modules
POST   /admin/courses/:courseId/modules/generate
PATCH  /admin/modules/:moduleId
DELETE /admin/modules/:moduleId
POST   /admin/modules/:moduleId/lessons
POST   /admin/modules/:moduleId/lessons/generate
PATCH  /admin/lessons/:lessonId            body: { title?, type?, youtubeId?, content? }
                                           content almacena la estructura JSON de la actividad
                                           interactiva (MATCH, SORT o FILL_BLANK)
DELETE /admin/lessons/:lessonId
POST   /admin/lessons/:lessonId/quiz
POST   /admin/quizzes/:quizId/questions
POST   /admin/quizzes/:quizId/questions/generate
PATCH  /admin/questions/:questionId
DELETE /admin/questions/:questionId
```

### Admin — Analytics y facturación

```
GET    /admin/metrics                      → totales globales (legacy)
GET    /admin/analytics?from=&to=&granularity=day|week|month&courseId=&schoolYearId=
GET    /admin/billing?from=&to=
PATCH  /admin/billing/config               body: { studentMonthlyPrice?, ... }
```

### Admin — Retos y canjes

```
GET    /admin/challenges
POST   /admin/challenges                   body: { title, description, type, target, points, badgeIcon?, badgeColor? }
PATCH  /admin/challenges/:challengeId      body: campos opcionales
DELETE /admin/challenges/:challengeId
PATCH  /admin/challenges/:challengeId/toggle  → activa/desactiva el reto
GET    /admin/redemptions                  → todos los canjes con datos del alumno
PATCH  /admin/redemptions/:id/deliver      → marca como entregado (guarda deliveredAt)
```

### Admin — Certificados

```
GET  /admin/certificates              [ADMIN]
POST /admin/certificates              [ADMIN] body: { userId, courseId?, moduleId?, type }
```

---

## 8. Convenciones de código

- **TypeScript estricto**: `"strict": true` en tsconfig. Sin `any` salvo casos justificados.
- **Nombres en inglés**: variables, funciones, clases, rutas API y columnas de BD en inglés.
- **Comentarios en español**: el equipo es hispanohablante.
- **DTOs con validación**: usar `class-validator` en todos los DTOs de NestJS.
- **Guards antes de servicios**: nunca lógica de roles dentro del service, siempre en el guard/decorador.
- **Nunca exponer `isCorrect`**: el campo `isCorrect` de `Answer` jamás debe aparecer en respuestas a endpoints públicos de `/quizzes/:id`. Solo en la respuesta de `/submit` tras la corrección.
- **URLs S3 firmadas**: nunca almacenar ni devolver URLs directas de S3. Siempre generar URLs firmadas con expiración de 1 hora.
- **checkAndAward sin await**: los hooks de gamificación se llaman con `void` para no bloquear la respuesta HTTP.
- **content como JSON**: el campo `content Json?` del modelo `Lesson` almacena la estructura de actividades interactivas. Nunca crear modelos separados para MATCH/SORT/FILL_BLANK — la BD sigue siendo schema-first pero el contenido interactivo es schema-less.
- **Errores**: usar `HttpException` de NestJS con mensajes descriptivos. El cliente siempre recibe `{ message, statusCode }`.

---

## 9. Variables de entorno

Crear `.env` en `apps/api/` con este template:

```env
# Base de datos
DATABASE_URL="postgresql://user:password@localhost:5432/basketball_app"
REDIS_URL="redis://localhost:6379"

# JWT
JWT_SECRET="cambiar_en_produccion"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_SECRET="cambiar_en_produccion_refresh"
JWT_REFRESH_EXPIRES_IN="7d"

# AWS S3
AWS_REGION="eu-west-1"
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""
AWS_S3_BUCKET=""
AWS_SIGNED_URL_EXPIRES=3600

# Email
RESEND_API_KEY=""
EMAIL_FROM="noreply@tuclub.com"

# YouTube Data API v3 (auto-asignación de vídeos en lecciones VIDEO)
YOUTUBE_API_KEY=""

# App
PORT=3001
FRONTEND_URL="http://localhost:5173"
NODE_ENV="development"
```

---

## 10. Comandos útiles

```bash
# Desarrollo local
docker compose up -d          # Levanta PostgreSQL y Redis
pnpm dev                      # Inicia todos los apps en paralelo (Turborepo)

# Base de datos
pnpm --filter api prisma migrate dev   # Nueva migración
pnpm --filter api prisma studio        # GUI de la BD
pnpm --filter api prisma db seed       # Seed de datos de prueba

# Tests
pnpm test                     # Unit tests en todos los packages
pnpm test:e2e                 # Tests de integración (api)

# Build
pnpm build                    # Build de producción (todos los apps)

# Mobile
pnpm --filter mobile start    # Expo dev server
pnpm --filter mobile build    # EAS Build
```

---

## 11. Decisiones de arquitectura tomadas

1. **Monorepo con Turborepo** en lugar de repos separados para compartir tipos y facilitar el desarrollo simultáneo de web, mobile y api.
2. **JWT con refresh tokens** en lugar de Auth0 para evitar dependencia externa y coste adicional.
3. **Corrección de tests en servidor** para evitar que los clientes puedan inspeccionar las respuestas correctas.
4. **URLs firmadas para vídeos** en lugar de vídeos públicos para proteger el contenido del club.
5. **PostgreSQL + Redis** en lugar de solo PostgreSQL para aprovechar Redis en caché de disponibilidad de teachers (dato consultado frecuentemente).
6. **React Query** para data fetching para evitar lógica manual de loading/error states y aprovechar el caché automático.
7. **Daily.co** para salas de videollamada en reservas online: se crea una sala al confirmar la reserva y se elimina al cancelarla. La URL se almacena en `Booking.meetingUrl`.
8. **Gamificación event-driven**: los hooks de retos (`checkAndAward`) se disparan con `void` desde los servicios existentes, sin bloquear la respuesta HTTP ni acoplar la lógica de negocio principal.
9. **Puntos denormalizados**: `User.totalPoints` se mantiene como campo calculado (incremento/decremento directo) para consultas O(1) en la tienda de canjes, evitando agregar `UserChallenge` en cada request.
10. **Contenido interactivo como JSON**: en lugar de crear modelos Prisma separados (MatchPair, SortItem, etc.), se usa un campo `content Json?` en `Lesson`. Simplifica las migraciones y permite añadir nuevos tipos interactivos sin cambios de schema, a costa de perder validación a nivel de BD (se valida en TypeScript vía interfaces en `packages/shared`).

---

## 12. Roadmap de fases

| Fase | Descripción                                                     | Estado        |
| ---- | --------------------------------------------------------------- | ------------- |
| 0    | Setup monorepo, Docker, Prisma                                  | ✅ Completado |
| 1    | Autenticación y roles                                           | ✅ Completado |
| 2    | Cursos, módulos, vídeos                                         | ✅ Completado |
| 3    | Tests y progreso                                                | ✅ Completado |
| 4    | Sistema de reservas + rol TUTOR                                 | ✅ Completado |
| 5    | Notificaciones                                                  | ✅ Completado |
| 6    | Panel de administración                                         | ✅ Completado |
| 7    | Gamificación (retos + tienda)                                   | ✅ Completado |
| 7.5  | Lecciones interactivas (MATCH, SORT, FILL_BLANK)                | ✅ Completado |
| 8    | Sistema de exámenes por curso y módulo                          | ✅ Completado |
| 8.5  | Certificados digitales (completar módulo/curso, aprobar examen) | ✅ Completado |
| 8.6  | Páginas de marketing (Landing, Sobre nosotros, Precios)         | ✅ Completado |
| 9    | Deployment parcial (Vercel + Railway)                           | ✅ Completado |
| 10   | Multi-tenancy (N academias)                                     | ✅ Completado |
| 10.5 | Entorno PRE + pipeline progresivo (Issue #11)                   | ✅ Completado |
| 10.6 | Auto-asignación de vídeos YouTube (Issue #22)                   | ✅ Completado |
| 11   | App móvil                                                       | ⬜ Pendiente  |
| 12   | Testing                                                         | ⬜ Pendiente  |
| 13   | Deployment completo                                             | ⬜ Pendiente  |

---

## 13. Panel de administración (Fase 6)

### Páginas implementadas

| Ruta                  | Página                                                                                | Estado |
| --------------------- | ------------------------------------------------------------------------------------- | ------ |
| `/admin`              | Dashboard con analytics                                                               | ✅     |
| `/admin/users`        | Gestión de usuarios (CRUD)                                                            | ✅     |
| `/admin/courses`      | Gestión de cursos (CRUD + IA) — 6 tipos de lección incluyendo MATCH, SORT, FILL_BLANK | ✅     |
| `/admin/billing`      | Facturación y costes                                                                  | ✅     |
| `/admin/challenges`   | Gestión de retos (CRUD + toggle)                                                      | ✅     |
| `/admin/redemptions`  | Registro de canjes + marcar entregado                                                 | ✅     |
| `/admin/certificates` | Certificados emitidos + emisión manual                                                | ✅     |

### Dashboard analytics — filtros disponibles

- Período: presets (7d / 30d / 3m / 6m / 1a) o rango personalizado
- Agrupación temporal: día / semana / mes
- Filtro por nivel educativo (schoolYear)
- Filtro por curso

### Dashboard analytics — métricas incluidas

- **KPIs**: nuevos alumnos, matrículas, lecciones completadas, intentos de quiz, score medio, reservas creadas, confirmadas, canceladas
- **Serie temporal SVG**: lecciones completadas, intentos de quiz, reservas, nuevos alumnos
- **Top 5 cursos** por matrículas en el período (con nivel educativo)
- **Top 5 alumnos** por lecciones completadas (con score medio de quiz y barras de progreso)
- **Desglose de reservas**: por estado (CONFIRMED/PENDING/CANCELLED) y por modalidad (IN_PERSON/ONLINE)
- **2 KPIs adicionales**: certificados emitidos (total) y cursos completados (certificados COURSE_COMPLETION)
- **Sección Certificados**: 4 mini-KPIs por tipo + tabla reciente de certificados

### Gestión de cursos (`/admin/courses`)

- Listado paginado con búsqueda y filtro por nivel educativo
- Editor en árbol: curso → módulos → lecciones → quiz + preguntas
- Tipos de lección: VIDEO, QUIZ, EXERCISE, MATCH (emparejar), SORT (ordenar), FILL_BLANK (rellenar huecos)
- Botón ⚡ Contenido por lección interactiva para configurar la actividad (pares, items u oraciones con huecos)
- Generación IA de lecciones MATCH, SORT y FILL_BLANK con estructura JSON incluida

---

## 14. Gamificación (Fase 7)

### Retos

- 7 tipos de reto (`ChallengeType`): LESSON_COMPLETED, MODULE_COMPLETED, COURSE_COMPLETED, QUIZ_SCORE, BOOKING_ATTENDED, STREAK_WEEKLY, TOTAL_HOURS
- Los retos se evalúan de forma asíncrona tras cada evento relevante (sin bloquear HTTP)
- El progreso se guarda en `UserChallenge`; al completarse se incrementa `User.totalPoints`
- La racha semanal (`currentStreak`) se actualiza en cada llamada a `checkAndAward` usando semanas ISO

### Tienda de merchandising

| Artículo                       | Coste    |
| ------------------------------ | -------- |
| 🎨 Pack de stickers VKB        | 100 pts  |
| 💧 Botella termo del club      | 200 pts  |
| 🧢 Gorra oficial VKB           | 350 pts  |
| 👕 Camiseta oficial del club   | 500 pts  |
| 🏀 Balón firmado por el equipo | 1000 pts |

- El canje descuenta puntos en transacción atómica y crea un registro `Redemption`
- Los admins ven todos los canjes en `/admin/redemptions` y pueden marcar cada uno como entregado

### Visibilidad por rol

- `🏆 Retos` en el sidebar: solo STUDENT y TUTOR
- `🎯 Retos` y `🎁 Canjes` en el sidebar: solo ADMIN

---

## 15. Lecciones interactivas (Fase 7.5)

### Tipos implementados

| Tipo         | Icono | Descripción                 | Estructura `content`                          |
| ------------ | ----- | --------------------------- | --------------------------------------------- |
| `MATCH`      | 🔗    | Emparejar dos columnas      | `{ pairs: [{ left, right }] }`                |
| `SORT`       | ↕️    | Ordenar una lista           | `{ prompt, items: [{ text, correctOrder }] }` |
| `FILL_BLANK` | ✏️    | Rellenar huecos en un texto | `{ template, distractors }`                   |

### Formato del campo `template` (FILL_BLANK)

Las palabras correctas se marcan con dobles llaves: `"El {{triple}} vale {{3}} puntos."`. El componente extrae las palabras correctas, genera el banco mezclando correctas + distractors, y el alumno arrastra o hace click para colocar cada palabra en su hueco.

### Flujo de creación (admin)

1. Admin abre `/admin/courses/:id` → módulo → "+ Añadir lección" → tipo MATCH/SORT/FILL_BLANK
2. La lección se crea en BD con `content = null`
3. Admin hace click en "⚡ Contenido" → modal de edición según el tipo
4. Al guardar, `PATCH /admin/lessons/:lessonId` con `{ content: {...} }` actualiza el campo JSON

### Flujo del alumno

1. CoursePage lista la lección con el icono correspondiente (🔗 / ↕️ / ✏️)
2. LessonPage renderiza el componente interactivo (`MatchLesson`, `SortLesson`, `FillBlankLesson`)
3. Si `content` es null → se muestra "Actividad no configurada" (placeholder)
4. El botón "Marcar como completada" está deshabilitado hasta resolver correctamente la actividad
5. Al completarla → `POST /lessons/:id/complete` → se disparan los hooks de gamificación

### Componentes React

- `apps/web/src/components/lessons/MatchLesson.tsx` — click-to-pair con verificación
- `apps/web/src/components/lessons/SortLesson.tsx` — drag & drop nativo HTML5
- `apps/web/src/components/lessons/FillBlankLesson.tsx` — banco de palabras click-to-place

### Tipos compartidos (`packages/shared/src/types/course.types.ts`)

```typescript
export interface MatchContent {
  pairs: { left: string; right: string }[];
}
export interface SortContent {
  prompt: string;
  items: { text: string; correctOrder: number }[];
}
export interface FillBlankContent {
  template: string;
  distractors: string[];
}
// Lesson.content?: MatchContent | SortContent | FillBlankContent | null
```

### Notas de caché (React Query)

Todas las mutaciones de `useAdminCourseDetail.ts` invalidan tanto `['admin', 'course', courseId]` como `['courses', courseId]` (vista del alumno) para que los cambios sean inmediatos sin recargar la página.

### Generación con IA

El agente (`course-generator.service.ts`) puede generar los 3 tipos interactivos junto con VIDEO y QUIZ. Incluye ejemplos de JSON en el prompt y aumenta `max_tokens` a 6000 para el módulo completo.

---

## 16. Sistema de exámenes (Fase 8)

### Modelos de datos

| Modelo         | Descripción                                                                       |
| -------------- | --------------------------------------------------------------------------------- |
| `ExamQuestion` | Pregunta de banco (courseId o moduleId, nunca ambos)                              |
| `ExamAnswer`   | Respuesta con `isCorrect` — nunca expuesto al alumno antes del submit             |
| `ExamAttempt`  | Intento con `questionsSnapshot` (incluye `isCorrect` para corrección server-side) |

### Flujo del alumno

1. Alumno accede a `/my-exams` (sidebar "🎓 Exámenes") → lista de cursos/módulos con banco activo
2. Hace click en "Empezar" → `ExamPage` en estado **Configuración**:
   - Número de preguntas (1–mín(50, disponibles)), por defecto 10
   - Toggle "⏱ Límite de tiempo" (minutos)
   - Toggle "🔒 Respuesta única" (una vez elegida no se puede cambiar)
3. `POST /exams/start` → servidor selecciona preguntas con Fisher-Yates y crea `ExamAttempt` con snapshot
4. Estado **En progreso**: todas las preguntas visibles, barra de progreso, contador regresivo (auto-submit al llegar a 0)
5. `POST /exams/:attemptId/submit` → servidor calcula score desde snapshot, nunca desde cliente
6. Estado **Resultados**: score grande, correcciones por pregunta (texto real de respuestas), historial, botón "⬇️ Descargar PDF"

### Flujo del admin

- Desde `/admin/courses/:id` → botón "🎓 Banco examen" (curso) o "🎓" por módulo → `AdminExamBankPage`
- **Tab Preguntas**: tabla CRUD, modal manual, modal IA (con contexto de curso/módulo)
- **Tab Historial**: intentos de todos los alumnos con nombre, fecha y score
- Generación IA incluye contexto: título del curso, nivel educativo y título del módulo

### Endpoints

```
GET  /exams/available                      → cursos/módulos con banco para el alumno [JWT]
GET  /exams/info?courseId=&moduleId=       → questionCount + últimos 5 intentos [JWT]
POST /exams/start                          → inicia intento (Fisher-Yates shuffle) [JWT]
POST /exams/:attemptId/submit              → entrega y corrección server-side [JWT]
GET  /exams/history?courseId=&moduleId=    → historial propio [JWT]

GET    /admin/exam-questions?courseId=&moduleId=   [ADMIN]
POST   /admin/exam-questions                       [ADMIN]
POST   /admin/exam-questions/generate              [ADMIN]
PATCH  /admin/exam-questions/:id                   [ADMIN]
DELETE /admin/exam-questions/:id                   [ADMIN]
GET    /admin/exam-attempts?courseId=&moduleId=    [ADMIN]
```

### Archivos clave

| Capa          | Archivo                                                                                   |
| ------------- | ----------------------------------------------------------------------------------------- |
| Backend       | `apps/api/src/exams/` — `exams.module.ts`, `exams.service.ts`, `exams.controller.ts`      |
| Backend admin | `apps/api/src/admin/dto/create-exam-question.dto.ts`, `generate-exam-questions.dto.ts`    |
| IA            | `course-generator.service.ts` → `generateExamQuestions()` (incluye contexto curso/módulo) |
| Shared        | `packages/shared/src/types/exam.types.ts`                                                 |
| Frontend      | `apps/web/src/pages/ExamPage.tsx`, `ExamsListPage.tsx`, `admin/AdminExamBankPage.tsx`     |
| PDF           | `apps/web/src/utils/examPdf.ts` — descarga PDF con jsPDF 4.x                              |

### Seguridad clave

- `isCorrect` **nunca** se devuelve al alumno en `GET /exams/info` ni en `POST /exams/start`
- La corrección se hace en servidor desde `questionsSnapshot` (campo JSON en BD), no desde los `ExamAnswer` en tiempo real
- Los textos de respuesta (`selectedAnswerText`, `correctAnswerText`) se incluyen en la corrección final para mostrarlos en pantalla y en el PDF

---

## 17. Certificados digitales (Fase 8.5)

### Tipos de certificado

| Tipo                | Descripción               | Condición                                 |
| ------------------- | ------------------------- | ----------------------------------------- |
| `MODULE_COMPLETION` | Módulo completado         | Alumno completa 100% lecciones del módulo |
| `COURSE_COMPLETION` | Curso completado          | Alumno completa 100% lecciones del curso  |
| `MODULE_EXAM`       | Examen de módulo superado | Score >= 50% en examen de módulo          |
| `COURSE_EXAM`       | Examen de curso superado  | Score >= 50% en examen de curso           |

### Generación automática

- Al completar una lección → `void certificates.checkAndIssueLessonCertificates(userId, lessonId)` en `progress.service.ts`
- Al entregar un examen → `void certificates.issueExamCertificate(userId, attemptId, score)` en `exams.service.ts`
- Idempotente: no se duplica si ya existe el mismo (userId, scope, type)

### Modelo de datos

```prisma
model Certificate {
  id         String          @id @default(cuid())
  userId     String
  courseId   String?
  moduleId   String?
  type       CertificateType
  verifyCode String          @unique @default(cuid())
  examScore  Float?
  issuedAt   DateTime        @default(now())
}
```

### Descarga PDF

- Generada client-side con jsPDF en `apps/web/src/utils/certificatePdf.ts`
- Diseño: banda morada, nombre del alumno en grande, línea dorada decorativa, sello circular, código de verificación

### Verificación pública

`GET /certificates/verify/:code` — devuelve datos del certificado sin JWT (para que terceros puedan verificar autenticidad)

### Frontend

- `CertificatesPage` (`/certificates`) en sidebar solo para STUDENT/TUTOR
- `CoursePage`: banner "Certificado disponible" cuando progreso = 100%
- `ExamPage` (ResultsStep): botón "Descargar certificado" si score >= 50%
- `AdminDashboardPage`: 2 KPIs + sección de certificados recientes

---

## 18. Páginas de marketing (Fase 8.6)

### Rutas públicas (sin autenticación)

| Ruta        | Página        | Descripción                                       |
| ----------- | ------------- | ------------------------------------------------- |
| `/`         | `LandingPage` | Home dirigida a padres/tutores de Vallekas Basket |
| `/nosotros` | `AboutPage`   | Historia del club, equipo fundador, valores       |
| `/precios`  | `PricingPage` | 15 EUR/alumno/mes con FAQ y merchandising         |

### Layout público (`PublicLayout`)

Navbar sticky (`#0d1b2a`, 64px): logo + links (Inicio / Sobre nosotros / Precios) + botón "Acceder" naranja → `/login`. Footer con copyright.

### Enfoque de audiencia

Todas las páginas de marketing están dirigidas a **padres y tutores de Vallekas Basket**, no a otros clubes. El pitch es: _"La formación del club, accesible para tu hijo/a desde casa"_.

### Merchandising en las 3 páginas

Sección "El esfuerzo tiene premio" con los 5 artículos del club y sus costes en puntos, presente en Landing, Sobre nosotros y Precios.

### Enrutamiento

- `/` con usuario autenticado → redirige a `/dashboard`
- El dashboard (antes en `/`) ahora está en `/dashboard`
- `PublicOnlyRoute` redirige a `/dashboard` si ya está autenticado

---

---

## 19. Deployment (Fase 9)

### Arquitectura

| Capa                    | Plataforma                           | Coste                  |
| ----------------------- | ------------------------------------ | ---------------------- |
| `apps/web` (React/Vite) | Vercel                               | Gratis                 |
| `apps/api` (NestJS)     | Railway (Docker)                     | ~$5/mes crédito gratis |
| PostgreSQL              | Railway add-on                       | Incluido en crédito    |
| Redis                   | No desplegado (no usado activamente) | —                      |

### Archivos clave

| Archivo                     | Descripción                                              |
| --------------------------- | -------------------------------------------------------- |
| `vercel.json`               | Build command, outputDirectory y rewrite SPA para Vercel |
| `apps/api/Dockerfile`       | Build en 2 etapas; build context = raíz del repo         |
| `.dockerignore`             | Excluye node_modules, apps/web, dist, .env               |
| `apps/web/src/lib/axios.ts` | `VITE_API_URL` env var → URL absoluta en producción      |
| `apps/api/src/main.ts`      | CORS multi-origen via `FRONTEND_URL` separado por comas  |

### Variables de entorno

| Plataforma | Variable                            | Valor                                             |
| ---------- | ----------------------------------- | ------------------------------------------------- |
| Vercel     | `VITE_API_URL`                      | `https://<api>.up.railway.app/api`                |
| Railway    | `FRONTEND_URL`                      | `https://<app>.vercel.app` (comas para múltiples) |
| Railway    | `DATABASE_URL`                      | auto-linked desde plugin PostgreSQL               |
| Railway    | `NODE_ENV`                          | `production`                                      |
| Railway    | `JWT_SECRET` / `JWT_REFRESH_SECRET` | `openssl rand -hex 32`                            |

### Notas Railway

- **Dockerfile Path:** `apps/api/Dockerfile`
- **Build Context:** `.` (raíz del repo — necesario para copiar `packages/shared`)
- El CMD ejecuta `prisma migrate deploy && node dist/main` — las migraciones corren al arrancar el contenedor, no durante el build (DATABASE_URL no está disponible en build time)

### Notas Vercel

- `vercel.json` en la raíz detectado automáticamente
- El rewrite `/(.*) → /index.html` es obligatorio para que el SPA no devuelva 404 al refrescar rutas
- Sin `VITE_API_URL` definida → `baseURL` cae a `/api` → Vite proxy local (desarrollo sin cambios)

---

## 20. Multi-tenancy (Fase 10)

### Arquitectura

BD compartida con columna discriminadora `academyId`. Profesores y cursos son globales (compartidos entre academias). Alumnos, tutores y admins pertenecen a una academia vía `AcademyMember`.

### Modelos nuevos

| Modelo          | Descripción                                          |
| --------------- | ---------------------------------------------------- |
| `Academy`       | slug, name, logoUrl, primaryColor, domain, isActive  |
| `AcademyMember` | Join table (userId + academyId) — membresía flexible |

### Nuevo rol: `SUPER_ADMIN`

- Gestiona todas las academias
- Puede operar en el contexto de cualquier academia vía header `X-Academy-Id`
- Pasa todas las comprobaciones de rol que incluyan `ADMIN`

### Tablas con `academyId` (scoped)

`Enrollment`, `Booking`, `Redemption`, `UserChallenge`, `BillingConfig`

### Tablas globales (compartidas)

`User`, `Course`, `Module`, `Lesson`, `Quiz`, `Challenge`, `Certificate`, `SchoolYear`, `ExamQuestion`, etc.

### Resolución de academia

1. JWT payload incluye `academyId` (null para SUPER_ADMIN y TEACHER)
2. `AcademyGuard` adjunta `request.academyId` desde JWT o header `X-Academy-Id`
3. Decorador `@CurrentAcademy()` para controllers
4. `JwtStrategy` resuelve la primera membresía del usuario

### Endpoints nuevos

```
GET    /academies/by-slug/:slug   → público (branding)
GET    /academies                 → [SUPER_ADMIN]
GET    /academies/:id             → [SUPER_ADMIN]
POST   /academies                 → [SUPER_ADMIN]
PATCH  /academies/:id             → [SUPER_ADMIN]
GET    /academies/:id/members     → [ADMIN, SUPER_ADMIN]
POST   /academies/:id/members     → [ADMIN, SUPER_ADMIN]
DELETE /academies/:id/members/:userId → [ADMIN, SUPER_ADMIN]
```

### Frontend

- Auth store incluye `academy` con branding dinámico (logo + color)
- Sidebar muestra enlace "Academias" para SUPER_ADMIN
- `AdminAcademiesPage`: crear academias, ver miembros, activar/desactivar
- `AdminRoute` acepta tanto ADMIN como SUPER_ADMIN

### Academias de ejemplo (seed)

| Slug              | Nombre                  |
| ----------------- | ----------------------- |
| `vallekas-basket` | Vallekas Basket Academy |
| `cb-oscar`        | CB Oscar Academy        |

---

## 21. Entorno de pre-producción y pipeline progresivo (Issue #11)

### Objetivo

Replicar un entorno idéntico al de producción (PRE) para validar cada cambio antes de subirlo a PROD. Flujo:

```
push main → tests → deploy PRE → smoke tests PRE → deploy PROD canary → smoke tests PROD → promover 100%
```

### Arquitectura

| Capa          | PRE                           | PROD                      |
| ------------- | ----------------------------- | ------------------------- |
| Web (Vercel)  | proyecto `vkbacademy-web-pre` | proyecto `vkbacademy-web` |
| API (Railway) | servicio `api-pre`            | servicio `api-prod`       |
| PostgreSQL    | BD dedicada en Railway        | BD dedicada en Railway    |

**Crítico:** PRE debe tener su propia BD (nunca compartir con PROD) para evitar que migraciones en pruebas afecten datos reales.

### Pipeline (`.github/workflows/deploy-pipeline.yml`)

| Job                  | Entorno GitHub | Gate              |
| -------------------- | -------------- | ----------------- |
| `test`               | —              | —                 |
| `deploy-pre`         | `pre`          | automático        |
| `smoke-pre`          | `pre`          | automático        |
| `deploy-prod-canary` | `prod-canary`  | required reviewer |
| `smoke-prod-canary`  | `prod-canary`  | automático        |
| `promote-prod`       | `prod`         | required reviewer |

Los environments `prod-canary` y `prod` se configuran en _Settings → Environments → Required reviewers_ para añadir una puerta manual antes de cada promoción.

### Secrets / variables requeridas

**Repository secrets:**

- `RAILWAY_TOKEN`, `RAILWAY_SERVICE_ID_PRE`, `RAILWAY_SERVICE_ID_PROD`
- `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID_PRE`, `VERCEL_PROJECT_ID_PROD`

**Environment vars** (por cada entorno `pre`, `prod-canary`, `prod`):

- `SMOKE_API_URL` — URL absoluta de la API a probar
- `SMOKE_WEB_URL` — URL absoluta del frontend a probar

### Smoke tests (`apps/api/test/smoke/`)

Suite independiente que hace peticiones HTTP con `fetch` nativo contra un entorno desplegado. No arranca Nest ni toca BD. Cobertura:

- `GET /api/health` → 200 con `{status: 'ok'}`
- `GET /api/courses` sin token → 401 (guard activo)
- `POST /api/auth/login` con credenciales falsas → 401 (validación activa)
- `GET /api/academies/by-slug/vallekas-basket` → 200 o 404 (no 5xx)
- `GET /` (web) → HTML del SPA con `<div id="root">`
- `GET /ruta-inexistente` → HTML (rewrite SPA de Vercel)

Ejecución local: `SMOKE_API_URL=... SMOKE_WEB_URL=... pnpm --filter @vkbacademy/api test:smoke`

### Health endpoint (`apps/api/src/health/`)

`GET /api/health` devuelve `{ status, timestamp, uptime, node, env }`. **No consulta BD** — un fallo de Postgres no debe tumbar la probe de readiness. Cubierto por `health.controller.spec.ts`.

### Workflow red/green TDD aplicado

La Issue #11 se implementó en ciclos rojo/verde:

1. **RED**: `health.controller.spec.ts` falla (controlador no existe)
2. **GREEN**: se crea `health.controller.ts` y se registra en `HealthModule` → tests pasan
3. **RED**: smoke tests fallan contra cualquier URL sin `/api/health`
4. **GREEN**: health endpoint desplegado → smoke tests pasan en PRE → pipeline promueve a PROD

### Promoción progresiva

- **Railway** usa _rolling update_ entre replicas: el nuevo deployment se rota gradualmente.
- **Vercel** hace switch instantáneo pero mantiene la versión previa 24h (_skew protection_) → rollback con un click desde el dashboard.
- Para un canary más fino (10% → 50% → 100%) hay que mover Railway a Pro y activar _Deployment Stages_ con traffic splitting.

---

_Última actualización: Abril 2026 — Fase 10.5 (Entorno PRE + pipeline progresivo) completada_
