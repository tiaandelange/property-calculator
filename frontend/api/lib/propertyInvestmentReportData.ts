/**
 * Property investment report — data assembly for PDF only (no schema / RLS changes).
 * Uses statement RPC, property row, leases, and invoice payments; formulas documented inline.
 */

import { computePropertyBondFinance, resolveBondRemainingMonths } from "./bondHelpers.js";

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
  metrics: {
    monthlyIncome: number;
    monthlyExpenses: number;
    monthlyCashFlow: number;
    totalCashNeeded: number | null;
    grossRentalYield: number | null;
    cashOnCashRoi: number | null;
    capRate: number | null;
    twoPercentRule: number | null;
  };
  assumptions: { label: string; value: string }[];
  expenseBreakdown: { label: string; amount: number }[];
  projection: {
    years: number[];
    rows: { label: string; values: (string | number | null)[] }[];
  };
  actuals: { label: string; value: string }[];
  comparison: { metric: string; projected: string; actual: string; difference: string; status: string }[];
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
  const v = Math.round((Number(amount) || 0) + Number.EPSILON);
  return `R ${v.toLocaleString("en-ZA")}`;
}

export function formatPct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(2)}%`;
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

function projectValue(base: number, annualPct: number | null, years: number): number | null {
  if (base <= 0) return null;
  if (annualPct == null || !Number.isFinite(annualPct)) return base;
  return base * Math.pow(1 + annualPct / 100, years);
}

/** Amortising balance after `years` full years of monthly payments. */
function projectLoanBalanceAfterYears(
  startBalance: number,
  monthlyPayment: number,
  annualRatePct: number | null,
  years: number
): number | null {
  if (startBalance <= 0) return 0;
  const months = years * 12;
  if (months <= 0) return startBalance;
  const rate = annualRatePct != null && annualRatePct > 0 ? annualRatePct : null;
  let balance = startBalance;
  const pmt = monthlyPayment > 0 ? monthlyPayment : null;
  if (pmt == null && rate == null) return null;

  for (let i = 0; i < months; i++) {
    const interest = rate != null ? (balance * rate) / 100 / 12 : 0;
    const pay = pmt ?? interest;
    const principal = Math.max(0, pay - interest);
    balance = Math.max(0, balance - principal);
    if (balance <= 0.005) return 0;
  }
  return Math.round(balance * 100) / 100;
}

function comparisonStatus(diff: number, metric: "cash" | "default"): string {
  if (!Number.isFinite(diff) || Math.abs(diff) < 1) return "On Track";
  if (metric === "cash") return diff > 0 ? "Above Projection" : "Below Projection";
  return diff > 0 ? "Above Projection" : diff < 0 ? "Below Projection" : "On Track";
}

export type AssemblePropertyReportInput = {
  propertyRow: Record<string, unknown>;
  statement: Record<string, unknown>;
  leases: Record<string, unknown>[];
  invoices: Record<string, unknown>[];
  generatedAt?: Date;
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
  const expectedExpenses = pickNum(p, "expectedMonthlyExpenses", "expected_monthly_expenses") ?? 0;
  const monthlyOperating = recurringMonthly > 0 ? recurringMonthly : expectedExpenses;
  const monthlyExpenses = monthlyOperating + (monthlyLoanPayment > 0 ? monthlyLoanPayment : 0);
  const monthlyCashFlow = monthlyIncome - monthlyExpenses;

  const valueForYield = marketValue ?? purchasePrice;
  const annualIncome = monthlyIncome * 12;
  const annualNoi = (monthlyIncome - monthlyOperating) * 12;
  const grossRentalYield =
    valueForYield != null && valueForYield > 0 && monthlyIncome > 0
      ? Number((((monthlyIncome * 12) / valueForYield) * 100).toFixed(2))
      : null;
  const capRate =
    valueForYield != null && valueForYield > 0 && annualNoi > 0
      ? Number(((annualNoi / valueForYield) * 100).toFixed(2))
      : null;
  const cashOnCashRoi =
    cashInvested != null && cashInvested > 0
      ? Number((((monthlyCashFlow * 12) / cashInvested) * 100).toFixed(2))
      : null;
  const twoPercentRule =
    purchasePrice != null && purchasePrice > 0 && monthlyIncome > 0
      ? Number(((monthlyIncome / purchasePrice) * 100).toFixed(2))
      : null;

  const equity =
    marketValue != null && loanBalance != null ? marketValue - loanBalance : marketValue != null && loanBalance == null ? marketValue : null;

  const propertyGrowth = pickNum(p, "expectedAnnualAppreciationPercent", "expected_annual_appreciation_percent");
  const incomeGrowth = propertyGrowth;
  const expenseGrowth = propertyGrowth;
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

  const projIncome = yearCols.map((y) => projectValue(baseAnnualIncome, incomeGrowth, y));
  const projExpenses = yearCols.map((y) => projectValue(baseAnnualExpenses, expenseGrowth, y));
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
  if (monthlyIncome > 0) expenseBreakdown.push({ label: "Rental income", amount: monthlyIncome });
  const byCat = new Map<string, number>();
  for (const rc of recurringLandlord) {
    const cat = String(rc.category ?? "OTHER").replace(/_/g, " ");
    byCat.set(cat, (byCat.get(cat) ?? 0) + monthlyFromRecurring(rc));
  }
  for (const [label, amount] of byCat) {
    if (amount > 0) expenseBreakdown.push({ label, amount });
  }
  if (monthlyLoanPayment > 0) expenseBreakdown.push({ label: "Bond / loan payment", amount: monthlyLoanPayment });

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
    monthlyLoanPayment > 0 ? monthlyIncome - fiftyPctExpenses - monthlyLoanPayment : null;

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
      grossRentalYield,
      cashOnCashRoi,
      capRate,
      twoPercentRule
    },
    assumptions: [
      { label: "Annual property value growth", value: formatPct(propertyGrowth) },
      { label: "Annual income growth", value: formatPct(incomeGrowth) },
      { label: "Annual expense growth", value: formatPct(expenseGrowth) },
      { label: "Management fee", value: formatPct(mgmtPct) },
      { label: "Loan interest rate", value: formatPct(ratePct) },
      { label: "Projection horizon", value: "30 years" }
    ],
    expenseBreakdown,
    projection: {
      years: yearCols,
      rows: [
        {
          label: "Total annual income",
          values: projIncome.map((v) => (v == null ? "—" : formatZar(v)))
        },
        {
          label: "Total annual expenses",
          values: projExpenses.map((v) => (v == null ? "—" : formatZar(v)))
        },
        {
          label: "Total annual cash flow",
          values: projCashFlow.map((v) => (v == null ? "—" : formatZar(v)))
        },
        {
          label: "Property value",
          values: projValue.map((v) => (v == null ? "—" : formatZar(v)))
        },
        {
          label: "Equity",
          values: projEquity.map((v) => (v == null ? "—" : formatZar(v)))
        },
        {
          label: "Loan balance",
          values: projLoan.map((v) => (v == null ? "—" : formatZar(v)))
        },
        {
          label: "Cash on cash ROI",
          values: projCoC.map((v) => (v == null ? "—" : formatPct(v)))
        }
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
        metric: "Income",
        projected: formatZar(monthlyIncome),
        actual: formatZar(receivedMonth),
        difference: formatZar(receivedMonth - monthlyIncome),
        status: comparisonStatus(receivedMonth - monthlyIncome, "default")
      },
      {
        metric: "Expenses",
        projected: formatZar(monthlyExpenses),
        actual: formatZar(expensesMonth),
        difference: formatZar(expensesMonth - monthlyExpenses),
        status: comparisonStatus(expensesMonth - monthlyExpenses, "default")
      },
      {
        metric: "Cash flow",
        projected: formatZar(monthlyCashFlow),
        actual: formatZar(receivedMonth - expensesMonth),
        difference: formatZar(receivedMonth - expensesMonth - monthlyCashFlow),
        status: comparisonStatus(receivedMonth - expensesMonth - monthlyCashFlow, "cash")
      }
    ],
    leases,
    fiftyPercentRule: [
      { label: "Total monthly income", value: formatZar(monthlyIncome) },
      { label: "50% for expenses", value: formatZar(fiftyPctExpenses) },
      { label: "Monthly loan payment", value: dash(monthlyLoanPayment > 0 ? monthlyLoanPayment : null) },
      { label: "50% rule cash flow", value: dash(ruleCashFlow) }
    ]
  };
}
