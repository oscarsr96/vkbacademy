-- AlterEnum
-- Prisma no generó este ALTER TYPE al diffear: sin él, insertar un certificado
-- de tipo STUDY_EXAM falla en runtime con "invalid input value for enum".
-- Va primero y fuera de transacción porque Postgres no permite usar un valor de
-- enum recién añadido dentro de la misma transacción que lo crea.
ALTER TYPE "CertificateType" ADD VALUE IF NOT EXISTS 'STUDY_EXAM';

-- AlterTable
ALTER TABLE "Certificate" ADD COLUMN     "studyPlanId" TEXT;

-- CreateIndex
CREATE INDEX "Certificate_studyPlanId_idx" ON "Certificate"("studyPlanId");

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_studyPlanId_fkey" FOREIGN KEY ("studyPlanId") REFERENCES "StudyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
