/**
 * Report PDF calculator surface — sources under ./propertyCalculator (synced on prebuild).
 */
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
