-- CreateTable
CREATE TABLE "UserActivityDay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "worked" BOOLEAN NOT NULL DEFAULT false,
    "academyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserActivityDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserActivityDay_day_idx" ON "UserActivityDay"("day");

-- CreateIndex
CREATE UNIQUE INDEX "UserActivityDay_userId_day_key" ON "UserActivityDay"("userId", "day");

-- AddForeignKey
ALTER TABLE "UserActivityDay" ADD CONSTRAINT "UserActivityDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
