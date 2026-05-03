-- CreateEnum
CREATE TYPE "TheoryLessonKind" AS ENUM ('INTRO', 'CONTENT', 'EXAMPLE', 'VIDEO');

-- CreateTable
CREATE TABLE "TheoryModule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TheoryModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TheoryLesson" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "kind" "TheoryLessonKind" NOT NULL,
    "heading" TEXT NOT NULL,
    "body" TEXT,
    "youtubeId" TEXT,

    CONSTRAINT "TheoryLesson_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TheoryModule_userId_courseId_idx" ON "TheoryModule"("userId", "courseId");

-- CreateIndex
CREATE INDEX "TheoryModule_userId_createdAt_idx" ON "TheoryModule"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "TheoryLesson_moduleId_order_idx" ON "TheoryLesson"("moduleId", "order");

-- AddForeignKey
ALTER TABLE "TheoryModule" ADD CONSTRAINT "TheoryModule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TheoryModule" ADD CONSTRAINT "TheoryModule_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TheoryLesson" ADD CONSTRAINT "TheoryLesson_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "TheoryModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
