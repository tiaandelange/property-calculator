/**
 * Property investment report — data assembly for PDF only (no schema / RLS changes).
 * Uses statement RPC, property row, leases, and invoice payments; formulas documented inline.
 */

import {
  computeMetricsFromMonthlySnapshot,
  calculateIRRByProjectionYear,
  irrPercent as calculateIrrPercent,
  resolveDefaultIrr,
  projectLoanBalanceAfterYears,
  projectValue
} from "./propertyCalculatorServer.js";
import { computePropertyBondFinance, resolveBondRemainingMonths } from "./bondHelpers.js";
import { formatPdfPercent, formatPdfZar } from "./pdf/pdfFormat.js";
import {
  buildExecutiveSummary,
  derivePdfInvestmentRating,
  type PdfInvestmentRating
} from "./reportInvestmentRating.js";

export { projectLoanBalanceAfterYears, projectValue };

/** @deprecated Import from `@propertyCalculator/irrCalculator` — re-exported for API tests. */
export function irrPercent(c0: number | null, cashFlows: number[]): number | null {
  return calculateIrrPercent(c0, cashFlows);
}

export const PROJECTION_YEAR_COLUMNS = [1, 2, 5, 10, 15, 20, 30] as const;

export type PropertyInvestmentReportModel = {
  generatedAt: string;
  reportingPeriodLabel: string;
  property: {
    name: string;
    address: string;
    propertyType: string;
    investmentType: string;
    imageNote: string;
  };
  propertyInfo: { label: string; value: string }[];
  /** Property profile rows for the Property Information card (from the property record). */
  propertyDetails: { label: string; value: string }[];
  /** Monthly income & expense rows for the Income & Expenses card (property + statement data). */
  monthlyIncomeExpense: { label: string; value: string }[];
  metrics: {
    monthlyIncome: number;
    monthlyExpenses: number;
    monthlyCashFlow: number;
    totalCashNeeded: number | null;
    marketValue: number | null;
    purchasePrice: number | null;
    equity: number | null;
    occupancyLabel: string | null;
    grossRentalYield: number | null;
    internalRateOfReturn: number | null;
    cashOnCashRoi: number | null;
    capRate: number | null;
    twoPercentRule: number | null;
    ltv: number | null;
  };
  assumptions: { label: string; value: string }[];
  /** Key projection assumptions shown in a dedicated Assumptions section. */
  keyAssumptions: { label: string; value: string }[];
  executiveSummary: string[];
  investmentRating: PdfInvestmentRating;
  expenseBreakdown: { label: string; amount: number }[];
  projection: {
    years: number[];
    rows: { label: string; values: (string | number | null)[] }[];
  };
  actuals: { label: string; value: string }[];
  comparison: {
    metric: string;
    projected: string;
    actual: string;
    difference: string;
    variancePercent: string;
    status: string;
  }[];
  leases: { unit: string; tenants: string; status: string; monthlyRent: string; rentDueDay: string; start: string; end: string; balance: string }[];
  fiftyPercentRule: { label: string; value: string }[];
};

function n(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function pickNum(row: Record<string, unknown>, ...keys: string[]): number | null {
  for (const k of keys) {
    const raw = row[k];
    if (raw == null || raw === "") continue;
    const x = Number(raw);
    if (Number.isFinite(x)) return x;
  }
  return null;
}

function dash(v: number | null | undefined, formatter: (x: number) => string = formatZar): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return formatter(v);
}

export function formatZar(amount: number): string {
  return formatPdfZar(amount);
}

export function formatPct(value: number | null): string {
  return formatPdfPercent(value);
}

export function fiftyPercentRuleResult(
  monthlyGross: number,
  monthlyOperating: number,
  ruleCashFlow: number | null
): string {
  if (monthlyGross <= 0) return "Insufficient Data";
  const meetsOperating = monthlyOperating <= monthlyGross * 0.5 + 0.01;
  const positiveRuleCf = ruleCashFlow == null || ruleCashFlow >= 0;
  return meetsOperating && positiveRuleCf ? "Meets 50% Rule" : "Does Not Meet 50% Rule";
}

function dashText(v: unknown): string {
  const s = String(v ?? "").trim();
  return s.length ? s : "—";
}

function formatBedBath(bedrooms: number | null, bathrooms: number | null): string {
  if (bedrooms == null && bathrooms == null) return "—";
  const b = bedrooms != null ? String(bedrooms) : "—";
  const ba = bathrooms != null ? String(bathrooms) : "—";
  return `${b} bd / ${ba} ba`;
}

function snakeToCamelKey(k: string): string {
  return k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function snakeRowToCamel(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[snakeToCamelKey(k)] = v;
  }
  return out;
}

function monthlyFromRecurring(rc: Record<string, unknown>): number {
  const amt = n(rc.amount);
  const freq = String(rc.frequency ?? rc.recurringFrequency ?? "MONTHLY").toUpperCase();
  if (freq === "WEEKLY") return amt * (52 / 12);
  if (freq === "QUARTERLY") return amt / 3;
  if (freq === "ANNUALLY" || freq === "YEARLY") return amt / 12;
  return amt;
}

function activeLeases(leases: Record<string, unknown>[]): Record<string, unknown>[] {
  return leases.filter((l) => ["ACTIVE", "MONTH_TO_MONTH"].includes(String(l.status ?? "").toUpperCase()));
}

function leaseRentRoll(leases: Record<string, unknown>[]): number {
  return activeLeases(leases).reduce((a, l) => a + n(l.monthlyRent ?? l.monthly_rent), 0);
}

function comparisonStatus(diff: number, metric: "cash" | "default"): string {
  if (!Number.isFinite(diff) || Math.abs(diff) < 1) return "On Track";
  if (metric === "cash") return diff > 0 ? "Above Projection" : "Below Projection";
  return diff > 0 ? "Above Projection" : diff < 0 ? "Below Projection" : "On Track";
}

function variancePercent(projected: number, actual: number): string {
  if (!Number.isFinite(projected) || projected === 0) return "—";
  if (!Number.isFinite(actual)) return "—";
  return `${(((actual - projected) / projected) * 100).toFixed(2)}%`;
}

export type AssemblePropertyReportInput = {
  propertyRow: Record<string, unknown>;
  statement: Record<string, unknown>;
  leases: Record<string, unknown>[];
  invoices: Record<string, unknown>[];
  generatedAt?: Date;
  projectionAssumptions?: {
    annualIncomeGrowthPercentAnnual?: number | null;
    expenseGrowthPercentAnnual?: number | null;
    propertyAppreciationPercentAnnual?: number | null;
  } | null;
};

export function assemblePropertyInvestmentReportData(input: AssemblePropertyReportInput): PropertyInvestmentReportModel {
  const now = input.generatedAt ?? new Date();
  const p = snakeRowToCamel(input.propertyRow);
  const stmt = input.statement;
  const summary = (stmt.summary as Record<string, unknown>) ?? {};
  const bondFinance = (stmt.bondFinance as Record<string, unknown>) ?? {};
  const recurringRaw = (stmt.recurringCharges as unknown[]) ?? [];

  const purchasePrice = pickNum(p, "purchasePrice", "purchase_price");
  const marketValue = pickNum(p, "currentEstimatedValue", "current_estimated_value");
  const arv = pickNum(p, "afterRepairValue", "after_repair_value");
  const transferCosts = pickNum(p, "transferCosts", "transfer_costs");
  const bondCosts = pickNum(p, "bondCosts", "bond_costs");
  const rehab = pickNum(p, "rehabBudget", "rehab_budget");
  const cashInvested = pickNum(p, "totalCashInvested", "total_cash_invested");
  const loanBalance = pickNum(p, "outstandingBondBalance", "outstanding_bond_balance");
  const loanAmount = loanBalance ?? purchasePrice;

  const totalProjectCost =
    (purchasePrice ?? 0) + (transferCosts ?? 0) + (bondCosts ?? 0) + (rehab ?? 0) || null;

  const bondSnap = computePropertyBondFinance(
    {
      outstandingBondBalance: loanBalance,
      monthlyBondPayment: pickNum(p, "monthlyBondPayment", "monthly_bond_payment"),
      bondAnnualInterestRatePercent: pickNum(p, "bondAnnualInterestRatePercent", "bond_annual_interest_rate_percent"),
      bondTermYears: pickNum(p, "bondTermYears", "bond_term_years"),
      bondStartDate: (p.bondStartDate ?? p.bond_start_date) as string | Date | null,
      bondRemainingTermMonths: pickNum(p, "bondRemainingTermMonths", "bond_remaining_term_months")
    },
    now
  );

  const monthlyLoanPayment =
    bondSnap.paymentThisMonth > 0
      ? bondSnap.paymentThisMonth
      : pickNum(p, "monthlyBondPayment", "monthly_bond_payment") ??
        bondSnap.calculatedMonthlyPayment ??
        pickNum(bondFinance, "paymentThisMonth", "monthlyBondPaymentStored") ??
        0;

  const rentRoll = leaseRentRoll(input.leases);
  const expectedIncome = pickNum(p, "expectedMonthlyIncome", "expected_monthly_income") ?? 0;
  const monthlyIncome = rentRoll > 0 ? rentRoll : expectedIncome > 0 ? expectedIncome : n(summary.receivedThisMonth) + n(summary.expectedThisMonth);

  const recurringLandlord = (recurringRaw as Record<string, unknown>[]).filter(
    (rc) => String(rc.category ?? "") !== "BOND_PAYMENT"
  );
  const recurringMonthly = recurringLandlord.reduce((a, rc) => a + monthlyFromRecurring(rc), 0);
  const ratesMonthly = pickNum(p, "ratesAndTaxesMonthly", "rates_and_taxes_monthly") ?? 0;
  const leviesMonthly = pickNum(p, "leviesMonthly", "levies_monthly") ?? 0;
  const maintenanceMonthly = pickNum(p, "maintenanceMonthly", "maintenance_monthly") ?? 0;
  const utilitiesMonthly = pickNum(p, "monthlyUtilities", "monthly_utilities") ?? 0;
  const securityMonthly = pickNum(p, "securityMonthly", "security_monthly") ?? 0;
  const propertyFixedMonthly = ratesMonthly + leviesMonthly + maintenanceMonthly + utilitiesMonthly + securityMonthly;
  const expectedExpenses = pickNum(p, "expectedMonthlyExpenses", "expected_monthly_expenses") ?? 0;
  const monthlyOperating =
    recurringMonthly > 0
      ? recurringMonthly
      : expectedExpenses > 0
        ? expectedExpenses
        : propertyFixedMonthly > 0
          ? propertyFixedMonthly
          : 0;
  const monthlyExpenses = monthlyOperating + (monthlyLoanPayment > 0 ? monthlyLoanPayment : 0);
  const sharedMetrics = computeMetricsFromMonthlySnapshot({
    monthlyIncome,
    monthlyOperatingExpenses: monthlyOperating,
    monthlyLoanPayment: monthlyLoanPayment > 0 ? monthlyLoanPayment : 0,
    purchasePrice,
    marketValue,
    loanBalance,
    loanAmount: loanBalance,
    cashInvested
  });
  const monthlyCashFlow = sharedMetrics.monthlyCashFlow ?? monthlyIncome - monthlyExpenses;
  const annualIncome = monthlyIncome * 12;
  const grossRentalYield = sharedMetrics.grossYield;
  const capRate = sharedMetrics.capRate;
  const cashOnCashRoi = sharedMetrics.cashOnCashRoi;
  const twoPercentRule = sharedMetrics.twoPercentRule;
  const equity = sharedMetrics.equity;
  const ltvPct = sharedMetrics.ltv;

  const defaults = input.projectionAssumptions ?? null;
  const incomeGrowth =
    defaults?.annualIncomeGrowthPercentAnnual != null ? defaults.annualIncomeGrowthPercentAnnual : 6;
  const expenseGrowth =
    defaults?.expenseGrowthPercentAnnual != null ? defaults.expenseGrowthPercentAnnual : 6;
  const propertyGrowth =
    defaults?.propertyAppreciationPercentAnnual != null
      ? defaults.propertyAppreciationPercentAnnual
      : pickNum(p, "expectedAnnualAppreciationPercent", "expected_annual_appreciation_percent") ?? 6;
  const mgmtPct = pickNum(p, "managementFeePercent", "management_fee_percent");

  const resolvedTerm = resolveBondRemainingMonths(
    {
      bondTermYears: pickNum(p, "bondTermYears", "bond_term_years"),
      bondStartDate: (p.bondStartDate ?? p.bond_start_date) as string | Date | null,
      bondRemainingTermMonths: pickNum(p, "bondRemainingTermMonths", "bond_remaining_term_months")
    },
    now
  );
  const amortYears =
    resolvedTerm.totalTermMonths != null
      ? Math.round(resolvedTerm.totalTermMonths / 12)
      : pickNum(p, "bondTermYears", "bond_term_years");

  const yearCols = [...PROJECTION_YEAR_COLUMNS];
  const baseAnnualIncome = annualIncome;
  const baseAnnualExpenses = monthlyOperating * 12;
  const baseValue = marketValue ?? purchasePrice ?? 0;
  const startLoan = loanBalance ?? 0;
  const ratePct = pickNum(p, "bondAnnualInterestRatePercent", "bond_annual_interest_rate_percent");

  const projMonthlyGross = yearCols.map((y) => projectValue(monthlyIncome, incomeGrowth, y));
  const projIncome = yearCols.map((y) => projectValue(baseAnnualIncome, incomeGrowth, y));
  const projExpenses = yearCols.map((y) => projectValue(baseAnnualExpenses, expenseGrowth, y));
  const projNoi = yearCols.map((_, i) => {
    const inc = projIncome[i];
    const exp = projExpenses[i];
    if (inc == null || exp == null) return null;
    return inc - exp;
  });
  const projCashFlow = yearCols.map((y, i) => {
    const inc = projIncome[i];
    const exp = projExpenses[i];
    if (inc == null || exp == null) return null;
    const debt = monthlyLoanPayment * 12;
    return inc - exp - debt;
  });
  const projValue = yearCols.map((y) => projectValue(baseValue, propertyGrowth, y));
  const projLoan = yearCols.map((y) =>
    startLoan > 0 ? projectLoanBalanceAfterYears(startLoan, monthlyLoanPayment, ratePct, y) : 0
  );
  const projEquity = yearCols.map((y, i) => {
    const pv = projValue[i];
    const lb = projLoan[i];
    if (pv == null || lb == null) return null;
    return pv - lb;
  });

  const sellingCostPct = pickNum(p, "estimatedSellingCostPercent", "estimated_selling_cost_percent");
  const holdingYears = pickNum(p, "holdingPeriodYears", "holding_period_years");
  const irrByYear = calculateIRRByProjectionYear({
    initialCashInvested: cashInvested,
    baseAnnualIncome,
    baseAnnualOperatingExpenses: baseAnnualExpenses,
    annualDebtService: monthlyLoanPayment * 12,
    basePropertyValue: baseValue,
    startLoanBalance: startLoan,
    incomeGrowthPct: incomeGrowth,
    expenseGrowthPct: expenseGrowth,
    propertyGrowthPct: propertyGrowth,
    monthlyLoanPayment,
    interestRateApr: ratePct,
    sellingCostPct,
    projectionYears: yearCols,
    holdingPeriodYears: holdingYears,
    hasLoan: startLoan > 0
  });
  const irrByHorizon = irrByYear.map((row) => row.irr);
  const defaultIrr = resolveDefaultIrr(irrByYear, holdingYears);
  const projCoC = yearCols.map((y, i) => {
    const cf = projCashFlow[i];
    if (cf == null || cashInvested == null || cashInvested <= 0) return null;
    return Number(((cf / cashInvested) * 100).toFixed(2));
  });

  let paymentsReceived = 0;
  let invoicesRaised = 0;
  let unpaidTotal = 0;
  for (const inv of input.invoices) {
    const total = n(inv.total ?? inv.total_amount);
    invoicesRaised += total;
    const st = String(inv.status ?? "").toUpperCase();
    if (!["PAID", "CANCELLED", "VOID"].includes(st)) unpaidTotal += n(inv.balanceDue ?? inv.balance_due) || total;
    const pays = (inv.payments as unknown[]) ?? (inv.invoice_payments as unknown[]) ?? [];
    for (const pay of pays as Record<string, unknown>[]) {
      paymentsReceived += n(pay.amount);
    }
  }

  const receivedMonth = n(summary.receivedThisMonth);
  const expensesMonth = n(summary.expensesThisMonth);

  const expenseBreakdown: { label: string; amount: number }[] = [];
  const byCat = new Map<string, number>();
  for (const rc of recurringLandlord) {
    const cat = String(rc.category ?? "OTHER").replace(/_/g, " ");
    byCat.set(cat, (byCat.get(cat) ?? 0) + monthlyFromRecurring(rc));
  }
  if (ratesMonthly > 0 && ![...byCat.keys()].some((k) => /rates|tax/i.test(k))) {
    byCat.set("Property tax / rates", ratesMonthly);
  }
  if (leviesMonthly > 0 && ![...byCat.keys()].some((k) => /levy|hoa/i.test(k))) {
    byCat.set("HOA / levies", leviesMonthly);
  }
  if (maintenanceMonthly > 0 && ![...byCat.keys()].some((k) => /maint/i.test(k))) {
    byCat.set("Maintenance", maintenanceMonthly);
  }
  if (utilitiesMonthly > 0 && ![...byCat.keys()].some((k) => /util/i.test(k))) {
    byCat.set("Utilities", utilitiesMonthly);
  }
  for (const [label, amount] of byCat) {
    if (amount > 0) expenseBreakdown.push({ label, amount });
  }
  if (monthlyLoanPayment > 0) expenseBreakdown.push({ label: "Bond / loan payment", amount: monthlyLoanPayment });

  const mgmtFromPct =
    mgmtPct != null && mgmtPct > 0 && monthlyIncome > 0 ? (monthlyIncome * mgmtPct) / 100 : 0;
  const mgmtFromRecurring = [...byCat.entries()]
    .filter(([k]) => /management/i.test(k))
    .reduce((a, [, v]) => a + v, 0);
  const mgmtMonthly = Math.max(mgmtFromRecurring, mgmtFromPct);
  const insuranceMonthly = [...byCat.entries()]
    .filter(([k]) => /insurance/i.test(k))
    .reduce((a, [, v]) => a + v, 0);

  const activeLeaseCount = activeLeases(input.leases).length;
  const expectedIncomeForOcc = pickNum(p, "expectedMonthlyIncome", "expected_monthly_income");
  const occupancyLabel =
    expectedIncomeForOcc != null && expectedIncomeForOcc > 0 && monthlyIncome > 0
      ? `${Math.min(100, Math.round((monthlyIncome / expectedIncomeForOcc) * 100))}%`
      : activeLeaseCount > 0
        ? "100%"
        : null;

  const purchaseDateRaw = (p.purchaseDate ?? p.purchase_date) as string | null;
  const purchaseDateLabel = purchaseDateRaw ? String(purchaseDateRaw).slice(0, 10) : "—";

  const propertyDetails: { label: string; value: string }[] = [
    { label: "Property Type", value: dashText(p.propertyType ?? p.property_type) },
    {
      label: "Bedrooms / Bathrooms",
      value: formatBedBath(pickNum(p, "bedrooms"), pickNum(p, "bathrooms"))
    },
    {
      label: "Living Area / Size",
      value: pickNum(p, "sizeSqm", "size_sqm") != null ? `${pickNum(p, "sizeSqm", "size_sqm")} sqm` : "—"
    },
    { label: "Lot Size", value: "—" },
    { label: "Year Built", value: "—" },
    {
      label: "Parking",
      value: pickNum(p, "parkingBays", "parking_bays") != null ? String(pickNum(p, "parkingBays", "parking_bays")) : "—"
    },
    { label: "Property Tax / Rates", value: ratesMonthly > 0 ? formatZar(ratesMonthly) : "—" },
    { label: "HOA / Levies", value: leviesMonthly > 0 ? formatZar(leviesMonthly) : "—" },
    { label: "Insurance", value: insuranceMonthly > 0 ? formatZar(insuranceMonthly) : "—" },
    { label: "Zoning", value: dashText(p.zoning ?? p.landUse ?? p.land_use) },
    { label: "Notes", value: dashText(p.notes) }
  ];

  const monthlyIncomeExpense: { label: string; value: string }[] = [
    { label: "Gross Rent", value: formatZar(monthlyIncome) },
    { label: "Other Income", value: "—" },
    { label: "Total Income", value: formatZar(monthlyIncome) },
    { label: "Property Tax / Rates", value: ratesMonthly > 0 ? formatZar(ratesMonthly) : "—" },
    { label: "Insurance", value: insuranceMonthly > 0 ? formatZar(insuranceMonthly) : "—" },
    { label: "HOA / Levies", value: leviesMonthly > 0 ? formatZar(leviesMonthly) : "—" },
    { label: "Property Management", value: mgmtMonthly > 0 ? formatZar(mgmtMonthly) : "—" },
    {
      label: "Maintenance & Repairs",
      value: maintenanceMonthly > 0 ? formatZar(maintenanceMonthly) : "—"
    },
    { label: "Utilities", value: utilitiesMonthly > 0 ? formatZar(utilitiesMonthly) : "—" },
    ...(monthlyLoanPayment > 0
      ? [{ label: "Debt Service", value: formatZar(monthlyLoanPayment) }]
      : []),
    { label: "Total Expenses", value: formatZar(monthlyExpenses) }
  ];

  const monthLabel = now.toLocaleDateString("en-ZA", { month: "long", year: "numeric", timeZone: "UTC" });

  const leases = input.leases.map((l) => {
    const c = snakeRowToCamel(l);
    const puRaw = l.property_units ?? c.propertyUnits ?? c.property_units;
    const pu = Array.isArray(puRaw) ? puRaw[0] : puRaw;
    const unitName =
      pu && typeof pu === "object"
        ? String((pu as Record<string, unknown>).unit_name ?? (pu as Record<string, unknown>).unitName ?? "")
        : "";
    const lt = (l.lease_tenants ?? c.leaseTenants) as Record<string, unknown>[] | undefined;
    const names: string[] = [];
    if (Array.isArray(lt)) {
      for (const link of lt) {
        const t = (link.tenants ?? link.tenant) as Record<string, unknown> | undefined;
        if (t && typeof t === "object") {
          const fn = String(t.first_name ?? t.firstName ?? "").trim();
          const ln = String(t.last_name ?? t.lastName ?? "").trim();
          if (fn || ln) names.push(`${fn} ${ln}`.trim());
        }
      }
    }
    return {
      unit: unitName || String(c.unitName ?? c.unit_name ?? "—"),
      tenants: names.length ? names.join(", ") : "—",
      status: String(c.status ?? "—"),
      monthlyRent: dash(pickNum(c, "monthlyRent", "monthly_rent")),
      rentDueDay: c.rentDueDay != null || c.rent_due_day != null ? String(c.rentDueDay ?? c.rent_due_day) : "—",
      start: String(c.startDate ?? c.start_date ?? "—").slice(0, 10),
      end: String(c.fixedTermEndDate ?? c.fixed_term_end_date ?? "—").slice(0, 10) || "Month-to-month",
      balance: "—"
    };
  });

  const fiftyPctExpenses = monthlyIncome * 0.5;
  const ruleCashFlow =
    monthlyIncome > 0 ? monthlyIncome - fiftyPctExpenses - monthlyLoanPayment : null;
  const meetsFiftyOperating = monthlyIncome > 0 ? monthlyOperating <= fiftyPctExpenses + 0.01 : null;

  const investmentRating = derivePdfInvestmentRating({
    monthlyGrossIncome: monthlyIncome,
    monthlyCashFlow,
    monthlyOperatingExpenses: monthlyOperating,
    monthlyLoanPayment: monthlyLoanPayment > 0 ? monthlyLoanPayment : 0,
    grossYield: grossRentalYield,
    twoPercentRule,
    cashOnCashRoi,
    internalRateOfReturn: defaultIrr ?? irrByHorizon[0] ?? null,
    cashInvested,
    purchasePrice,
    meetsFiftyPercentOperating: meetsFiftyOperating,
    ruleCashFlow
  });

  const keyAssumptions: { label: string; value: string }[] = [
    { label: "Cash invested / deposit", value: dash(cashInvested) },
    { label: "Annual rent growth", value: formatPct(incomeGrowth) },
    { label: "Expense growth", value: formatPct(expenseGrowth) },
    { label: "Property appreciation", value: formatPct(propertyGrowth) }
  ];

  return {
    generatedAt: now.toISOString(),
    reportingPeriodLabel: monthLabel,
    property: {
      name: String(p.name ?? "Property"),
      address: [p.addressLine1, p.suburb, p.city, p.province, p.postalCode]
        .map((x) => (x != null ? String(x).trim() : ""))
        .filter(Boolean)
        .join(", "),
      propertyType: String(p.propertyType ?? p.property_type ?? "—"),
      investmentType: String(p.investmentType ?? p.investment_type ?? "—"),
      imageNote: "No property image available"
    },
    propertyDetails,
    monthlyIncomeExpense,
    propertyInfo: [
      { label: "Purchase price", value: dash(purchasePrice) },
      { label: "Closing / transfer costs", value: dash(transferCosts) },
      { label: "Estimated repair costs", value: dash(rehab) },
      { label: "Total cost of project", value: dash(totalProjectCost && totalProjectCost > 0 ? totalProjectCost : null) },
      { label: "After repair value / market value", value: dash(arv ?? marketValue) },
      { label: "Equity", value: dash(equity) },
      { label: "Deposit / cash invested", value: dash(cashInvested) },
      { label: "Loan amount", value: dash(loanAmount) },
      { label: "Loan balance", value: dash(loanBalance) },
      { label: "Amortised over", value: amortYears != null ? `${amortYears} years` : "—" },
      { label: "Loan interest rate", value: formatPct(ratePct) },
      { label: "Monthly loan payment", value: dash(monthlyLoanPayment > 0 ? monthlyLoanPayment : null) }
    ],
    metrics: {
      monthlyIncome,
      monthlyExpenses,
      monthlyCashFlow,
      totalCashNeeded: cashInvested,
      marketValue: marketValue ?? arv,
      purchasePrice,
      equity,
      occupancyLabel,
      grossRentalYield,
      internalRateOfReturn: defaultIrr ?? irrByHorizon[0] ?? null,
      cashOnCashRoi,
      capRate,
      twoPercentRule,
      ltv: ltvPct
    },
    keyAssumptions,
    executiveSummary: buildExecutiveSummary(investmentRating),
    investmentRating,
    assumptions: [
      { label: "Purchase date", value: purchaseDateLabel },
      {
        label: "Holding period",
        value: holdingYears != null ? `${holdingYears} years` : "30 years"
      },
      { label: "Annual rent growth", value: formatPct(incomeGrowth) },
      { label: "Expense inflation", value: formatPct(expenseGrowth) },
      { label: "Property appreciation", value: formatPct(propertyGrowth) },
      { label: "Loan amount", value: dash(loanAmount) },
      { label: "Loan interest rate", value: formatPct(ratePct) },
      { label: "Loan term", value: amortYears != null ? `${amortYears} years` : "—" },
      { label: "Down payment / cash invested", value: dash(cashInvested) },
      { label: "Closing costs", value: dash(transferCosts) },
      { label: "Income tax rate", value: "—" }
    ],
    expenseBreakdown,
    projection: {
      years: yearCols,
      rows: [
        { label: "Monthly gross rent", values: projMonthlyGross },
        { label: "Total annual income", values: projIncome },
        { label: "Total annual expenses", values: projExpenses },
        { label: "Net operating income", values: projNoi },
        { label: "Total annual cash flow", values: projCashFlow },
        { label: "Property value", values: projValue },
        { label: "Equity", values: projEquity },
        { label: "Loan balance", values: projLoan },
        { label: "Cash on cash ROI", values: projCoC },
        { label: "IRR", values: irrByHorizon }
      ]
    },
    actuals: [
      { label: "Total invoices raised", value: formatZar(invoicesRaised) },
      { label: "Total payments received", value: formatZar(paymentsReceived) },
      { label: "Total unpaid invoices", value: formatZar(unpaidTotal) },
      { label: "Received this month (statement)", value: formatZar(receivedMonth) },
      { label: "Operating expenses this month", value: formatZar(expensesMonth) },
      { label: "Net actual cash flow (month)", value: formatZar(receivedMonth - expensesMonth) },
      { label: "Balance due (open invoices)", value: formatZar(n(summary.balanceDue)) }
    ],
    comparison: [
      {
        metric: "Gross Rent",
        projected: formatZar(monthlyIncome),
        actual: formatZar(receivedMonth),
        difference: formatZar(receivedMonth - monthlyIncome),
        variancePercent: variancePercent(monthlyIncome, receivedMonth),
        status: comparisonStatus(receivedMonth - monthlyIncome, "default")
      },
      {
        metric: "Total Expenses",
        projected: formatZar(monthlyExpenses),
        actual: formatZar(expensesMonth),
        difference: formatZar(expensesMonth - monthlyExpenses),
        variancePercent: variancePercent(monthlyExpenses, expensesMonth),
        status: comparisonStatus(expensesMonth - monthlyExpenses, "default")
      },
      {
        metric: "Net Operating Income",
        projected: formatZar(monthlyIncome - monthlyOperating),
        actual: formatZar(receivedMonth - expensesMonth),
        difference: formatZar(receivedMonth - expensesMonth - (monthlyIncome - monthlyOperating)),
        variancePercent: variancePercent(monthlyIncome - monthlyOperating, receivedMonth - expensesMonth),
        status: comparisonStatus(
          receivedMonth - expensesMonth - (monthlyIncome - monthlyOperating),
          "default"
        )
      },
      {
        metric: "Cash Flow After Debt Service",
        projected: formatZar(monthlyCashFlow),
        actual: formatZar(receivedMonth - expensesMonth),
        difference: formatZar(receivedMonth - expensesMonth - monthlyCashFlow),
        variancePercent: variancePercent(monthlyCashFlow, receivedMonth - expensesMonth),
        status: comparisonStatus(receivedMonth - expensesMonth - monthlyCashFlow, "cash")
      },
      {
        metric: "Occupancy",
        projected: occupancyLabel ?? "—",
        actual: occupancyLabel ?? "—",
        difference: "—",
        variancePercent: "—",
        status: "—"
      }
    ],
    leases,
    fiftyPercentRule: [
      { label: "Monthly Gross Rent", value: formatZar(monthlyIncome) },
      { label: "50% Operating Allowance", value: formatZar(fiftyPctExpenses) },
      { label: "Operating Expenses (excl. debt)", value: formatZar(monthlyOperating) },
      { label: "Debt Service", value: dash(monthlyLoanPayment > 0 ? monthlyLoanPayment : null) },
      { label: "Rule Cash Flow", value: dash(ruleCashFlow) },
      {
        label: "Result",
        value: fiftyPercentRuleResult(monthlyIncome, monthlyOperating, ruleCashFlow)
      },
      {
        label: "Operating costs vs gross rent",
        value:
          monthlyIncome > 0
            ? `Operating costs are ${formatPct((monthlyOperating / monthlyIncome) * 100)} of gross rent (debt service excluded).`
            : "—"
      }
    ]
  };
}
