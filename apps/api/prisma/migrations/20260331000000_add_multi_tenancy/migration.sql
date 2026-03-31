-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SUPER_ADMIN';

-- CreateTable
CREATE TABLE "Academy" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "primaryColor" TEXT DEFAULT '#6366f1',
    "domain" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Academy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademyMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "academyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcademyMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Academy_slug_key" ON "Academy"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Academy_domain_key" ON "Academy"("domain");

-- CreateIndex
CREATE INDEX "AcademyMember_academyId_idx" ON "AcademyMember"("academyId");

-- CreateIndex
CREATE INDEX "AcademyMember_userId_idx" ON "AcademyMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AcademyMember_userId_academyId_key" ON "AcademyMember"("userId", "academyId");

-- AddColumn
ALTER TABLE "Enrollment" ADD COLUMN "academyId" TEXT;

-- AddColumn
ALTER TABLE "Booking" ADD COLUMN "academyId" TEXT;

-- AddColumn
ALTER TABLE "Redemption" ADD COLUMN "academyId" TEXT;

-- AddColumn
ALTER TABLE "UserChallenge" ADD COLUMN "academyId" TEXT;

-- AddColumn
ALTER TABLE "BillingConfig" ADD COLUMN "academyId" TEXT;

-- CreateIndex
CREATE INDEX "Enrollment_academyId_idx" ON "Enrollment"("academyId");

-- CreateIndex
CREATE INDEX "Booking_academyId_idx" ON "Booking"("academyId");

-- CreateIndex
CREATE INDEX "Redemption_academyId_idx" ON "Redemption"("academyId");

-- CreateIndex
CREATE INDEX "UserChallenge_academyId_idx" ON "UserChallenge"("academyId");

-- CreateIndex (BillingConfig.academyId es unique)
CREATE UNIQUE INDEX "BillingConfig_academyId_key" ON "BillingConfig"("academyId");

-- AddForeignKey
ALTER TABLE "AcademyMember" ADD CONSTRAINT "AcademyMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademyMember" ADD CONSTRAINT "AcademyMember_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "Academy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "Academy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "Academy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Redemption" ADD CONSTRAINT "Redemption_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "Academy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserChallenge" ADD CONSTRAINT "UserChallenge_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "Academy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingConfig" ADD CONSTRAINT "BillingConfig_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "Academy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
