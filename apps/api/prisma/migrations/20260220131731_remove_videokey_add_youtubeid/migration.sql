-- AlterTable: reemplazar videoKey por youtubeId en Lesson
ALTER TABLE "Lesson" DROP COLUMN IF EXISTS "videoKey";
ALTER TABLE "Lesson" ADD COLUMN "youtubeId" TEXT;
