import { fmtZar } from "../../financials/financialDirectoryUtils";

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
  const freq = String(rc.frequency ?? "MONTHLY").toUpperCase();
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
      frequency: String(rc.frequency ?? "MONTHLY"),
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

export function buildPropertyFinancialOverview({
  propertyId,
  propertyDetail,
  currentLeases,
  recurringChargesLandlord,
  statement,
  deposits
}: {
  propertyId: string;
  propertyDetail: Record<string, unknown> | null;
  currentLeases: unknown[];
  recurringChargesLandlord: unknown[];
  statement: Record<string, unknown> | null;
  deposits: unknown[];
}): PropertyFinancialOverview {
  const pf = propertyDetail ?? {};
  const leases = currentLeases as Record<string, unknown>[];
  const active = leases.filter((l) => ["ACTIVE", "MONTH_TO_MONTH"].includes(String(l.status ?? "")));
  const rentRoll = active.reduce((a, l) => a + n(l.monthlyRent), 0);
  const expectedIncome = n(pf.expectedMonthlyIncome);
  const monthlyIncome = rentRoll > 0 ? rentRoll : expectedIncome;

  const recurringRows = recurringChargesLandlord as Record<string, unknown>[];
  const totalRecurringExpenses = recurringRows.reduce((a, rc) => a + monthlyAmountFromRecurring(rc), 0);
  const expectedExpenses = n(pf.expectedMonthlyExpenses);
  const totalMonthlyExpenses = totalRecurringExpenses > 0 ? totalRecurringExpenses : expectedExpenses;

  const netCashFlow = monthlyIncome - totalMonthlyExpenses;
  const purchase = n(pf.purchasePrice);
  const value = n(pf.currentEstimatedValue);
  const annualYieldPercent =
    purchase > 0 && monthlyIncome > 0 ? Number((((monthlyIncome * 12) / purchase) * 100).toFixed(2)) : null;

  let occupancyStatus = "Vacant";
  let occupancyHelper = "No active lease";
  let leaseStatus = "Vacant";
  if (active.length > 0) {
    occupancyStatus = "Occupied";
    occupancyHelper = "Active lease in place";
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
    totalRecurringExpenses,
    netCashFlow,
    occupancyStatus,
    occupancyHelper,
    grossRentalIncome: monthlyIncome,
    totalMonthlyExpenses,
    netOperatingIncome: monthlyIncome - totalMonthlyExpenses,
    estimatedCashFlow: netCashFlow,
    annualYieldPercent,
    leaseStatus,
    incomePct,
    expensePct: 100 - incomePct,
    expenseCategories
  };
}

export { fmtZar };
