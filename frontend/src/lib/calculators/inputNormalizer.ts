import type { CalculatorPropertyTypeId, NormalizedPropertyCalculatorInput } from "@propertyCalculator/calculatorTypes";
import type { PropertyTypeId } from "../../data/calculatorPropertyTypes";
import { mapPropertyBondPayment } from "../../features/properties/financials/propertyBondAdapter";
import {
  filterLandlordRecurringCharges,
  type PropertyMonthlyFinancialSnapshot
} from "../../features/properties/financials/propertyFinancialsAdapter";
import { monthlyBondRepayment } from "../../utils/mortgageRepayment";
import { structureTypeIdFromProperty } from "../../utils/propertyOccupancy";
import { calculatorPropertyTypeFromStructure, toCalculatorPropertyTypeId } from "./propertyTypeConfigs";

function parseNum(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d.-]/g, "");
    if (!cleaned) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function monthlyFromRecurring(rc: Record<string, unknown>): number {
  const amt = parseNum(rc.amount) ?? 0;
  const freq = String(rc.frequency ?? rc.recurringFrequency ?? "MONTHLY").toUpperCase();
  if (freq === "WEEKLY") return amt * (52 / 12);
  if (freq === "QUARTERLY") return amt / 3;
  if (freq === "ANNUALLY" || freq === "YEARLY") return amt / 12;
  return amt;
}

function calcBondPaymentMonthly(values: Record<string, unknown>): number | null {
  const loan = parseNum(values.loanAmount);
  const rate = parseNum(values.interestRateApr);
  const term = parseNum(values.loanTermYears);
  if (!(loan != null && loan > 0) || !(rate != null && rate > 0) || !(term != null && term > 0)) return null;
  return monthlyBondRepayment(loan, rate, term);
}

export function normalizeFromCalculatorForm(
  propertyType: PropertyTypeId,
  values: Record<string, string>
): NormalizedPropertyCalculatorInput {
  const v = values;
  const n = (key: string) => parseNum(v[key]);

  return {
    propertyType: toCalculatorPropertyTypeId(propertyType),
    dataSource: "calculator-form",
    purchasePrice: n("purchasePrice"),
    marketValue: n("marketValue"),
    closingCosts: n("closingCosts"),
    repairsRenovation: n("repairsRenovation"),
    cashInvested: n("cashInvested"),
    loanAmount: n("loanAmount"),
    loanBalance: n("loanAmount"),
    interestRateApr: n("interestRateApr"),
    loanTermYears: n("loanTermYears"),
    monthlyLoanPayment: calcBondPaymentMonthly(v),
    monthlyRent: n("monthlyRent"),
    unit1Rent: n("unit1Rent"),
    unit2Rent: n("unit2Rent"),
    unit1Occupied: v.unit1Occupied !== "false",
    unit2Occupied: v.unit2Occupied !== "false",
    numberOfUnits: n("unitCount"),
    averageRentPerUnit: n("avgRentPerUnit"),
    bedsOrRooms: n("bedCount"),
    rentPerBed: n("rentPerBed"),
    nightlyRate: n("avgNightlyRate"),
    occupancyRatePct: n("occupancyRatePct") ?? n("occupancyPct"),
    bookedNightsPerMonth: n("avgNightsBookedPerMonth"),
    cleaningIncome: n("cleaningFeeIncomeMonthly"),
    monthlyLeaseIncome: n("monthlyLeaseIncome"),
    cleaningCosts: n("cleaningCostsMonthly"),
    platformFeesPct: n("platformFeesPct"),
    ratesTaxesMonthly: n("ratesTaxesMonthly"),
    insuranceMonthly: n("insuranceMonthly"),
    maintenanceMonthly: n("maintenanceReserveMonthly"),
    managementFeePct: n("managementFeePct"),
    leviesMonthly: n("hoaLeviesMonthly"),
    utilitiesMonthly: n("utilitiesMonthly"),
    otherExpensesMonthly: null,
    holdingCostsMonthly: n("holdingCostsMonthly"),
    vacancyAllowancePct: n("vacancyAllowancePct"),
    annualRentGrowthPct: null,
    annualExpenseGrowthPct: null,
    annualPropertyGrowthPct: n("expectedAppreciationPct"),
    holdingPeriodYears: n("holdYears"),
    sellingCostPct: n("sellingCostsPercent") ?? n("sellingCostPct"),
    monthlyOperatingExpensesOverride: null,
    monthlyDebtServiceOverride: null
  };
}

export function normalizeFromProperty(params: {
  property: Record<string, unknown>;
  currentLeases?: unknown[];
  recurringCharges?: unknown[];
  additionalBondMonthlyTotal?: number;
  statement?: Record<string, unknown> | null;
  snapshot?: PropertyMonthlyFinancialSnapshot;
}): NormalizedPropertyCalculatorInput {
  const pf = params.property;
  const structureTypeId = structureTypeIdFromProperty(pf);
  const propertyType = calculatorPropertyTypeFromStructure(structureTypeId, pf.investmentType as string | undefined);

  const leases = (params.currentLeases ?? []) as Record<string, unknown>[];
  const active = leases.filter((l) => ["ACTIVE", "MONTH_TO_MONTH"].includes(String(l.status ?? "")));
  const rentRoll = active.reduce((sum, lease) => sum + (parseNum(lease.monthlyRent) ?? 0), 0);
  const expectedIncome = parseNum(pf.expectedMonthlyIncome) ?? 0;
  const monthlyRent = rentRoll > 0 ? rentRoll : expectedIncome > 0 ? expectedIncome : null;

  const recurringRows = filterLandlordRecurringCharges(params.recurringCharges ?? []);
  const recurringOnly = recurringRows.reduce((sum, row) => sum + monthlyFromRecurring(row), 0);
  const expectedExpenses = parseNum(pf.expectedMonthlyExpenses) ?? 0;

  const bondRows = mapPropertyBondPayment(pf, String(pf.name ?? "Property"), {
    statementBondFinance: (params.statement?.bondFinance as Record<string, unknown> | undefined) ?? null
  });
  const monthlyBondPayment = bondRows[0]?.monthlyPayment ?? 0;
  const additionalBond = Math.max(0, params.additionalBondMonthlyTotal ?? 0);
  const monthlyDebtService = monthlyBondPayment + additionalBond;
  const monthlyOperating =
    recurringOnly > 0
      ? recurringOnly
      : expectedExpenses > 0
        ? expectedExpenses
        : sumPropertyFixedMonthly(pf);

  const snapshot = params.snapshot;
  const operatingOverride = snapshot?.monthlyOperatingExpenses ?? monthlyOperating;
  const debtOverride = snapshot?.monthlyDebtService ?? monthlyDebtService;

  return {
    propertyType,
    dataSource: "portfolio",
    purchasePrice: parseNum(pf.purchasePrice),
    marketValue: parseNum(pf.currentEstimatedValue),
    closingCosts: parseNum(pf.transferCosts),
    repairsRenovation: parseNum(pf.rehabBudget),
    cashInvested: parseNum(pf.totalCashInvested),
    loanAmount: parseNum(pf.outstandingBondBalance),
    loanBalance: parseNum(pf.outstandingBondBalance),
    interestRateApr: parseNum(pf.bondAnnualInterestRatePercent),
    loanTermYears: parseNum(pf.bondTermYears),
    monthlyLoanPayment: monthlyBondPayment > 0 ? monthlyBondPayment : null,
    monthlyRent,
    unit1Rent: null,
    unit2Rent: null,
    unit1Occupied: true,
    unit2Occupied: true,
    numberOfUnits: parseNum(pf.activeUnitCount),
    averageRentPerUnit: null,
    bedsOrRooms: null,
    rentPerBed: null,
    nightlyRate: null,
    occupancyRatePct: parseOccupancyPct(pf.occupancyRate),
    bookedNightsPerMonth: null,
    cleaningIncome: null,
    monthlyLeaseIncome: monthlyRent,
    cleaningCosts: null,
    platformFeesPct: parseNum(pf.managementFeePercent),
    ratesTaxesMonthly: parseNum(pf.ratesAndTaxesMonthly),
    insuranceMonthly: null,
    maintenanceMonthly: parseNum(pf.maintenanceMonthly),
    managementFeePct: parseNum(pf.managementFeePercent),
    leviesMonthly: parseNum(pf.leviesMonthly),
    utilitiesMonthly: parseNum(pf.monthlyUtilities),
    otherExpensesMonthly: parseNum(pf.securityMonthly),
    holdingCostsMonthly: null,
    vacancyAllowancePct: null,
    annualRentGrowthPct: parseNum(pf.expectedAnnualAppreciationPercent),
    annualExpenseGrowthPct: null,
    annualPropertyGrowthPct: parseNum(pf.expectedAnnualAppreciationPercent),
    holdingPeriodYears: parseNum(pf.holdingPeriodYears),
    sellingCostPct: parseNum(pf.estimatedSellingCostPercent) ?? parseNum(pf.estimated_selling_cost_percent),
    monthlyOperatingExpensesOverride:
      operatingOverride > 0 || recurringOnly > 0 || expectedExpenses > 0 ? operatingOverride : null,
    monthlyDebtServiceOverride: debtOverride > 0 ? debtOverride : null,
    unitsOccupied: active.length,
    totalUnits: parseNum(pf.activeUnitCount) ?? (active.length > 0 ? active.length : 1)
  };
}

function sumPropertyFixedMonthly(pf: Record<string, unknown>): number {
  return (
    (parseNum(pf.ratesAndTaxesMonthly) ?? 0) +
    (parseNum(pf.leviesMonthly) ?? 0) +
    (parseNum(pf.maintenanceMonthly) ?? 0) +
    (parseNum(pf.monthlyUtilities) ?? 0) +
    (parseNum(pf.securityMonthly) ?? 0)
  );
}

function parseOccupancyPct(value: unknown): number | null {
  const n = parseNum(value);
  if (n == null) return null;
  return n <= 1 ? n * 100 : n;
}

export function normalizeFromReportPayload(payload: {
  propertyType: CalculatorPropertyTypeId | string;
  answers?: Record<string, unknown>;
  metrics?: Record<string, unknown>;
}): NormalizedPropertyCalculatorInput {
  const answers = payload.answers ?? {};
  const stringAnswers: Record<string, string> = {};
  for (const [key, value] of Object.entries(answers)) {
    stringAnswers[key] = value == null ? "" : String(value);
  }
  return normalizeFromCalculatorForm(payload.propertyType as PropertyTypeId, stringAnswers);
}
