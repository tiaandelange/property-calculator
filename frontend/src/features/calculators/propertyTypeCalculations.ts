import type { IrrByYearEntry } from "@propertyCalculator/calculatorTypes";
import type { PropertyTypeId } from "../../data/calculatorPropertyTypes";
import {
  normalizeFromCalculatorForm,
  runPropertyCalculator,
  toLegacyNormalizedCalcResult
} from "../../lib/calculators";

export type NormalizedCalcResult = {
  monthlyIncome: number | null;
  monthlyExpenses: number | null;
  projectedCashFlow: number | null;
  annualCashFlow: number | null;
  grossYield: number | null;
  netYield: number | null;
  cashOnCashRoi: number | null;
  internalRateofReturn: number | null;
  irrByYear?: IrrByYearEntry[];
  ltv: number | null;
  unitsOccupied: { occupied: number; total: number } | null;
  monthlyBondPayment: number | null;
  other?: Record<string, number | string | boolean | null>;
};

/**
 * @deprecated Prefer `runPropertyCalculator(normalizeFromCalculatorForm(...))` from `lib/calculators`.
 */
export function calculatePropertyTypeMetrics(
  propertyType: PropertyTypeId,
  values: Record<string, string>
): NormalizedCalcResult {
  const input = normalizeFromCalculatorForm(propertyType, values);
  const result = runPropertyCalculator(input);
  return toLegacyNormalizedCalcResult(result);
}
