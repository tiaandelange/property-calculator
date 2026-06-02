export type {
  CalculatorDataSource,
  CalculatorPropertyTypeId,
  IrrByYearEntry,
  NormalizedPropertyCalculatorInput,
  PropertyCalculatorResult,
  ProjectedYearSeries
} from "./calculatorTypes";

export {
  calculateIRR,
  calculateIRRByProjectionYear,
  computeTerminalExitValue,
  irrPercent,
  npv,
  resolveDefaultIrr,
  type IrrProjectionInputs
} from "./irrCalculator";

export { projectLoanBalanceAfterYears } from "./loanProjection";
export { buildProjectionReportRows, type ProjectionReportRow } from "./projectionReportRows";

export {
  buildAnnualProjectionSeries,
  buildFiveYearCashFlowFromMonthly,
  CALCULATOR_PROJECTION_YEARS,
  DEFAULT_PROJECTION_YEARS,
  projectValue
} from "./projectionCalculator";

export {
  clampPct,
  computeCapRatePercent,
  computeCashOnCashRoiPercent,
  computeEquity,
  computeFiftyPercentRuleCashFlow,
  computeGrossYieldPercent,
  computeLtvPercent,
  computeMetricsFromMonthlySnapshot,
  computeNetYieldPercent,
  computeTwoPercentRulePercent,
  deriveInvestmentRating,
  meetsFiftyPercentRule,
  round2,
  safeDiv,
  sumNullable,
  totalProjectCost
} from "./financialMetrics";

export { computeIncomeByPropertyType, isVacantLandType } from "./incomeByPropertyType";
export { runPropertyCalculator } from "./propertyCalculatorEngine";
export {
  mapCalculatorResultToLegacyMetrics,
  mapCalculatorResultToReportSections,
  type MappedInvestmentReportMetrics,
  type ReportKeyValueRow,
  type ReportMetricCard
} from "./reportResultMapper";
