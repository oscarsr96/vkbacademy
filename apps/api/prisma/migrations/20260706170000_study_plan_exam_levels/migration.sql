-- Exámenes por nivel del plan multi-tema: AiExamBank.studyPlanId pasa de 1:1 a
-- 1:N (un banco por nivel BASIC/MEDIUM/HARD, combinado o por tema) y StudyPlan
-- persiste el reparto de ejercicios elegido. Aditiva salvo el drop del unique.

-- DropIndex
DROP INDEX "AiExamBank_studyPlanId_key";

-- AlterTable
ALTER TABLE "AiExamBank" ADD COLUMN     "level" TEXT,
ADD COLUMN     "studyPlanTopicId" TEXT;

-- AlterTable
ALTER TABLE "StudyPlan" ADD COLUMN     "exercisesConfig" JSONB;

-- CreateIndex
CREATE INDEX "AiExamBank_studyPlanId_idx" ON "AiExamBank"("studyPlanId");

-- AddForeignKey
ALTER TABLE "AiExamBank" ADD CONSTRAINT "AiExamBank_studyPlanTopicId_fkey" FOREIGN KEY ("studyPlanTopicId") REFERENCES "StudyPlanTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
