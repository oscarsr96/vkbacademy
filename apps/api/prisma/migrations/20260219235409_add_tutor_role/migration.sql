-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'TUTOR';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "tutorId" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
