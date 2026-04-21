# Fase 6 — Panel de administración

## Páginas implementadas

| Ruta                  | Página                                                                                | Estado |
| --------------------- | ------------------------------------------------------------------------------------- | ------ |
| `/admin`              | Dashboard con analytics                                                               | ✅     |
| `/admin/users`        | Gestión de usuarios (CRUD)                                                            | ✅     |
| `/admin/courses`      | Gestión de cursos (CRUD + IA) — 6 tipos de lección incluyendo MATCH, SORT, FILL_BLANK | ✅     |
| `/admin/billing`      | Facturación y costes                                                                  | ✅     |
| `/admin/challenges`   | Gestión de retos (CRUD + toggle)                                                      | ✅     |
| `/admin/redemptions`  | Registro de canjes + marcar entregado                                                 | ✅     |
| `/admin/certificates` | Certificados emitidos + emisión manual                                                | ✅     |

## Dashboard analytics — filtros disponibles

- Período: presets (7d / 30d / 3m / 6m / 1a) o rango personalizado
- Agrupación temporal: día / semana / mes
- Filtro por nivel educativo (schoolYear)
- Filtro por curso

## Dashboard analytics — métricas incluidas

- **KPIs**: nuevos alumnos, matrículas, lecciones completadas, intentos de quiz, score medio, reservas creadas, confirmadas, canceladas
- **Serie temporal SVG**: lecciones completadas, intentos de quiz, reservas, nuevos alumnos
- **Top 5 cursos** por matrículas en el período (con nivel educativo)
- **Top 5 alumnos** por lecciones completadas (con score medio de quiz y barras de progreso)
- **Desglose de reservas**: por estado (CONFIRMED/PENDING/CANCELLED) y por modalidad (IN_PERSON/ONLINE)
- **2 KPIs adicionales**: certificados emitidos (total) y cursos completados (certificados COURSE_COMPLETION)
- **Sección Certificados**: 4 mini-KPIs por tipo + tabla reciente de certificados

## Gestión de cursos (`/admin/courses`)

- Listado paginado con búsqueda y filtro por nivel educativo
- Editor en árbol: curso → módulos → lecciones → quiz + preguntas
- Tipos de lección: VIDEO, QUIZ, EXERCISE, MATCH (emparejar), SORT (ordenar), FILL_BLANK (rellenar huecos)
- Botón ⚡ Contenido por lección interactiva para configurar la actividad (pares, items u oraciones con huecos)
- Generación IA de lecciones MATCH, SORT y FILL_BLANK con estructura JSON incluida
