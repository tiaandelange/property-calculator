/** esbuild entry only — bundled to propertyCalculator.server.mjs on prebuild. */
export { computeMetricsFromMonthlySnapshot } from "./propertyCalculator/financialMetrics.js";
export {
  calculateIRR,
  calculateIRRByProjectionYear,
  irrPercent,
  resolveDefaultIrr,
  type IrrByYearEntry
} from "./propertyCalculator/irrCalculator.js";
export { projectLoanBalanceAfterYears } from "./propertyCalculator/loanProjection.js";
export { projectValue } from "./propertyCalculator/projectionCalculator.js";
