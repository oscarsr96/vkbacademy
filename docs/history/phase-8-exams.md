# Fase 8 — Sistema de exámenes

## Modelos de datos

| Modelo         | Descripción                                                                       |
| -------------- | --------------------------------------------------------------------------------- |
| `ExamQuestion` | Pregunta de banco (courseId o moduleId, nunca ambos)                              |
| `ExamAnswer`   | Respuesta con `isCorrect` — nunca expuesto al alumno antes del submit             |
| `ExamAttempt`  | Intento con `questionsSnapshot` (incluye `isCorrect` para corrección server-side) |

## Flujo del alumno

1. Alumno accede a `/my-exams` (sidebar "🎓 Exámenes") → lista de cursos/módulos con banco activo
2. Hace click en "Empezar" → `ExamPage` en estado **Configuración**:
   - Número de preguntas (1–mín(50, disponibles)), por defecto 10
   - Toggle "⏱ Límite de tiempo" (minutos)
   - Toggle "🔒 Respuesta única" (una vez elegida no se puede cambiar)
3. `POST /exams/start` → servidor selecciona preguntas con Fisher-Yates y crea `ExamAttempt` con snapshot
4. Estado **En progreso**: todas las preguntas visibles, barra de progreso, contador regresivo (auto-submit al llegar a 0)
5. `POST /exams/:attemptId/submit` → servidor calcula score desde snapshot, nunca desde cliente
6. Estado **Resultados**: score grande, correcciones por pregunta (texto real de respuestas), historial, botón "⬇️ Descargar PDF"

## Flujo del admin

- Desde `/admin/courses/:id` → botón "🎓 Banco examen" (curso) o "🎓" por módulo → `AdminExamBankPage`
- **Tab Preguntas**: tabla CRUD, modal manual, modal IA (con contexto de curso/módulo)
- **Tab Historial**: intentos de todos los alumnos con nombre, fecha y score
- Generación IA incluye contexto: título del curso, nivel educativo y título del módulo

## Endpoints

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

## Archivos clave

| Capa          | Archivo                                                                                   |
| ------------- | ----------------------------------------------------------------------------------------- |
| Backend       | `apps/api/src/exams/` — `exams.module.ts`, `exams.service.ts`, `exams.controller.ts`      |
| Backend admin | `apps/api/src/admin/dto/create-exam-question.dto.ts`, `generate-exam-questions.dto.ts`    |
| IA            | `course-generator.service.ts` → `generateExamQuestions()` (incluye contexto curso/módulo) |
| Shared        | `packages/shared/src/types/exam.types.ts`                                                 |
| Frontend      | `apps/web/src/pages/ExamPage.tsx`, `ExamsListPage.tsx`, `admin/AdminExamBankPage.tsx`     |
| PDF           | `apps/web/src/utils/examPdf.ts` — descarga PDF con jsPDF 4.x                              |

## Seguridad clave

- `isCorrect` **nunca** se devuelve al alumno en `GET /exams/info` ni en `POST /exams/start`
- La corrección se hace en servidor desde `questionsSnapshot` (campo JSON en BD), no desde los `ExamAnswer` en tiempo real
- Los textos de respuesta (`selectedAnswerText`, `correctAnswerText`) se incluyen en la corrección final para mostrarlos en pantalla y en el PDF
