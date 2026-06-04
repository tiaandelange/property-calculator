/**
 * Portfolio dashboard summary KPIs — same basis as each property Financials tab
 * (`computePropertyMonthlyFinancialSnapshot`): active-lease rent, recurring expense
 * schedules, and bond payments from the property profile (plus additional bonds).
 */

export const PORTFOLIO_DASHBOARD_METRIC_INFO = {
  netWorth:
    "Total current estimated property values minus outstanding bond balances for properties in the current filter.",
  monthlyIncome:
    "Combined monthly rent from active leases (or expected income when no lease rent is set), matching the Financials tab on each property.",
  totalProperties: "Count of properties included in the current dashboard filter.",
  cashOnCashRoi:
    "Annual cash flow (monthly cash flow × 12) divided by total cash invested on filtered properties. Cash flow uses the same income, recurring expenses, and bond payments as the Financials tab.",
  tenants: "Active tenants linked to properties in your workspace.",
  occupancy:
    "Share of rental units with an active lease. Shown as occupied count versus units that require a tenant.",
  monthlyCashFlow:
    "Monthly income minus recurring operating expenses minus bond payments — same formula as the Financials tab net cash flow.",
  monthlyExpenses:
    "Recurring operating expenses from the Financials tab plus primary and additional bond monthly payments configured on each property.",
  capRate:
    "Annual net operating income divided by total current estimated market value. NOI is monthly income minus recurring operating expenses only (bond payments excluded), matching Financials."
} as const;

export type PortfolioDashboardKpis = {
  monthlyIncome: number;
  monthlyOperatingExpenses: number;
  monthlyDebtService: number;
  monthlyExpenses: number;
  monthlyNoi: number;
  monthlyCashFlow: number;
  totalMarketValue: number;
  totalCashInvested: number | null;
  cashOnCashAnnualPercent: number | null;
  capRatePercent: number | null;
};

function num(v: unknown, fallback = 0): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

function numOrNull(v: unknown): number | null {
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

/** Prefer the first finite number in the list (including zero). */
function pick(...values: unknown[]): number {
  for (const v of values) {
    if (v == null || v === "") continue;
    const x = Number(v);
    if (Number.isFinite(x)) return x;
  }
  return 0;
}

function sumPropertyField(properties: Record<string, unknown>[], field: string): number {
  return properties.reduce((acc, p) => acc + num(p[field]), 0);
}

export function filterPropertiesForDashboard(
  properties: Record<string, unknown>[],
  opts?: { propertyTypes?: string[]; propertyId?: string | number | null }
): Record<string, unknown>[] {
  let list = properties;
  const propertyId = opts?.propertyId;
  if (propertyId != null && propertyId !== "") {
    list = list.filter((p) => String(p.id) === String(propertyId));
  }
  const types = opts?.propertyTypes?.filter(Boolean) ?? [];
  if (types.length > 0) {
    const allowed = new Set(types.map((t) => t.toUpperCase()));
    list = list.filter((p) =>
      allowed.has(String(p.investmentType ?? p.investment_type ?? "").toUpperCase())
    );
  }
  return list;
}

/** Sums Financials-tab monthly figures across filtered properties (primary dashboard KPI source). */
export function aggregatePortfolioKpisFromProperties(
  properties: Record<string, unknown>[]
): PortfolioDashboardKpis {
  const monthlyIncome = sumPropertyField(properties, "monthlyIncome");
  const monthlyOperatingExpenses = sumPropertyField(properties, "monthlyOperatingExpenses");
  const monthlyDebtService = sumPropertyField(properties, "monthlyDebtService");
  const monthlyExpenses = sumPropertyField(properties, "monthlyExpenses");
  const monthlyNoi = sumPropertyField(properties, "monthlyNOI");
  const monthlyCashFlow = properties.reduce(
    (acc, p) => acc + num(p.netCashFlow ?? p.monthlyCashFlowAfterDebtService),
    0
  );

  const totalMarketValue = properties.reduce(
    (acc, p) => acc + num(p.currentEstimatedValue),
    0
  );
  const totalCashInvested = properties.reduce((acc, p) => {
    const invested = numOrNull(p.totalCashInvested) ?? numOrNull(p.total_cash_invested);
    if (invested != null && invested > 0) return acc + invested;
    const purchase = num(p.purchasePrice);
    return purchase > 0 ? acc + purchase : acc;
  }, 0);
  const totalBuyingCosts = totalCashInvested > 0 ? totalCashInvested : null;

  const annualCashFlow = monthlyCashFlow * 12;
  const cashOnCashAnnualPercent =
    totalBuyingCosts != null && totalBuyingCosts > 0
      ? (annualCashFlow / totalBuyingCosts) * 100
      : null;

  const capRatePercent =
    totalMarketValue > 0 && monthlyNoi !== 0 ? ((monthlyNoi * 12) / totalMarketValue) * 100 : null;

  return {
    monthlyIncome,
    monthlyOperatingExpenses,
    monthlyDebtService,
    monthlyExpenses,
    monthlyNoi,
    monthlyCashFlow,
    totalMarketValue,
    totalCashInvested: totalBuyingCosts,
    cashOnCashAnnualPercent,
    capRatePercent
  };
}

/** RPC fallback when property rows are not loaded yet. Prefers lease rent over received ledger. */
export function parsePortfolioDashboardKpis(
  data: Record<string, unknown> | null | undefined
): PortfolioDashboardKpis {
  const k = (data?.kpis ?? {}) as Record<string, unknown>;
  const charts = (data?.charts ?? {}) as Record<string, unknown>;
  const valueDebt = (charts.valueDebtEquity ?? {}) as Record<string, unknown>;
  const monthlyNoiKpi = (k.monthlyNOI ?? {}) as Record<string, unknown>;
  const monthlyExpensesKpi = (k.monthlyExpenses ?? {}) as Record<string, unknown>;
  const cocKpi = (k.trueCashOnCashROI ?? {}) as Record<string, unknown>;

  const leaseIncome = pick(
    monthlyNoiKpi.operatingIncomeProjectedFromLeases,
    data?.contractualMonthlyRentFromLeases,
    monthlyNoiKpi.contractualMonthlyRentFromLeases
  );
  const receivedIncome = pick(
    data?.totalMonthlyIncomeReceived,
    data?.totalMonthlyIncome,
    monthlyNoiKpi.operatingIncomeActualReceived,
    monthlyNoiKpi.operatingIncome
  );
  const monthlyIncome = leaseIncome > 0 ? leaseIncome : receivedIncome;

  const monthlyOperatingExpenses = pick(
    data?.totalMonthlyOperatingExpenses,
    monthlyExpensesKpi.operatingExpenses,
    monthlyNoiKpi.operatingExpenses
  );
  const monthlyDebtService = pick(data?.totalMonthlyDebtService, monthlyExpensesKpi.debtService);
  const monthlyExpenses = pick(monthlyExpensesKpi.value, monthlyOperatingExpenses + monthlyDebtService);
  const monthlyNoi = monthlyIncome - monthlyOperatingExpenses;
  const monthlyCashFlow = monthlyIncome - monthlyExpenses;

  const totalMarketValue = pick(
    valueDebt.totalCurrentEstimatedValue,
    data?.totalCurrentEstimatedValue
  );
  const totalCashInvested = numOrNull(cocKpi.totalCashInvested);
  const totalBuyingCosts =
    totalCashInvested != null && totalCashInvested > 0
      ? totalCashInvested
      : num(data?.totalPurchasePrice) > 0
        ? num(data?.totalPurchasePrice)
        : null;

  const annualCashFlow = monthlyCashFlow * 12;
  const cashOnCashAnnualPercent =
    totalBuyingCosts != null && totalBuyingCosts > 0
      ? (annualCashFlow / totalBuyingCosts) * 100
      : numOrNull(cocKpi.valuePercent);

  const averageCapRate = num(data?.averageCapRate);
  const capRatePercent =
    totalMarketValue > 0 && monthlyNoi !== 0
      ? ((monthlyNoi * 12) / totalMarketValue) * 100
      : averageCapRate > 0
        ? averageCapRate * 100
        : null;

  return {
    monthlyIncome,
    monthlyOperatingExpenses,
    monthlyDebtService,
    monthlyExpenses,
    monthlyNoi,
    monthlyCashFlow,
    totalMarketValue,
    totalCashInvested: totalBuyingCosts,
    cashOnCashAnnualPercent,
    capRatePercent
  };
}

export function resolvePortfolioDashboardKpis(
  summary: Record<string, unknown> | null | undefined,
  properties: Record<string, unknown>[],
  filters?: { propertyTypes?: string[]; propertyId?: string | number | null }
): PortfolioDashboardKpis {
  const filtered = filterPropertiesForDashboard(properties, filters);
  if (filtered.length > 0) {
    return aggregatePortfolioKpisFromProperties(filtered);
  }
  return parsePortfolioDashboardKpis(summary);
}
