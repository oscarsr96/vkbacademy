-- CreateEnum
CREATE TYPE "StudyTopicSource" AS ENUM ('OFFICIAL', 'CUSTOM');

-- AlterTable
ALTER TABLE "TheoryModule" ADD COLUMN     "studyPlanTopicId" TEXT;

-- AlterTable
ALTER TABLE "AiExamBank" ADD COLUMN     "studyPlanId" TEXT;

-- AlterTable
ALTER TABLE "AiExamQuestion" ADD COLUMN     "topicLabel" TEXT;

-- CreateTable
CREATE TABLE "StudyPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "difficulty" TEXT NOT NULL DEFAULT 'MEDIUM',
    "exercises" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudyPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyPlanTopic" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "source" "StudyTopicSource" NOT NULL,
    "moduleId" TEXT,
    "title" TEXT NOT NULL,
    "subject" TEXT,
    "contextCourseId" TEXT NOT NULL,

    CONSTRAINT "StudyPlanTopic_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudyPlan_userId_createdAt_idx" ON "StudyPlan"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "StudyPlan_userId_courseId_idx" ON "StudyPlan"("userId", "courseId");

-- CreateIndex
CREATE INDEX "StudyPlanTopic_planId_order_idx" ON "StudyPlanTopic"("planId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "TheoryModule_studyPlanTopicId_key" ON "TheoryModule"("studyPlanTopicId");

-- CreateIndex
CREATE UNIQUE INDEX "AiExamBank_studyPlanId_key" ON "AiExamBank"("studyPlanId");

-- AddForeignKey
ALTER TABLE "TheoryModule" ADD CONSTRAINT "TheoryModule_studyPlanTopicId_fkey" FOREIGN KEY ("studyPlanTopicId") REFERENCES "StudyPlanTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiExamBank" ADD CONSTRAINT "AiExamBank_studyPlanId_fkey" FOREIGN KEY ("studyPlanId") REFERENCES "StudyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyPlan" ADD CONSTRAINT "StudyPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyPlan" ADD CONSTRAINT "StudyPlan_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyPlanTopic" ADD CONSTRAINT "StudyPlanTopic_planId_fkey" FOREIGN KEY ("planId") REFERENCES "StudyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyPlanTopic" ADD CONSTRAINT "StudyPlanTopic_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE SET NULL ON UPDATE CASCADE;
