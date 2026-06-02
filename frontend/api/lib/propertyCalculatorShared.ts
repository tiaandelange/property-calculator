/**
 * Vercel serverless resolves `api/` via Node — not Vite/tsconfig path aliases.
 * Re-export shared calculator modules with relative paths so report PDF routes bundle correctly.
 */
export { computeMetricsFromMonthlySnapshot } from "../../../shared/propertyCalculator/financialMetrics.js";
export {
  calculateIRR,
  calculateIRRByProjectionYear,
  irrPercent,
  resolveDefaultIrr,
  type IrrByYearEntry
} from "../../../shared/propertyCalculator/irrCalculator.js";
export { projectLoanBalanceAfterYears } from "../../../shared/propertyCalculator/loanProjection.js";
export { projectValue } from "../../../shared/propertyCalculator/projectionCalculator.js";
