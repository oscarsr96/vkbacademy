-- CreateTable
CREATE TABLE "TutorImage" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TutorImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TutorImage_messageId_key" ON "TutorImage"("messageId");

-- AddForeignKey
ALTER TABLE "TutorImage" ADD CONSTRAINT "TutorImage_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "TutorMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
