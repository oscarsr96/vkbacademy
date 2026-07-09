-- ─────────────────────────────────────────────────────────────────────────────
-- Migración DESTRUCTIVA A PROPÓSITO (decisión de producto, 09/07/2026):
-- el flujo de estudio un-tema (StudyUnit) se elimina por completo, código Y
-- datos. El flujo único pasa a ser StudyPlan (acepta desde 1 tema).
--
-- Orden: primero limpieza de datos del flujo un-tema, después el DDL.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Limpieza de datos.
-- ExamAttempt.aiExamBankId es ON DELETE SET NULL en BD: los intentos de bancos
-- un-tema NO caerían en cascada, así que se borran explícitamente antes.
DELETE FROM "ExamAttempt"
WHERE "aiExamBankId" IN (SELECT "id" FROM "AiExamBank" WHERE "studyUnitId" IS NOT NULL);

-- Bancos de examen del flujo un-tema. Sus AiExamQuestion/AiExamAnswer sí caen
-- en cascada (FKs ON DELETE CASCADE en BD).
DELETE FROM "AiExamBank" WHERE "studyUnitId" IS NOT NULL;

-- Teorías del flujo un-tema. Sus TheoryLesson caen en cascada.
DELETE FROM "TheoryModule" WHERE "studyUnitId" IS NOT NULL;

-- 2) DDL (generado con `prisma migrate diff`, nombres canónicos de constraints).

-- DropForeignKey
ALTER TABLE "TheoryModule" DROP CONSTRAINT "TheoryModule_studyUnitId_fkey";

-- DropForeignKey
ALTER TABLE "AiExamBank" DROP CONSTRAINT "AiExamBank_studyUnitId_fkey";

-- DropForeignKey
ALTER TABLE "StudyUnit" DROP CONSTRAINT "StudyUnit_userId_fkey";

-- DropForeignKey
ALTER TABLE "StudyUnit" DROP CONSTRAINT "StudyUnit_courseId_fkey";

-- DropIndex
DROP INDEX "TheoryModule_studyUnitId_key";

-- DropIndex
DROP INDEX "AiExamBank_studyUnitId_key";

-- AlterTable
ALTER TABLE "TheoryModule" DROP COLUMN "studyUnitId";

-- AlterTable
ALTER TABLE "AiExamBank" DROP COLUMN "studyUnitId";

-- DropTable
DROP TABLE "StudyUnit";
