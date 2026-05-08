-- Reemplaza ChallengeType: quita retos ligados a lecciones/módulos/cursos/clases,
-- añade retos de Ejercicios, Teoría y Exámenes.

-- 1. Borrar progreso de usuarios y retos existentes (incompatibles con nuevo enum)
DELETE FROM "UserChallenge";
DELETE FROM "Challenge";

-- 2. Recrear el enum (Postgres no permite quitar valores in-place)
ALTER TYPE "ChallengeType" RENAME TO "ChallengeType_old";

CREATE TYPE "ChallengeType" AS ENUM (
  'EXERCISE_COMPLETED',
  'EXERCISE_SCORE',
  'THEORY_COMPLETED',
  'EXAM_COMPLETED',
  'EXAM_SCORE',
  'STREAK_WEEKLY',
  'TOTAL_HOURS_EXERCISE',
  'TOTAL_HOURS_THEORY',
  'TOTAL_HOURS_EXAM'
);

ALTER TABLE "Challenge"
  ALTER COLUMN "type" TYPE "ChallengeType"
  USING "type"::text::"ChallengeType";

DROP TYPE "ChallengeType_old";
