/** Background assumptions for the simple buy vs rent calculator (not shown on main form). */
export const SIMPLE_BUY_VS_RENT_BACKGROUND = {
  bondTermYears: 20,
  investmentReturn: 8,
  maintenancePercent: 1,
  ownershipCostInflation: 6,
  transferAndLegalCostPercent: 4,
  bondRegistrationCostPercent: 1,
  sellingCostPercent: 5,
  renterOtherMonthlyCosts: 0,
  rentalDepositMonths: 1,
  ratesTaxesMonthlyFactor: 0.001,
  insuranceMonthlyFactor: 0.0005,
  leviesMonthly: 0,
  closeCallThresholdPercent: 2.5
} as const;

export const SIMPLE_BUY_VS_RENT_ASSUMPTIONS_DISPLAY = [
  "20-year bond term",
  "8% investment return if renting",
  "1% annual maintenance estimate",
  "6% annual ownership cost inflation",
  "Estimated transfer/legal costs: 4% of purchase price",
  "Estimated bond registration costs: 1% of bond amount",
  "Estimated selling costs: 5% of final property value",
  "Rates/taxes and insurance are estimated from the property price"
] as const;

export const SIMPLE_BUY_VS_RENT_ASSUMPTIONS_NOTE =
  "This simple calculator uses background assumptions to keep the input form short. For a detailed result, use the advanced Buy vs Rent calculator.";

export const SIMPLE_BUY_VS_RENT_UPGRADE_PROMPT = {
  title: "Want a more accurate result?",
  body: "Use the advanced calculator to edit transfer costs, levies, rates, insurance, maintenance, selling costs, tax assumptions, bond term and investment assumptions."
} as const;
