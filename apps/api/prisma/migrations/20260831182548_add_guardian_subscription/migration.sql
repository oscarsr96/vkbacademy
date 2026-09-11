-- CreateTable
CREATE TABLE "GuardianSubscription" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "unsubscribedAt" TIMESTAMP(3),
    "token" TEXT NOT NULL,
    "lastSentWeek" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuardianSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GuardianSubscription_email_key" ON "GuardianSubscription"("email");

-- CreateIndex
CREATE UNIQUE INDEX "GuardianSubscription_token_key" ON "GuardianSubscription"("token");
