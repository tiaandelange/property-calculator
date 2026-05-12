-- AlterTable Property — amortisation inputs & optional split overrides (profile-level “this period”).
-- Column names match Prisma @map(...) (snake_case in PostgreSQL).
ALTER TABLE "Property" ADD COLUMN "bond_annual_interest_rate_percent" DOUBLE PRECISION,
ADD COLUMN "bond_remaining_term_months" INTEGER,
ADD COLUMN "bond_interest_portion_override" DOUBLE PRECISION,
ADD COLUMN "bond_principal_portion_override" DOUBLE PRECISION;

-- AlterTable PropertyExpense — optional split stored per ledger row (statement edits).
ALTER TABLE "PropertyExpense" ADD COLUMN "bond_interest_amount" DOUBLE PRECISION,
ADD COLUMN "bond_principal_amount" DOUBLE PRECISION;
