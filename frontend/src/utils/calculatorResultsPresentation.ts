import type { IconName } from "../components/icons/iconRegistry";
import type { CalculatorSummaryCard } from "../components/calculators/tool/CalculatorToolSummaryCards";
import { getCalculatorSummaryMetricInfo } from "../data/calculatorSummaryMetricInfo";

export type SummaryMetricLike = {
  key?: string;
  label?: string;
  unit?: string;
  value?: unknown;
  formatted?: string;
};

export type ResultTone = "positive" | "negative" | "neutral";

/** Consistent ZAR display: R 17,390 or -R 8,060 */
export function formatCalculatorZar(value: number): string {
  const rounded = Math.round(value);
  const abs = Math.abs(rounded);
  const body = abs.toLocaleString("en-US", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0
  });
  return rounded < 0 ? `-R ${body}` : `R ${body}`;
}

export function formatCalculatorPercent(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value < 0 ? "-" : "";
  return `${sign}${Math.abs(value).toFixed(decimals)}%`;
}

export function formatResultsMetricDisplay(m: SummaryMetricLike): string {
  const unit = m.unit ?? "";
  const formatted = m.formatted ?? "—";
  const raw = m.value;
  if (raw == null || typeof raw !== "number" || !Number.isFinite(raw)) {
    if (unit === "currency" && typeof formatted === "string" && formatted.startsWith("R")) {
      return normalizeZarString(formatted);
    }
    return formatted;
  }
  if (unit === "currency") return formatCalculatorZar(raw);
  if (unit === "percent") return formatCalculatorPercent(raw);
  if (unit === "number") {
    return Math.round(raw).toLocaleString("en-US", {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0
    });
  }
  return formatted;
}

function normalizeZarString(s: string): string {
  const t = s.replace(/\u00a0/g, " ").trim();
  const negative = t.startsWith("-") || t.includes("-R");
  const digits = t.replace(/[^\d]/g, "");
  if (!digits) return t;
  const n = Number(digits);
  return formatCalculatorZar(negative ? -n : n);
}

export function metricTone(m: SummaryMetricLike): ResultTone {
  const raw = m.value;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return "neutral";
  if (m.unit === "percent" || m.unit === "currency") {
    if (raw < 0) return "negative";
    if (raw > 0) return "positive";
  }
  return "neutral";
}

export type PrimaryResultPresentation = {
  tone: ResultTone;
  badge?: string;
  suffix?: string;
  formattedValue?: string;
};

export function getPrimaryResultPresentation(
  slug: string,
  primary: SummaryMetricLike | undefined
): PrimaryResultPresentation {
  if (!primary) return { tone: "neutral" };

  const raw = primary.value;
  const n = typeof raw === "number" && Number.isFinite(raw) ? raw : NaN;
  const formattedValue = formatResultsMetricDisplay(primary);

  if (slug === "cash-flow" && Number.isFinite(n)) {
    return {
      tone: n >= 0 ? "positive" : "negative",
      badge: n >= 0 ? "Cash-flow positive" : "Cash-flow negative",
      suffix: " / month",
      formattedValue
    };
  }

  if (slug === "monthly-payment" && primary.unit === "currency") {
    return { tone: "positive", suffix: " / month", formattedValue };
  }

  if (primary.unit === "currency" && Number.isFinite(n)) {
    return {
      tone: n >= 0 ? "positive" : "negative",
      formattedValue
    };
  }

  if (primary.unit === "percent" && Number.isFinite(n)) {
    return {
      tone: n >= 0 ? "positive" : "negative",
      formattedValue
    };
  }

  return { tone: "neutral", formattedValue };
}

export function buildCalculatorSummaryCards(
  slug: string,
  result: { summary?: SummaryMetricLike[]; breakdown?: Record<string, unknown> } | null
): CalculatorSummaryCard[] {
  if (!result) return [];

  if (slug === "cash-flow" && result.breakdown) {
    const b = result.breakdown;
    const margin = Number(b.cashFlowMarginPercent);
    return [
      {
        key: "effectiveIncome",
        label: "Effective rental income",
        value: formatCalculatorZar(Number(b.effectiveMonthlyIncome) || 0),
        info: getCalculatorSummaryMetricInfo("effectiveIncome"),
        icon: "income" as IconName,
        tone: "neutral"
      },
      {
        key: "monthlyNOI",
        label: "Monthly NOI",
        value: formatCalculatorZar(Number(b.monthlyNOI) || 0),
        info: getCalculatorSummaryMetricInfo("monthlyNOI"),
        icon: "wallet" as IconName,
        tone: Number(b.monthlyNOI) < 0 ? "negative" : "neutral"
      },
      {
        key: "debtService",
        label: "Debt service",
        value: formatCalculatorZar(Number(b.monthlyDebtService) || 0),
        info: getCalculatorSummaryMetricInfo("debtService"),
        icon: "calculators" as IconName,
        tone: "neutral"
      },
      {
        key: "cashFlowMargin",
        label: "Cash flow margin",
        value: formatCalculatorPercent(margin),
        info: getCalculatorSummaryMetricInfo("cashFlowMargin"),
        icon: "percent" as IconName,
        tone: margin < 0 ? "negative" : margin > 0 ? "positive" : "neutral"
      }
    ];
  }

  const summary = result.summary ?? [];
  return summary.slice(1, 5).map((m) => {
    const key = String(m.key ?? m.label ?? "");
    const label = String(m.label ?? "");
    return {
      key,
      label,
      value: formatResultsMetricDisplay(m),
      tone: metricTone(m),
      info: getCalculatorSummaryMetricInfo(key, label)
    };
  });
}

export function getCalculatorChartTitle(slug: string, fallback?: string): string {
  if (slug === "cash-flow") return "Cash flow breakdown";
  return fallback ?? "Chart";
}

export function isCashFlowNegative(result: { summary?: SummaryMetricLike[]; breakdown?: Record<string, unknown> } | null): boolean {
  if (!result) return false;
  const fromBreakdown = Number((result.breakdown as { monthlyCashFlow?: number } | undefined)?.monthlyCashFlow);
  if (Number.isFinite(fromBreakdown)) return fromBreakdown < 0;
  const primary = result.summary?.[0];
  if (primary?.key === "monthlyCashFlow" && typeof primary.value === "number") {
    return primary.value < 0;
  }
  return false;
}

export function buildCashFlowInterpretation(breakdown: Record<string, unknown>): string {
  const income = formatCalculatorZar(Number(breakdown.effectiveMonthlyIncome) || 0);
  const monthly = Number(breakdown.monthlyCashFlow) || 0;
  const cf = formatCalculatorZar(monthly);
  if (monthly < 0) {
    return `Your effective monthly income is ${income} after vacancy. After operating expenses and debt service, the property is estimated to be cash-flow negative at ${cf} per month.`;
  }
  return `Your effective monthly income is ${income} after vacancy. After operating expenses and debt service, the property is estimated to be cash-flow positive at ${cf} per month.`;
}
