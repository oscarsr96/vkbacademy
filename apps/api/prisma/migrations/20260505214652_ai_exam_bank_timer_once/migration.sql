-- AddColumn: límite de tiempo opcional + flag de un solo intento
ALTER TABLE "AiExamBank" ADD COLUMN "timeLimit" INTEGER;
ALTER TABLE "AiExamBank" ADD COLUMN "onlyOnce" BOOLEAN NOT NULL DEFAULT false;
