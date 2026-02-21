-- Añadir nuevos valores al enum LessonType
ALTER TYPE "LessonType" ADD VALUE 'MATCH';
ALTER TYPE "LessonType" ADD VALUE 'SORT';
ALTER TYPE "LessonType" ADD VALUE 'FILL_BLANK';

-- Añadir campo content para lecciones interactivas
ALTER TABLE "Lesson" ADD COLUMN "content" JSONB;
