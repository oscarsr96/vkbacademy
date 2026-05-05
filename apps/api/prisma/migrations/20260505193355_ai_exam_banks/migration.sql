-- AddColumn: trazabilidad de intento desde un banco IA
ALTER TABLE "ExamAttempt" ADD COLUMN "aiExamBankId" TEXT;

-- CreateTable
CREATE TABLE "AiExamBank" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "moduleId" TEXT,
    "topic" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "numQuestions" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiExamBank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiExamQuestion" (
    "id" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "order" INTEGER NOT NULL,
    "explanation" TEXT,

    CONSTRAINT "AiExamQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiExamAnswer" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL,

    CONSTRAINT "AiExamAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExamAttempt_aiExamBankId_idx" ON "ExamAttempt"("aiExamBankId");

-- CreateIndex
CREATE INDEX "AiExamBank_userId_createdAt_idx" ON "AiExamBank"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiExamBank_userId_courseId_idx" ON "AiExamBank"("userId", "courseId");

-- CreateIndex
CREATE INDEX "AiExamQuestion_bankId_order_idx" ON "AiExamQuestion"("bankId", "order");

-- CreateIndex
CREATE INDEX "AiExamAnswer_questionId_order_idx" ON "AiExamAnswer"("questionId", "order");

-- AddForeignKey
ALTER TABLE "ExamAttempt" ADD CONSTRAINT "ExamAttempt_aiExamBankId_fkey" FOREIGN KEY ("aiExamBankId") REFERENCES "AiExamBank"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiExamBank" ADD CONSTRAINT "AiExamBank_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiExamBank" ADD CONSTRAINT "AiExamBank_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiExamBank" ADD CONSTRAINT "AiExamBank_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiExamQuestion" ADD CONSTRAINT "AiExamQuestion_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "AiExamBank"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiExamAnswer" ADD CONSTRAINT "AiExamAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "AiExamQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
