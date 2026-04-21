# Fase 7.5 — Lecciones interactivas

## Tipos implementados

| Tipo         | Icono | Descripción                 | Estructura `content`                          |
| ------------ | ----- | --------------------------- | --------------------------------------------- |
| `MATCH`      | 🔗    | Emparejar dos columnas      | `{ pairs: [{ left, right }] }`                |
| `SORT`       | ↕️    | Ordenar una lista           | `{ prompt, items: [{ text, correctOrder }] }` |
| `FILL_BLANK` | ✏️    | Rellenar huecos en un texto | `{ template, distractors }`                   |

## Formato del campo `template` (FILL_BLANK)

Las palabras correctas se marcan con dobles llaves: `"El {{triple}} vale {{3}} puntos."`. El componente extrae las palabras correctas, genera el banco mezclando correctas + distractors, y el alumno arrastra o hace click para colocar cada palabra en su hueco.

## Flujo de creación (admin)

1. Admin abre `/admin/courses/:id` → módulo → "+ Añadir lección" → tipo MATCH/SORT/FILL_BLANK
2. La lección se crea en BD con `content = null`
3. Admin hace click en "⚡ Contenido" → modal de edición según el tipo
4. Al guardar, `PATCH /admin/lessons/:lessonId` con `{ content: {...} }` actualiza el campo JSON

## Flujo del alumno

1. CoursePage lista la lección con el icono correspondiente (🔗 / ↕️ / ✏️)
2. LessonPage renderiza el componente interactivo (`MatchLesson`, `SortLesson`, `FillBlankLesson`)
3. Si `content` es null → se muestra "Actividad no configurada" (placeholder)
4. El botón "Marcar como completada" está deshabilitado hasta resolver correctamente la actividad
5. Al completarla → `POST /lessons/:id/complete` → se disparan los hooks de gamificación

## Componentes React

- `apps/web/src/components/lessons/MatchLesson.tsx` — click-to-pair con verificación
- `apps/web/src/components/lessons/SortLesson.tsx` — drag & drop nativo HTML5
- `apps/web/src/components/lessons/FillBlankLesson.tsx` — banco de palabras click-to-place

## Tipos compartidos (`packages/shared/src/types/course.types.ts`)

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

## Notas de caché (React Query)

Todas las mutaciones de `useAdminCourseDetail.ts` invalidan tanto `['admin', 'course', courseId]` como `['courses', courseId]` (vista del alumno) para que los cambios sean inmediatos sin recargar la página.

## Generación con IA

El agente (`course-generator.service.ts`) puede generar los 3 tipos interactivos junto con VIDEO y QUIZ. Incluye ejemplos de JSON en el prompt y aumenta `max_tokens` a 6000 para el módulo completo.
