/** Shared formatters and data helpers for the portfolio dashboard UI. */

export type PortfolioChartRange = "THIS_YEAR" | "LAST_6" | "LAST_12" | "ALL";

export type MonthIncomeExpenseRow = {
  month?: string;
  income?: number;
  operatingExpenses?: number;
  debtService?: number;
  netCashFlow?: number;
};

export type NoiTrendRow = {
  month?: string;
  label?: string;
  income?: number;
  operatingExpenses?: number;
  noi?: number;
};

export type ActivityItem = {
  id: string;
  kind: "rent" | "lease" | "maintenance" | "tenant" | "warning" | "property";
  title: string;
  subtitle?: string;
  dateLabel: string;
  to?: string;
};

export function fmtZar(n: unknown): string {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return `R ${Math.round(x).toLocaleString()}`;
}

export function fmtZarCompact(n: unknown): string {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  if (Math.abs(x) >= 1_000_000) return `R ${(x / 1_000_000).toFixed(1)}M`;
  if (Math.abs(x) >= 10_000) return `R ${Math.round(x / 1000)}k`;
  return `R ${Math.round(x).toLocaleString()}`;
}

export function monthLabel(ym: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!m) return ym;
  return new Date(Number(m[1]), Number(m[2]) - 1, 1).toLocaleString("en-ZA", { month: "short" });
}

export function percentChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous === 0) {
    if (current === 0) return 0;
    return null;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function changeFromSeries(values: number[]): number | null {
  if (values.length < 2) return null;
  return percentChange(values[values.length - 1]!, values[values.length - 2]!);
}

export function formatChangeLine(pct: number | null): { text: string; tone: "up" | "down" | "neutral" } {
  if (pct == null) return { text: "— vs last month", tone: "neutral" };
  if (Math.abs(pct) < 0.05) return { text: "— 0% vs last month", tone: "neutral" };
  const sign = pct > 0 ? "+" : "";
  return {
    text: `${sign}${pct.toFixed(1)}% vs last month`,
    tone: pct > 0 ? "up" : "down"
  };
}

export function filterMonthRows<T extends { month?: string }>(rows: T[], range: PortfolioChartRange): T[] {
  if (!rows.length) return [];
  const sorted = [...rows].sort((a, b) => String(a.month).localeCompare(String(b.month)));
  if (range === "ALL") return sorted;
  if (range === "LAST_12") return sorted.slice(-12);
  if (range === "LAST_6") return sorted.slice(-6);
  const year = new Date().getFullYear();
  return sorted.filter((r) => String(r.month ?? "").startsWith(`${year}-`));
}

export type PortfolioChartPoint = { label: string; value: number; month?: string };

/**
 * Builds chart points from RPC history, then NOI trend, then a frontend-only estimate
 * (isolated — replace when historical equity series exists).
 */
export function buildPortfolioChartPoints(
  data: Record<string, unknown> | null | undefined,
  range: PortfolioChartRange
): { points: PortfolioChartPoint[]; estimated: boolean } {
  const charts = (data?.charts ?? {}) as Record<string, unknown>;
  const mie = (charts.monthlyIncomeExpenses ?? []) as MonthIncomeExpenseRow[];
  const filteredMie = filterMonthRows(
    mie.filter((r) => r.month),
    range === "THIS_YEAR" ? "THIS_YEAR" : range
  );
  if (filteredMie.length >= 2) {
    return {
      estimated: false,
      points: filteredMie.map((r) => ({
        month: r.month,
        label: monthLabel(String(r.month)),
        value: Number(r.netCashFlow ?? (Number(r.income ?? 0) - Number(r.operatingExpenses ?? 0) - Number(r.debtService ?? 0)))
      }))
    };
  }

  const noiRows = (charts.monthlyNOITrend ?? []) as NoiTrendRow[];
  const filteredNoi = filterMonthRows(
    noiRows.filter((r) => r.month || r.label),
    range === "ALL" ? "LAST_12" : range === "THIS_YEAR" ? "THIS_YEAR" : range
  );
  if (filteredNoi.length >= 2) {
    return {
      estimated: filteredNoi.some((r) => (r as { estimatedIncome?: boolean }).estimatedIncome),
      points: filteredNoi.map((r) => ({
        month: r.month,
        label: r.label ?? (r.month ? monthLabel(String(r.month)) : "—"),
        value: Number(r.noi ?? 0)
      }))
    };
  }

  return {
    estimated: true,
    points: buildEstimatedPortfolioChartPoints(data, range)
  };
}

/** Frontend-only projection; not persisted. */
function buildEstimatedPortfolioChartPoints(
  data: Record<string, unknown> | null | undefined,
  range: PortfolioChartRange
): PortfolioChartPoint[] {
  const k = (data?.kpis ?? {}) as Record<string, unknown>;
  const analysis = k.portfolioAnalysisOverTime as
    | { projectionGrowth?: { rentalIncomeGrowthPercentAnnual?: number; totalExpensesGrowthPercentAnnual?: number } }
    | undefined;
  const irrProj = (k.portfolioIRR as { projectionGrowth?: { rentalIncomeGrowthPercentAnnual?: number; totalExpensesGrowthPercentAnnual?: number } })
    ?.projectionGrowth;

  const incomeMo = Number(
    data?.contractualMonthlyRentFromLeases ??
      (k.monthlyNOI as { contractualMonthlyRentFromLeases?: number })?.contractualMonthlyRentFromLeases ??
      data?.totalMonthlyIncome ??
      0
  );
  const expensesMo = Number(
    (k.monthlyExpenses as { value?: number })?.value ??
      Number(data?.totalMonthlyOperatingExpenses ?? 0) + Number(data?.totalMonthlyDebtService ?? 0)
  );
  const baseCashFlow = incomeMo - expensesMo;
  const equity = Number(data?.portfolioEquity ?? 0);
  const rentGrowth =
    Number(
      analysis?.projectionGrowth?.rentalIncomeGrowthPercentAnnual ??
        irrProj?.rentalIncomeGrowthPercentAnnual ??
        5
    ) / 100;
  const expGrowth =
    Number(
      analysis?.projectionGrowth?.totalExpensesGrowthPercentAnnual ??
        irrProj?.totalExpensesGrowthPercentAnnual ??
        5
    ) / 100;

  const monthCount = range === "LAST_6" ? 6 : range === "THIS_YEAR" ? Math.max(1, new Date().getMonth() + 1) : 12;
  const now = new Date();
  const points: PortfolioChartPoint[] = [];

  for (let i = monthCount - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const yearsForward = (monthCount - 1 - i) / 12;
    const projectedIncome = incomeMo * Math.pow(1 + rentGrowth, yearsForward);
    const projectedExpenses = expensesMo * Math.pow(1 + expGrowth, yearsForward);
    const cash = projectedIncome - projectedExpenses;
    points.push({
      month: ym,
      label: monthLabel(ym),
      value: equity > 0 ? equity * 0.002 + cash : cash || baseCashFlow
    });
  }

  return points.length ? points : [{ label: monthLabel(now.toISOString().slice(0, 7)), value: baseCashFlow }];
}

export function buildActivityItems(data: Record<string, unknown> | null | undefined): ActivityItem[] {
  if (!data) return [];
  const items: ActivityItem[] = [];
  const today = new Date();

  const rentOverdue = Number((data.rentDue as { overdue?: number })?.overdue ?? 0);
  const rentSoon = Number((data.rentDue as { dueSoon?: number })?.dueSoon ?? 0);
  const leasesExp = Number((data.leases as { expiringSoon?: number })?.expiringSoon ?? 0);
  const leasesMtm = Number((data.leases as { monthToMonth?: number })?.monthToMonth ?? 0);
  const missingDocs = Number((data.missingData as { missingLeaseDocuments?: number })?.missingLeaseDocuments ?? 0);
  const negativeProps = ((data.charts as { cashFlowByProperty?: Array<{ name?: string; propertyName?: string; netCashFlow?: number }> })
    ?.cashFlowByProperty ?? []).filter((r) => Number(r.netCashFlow ?? 0) < 0);

  if (rentOverdue > 0) {
    items.push({
      id: "rent-overdue",
      kind: "warning",
      title: "Payment overdue",
      subtitle: `${rentOverdue} rent item${rentOverdue === 1 ? "" : "s"} need attention`,
      dateLabel: formatRelative(today),
      to: "/invoices"
    });
  }
  if (rentSoon > 0 && rentOverdue === 0) {
    items.push({
      id: "rent-soon",
      kind: "rent",
      title: "Rent due soon",
      subtitle: `${rentSoon} upcoming payment${rentSoon === 1 ? "" : "s"}`,
      dateLabel: formatRelative(today),
      to: "/invoices"
    });
  }
  if (leasesExp > 0) {
    items.push({
      id: "leases-exp",
      kind: "lease",
      title: "Lease expiring soon",
      subtitle: `${leasesExp} lease${leasesExp === 1 ? "" : "s"} within 90 days`,
      dateLabel: formatRelative(today),
      to: "/leases"
    });
  }
  if (leasesMtm > 0) {
    items.push({
      id: "leases-mtm",
      kind: "lease",
      title: "Month-to-month lease",
      subtitle: `${leasesMtm} active lease${leasesMtm === 1 ? "" : "s"} on rolling terms`,
      dateLabel: formatRelative(today),
      to: "/leases"
    });
  }

  const timeline = ((data.charts as { leaseTimeline?: Array<Record<string, unknown>> })?.leaseTimeline ?? []).slice(0, 4);
  timeline.forEach((row, idx) => {
    const tenant = String(row.tenantName ?? "").trim();
    const property = String(row.propertyName ?? "Property");
    if (tenant) {
      items.push({
        id: `tenant-${row.propertyId ?? idx}`,
        kind: "tenant",
        title: "Active tenant",
        subtitle: `${tenant} · ${property}`,
        dateLabel: row.fixedTermEndDate ? formatDate(String(row.fixedTermEndDate)) : formatRelative(today),
        to: row.propertyId ? `/owned-properties/${row.propertyId}?tab=leases` : undefined
      });
    } else {
      items.push({
        id: `lease-${row.propertyId ?? idx}`,
        kind: "lease",
        title: "Lease active",
        subtitle: property,
        dateLabel: formatRelative(today),
        to: row.propertyId ? `/owned-properties/${row.propertyId}?tab=leases` : "/leases"
      });
    }
  });

  negativeProps.slice(0, 2).forEach((row, idx) => {
    items.push({
      id: `neg-cf-${idx}`,
      kind: "maintenance",
      title: "Negative cash flow",
      subtitle: String(row.name ?? row.propertyName ?? "Property"),
      dateLabel: formatRelative(today),
      to: "/owned-properties/my-properties?sort=LOWEST_CASH"
    });
  });

  if (missingDocs > 0) {
    items.push({
      id: "missing-docs",
      kind: "lease",
      title: "Missing lease documents",
      subtitle: `${missingDocs} propert${missingDocs === 1 ? "y" : "ies"} need uploads`,
      dateLabel: formatRelative(today),
      to: "/documents"
    });
  }

  const income = Number(data.totalMonthlyIncomeReceived ?? data.totalMonthlyIncome ?? 0);
  if (income > 0 && items.length < 6) {
    items.unshift({
      id: "rent-received",
      kind: "rent",
      title: "Rent received",
      subtitle: fmtZar(income),
      dateLabel: formatRelative(today),
      to: "/financials"
    });
  }

  return items.slice(0, 8);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
}

function formatRelative(d: Date): string {
  return d.toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
}

export function displayUserName(email: string | undefined, fullName: string | null | undefined): string {
  const name = fullName?.trim();
  if (name) return name;
  if (email) {
    const local = email.split("@")[0];
    if (local) return local.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return "there";
}
