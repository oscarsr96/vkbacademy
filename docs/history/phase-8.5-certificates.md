# Fase 8.5 — Certificados digitales

## Tipos de certificado

| Tipo                | Descripción               | Condición                                 |
| ------------------- | ------------------------- | ----------------------------------------- |
| `MODULE_COMPLETION` | Módulo completado         | Alumno completa 100% lecciones del módulo |
| `COURSE_COMPLETION` | Curso completado          | Alumno completa 100% lecciones del curso  |
| `MODULE_EXAM`       | Examen de módulo superado | Score >= 50% en examen de módulo          |
| `COURSE_EXAM`       | Examen de curso superado  | Score >= 50% en examen de curso           |

## Generación automática

- Al completar una lección → `void certificates.checkAndIssueLessonCertificates(userId, lessonId)` en `progress.service.ts`
- Al entregar un examen → `void certificates.issueExamCertificate(userId, attemptId, score)` en `exams.service.ts`
- Idempotente: no se duplica si ya existe el mismo (userId, scope, type)

## Modelo de datos

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

## Descarga PDF

- Generada client-side con jsPDF en `apps/web/src/utils/certificatePdf.ts`
- Diseño: banda morada, nombre del alumno en grande, línea dorada decorativa, sello circular, código de verificación

## Verificación pública

`GET /certificates/verify/:code` — devuelve datos del certificado sin JWT (para que terceros puedan verificar autenticidad)

## Frontend

- `CertificatesPage` (`/certificates`) en sidebar solo para STUDENT/TUTOR
- `CoursePage`: banner "Certificado disponible" cuando progreso = 100%
- `ExamPage` (ResultsStep): botón "Descargar certificado" si score >= 50%
- `AdminDashboardPage`: 2 KPIs + sección de certificados recientes
