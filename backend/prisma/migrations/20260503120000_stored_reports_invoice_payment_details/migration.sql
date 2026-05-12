-- CreateTable
CREATE TABLE "StoredReport" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "report_type" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "calculation_id" INTEGER,
    "property_id" INTEGER,
    "invoice_id" INTEGER,
    "scenario_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredReport_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "User" ADD COLUMN "invoice_payment_details" JSONB;

-- CreateIndex
CREATE INDEX "StoredReport_user_id_idx" ON "StoredReport"("user_id");

-- CreateIndex
CREATE INDEX "StoredReport_calculation_id_idx" ON "StoredReport"("calculation_id");

-- AddForeignKey
ALTER TABLE "StoredReport" ADD CONSTRAINT "StoredReport_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredReport" ADD CONSTRAINT "StoredReport_calculation_id_fkey" FOREIGN KEY ("calculation_id") REFERENCES "Calculation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
