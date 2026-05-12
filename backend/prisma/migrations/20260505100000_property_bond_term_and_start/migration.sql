-- Bond amortisation schedule: fixed term (years) + registration/start date → remaining months derived in app code.
ALTER TABLE "Property" ADD COLUMN "bond_term_years" INTEGER,
ADD COLUMN "bond_start_date" DATE;
