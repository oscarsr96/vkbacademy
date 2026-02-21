# VKBacademy

Plataforma educativa web y móvil para el club de baloncesto **Vallekas Basket**. Los jugadores acceden a cursos con vídeos, ejercicios interactivos (emparejar, ordenar, rellenar huecos) y tests; los tutores (padres/responsables) gestionan las reservas de clases particulares con los profesores; los administradores disponen de un panel completo con analytics en tiempo real.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Web frontend | React 18 + Vite 6 + TypeScript |
| Mobile | React Native + Expo SDK 51 |
| Backend | NestJS 10 + TypeScript |
| Base de datos | PostgreSQL 16 |
| ORM | Prisma 5 |
| Caché | Redis 7 |
| Auth | JWT + Refresh tokens (implementación propia) |
| Almacenamiento vídeo | AWS S3 + URLs firmadas (1 h) |
| Email transaccional | Resend |
| Videollamadas | Daily.co |
| Estado global (web) | Zustand 5 |
| Data fetching | TanStack Query v5 |
| Monorepo | Turborepo + pnpm workspaces |

---

## Roles

| Rol | Descripción |
|-----|-------------|
| `STUDENT` | Accede a cursos de su nivel, realiza tests, ve sus reservas (solo lectura) |
| `TUTOR` | Gestiona reservas en nombre de sus alumnos asignados |
| `TEACHER` | Gestiona cursos donde es autor, fija su disponibilidad, confirma/cancela reservas |
| `ADMIN` | Acceso completo: CRUD usuarios, cursos, contenido con IA y analytics avanzado |

---

## Inicio rápido

### Requisitos

- Node.js 20+
- pnpm 9+ → `npm install -g pnpm`
- Docker Desktop

### 1. Instalar dependencias

```bash
git clone <repo-url> vkbacademy
cd vkbacademy
pnpm install
```

### 2. Variables de entorno

Crea `apps/api/.env`:

```env
# Base de datos
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/vkbacademy"
REDIS_URL="redis://localhost:6379"

# JWT
JWT_SECRET="cambia_esto_en_produccion"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_SECRET="cambia_esto_en_produccion_refresh"
JWT_REFRESH_EXPIRES_IN="7d"

# AWS S3
AWS_REGION="eu-west-1"
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""
AWS_S3_BUCKET=""
AWS_SIGNED_URL_EXPIRES=3600

# Email (Resend)
RESEND_API_KEY=""
EMAIL_FROM="noreply@tuclub.com"

# Videollamadas (Daily.co)
DAILY_API_KEY=""

# App
PORT=3001
FRONTEND_URL="http://localhost:5173"
NODE_ENV="development"
```

### 3. Infraestructura local

```bash
docker compose up -d          # PostgreSQL 16 en :5432 + Redis 7 en :6379
```

### 4. Base de datos

```bash
pnpm --filter @vkbacademy/api exec prisma migrate dev
pnpm --filter @vkbacademy/api exec prisma db seed
```

Usuarios creados por el seed:

| Email | Contraseña | Rol |
|-------|-----------|-----|
| `admin@vkbacademy.com` | `password123` | ADMIN |
| `teacher@vkbacademy.com` | `password123` | TEACHER |
| `oscar.sanchez@egocogito.com` | `password123` | TUTOR |
| `student@vkbacademy.com` | `password123` | STUDENT (3º ESO) |

### 5. Arrancar en desarrollo

```bash
pnpm dev
```

| App | URL |
|-----|-----|
| API (NestJS) | http://localhost:3001/api |
| Web (Vite) | http://localhost:5173 |
| Mobile (Expo) | Escanea el QR con Expo Go |

---

## Estructura del proyecto

```
/
├── apps/
│   ├── api/                  # NestJS
│   │   ├── prisma/           # schema.prisma + seed.ts + migraciones
│   │   └── src/
│   │       ├── auth/          # JWT, refresh tokens, guards, decoradores
│   │       ├── users/         # Perfiles de usuario
│   │       ├── courses/       # Cursos, módulos, lecciones, progreso
│   │       ├── quizzes/       # Tests, corrección en servidor
│   │       ├── progress/      # Progreso por lección
│   │       ├── bookings/      # Reservas + Daily.co
│   │       ├── availability/  # Slots de disponibilidad del profesor
│   │       ├── tutors/        # Alumnos asignados a un tutor
│   │       ├── media/         # S3 upload + URLs firmadas
│   │       ├── notifications/ # Emails transaccionales (Resend)
│   │       ├── school-years/  # Niveles educativos
│   │       ├── exams/         # Bancos de examen por curso/módulo, corrección server-side
│   │       ├── certificates/  # Certificados digitales con verificación pública
│   │       ├── admin/         # CRUD usuarios, cursos, analytics, bancos de examen, certificados
│   │       └── challenges/    # Gamificación: retos, insignias, canjes
│   ├── web/                  # React + Vite
│   │   └── src/
│   │       ├── api/          # Clientes HTTP (admin.api.ts, challenges.api.ts, certificates.api.ts…)
│   │       ├── hooks/        # React Query hooks
│   │       ├── layouts/      # AppLayout (sidebar por rol) + PublicLayout (marketing)
│   │       ├── pages/
│   │       │   ├── admin/    # AdminDashboardPage, AdminUsersPage, AdminCoursesPage,
│   │       │   │             # AdminChallengesPage, AdminRedemptionsPage, AdminBillingPage,
│   │       │   │             # AdminExamBankPage
│   │       │   ├── marketing/           # LandingPage, AboutPage, PricingPage (públicas)
│   │       │   ├── CertificatesPage.tsx # Mis certificados + descarga PDF
│   │       │   ├── ExamsListPage.tsx    # Lista de bancos disponibles para el alumno
│   │       │   ├── ExamPage.tsx         # Flujo completo: config → examen → resultados + PDF
│   │       │   ├── ChallengesPage.tsx   # Retos + tienda de merchandising
│   │       │   ├── BookingsPage.tsx
│   │       │   ├── CoursesPage.tsx
│   │       │   └── …
│   │       └── utils/
│   │           ├── certificatePdf.ts    # PDF de certificados con jsPDF
│   │           ├── examPdf.ts           # Generación de PDF con jsPDF
│   │           └── quizPdf.ts           # PDF para resultados de quiz
│   │       └── store/        # Zustand (auth)
│   └── mobile/               # React Native + Expo Router
└── packages/
    └── shared/               # Tipos TypeScript compartidos
```

---

## API — Endpoints principales

### Auth
```
POST /auth/register
POST /auth/login      → { accessToken, refreshToken }
POST /auth/refresh
POST /auth/logout
```

### Cursos y lecciones
```
GET  /courses                   → lista paginada (STUDENT: filtrada por nivel)
GET  /courses/:id               → detalle con módulos
GET  /courses/:id/progress      → progreso del usuario autenticado
GET  /lessons/:id               → detalle de lección
                                  (incluye campo `content` para lecciones interactivas)
POST /lessons/:id/complete      → marcar lección como completada
POST /media/upload-url          → presigned URL para subir vídeo a S3 [TEACHER, ADMIN]
GET  /media/view-url/:key       → URL firmada para reproducir vídeo
```

### Tests
```
GET  /quizzes/:id               → preguntas SIN isCorrect
POST /quizzes/:id/submit        → respuestas → { score, correcciones }
GET  /quizzes/:id/attempts      → historial de intentos
```

### Reservas
```
GET  /teachers                            → lista de profesores con disponibilidad
GET  /teachers/:id/slots?from=&to=        → slots libres en rango
POST /bookings                            → crear reserva [TUTOR, ADMIN]
PATCH /bookings/:id/confirm               → confirmar [TEACHER, ADMIN]
PATCH /bookings/:id/cancel                → cancelar [TUTOR, TEACHER, ADMIN]
GET  /bookings/mine                       → mis reservas (filtrado por rol)
GET  /availability/mine                   → mis slots [TEACHER]
POST /availability                        → añadir slot [TEACHER, ADMIN]
DELETE /availability/:id                  → eliminar slot [TEACHER, ADMIN]
```

### Tutores
```
GET /tutors/my-students                   → alumnos del tutor [TUTOR, ADMIN]
GET /tutors/my-students/:id/courses       → cursos del alumno [TUTOR, ADMIN]
```

### Tipos de lección

| Tipo | Icono | Descripción |
|------|-------|-------------|
| `VIDEO` | 🎬 | Vídeo de YouTube embebido |
| `QUIZ` | 📝 | Test de preguntas y respuestas (corregido en servidor) |
| `EXERCISE` | 💪 | Ejercicio libre (próximamente) |
| `MATCH` | 🔗 | Emparejar dos columnas — alumno conecta pares correctos |
| `SORT` | ↕️ | Ordenar lista — drag & drop para ordenar correctamente |
| `FILL_BLANK` | ✏️ | Rellenar huecos — banco de palabras click-to-place |

Las lecciones interactivas (MATCH, SORT, FILL_BLANK) bloquean el botón "Marcar como completada" hasta que el alumno resuelva correctamente la actividad.

### Exámenes
```
GET  /exams/available                       → cursos/módulos con banco para el alumno [JWT]
GET  /exams/info?courseId=&moduleId=        → questionCount + últimos 5 intentos [JWT]
POST /exams/start                           → inicia intento con preguntas aleatorias [JWT]
POST /exams/:attemptId/submit              → entrega y corrección server-side [JWT]
GET  /exams/history?courseId=&moduleId=    → historial propio [JWT]
```

### Admin
```
GET    /admin/users
POST   /admin/users
PATCH  /admin/users/:id
PATCH  /admin/users/:id/role
PATCH  /admin/users/:id/tutor
DELETE /admin/users/:id
GET    /admin/courses?page=&limit=&schoolYearId=&search=
GET    /admin/courses/:courseId/detail
POST   /admin/courses/generate              → generación con IA
DELETE /admin/courses/:id
GET    /admin/analytics?from=&to=&granularity=day|week|month&courseId=&schoolYearId=
GET    /admin/metrics
GET    /admin/billing?from=&to=
PATCH  /admin/billing/config
GET    /admin/challenges
POST   /admin/challenges
PATCH  /admin/challenges/:id
DELETE /admin/challenges/:id
PATCH  /admin/challenges/:id/toggle
GET    /admin/redemptions
PATCH  /admin/redemptions/:id/deliver
GET    /admin/exam-questions?courseId=&moduleId=
POST   /admin/exam-questions
POST   /admin/exam-questions/generate       → generación IA con contexto curso/módulo
PATCH  /admin/exam-questions/:id
DELETE /admin/exam-questions/:id
GET    /admin/exam-attempts?courseId=&moduleId=
GET    /admin/certificates                  → todos los certificados emitidos
POST   /admin/certificates                  → emisión manual (body: userId, courseId?, moduleId?, type)
```

### Gamificación (Retos)
```
GET  /challenges            → retos activos con progreso del usuario [JWT]
GET  /challenges/summary    → totalPoints, currentStreak, longestStreak, recentBadges [JWT]
POST /challenges/redeem     → body: { itemName, cost } — canjear puntos por merchandising [JWT]
```

### Certificados
```
GET  /certificates               → mis certificados [JWT]
GET  /certificates/:id           → un certificado por ID [JWT]
GET  /certificates/verify/:code  → verificación pública (sin JWT)
```

---

## Panel de administración (`/admin`)

### Dashboard analytics

Filtros: período (presets 7d/30d/3m/6m/1a o rango personalizado), agrupación día/semana/mes, nivel educativo y curso.

- **8 KPIs**: nuevos alumnos, matrículas, lecciones completadas, intentos de quiz, score medio, reservas creadas, confirmadas, canceladas
- **Gráfico de líneas SVG** con 4 series temporales (sin librerías externas)
- **Top 5 cursos** por matrículas con barras de progreso
- **Top 5 alumnos** por actividad con score medio
- **Desglose de reservas** por estado (CONFIRMED/PENDING/CANCELLED) y modalidad (IN_PERSON/ONLINE)

### Gestión de usuarios (`/admin/users`)

- Tabla con búsqueda y filtro por rol
- Cambio de rol inline, asignación de tutor inline para alumnos
- Modal de creación: cuando el rol es STUDENT, permite seleccionar un tutor existente **o crear uno nuevo inline** (nombre, email, contraseña) sin salir del modal
- Edición y eliminación con confirmación inline en la propia fila

### Gestión de cursos (`/admin/courses`)

- Listado paginado con búsqueda y filtro por nivel educativo
- Editor en árbol: curso → módulos → lecciones → quiz + preguntas
- **6 tipos de lección**: VIDEO (YouTube embed), QUIZ (test), EXERCISE, MATCH (emparejar columnas), SORT (ordenar lista), FILL_BLANK (rellenar huecos)
- Botón **⚡ Contenido** por cada lección interactiva para configurar pares, items u oraciones con huecos
- Generación con IA (Claude Sonnet) para cursos, módulos, lecciones (incluidos tipos MATCH/SORT/FILL_BLANK) y preguntas individuales
- Los cambios en el admin invalidan automáticamente la caché del alumno (sin necesidad de recargar la página)

### Facturación (`/admin/billing`)

- Ingresos estimados: suscripciones de alumnos + comisión sobre clases
- Costes estimados: Resend, Daily.co, S3, Anthropic, infraestructura
- Margen neto con filtro de período personalizable
- Configuración de tarifas y costes editable por el admin

### Retos (`/admin/challenges`)

- Tabla de retos con tipo, objetivo, puntos, completados y estado activo/inactivo
- Toggle activo/inactivo inline sin recargar la página
- Modal de creación y edición con selector de tipo, icono emoji y color de insignia

### Canjes (`/admin/redemptions`)

- Historial completo de todos los canjes de puntos de los alumnos
- KPIs: total canjes, pendientes de entrega (resaltados en amarillo), puntos gastados, alumnos distintos
- Botón "Marcar entregado" por cada canje pendiente con registro de fecha de entrega

---

## Flujo de reservas

```
Tutor
  → selecciona alumno
  → elige profesor (slots en tiempo real)
  → elige fecha/hora
  → indica curso, modalidad (presencial / online) y notas
  → crea reserva  ───────────────────→  email al profesor

Profesor confirma
  → si ONLINE: sala Daily.co creada automáticamente
  → email a tutor + alumno con enlace de videollamada

Cancelación (tutor, profesor o admin)
  → sala Daily.co eliminada si era ONLINE
  → email a las demás partes
```

---

## Comandos útiles

```bash
# Desarrollo
pnpm dev
pnpm --filter @vkbacademy/api dev       # Solo API
pnpm --filter @vkbacademy/web dev       # Solo web

# Base de datos
pnpm --filter @vkbacademy/api exec prisma migrate dev --name <nombre>
pnpm --filter @vkbacademy/api exec prisma studio
pnpm --filter @vkbacademy/api exec prisma db seed

# Docker
docker compose up -d
docker compose down -v   # Resetea la BD

# Build
pnpm build

# Tests
pnpm test
pnpm test:e2e
```

## Gamificación

El sistema de retos fideliza a los alumnos mediante puntos e insignias obtenidos al completar acciones dentro de la plataforma.

### Tipos de reto

| Tipo | Descripción |
|------|-------------|
| `LESSON_COMPLETED` | Completa N lecciones en total |
| `MODULE_COMPLETED` | Completa N módulos enteros |
| `COURSE_COMPLETED` | Completa N cursos completos |
| `QUIZ_SCORE` | Consigue ≥ N% en cualquier quiz |
| `BOOKING_ATTENDED` | Asiste a N clases confirmadas |
| `STREAK_WEEKLY` | Mantén una racha activa de N semanas consecutivas |
| `TOTAL_HOURS` | Acumula N horas de estudio |

### Racha semanal

La racha (`currentStreak`) se calcula por semana ISO. Cada vez que el alumno completa una lección, quiz o clase en una semana distinta a la anterior, la racha aumenta. Si hay un salto de más de una semana, la racha se reinicia a 1.

### Tienda de merchandising (`/challenges`)

Los alumnos pueden canjear sus puntos acumulados por artículos del club. Cada canje es atómico (se descuentan puntos y se registra el canje en la misma transacción). Los administradores gestionan las entregas físicas desde `/admin/redemptions`.

### Visibilidad por rol

| Ruta | STUDENT | TUTOR | TEACHER | ADMIN |
|------|---------|-------|---------|-------|
| `/challenges` | ✅ | ✅ | ❌ | ❌ |
| `/my-exams` | ✅ | ❌ | ❌ | ❌ |
| `/admin/challenges` | ❌ | ❌ | ❌ | ✅ |
| `/admin/redemptions` | ❌ | ❌ | ❌ | ✅ |
| `/admin/exam-banks` | ❌ | ❌ | ❌ | ✅ |

---

## Sistema de exámenes

Cada curso y módulo puede tener un banco de preguntas independiente de los quizzes de lección. El alumno configura el examen (número de preguntas, límite de tiempo, respuesta única) y se corrige enteramente en servidor.

### Flujo del alumno

1. **`/my-exams`** — lista todos los bancos disponibles con el último score
2. **Configuración** — nº preguntas (1-50), timer opcional, respuesta única opcional
3. **Examen** — preguntas seleccionadas aleatoriamente (Fisher-Yates), barra de progreso, cuenta atrás con auto-submit
4. **Resultados** — score, correcciones con texto real de respuestas, historial de intentos
5. **PDF** — botón "⬇️ Descargar PDF" genera un informe detallado con jsPDF

### Flujo del admin

- Desde `/admin/courses/:id` → botón "🎓 Banco examen" por curso o módulo
- **Tab Preguntas**: añadir manualmente o generar con IA (incluye contexto de curso, nivel y módulo)
- **Tab Historial**: intentos de todos los alumnos con score

### Seguridad

- `isCorrect` **nunca** se devuelve al alumno antes del submit
- La corrección se realiza desde el `questionsSnapshot` almacenado en BD, no desde los `ExamAnswer` en tiempo real

---

## Estado del proyecto

| Fase | Descripción | Estado |
|------|-------------|--------|
| 0 | Setup monorepo, Docker, Prisma | ✅ |
| 1 | Autenticación y roles (STUDENT, TUTOR, TEACHER, ADMIN) | ✅ |
| 2 | Cursos, módulos, vídeos, niveles educativos | ✅ |
| 3 | Tests, corrección en servidor, progreso | ✅ |
| 4 | Sistema de reservas + rol TUTOR + Daily.co | ✅ |
| 5 | Notificaciones por email (Resend) | ✅ |
| 6 | Panel de administración completo (analytics, usuarios, cursos, facturación) | ✅ |
| 7 | Gamificación (retos, insignias, racha, tienda de merchandising) | ✅ |
| 7.5 | Lecciones interactivas (MATCH emparejar, SORT ordenar, FILL_BLANK rellenar huecos) | ✅ |
| 8 | Sistema de exámenes por curso y módulo (con PDF descargable) | ✅ |
| 8.5 | Certificados digitales descargables (completar módulo/curso, aprobar examen) | ✅ |
| 8.6 | Páginas de marketing públicas (Landing, Sobre nosotros, Precios) | ✅ |
| 9 | App móvil (Expo) | ⬜ Pendiente |
| 10 | Testing (unit + e2e) | ⬜ Pendiente |
| 11 | Deployment | ⬜ Pendiente |

---

## Certificados digitales

Los certificados se generan automáticamente al completar módulos/cursos o aprobar exámenes (score ≥ 50%). Cada certificado tiene un código único de verificación pública accesible sin autenticación.

| Tipo | Condición |
|------|-----------|
| `MODULE_COMPLETION` | 100% lecciones del módulo completadas |
| `COURSE_COMPLETION` | 100% lecciones del curso completadas |
| `MODULE_EXAM` | Examen de módulo con score ≥ 50% |
| `COURSE_EXAM` | Examen de curso con score ≥ 50% |

Los alumnos descargan sus certificados en PDF desde `/certificates`. El admin puede emitir certificados manualmente desde el dashboard.

---

## Páginas públicas de marketing

Accesibles sin autenticación, dirigidas a **padres y tutores de Vallekas Basket**:

| URL | Página |
|-----|--------|
| `/` | Landing — "El entrenamiento de tu hijo/a, también en casa" |
| `/nosotros` | Historia del club, equipo fundador, valores |
| `/precios` | €15/alumno/mes, FAQ para familias, merchandising del club |

Si el usuario ya está autenticado y visita `/`, se redirige automáticamente a `/dashboard`.

---

*Última actualización: Febrero 2026 — Fases 8.5 (Certificados) y 8.6 (Marketing) completadas*
