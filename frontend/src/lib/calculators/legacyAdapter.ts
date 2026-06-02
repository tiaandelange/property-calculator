import type { PropertyCalculatorResult } from "@propertyCalculator/calculatorTypes";
import type { NormalizedCalcResult } from "../../features/calculators/propertyTypeCalculations";

/** Maps global engine output to the legacy calculators-page result shape. */
export function toLegacyNormalizedCalcResult(result: PropertyCalculatorResult): NormalizedCalcResult {
  return {
    monthlyIncome: result.effectiveMonthlyIncome,
    monthlyExpenses: result.monthlyExpenses,
    projectedCashFlow: result.monthlyCashFlow,
    annualCashFlow: result.annualCashFlow,
    grossYield: result.grossYield,
    netYield: result.netYield,
    cashOnCashRoi: result.cashOnCashRoi,
    internalRateofReturn: result.irr,
    irrByYear: result.irrByYear,
    ltv: result.ltv,
    unitsOccupied:
      result.unitsOccupied != null && result.totalUnits != null
        ? { occupied: result.unitsOccupied, total: result.totalUnits }
        : null,
    monthlyBondPayment: result.monthlyLoanPayment,
    other: result.warnings.length ? { warnings: result.warnings.join("; ") } : undefined
  };
}
