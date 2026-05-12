-- CreateEnum
CREATE TYPE "RecurringExpenseMonthAnchor" AS ENUM ('FIRST_OF_MONTH', 'LAST_OF_MONTH');

-- AlterTable
ALTER TABLE "PropertyExpense" ADD COLUMN "recurring_schedule_parent_id" INTEGER,
ADD COLUMN "recurring_start_date" DATE,
ADD COLUMN "recurring_end_date" DATE,
ADD COLUMN "recurring_open_ended" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "recurring_month_anchor" "RecurringExpenseMonthAnchor";

-- AddForeignKey
ALTER TABLE "PropertyExpense" ADD CONSTRAINT "PropertyExpense_recurring_schedule_parent_id_fkey" FOREIGN KEY ("recurring_schedule_parent_id") REFERENCES "PropertyExpense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "PropertyExpense_recurring_schedule_parent_id_idx" ON "PropertyExpense"("recurring_schedule_parent_id");

-- Legacy recurring templates: treat expenseDate month-start as schedule metadata so KPI logic stops double-counting the template row (materialized rows carry amounts).
UPDATE "PropertyExpense"
SET
  "recurring_open_ended" = true,
  "recurring_month_anchor" = 'FIRST_OF_MONTH'::"RecurringExpenseMonthAnchor",
  "recurring_start_date" = ("expenseDate")::date
WHERE "isRecurring" = true
  AND "recurring_schedule_parent_id" IS NULL
  AND "recurring_start_date" IS NULL;
