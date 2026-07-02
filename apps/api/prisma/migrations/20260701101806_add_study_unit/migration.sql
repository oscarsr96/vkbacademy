-- AlterTable
ALTER TABLE "AiExamBank" ADD COLUMN     "studyUnitId" TEXT;

-- AlterTable
ALTER TABLE "TheoryModule" ADD COLUMN     "studyUnitId" TEXT;

-- CreateTable
CREATE TABLE "StudyUnit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "exercises" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudyUnit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudyUnit_userId_createdAt_idx" ON "StudyUnit"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "StudyUnit_userId_courseId_idx" ON "StudyUnit"("userId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "AiExamBank_studyUnitId_key" ON "AiExamBank"("studyUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "TheoryModule_studyUnitId_key" ON "TheoryModule"("studyUnitId");

-- AddForeignKey
ALTER TABLE "TheoryModule" ADD CONSTRAINT "TheoryModule_studyUnitId_fkey" FOREIGN KEY ("studyUnitId") REFERENCES "StudyUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiExamBank" ADD CONSTRAINT "AiExamBank_studyUnitId_fkey" FOREIGN KEY ("studyUnitId") REFERENCES "StudyUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyUnit" ADD CONSTRAINT "StudyUnit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyUnit" ADD CONSTRAINT "StudyUnit_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
