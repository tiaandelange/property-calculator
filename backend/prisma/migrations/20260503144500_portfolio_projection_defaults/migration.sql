-- CreateTable
CREATE TABLE "PortfolioProjectionDefaults" (
    "id" INTEGER NOT NULL,
    "rentalIncomeGrowthPercentAnnual" DOUBLE PRECISION NOT NULL DEFAULT 6,
    "totalExpensesGrowthPercentAnnual" DOUBLE PRECISION NOT NULL DEFAULT 6,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortfolioProjectionDefaults_pkey" PRIMARY KEY ("id")
);

INSERT INTO "PortfolioProjectionDefaults" ("id", "rentalIncomeGrowthPercentAnnual", "totalExpensesGrowthPercentAnnual", "updatedAt")
VALUES (1, 6, 6, CURRENT_TIMESTAMP);
