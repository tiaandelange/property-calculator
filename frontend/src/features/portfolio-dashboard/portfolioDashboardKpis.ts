/** Portfolio dashboard summary KPIs — aligned with `get_dashboard_summary` RPC. */

export const PORTFOLIO_DASHBOARD_METRIC_INFO = {
  netWorth:
    "Total current estimated property values minus outstanding bond balances for properties in the current filter.",
  monthlyIncome:
    "All income received in the selected calendar month (ledger entries marked received plus paid invoices), plus short-term rental estimates where configured. Respects property and type filters.",
  totalProperties: "Count of properties included in the current dashboard filter.",
  cashOnCashRoi:
    "Annual cash flow (monthly cash flow × 12) divided by total cash invested (purchase and buying costs recorded on each property). Uses filtered properties only.",
  tenants: "Active tenants linked to properties in your workspace.",
  occupancy:
    "Share of rental units with an active lease. Shown as occupied count versus units that require a tenant.",
  monthlyCashFlow:
    "Monthly income minus recurring operating expenses minus bond payments for the selected month. Same scope as the dashboard filters (one property when selected).",
  monthlyExpenses:
    "Recurring operating expenses plus bond payments recorded for the selected calendar month.",
  capRate:
    "Capitalization rate: annual net operating income divided by total current estimated market value. NOI is monthly income minus recurring operating expenses (bond payments excluded)."
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

export function parsePortfolioDashboardKpis(
  data: Record<string, unknown> | null | undefined
): PortfolioDashboardKpis {
  const k = (data?.kpis ?? {}) as Record<string, unknown>;
  const charts = (data?.charts ?? {}) as Record<string, unknown>;
  const valueDebt = (charts.valueDebtEquity ?? {}) as Record<string, unknown>;
  const monthlyNoiKpi = (k.monthlyNOI ?? {}) as Record<string, unknown>;
  const monthlyExpensesKpi = (k.monthlyExpenses ?? {}) as Record<string, unknown>;
  const cocKpi = (k.trueCashOnCashROI ?? {}) as Record<string, unknown>;

  const monthlyIncome = num(
    data?.totalMonthlyIncome ??
      monthlyNoiKpi.operatingIncome ??
      monthlyNoiKpi.operatingIncomeActualReceived
  );
  const monthlyOperatingExpenses = num(
    data?.totalMonthlyOperatingExpenses ?? monthlyExpensesKpi.operatingExpenses ?? monthlyNoiKpi.operatingExpenses
  );
  const monthlyDebtService = num(data?.totalMonthlyDebtService ?? monthlyExpensesKpi.debtService);
  const monthlyExpenses = num(monthlyExpensesKpi.value, monthlyOperatingExpenses + monthlyDebtService);
  const monthlyNoi = num(monthlyNoiKpi.value, monthlyIncome - monthlyOperatingExpenses);
  const monthlyCashFlow = num(data?.monthlyNetCashFlow, monthlyIncome - monthlyExpenses);

  const totalMarketValue = num(valueDebt.totalCurrentEstimatedValue);
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

  const capRatePercent =
    totalMarketValue > 0 && monthlyNoi !== 0
      ? ((monthlyNoi * 12) / totalMarketValue) * 100
      : num(data?.averageCapRate) > 0
        ? num(data.averageCapRate) * 100
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
