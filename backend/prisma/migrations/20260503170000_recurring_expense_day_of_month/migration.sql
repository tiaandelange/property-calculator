-- AlterEnum
ALTER TYPE "RecurringExpenseMonthAnchor" ADD VALUE 'DAY_OF_MONTH';

-- AlterTable
ALTER TABLE "PropertyExpense" ADD COLUMN "recurring_day_of_month" INTEGER;
