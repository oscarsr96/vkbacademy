-- CreateTable
CREATE TABLE "BillingConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "studentMonthlyPrice" DOUBLE PRECISION NOT NULL DEFAULT 15.00,
    "classOnlineRatePerHour" DOUBLE PRECISION NOT NULL DEFAULT 15.00,
    "classInPersonRatePerHour" DOUBLE PRECISION NOT NULL DEFAULT 18.00,
    "clubCommissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    "infrastructureMonthlyCost" DOUBLE PRECISION NOT NULL DEFAULT 25.00,
    "s3MonthlyCost" DOUBLE PRECISION NOT NULL DEFAULT 2.00,
    "anthropicMonthlyCost" DOUBLE PRECISION NOT NULL DEFAULT 5.00,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingConfig_pkey" PRIMARY KEY ("id")
);
