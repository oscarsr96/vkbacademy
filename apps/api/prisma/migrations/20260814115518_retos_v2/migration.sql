/*
  Warnings:

  - The values [EXERCISE_COMPLETED,EXERCISE_SCORE,TOTAL_HOURS_EXERCISE,TOTAL_HOURS_THEORY,TOTAL_HOURS_EXAM] on the enum `ChallengeType` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[userId,challengeId,periodKey]` on the table `UserChallenge` will be added. If there are existing duplicate values, this will fail.

*/

-- Retos v2: los tipos EXERCISE_COMPLETED, EXERCISE_SCORE y TOTAL_HOURS_*
-- desaparecen del enum. Postgres no permite quitar un valor mientras haya
-- filas que lo usen, así que se borran primero los retos de esos tipos y
-- su progreso. Los puntos ya concedidos se quedan en User.totalPoints:
-- no hay clawback (decisión D9 del diseño).
DELETE FROM "UserChallenge"
WHERE "challengeId" IN (
  SELECT "id" FROM "Challenge"
  WHERE "type" IN (
    'EXERCISE_COMPLETED', 'EXERCISE_SCORE',
    'TOTAL_HOURS_EXERCISE', 'TOTAL_HOURS_THEORY', 'TOTAL_HOURS_EXAM'
  )
);

DELETE FROM "Challenge"
WHERE "type" IN (
  'EXERCISE_COMPLETED', 'EXERCISE_SCORE',
  'TOTAL_HOURS_EXERCISE', 'TOTAL_HOURS_THEORY', 'TOTAL_HOURS_EXAM'
);

-- CreateEnum
CREATE TYPE "ChallengeCadence" AS ENUM ('PERMANENT', 'WEEKLY');

-- AlterEnum
BEGIN;
CREATE TYPE "ChallengeType_new" AS ENUM ('STUDY_PLAN_CREATED', 'TOPICS_STUDIED', 'SUBJECT_VARIETY', 'THEORY_COMPLETED', 'EXERCISES_SOLVED', 'HARD_EXERCISES_SOLVED', 'EXERCISES_CORRECT_STREAK', 'EXAM_COMPLETED', 'EXAM_SCORE', 'EXAM_PERFECT', 'EXAM_HARD_SCORE', 'TUTOR_QUESTIONS', 'STREAK_DAILY', 'STREAK_WEEKLY');
ALTER TABLE "Challenge" ALTER COLUMN "type" TYPE "ChallengeType_new" USING ("type"::text::"ChallengeType_new");
ALTER TYPE "ChallengeType" RENAME TO "ChallengeType_old";
ALTER TYPE "ChallengeType_new" RENAME TO "ChallengeType";
DROP TYPE "ChallengeType_old";
COMMIT;

-- DropIndex
DROP INDEX "UserChallenge_userId_challengeId_key";

-- AlterTable
ALTER TABLE "Challenge" ADD COLUMN     "cadence" "ChallengeCadence" NOT NULL DEFAULT 'PERMANENT';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "currentCorrectStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "currentDailyStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastActiveDay" TEXT,
ADD COLUMN     "longestCorrectStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "longestDailyStreak" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "UserChallenge" ADD COLUMN     "periodKey" TEXT NOT NULL DEFAULT 'ALL';

-- CreateTable
CREATE TABLE "ExerciseAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "studyPlanId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "topicLabel" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExerciseAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExerciseAttempt_userId_answeredAt_idx" ON "ExerciseAttempt"("userId", "answeredAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseAttempt_userId_exerciseId_key" ON "ExerciseAttempt"("userId", "exerciseId");

-- CreateIndex
CREATE INDEX "UserChallenge_userId_periodKey_idx" ON "UserChallenge"("userId", "periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "UserChallenge_userId_challengeId_periodKey_key" ON "UserChallenge"("userId", "challengeId", "periodKey");

-- AddForeignKey
ALTER TABLE "ExerciseAttempt" ADD CONSTRAINT "ExerciseAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseAttempt" ADD CONSTRAINT "ExerciseAttempt_studyPlanId_fkey" FOREIGN KEY ("studyPlanId") REFERENCES "StudyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
