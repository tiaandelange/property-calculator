/**
 * Global property investment calculator — pure business logic + normalizers.
 * Core formulas live in `shared/propertyCalculator` (also used by API report assembly).
 */
export type {
  CalculatorDataSource,
  CalculatorPropertyTypeId,
  NormalizedPropertyCalculatorInput,
  PropertyCalculatorResult
} from "@propertyCalculator/index";

export {
  buildFiveYearCashFlowFromMonthly,
  buildProjectionReportRows,
  calculateIRR,
  calculateIRRByProjectionYear,
  computeMetricsFromMonthlySnapshot,
  mapCalculatorResultToLegacyMetrics,
  mapCalculatorResultToReportSections,
  resolveDefaultIrr,
  runPropertyCalculator
} from "@propertyCalculator/index";

export {
  calculatorPropertyTypeFromStructure,
  toCalculatorPropertyTypeId
} from "./propertyTypeConfigs";

export {
  normalizeFromCalculatorForm,
  normalizeFromProperty,
  normalizeFromReportPayload
} from "./inputNormalizer";

export { toLegacyNormalizedCalcResult } from "./legacyAdapter";
