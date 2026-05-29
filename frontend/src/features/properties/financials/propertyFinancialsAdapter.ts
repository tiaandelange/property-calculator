import { fmtZar } from "../../financials/financialDirectoryUtils";
import { mapPropertyBondPayment } from "./propertyBondAdapter";
import {
  derivePropertyOccupancy,
  effectiveActiveUnitCount,
  occupancyCodeToTenantStatus,
  structureTypeIdFromProperty
} from "../../../utils/propertyOccupancy";

export type RecurringExpenseDisplayItem = {
  id: string | number;
  name: string;
  category: string;
  categoryLabel: string;
  frequency: string;
  amount: number;
  nextDueDate: string | null;
  status: string;
  raw: Record<string, unknown>;
};

export type PropertyFinancialOverview = {
  propertyId: string;
  propertyName: string;
  unitLabel: string | null;
  addressLine: string | null;
  monthlyIncome: number;
  monthlyBondPayment: number;
  monthlyAdditionalBondPayment: number;
  monthlyOperatingExpenses: number;
  monthlyDebtService: number;
  totalRecurringExpenses: number;
  netCashFlow: number;
  occupancyStatus: string;
  occupancyHelper: string;
  grossRentalIncome: number;
  totalMonthlyExpenses: number;
  netOperatingIncome: number;
  estimatedCashFlow: number;
  annualYieldPercent: number | null;
  leaseStatus: string;
  incomePct: number;
  expensePct: number;
  expenseCategories: { key: string; label: string; amount: number; pct: number }[];
};

const CATEGORY_GROUP_LABELS: Record<string, string> = {
  RATES_TAXES: "Taxes",
  LEVIES: "HOA / Levies",
  INSURANCE: "Insurance",
  WATER: "Utilities",
  ELECTRICITY: "Utilities",
  MAINTENANCE: "Maintenance",
  REPAIRS: "Maintenance",
  MANAGEMENT_FEES: "Other",
  BOND_PAYMENT: "Other",
  ACCOUNTING: "Other",
  OTHER: "Other"
};

function n(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function monthlyAmountFromRecurring(rc: Record<string, unknown>): number {
  const amt = n(rc.amount);
  const freq = String(rc.frequency ?? rc.recurringFrequency ?? "MONTHLY").toUpperCase();
  if (freq === "WEEKLY") return amt * (52 / 12);
  if (freq === "QUARTERLY") return amt / 3;
  if (freq === "ANNUALLY" || freq === "YEARLY") return amt / 12;
  return amt;
}

function recurringStatus(rc: Record<string, unknown>): string {
  const st = String(rc.status ?? "ACTIVE").toUpperCase();
  if (st === "ARCHIVED") return "paused";
  return "active";
}

function nextDueFromRecurring(rc: Record<string, unknown>): string | null {
  const d = rc.recurringStartDate ?? rc.expenseDate ?? rc.nextDueDate;
  if (d == null) return null;
  return String(d).slice(0, 10);
}

export function mapRecurringCharges(rows: unknown[]): RecurringExpenseDisplayItem[] {
  return (rows as Record<string, unknown>[]).map((rc) => {
    const category = String(rc.category ?? "OTHER");
    return {
      id: rc.id as string | number,
      name: String(rc.description ?? expenseCategoryLabel(category)),
      category,
      categoryLabel: CATEGORY_GROUP_LABELS[category] ?? category,
      frequency: String(rc.frequency ?? rc.recurringFrequency ?? "MONTHLY"),
      amount: n(rc.amount),
      nextDueDate: nextDueFromRecurring(rc),
      status: recurringStatus(rc),
      raw: rc
    };
  });
}

export function expenseCategoryLabel(value: string): string {
  const labels: Record<string, string> = {
    RATES_TAXES: "Rates and Taxes",
    WATER: "Water",
    ELECTRICITY: "Electricity",
    LEVIES: "Levies",
    INSURANCE: "Insurance",
    MAINTENANCE: "Maintenance",
    REPAIRS: "Repairs",
    MANAGEMENT_FEES: "Management Fees",
    BOND_PAYMENT: "Bond Payment",
    ACCOUNTING: "Accounting",
    OTHER: "Other"
  };
  return labels[value] ?? value;
}

/** Recurring landlord charges used for operating expenses (excludes bond payment rows). */
export function filterLandlordRecurringCharges(rows: unknown[]): Record<string, unknown>[] {
  return (rows as Record<string, unknown>[]).filter((rc) => String(rc.category ?? "") !== "BOND_PAYMENT");
}

export type PropertyMonthlyFinancialSnapshot = {
  monthlyIncome: number;
  monthlyOperatingExpenses: number;
  monthlyDebtService: number;
  monthlyBondPayment: number;
  monthlyAdditionalBondPayment: number;
  monthlyNOI: number;
  netCashFlow: number;
  combinedMonthlyLeaseRent: number;
  monthlyRent: number;
  monthlyExpenses: number;
  monthlyCashFlowAfterDebtService: number;
};

/** Monthly income, operating expenses, NOI, and cash flow — same rules as the Financials tab. */
export function computePropertyMonthlyFinancialSnapshot({
  property,
  currentLeases = [],
  recurringCharges = [],
  additionalBondMonthlyTotal = 0,
  statement = null
}: {
  property: Record<string, unknown>;
  currentLeases?: unknown[];
  recurringCharges?: unknown[];
  additionalBondMonthlyTotal?: number;
  statement?: Record<string, unknown> | null;
}): PropertyMonthlyFinancialSnapshot {
  const pf = property;
  const leases = currentLeases as Record<string, unknown>[];
  const active = leases.filter((l) => ["ACTIVE", "MONTH_TO_MONTH"].includes(String(l.status ?? "")));
  const rentRoll = active.reduce((a, l) => a + n(l.monthlyRent), 0);
  const expectedIncome = n(pf.expectedMonthlyIncome);
  const monthlyIncome = rentRoll > 0 ? rentRoll : expectedIncome;

  const recurringRows = filterLandlordRecurringCharges(recurringCharges);
  const recurringOnly = recurringRows.reduce((a, rc) => a + monthlyAmountFromRecurring(rc), 0);
  const expectedExpenses = n(pf.expectedMonthlyExpenses);

  const bondRows = mapPropertyBondPayment(pf, String(pf.name ?? "Property"), {
    statementBondFinance: (statement?.bondFinance as Record<string, unknown> | undefined) ?? null
  });
  const monthlyBondPayment = bondRows[0]?.monthlyPayment ?? 0;
  const monthlyAdditionalBondPayment = Math.max(0, n(additionalBondMonthlyTotal));
  const monthlyDebtService = monthlyBondPayment + monthlyAdditionalBondPayment;

  const monthlyOperatingExpenses = recurringOnly > 0 ? recurringOnly : expectedExpenses;
  const totalMonthlyExpenses = monthlyOperatingExpenses + monthlyDebtService;
  const monthlyNOI = monthlyIncome - monthlyOperatingExpenses;
  const netCashFlow = monthlyIncome - totalMonthlyExpenses;

  return {
    monthlyIncome,
    monthlyOperatingExpenses,
    monthlyDebtService,
    monthlyBondPayment,
    monthlyAdditionalBondPayment,
    monthlyNOI,
    netCashFlow,
    combinedMonthlyLeaseRent: rentRoll,
    monthlyRent: rentRoll,
    monthlyExpenses: totalMonthlyExpenses,
    monthlyCashFlowAfterDebtService: netCashFlow
  };
}

export function buildPropertyFinancialOverview({
  propertyId,
  propertyDetail,
  currentLeases,
  recurringChargesLandlord,
  statement,
  deposits,
  additionalBondMonthlyTotal = 0
}: {
  propertyId: string;
  propertyDetail: Record<string, unknown> | null;
  currentLeases: unknown[];
  recurringChargesLandlord: unknown[];
  statement: Record<string, unknown> | null;
  deposits: unknown[];
  additionalBondMonthlyTotal?: number;
}): PropertyFinancialOverview {
  const pf = propertyDetail ?? {};
  const leases = currentLeases as Record<string, unknown>[];
  const active = leases.filter((l) => ["ACTIVE", "MONTH_TO_MONTH"].includes(String(l.status ?? "")));

  const snap = computePropertyMonthlyFinancialSnapshot({
    property: pf as Record<string, unknown>,
    currentLeases,
    recurringCharges: recurringChargesLandlord,
    additionalBondMonthlyTotal,
    statement
  });

  const {
    monthlyIncome,
    monthlyOperatingExpenses,
    monthlyDebtService,
    monthlyBondPayment,
    monthlyAdditionalBondPayment,
    monthlyNOI: netOperatingIncome,
    netCashFlow
  } = snap;
  const totalRecurringExpenses = monthlyOperatingExpenses;
  const totalMonthlyExpenses = monthlyOperatingExpenses + monthlyDebtService;

  const recurringRows = filterLandlordRecurringCharges(recurringChargesLandlord);
  const purchase = n(pf.purchasePrice);
  const annualYieldPercent =
    purchase > 0 && monthlyIncome > 0 ? Number((((monthlyIncome * 12) / purchase) * 100).toFixed(2)) : null;

  const structureTypeId = structureTypeIdFromProperty(pf);
  const totalUnitCount = effectiveActiveUnitCount(structureTypeId, Number(pf.activeUnitCount) || undefined);
  const derived = derivePropertyOccupancy({
    structureTypeId,
    investmentType: pf.investmentType as string | undefined,
    activeLeaseCount: active.length,
    totalUnitCount
  });
  let occupancyStatus = occupancyCodeToTenantStatus(derived.code);
  let occupancyHelper =
    derived.code === "PARTIALLY_OCCUPIED"
      ? `${derived.activeLeaseCount} of ${derived.totalUnitCount} units have an active lease`
      : derived.code === "OCCUPIED"
        ? "Active lease in place"
        : "No active lease";
  let leaseStatus = "Vacant";
  if (active.length > 0) {
    leaseStatus = "Active";
    const end = active[0].endDate ? String(active[0].endDate).slice(0, 10) : null;
    if (end) {
      const endMs = new Date(end).getTime();
      if (Number.isFinite(endMs) && endMs < Date.now()) {
        leaseStatus = "Expired";
        occupancyStatus = "Pending";
        occupancyHelper = "Lease end date passed";
      }
    }
  }

  const depositHeld = (deposits as Record<string, unknown>[]).reduce((a, d) => a + n(d.amount), 0);

  const categoryTotals = new Map<string, number>();
  for (const rc of recurringRows) {
    const cat = CATEGORY_GROUP_LABELS[String(rc.category ?? "OTHER")] ?? "Other";
    categoryTotals.set(cat, (categoryTotals.get(cat) ?? 0) + monthlyAmountFromRecurring(rc));
  }
  if (monthlyBondPayment > 0) {
    categoryTotals.set("Bond Payment", (categoryTotals.get("Bond Payment") ?? 0) + monthlyBondPayment);
  }
  if (monthlyAdditionalBondPayment > 0) {
    categoryTotals.set("Additional bonds", (categoryTotals.get("Additional bonds") ?? 0) + monthlyAdditionalBondPayment);
  }
  const expenseCategories = [...categoryTotals.entries()]
    .map(([label, amount]) => ({ key: label, label, amount, pct: 0 }))
    .sort((a, b) => b.amount - a.amount);
  const catSum = expenseCategories.reduce((a, c) => a + c.amount, 0);
  for (const c of expenseCategories) {
    c.pct = catSum > 0 ? Math.round((c.amount / catSum) * 100) : 0;
  }

  const incomePct = monthlyIncome + totalMonthlyExpenses > 0 ? Math.round((monthlyIncome / (monthlyIncome + totalMonthlyExpenses)) * 100) : 50;

  const suburb = pf.suburb ? String(pf.suburb) : "";
  const city = pf.city ? String(pf.city) : "";
  const addressLine = [suburb, city].filter(Boolean).join(", ") || String(pf.addressLine1 ?? "");

  return {
    propertyId,
    propertyName: String(pf.name ?? "Property"),
    unitLabel: pf.erfNumber ? String(pf.erfNumber) : null,
    addressLine: addressLine || null,
    monthlyIncome,
    monthlyBondPayment,
    monthlyAdditionalBondPayment,
    monthlyOperatingExpenses,
    monthlyDebtService,
    totalRecurringExpenses,
    netCashFlow,
    occupancyStatus,
    occupancyHelper,
    grossRentalIncome: monthlyIncome,
    totalMonthlyExpenses,
    netOperatingIncome,
    estimatedCashFlow: netCashFlow,
    annualYieldPercent,
    leaseStatus,
    incomePct,
    expensePct: 100 - incomePct,
    expenseCategories
  };
}

export { fmtZar };
