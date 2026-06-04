import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, BarElement, CategoryScale, Legend, LinearScale, LineElement, PointElement, Tooltip } from "chart.js";
import { calculators, type FieldDef } from "../data/calculators";
import { getCalculatorDefaultValues } from "../data/calculatorDefaultValues";
import { getCalculatorToolPage } from "../data/calculatorToolPageContent";
import { getToolExplainer } from "../data/calculatorToolExplainerContent";
import { getSupabase } from "../lib/supabaseClient";
import { runCalculatorLocally, saveCalculationResult } from "../services/calculationsSupabase";
import { fetchPdfBlob, isAbsoluteHttpUrl, openPdfBlobInNewTab } from "../api/pdfBlob";
import { generateReportViaVercel } from "../services/reportsVercel";
import { CalculatorToolPageLayout } from "../components/calculators/tool/CalculatorToolPageLayout";
import { CalculatorToolProTip } from "../components/calculators/tool/CalculatorToolProTip";
import { CalculatorToolResultsHero } from "../components/calculators/tool/CalculatorToolResultsHero";
import { getCalculatorToolPageMeta } from "../data/calculatorToolPageMeta";
import { BuyVsRentSimpleResults } from "../components/calculators/BuyVsRentSimpleResults";
import type { SimpleBuyVsRentCoreResult } from "@calculatorShared/buyVsRentSimple/simpleBuyVsRentTypes";
import { useCalculatorMobileLayout } from "../hooks/useCalculatorMobileLayout";
import { CalculatorToolInputsAccordion } from "../components/calculators/tool/CalculatorToolInputsAccordion";
import { CalculatorToolAmortisationTable } from "../components/calculators/tool/CalculatorToolAmortisationTable";
import { CalculatorToolBreakdownList } from "../components/calculators/tool/CalculatorToolBreakdownList";
import { CalculatorToolStickyBar } from "../components/calculators/tool/CalculatorToolStickyBar";
import { buildCalculatorInputSummary } from "../utils/formatCalculatorInputSummary";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Grid } from "../components/ui/Grid";
import { Card } from "../components/ui/Card";
import { Field, Input } from "../components/ui/Input";
import { Button, ButtonLink } from "../components/ui/Button";
import { PlanLimitUpgradePrompt } from "../features/subscription/PlanLimitUpgradePrompt";
import { formatReportLimitUsage } from "../features/subscription/subscriptionLimits";
import { useSubscriptionLimits } from "../features/subscription/useSubscriptionLimits";
import { LockedFeaturePreview } from "../lib/subscription/LockedFeaturePreview";
import { getCalculatorPlanGateFeature } from "../lib/subscription/planGatingHelpers";
import { usePlanPermissions } from "../lib/subscription/usePlanPermissions";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Legend, Tooltip, PointElement, LineElement);

function parseNumberList(text: string) {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n));
}

function selectFieldCoerceValue(field: FieldDef, raw: string): string | number {
  if (raw === "") return "";
  if (field.type !== "select") return Number(raw);
  const stringSelectKeys = new Set([
    "transactionType",
    "buyerType",
    "feeYear",
    "attorneyFeeMode",
    "propertyUse"
  ]);
  if (stringSelectKeys.has(field.key)) return raw;
  return Number(raw);
}

/** HTML inputs often yield strings; shared Zod schemas expect real numbers. */
function coerceEngineNumericPayload(payload: Record<string, unknown>) {
  const neverCoerce = new Set(["scenarioName", "annualCashFlows", "items"]);
  for (const key of Object.keys(payload)) {
    if (neverCoerce.has(key)) continue;
    const v = payload[key];
    if (typeof v !== "string") continue;
    const t = v.trim();
    if (t === "") continue;
    const normalized = t.replace(/,/g, "").replace(/\s/g, "");
    if (normalized === "") continue;
    const n = Number(normalized);
    if (Number.isFinite(n)) payload[key] = n;
  }
}

function normalizeScenarioNameField(payload: Record<string, unknown>) {
  const sn = payload.scenarioName;
  if (sn === null || sn === undefined) {
    delete payload.scenarioName;
    return;
  }
  if (typeof sn === "string") {
    const t = sn.trim();
    if (t) payload.scenarioName = t;
    else delete payload.scenarioName;
  }
}

/** Best-effort string for UI when catch receives non-Error throws or odd axios/PostgREST shapes. */
function formatClientCatch(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message;
  if (typeof err === "string" && err.trim()) return err;
  const a = err as {
    message?: unknown;
    response?: { data?: { message?: unknown; error?: unknown }; status?: number };
    issues?: Array<{ message?: string }>;
  };
  const axiosMsg = a?.response?.data?.message ?? a?.response?.data?.error;
  if (axiosMsg != null && String(axiosMsg).trim()) return String(axiosMsg);
  if (a?.response?.status != null) return `Request failed (HTTP ${a.response.status}).`;
  if (a?.message != null && String(a.message).trim()) return String(a.message);
  if (err && typeof err === "object") {
    try {
      const s = JSON.stringify(err);
      if (s !== "{}") return s;
    } catch {
      /* ignore */
    }
  }
  return "Calculation failed";
}

function toPayload(slug: string, values: Record<string, any>) {
  if (slug === "noi") {
    const items = Array.isArray(values.expenseItems) ? values.expenseItems : [];
    const rentG = Number(values.rentGrowthPercentAnnual);
    const expG = Number(values.expenseGrowthPercentAnnual);
    const out: Record<string, unknown> = {
      rentalIncomeAnnual: Number(values.rentalIncomeAnnual),
      otherIncomeAnnual: Number(values.otherIncomeAnnual) || 0,
      vacancyRatePercent: Number(values.vacancyRatePercent) || 0,
      maintenancePercentOfEffectiveGross: Number(values.maintenancePercentOfEffectiveGross) || 0,
      rentGrowthPercentAnnual: Number.isFinite(rentG) ? rentG : 3,
      expenseGrowthPercentAnnual: Number.isFinite(expG) ? expG : 3,
      expenseItems: items.map((it: any) => ({
        label: String(it?.label ?? "Expense").trim() || "Expense",
        annualAmount: Math.max(0, Number(it?.annualAmount) || 0)
      }))
    };
    const sn = values.scenarioName;
    if (typeof sn === "string" && sn.trim()) out.scenarioName = sn.trim();
    return out;
  }

  const payload: Record<string, unknown> = { ...values };
  normalizeScenarioNameField(payload);

  if (slug === "transfer-bond-costs") {
    const numKeys = new Set([
      "purchasePrice",
      "marketValue",
      "bondAmount",
      "depositAmount",
      "manualTransferAttorneyFee",
      "manualBondAttorneyFee",
      "vatRate",
      "municipalRatesClearanceProvision",
      "postagesAndPettiesEstimate",
      "ficaFeeEstimate",
      "deedsSearchFeeEstimate",
      "electronicInstructionFeeEstimate"
    ]);
    for (const k of numKeys) {
      const v = payload[k];
      if (v === "" || v === undefined || v === null) {
        delete payload[k];
        continue;
      }
      if (typeof v === "string" || typeof v === "number") {
        const n = Number(v);
        if (Number.isFinite(n)) payload[k] = n;
      }
    }
    const boolKeys = [
      "includeBondRegistration",
      "includeDepositInCashRequired",
      "sellerVatRegistered",
      "isFirstTimeBuyer"
    ] as const;
    for (const k of boolKeys) {
      payload[k] = Boolean(values[k]);
    }
  }

  if (slug === "irr" && typeof values.annualCashFlows === "string") {
    payload.annualCashFlows = parseNumberList(values.annualCashFlows);
  }
  if (slug === "dcf" && typeof values.annualCashFlows === "string") {
    payload.annualCashFlows = parseNumberList(values.annualCashFlows);
  }
  if (slug === "rehab-cost" && typeof values.items === "string") {
    try {
      payload.items = JSON.parse(values.items);
    } catch {
      // backend will validate and return a clear error
    }
  }

  coerceEngineNumericPayload(payload);
  return payload;
}

function mergeThemedChartOptions(base: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const b = base && typeof base === "object" ? base : {};
  const legendColor =
    typeof document !== "undefined"
      ? getComputedStyle(document.documentElement).getPropertyValue("--text-secondary").trim() || "#cbd5e1"
      : "#cbd5e1";
  const tickColor =
    typeof document !== "undefined"
      ? getComputedStyle(document.documentElement).getPropertyValue("--text-muted").trim() || "#64748b"
      : "#64748b";
  const gridColor =
    typeof document !== "undefined"
      ? getComputedStyle(document.documentElement).getPropertyValue("--border-soft").trim() || "#1b2233"
      : "#1b2233";
  const plugins = (b.plugins as Record<string, unknown> | undefined) ?? {};
  const legend = (plugins.legend as Record<string, unknown> | undefined) ?? {};
  const legendLabels = (legend.labels as Record<string, unknown> | undefined) ?? {};
  const mergedPlugins = {
    ...plugins,
    legend: {
      ...legend,
      labels: { color: legendColor, ...legendLabels }
    }
  };
  const scales = b.scales as Record<string, unknown> | undefined;
  if (!scales || !Object.keys(scales).length) {
    return { ...b, plugins: mergedPlugins };
  }
  const mergeAxis = (axis: Record<string, unknown> | undefined) => {
    const a = axis ?? {};
    const ticks = (a.ticks as Record<string, unknown> | undefined) ?? {};
    const grid = (a.grid as Record<string, unknown> | undefined) ?? {};
    return {
      ...a,
      ticks: { color: tickColor, ...ticks },
      grid: { color: gridColor, ...grid }
    };
  };
  return {
    ...b,
    plugins: mergedPlugins,
    scales: {
      ...scales,
      x: scales.x != null ? mergeAxis(scales.x as Record<string, unknown>) : scales.x,
      y: scales.y != null ? mergeAxis(scales.y as Record<string, unknown>) : scales.y
    }
  };
}

/** Responsive chart options for narrow viewports (no formula changes). */
function mergeMobileChartOptions(base: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const themed = mergeThemedChartOptions(base);
  const plugins = (themed.plugins as Record<string, unknown> | undefined) ?? {};
  const legend = (plugins.legend as Record<string, unknown> | undefined) ?? {};
  return {
    ...themed,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      ...plugins,
      legend: {
        ...legend,
        position: "top",
        align: "end"
      }
    }
  };
}

function buildIllustrativeFiveYearLineChart(metric: { label: string; value: number }) {
  const growth = 0.03;
  const series = [0, 1, 2, 3, 4].map((y) => Math.round(metric.value * (1 + growth) ** y));
  const line =
    typeof document !== "undefined"
      ? getComputedStyle(document.documentElement).getPropertyValue("--chart-line").trim() || "#8b5cf6"
      : "#8b5cf6";
  const fill =
    typeof document !== "undefined"
      ? getComputedStyle(document.documentElement).getPropertyValue("--chart-fill").trim() ||
        "rgba(139, 92, 246, 0.22)"
      : "rgba(139, 92, 246, 0.22)";
  return {
    chartType: "line" as const,
    title: "Five-year illustrative trend (3% p.a. — not a forecast)",
    data: {
      labels: ["Year 1", "Year 2", "Year 3", "Year 4", "Year 5"],
      datasets: [
        {
          label: metric.label,
          data: series,
          borderColor: line,
          backgroundColor: fill,
          fill: true,
          tension: 0.25
        }
      ]
    },
    options: {} as Record<string, unknown>
  };
}

type SummaryMetricLike = {
  key?: string;
  label?: string;
  unit?: string;
  value?: unknown;
  formatted?: string;
};

/** Results pane: ZAR without cents; percentages keep backend decimal formatting. */
function formatResultsMetricDisplay(m: SummaryMetricLike): string {
  const unit = m.unit ?? "";
  const formatted = m.formatted ?? "—";
  const raw = m.value;
  if (raw == null || typeof raw !== "number" || !Number.isFinite(raw)) {
    return formatted;
  }
  if (unit === "currency") {
    return Math.round(raw).toLocaleString("en-ZA", {
      style: "currency",
      currency: "ZAR",
      maximumFractionDigits: 0,
      minimumFractionDigits: 0
    });
  }
  if (unit === "percent") {
    return formatted;
  }
  if (unit === "number") {
    return Math.round(raw).toLocaleString("en-ZA", {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0
    });
  }
  return formatted;
}

function formatZarResultsAmount(n: number): string {
  return Math.round(n).toLocaleString("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0
  });
}

const MONTHLY_PAYMENT_RELATED = ["transfer-bond-costs", "ltv", "cash-flow", "dscr"] as const;
const CALCULATOR_TOOL_FORM_ID = "calculator-tool-form";

export function CalculatorPage() {
  const { slug } = useParams();
  const calc = useMemo(() => calculators.find((c) => c.slug === slug), [slug]);
  const [values, setValues] = useState<Record<string, any>>(() => getCalculatorDefaultValues(slug ?? ""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<any>(null);
  const [autoUpdate, setAutoUpdate] = useState(true);
  const lastRunRef = useRef<string>("");
  const [savedId, setSavedId] = useState<string | number | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const subscriptionLimits = useSubscriptionLimits();
  const planPermissions = usePlanPermissions();
  const calculatorGateFeature = slug ? getCalculatorPlanGateFeature(slug) : null;
  const showForecasting = planPermissions.canUseFeature("forecasting");
  const { isMobile, inputsExpanded, setInputsExpanded, onCalculateSuccess, showStickyActions } =
    useCalculatorMobileLayout(slug);

  const runWithValues = useCallback(async (targetSlug: string, payloadValues: Record<string, any>, opts?: { userInitiated?: boolean }) => {
    setError("");
    setLoading(true);
    setSavedId(null);
    const payload = toPayload(targetSlug, payloadValues);
    try {
      let calcResult: ReturnType<typeof runCalculatorLocally>;
      try {
        calcResult = runCalculatorLocally(targetSlug, payload);
      } catch (calcErr: unknown) {
        const issues = (calcErr as Error & { issues?: { message?: string }[] })?.issues;
        const base = formatClientCatch(calcErr);
        throw issues?.length
          ? new Error(`Calculator: ${base}: ${issues.map((i) => i.message).filter(Boolean).join(" · ")}`)
          : new Error(`Calculator: ${base}`);
      }
      setResult(calcResult);
      if (opts?.userInitiated) onCalculateSuccess();
      const { data: sessionData } = await getSupabase().auth.getSession();
      if (sessionData.session) {
        try {
          const saved = await saveCalculationResult(targetSlug, payload, calcResult);
          setSavedId(saved.id);
        } catch (saveErr: unknown) {
          setSavedId(null);
          const sm =
            saveErr instanceof Error
              ? saveErr.message
              : saveErr && typeof saveErr === "object" && "message" in saveErr
                ? String((saveErr as { message: unknown }).message)
                : String(saveErr);
          throw new Error(
            `Could not save this run: ${sm}. (Results are still shown; try signing in, or check profile / free uses in Supabase.)`
          );
        }
      } else {
        setSavedId(null);
      }
      lastRunRef.current = JSON.stringify(payloadValues);
    } catch (err: unknown) {
      const issues = (err as Error & { issues?: { message?: string }[] })?.issues ?? (err as any)?.response?.data?.issues;
      const msg = formatClientCatch(err);
      setError(issues?.length ? `${msg}: ${issues.map((i: any) => i.message).join(" · ")}` : msg);
    } finally {
      setLoading(false);
    }
  }, [onCalculateSuccess]);

  useEffect(() => {
    if (!slug) return;
    const calcDef = calculators.find((c) => c.slug === slug);
    if (!calcDef) return;
    const defaults = getCalculatorDefaultValues(calcDef.slug);
    setValues(defaults);
    setResult(null);
    setError("");
    setSavedId(null);
    lastRunRef.current = "";
    if (calcDef.slug === "monthly-payment") return;
    let cancelled = false;
    void (async () => {
      setError("");
      setLoading(true);
      setSavedId(null);
      try {
        const payload = toPayload(calcDef.slug, defaults);
        let calcResult: ReturnType<typeof runCalculatorLocally>;
        try {
          calcResult = runCalculatorLocally(calcDef.slug, payload);
        } catch (calcErr: unknown) {
          if (cancelled) return;
          const issues = (calcErr as Error & { issues?: { message?: string }[] })?.issues;
          const base = formatClientCatch(calcErr);
          throw issues?.length
            ? new Error(`Calculator: ${base}: ${issues.map((i) => i.message).filter(Boolean).join(" · ")}`)
            : new Error(`Calculator: ${base}`);
        }
        if (cancelled) return;
        setResult(calcResult);
        const { data: sessionData } = await getSupabase().auth.getSession();
        if (sessionData.session) {
          try {
            const saved = await saveCalculationResult(calcDef.slug, payload, calcResult);
            if (cancelled) return;
            setSavedId(saved.id);
          } catch (saveErr: unknown) {
            if (cancelled) return;
            setSavedId(null);
            const sm =
              saveErr instanceof Error
                ? saveErr.message
                : saveErr && typeof saveErr === "object" && "message" in saveErr
                  ? String((saveErr as { message: unknown }).message)
                  : String(saveErr);
            throw new Error(
              `Could not save this run: ${sm}. (Results are still shown; try signing in, or check profile / free uses in Supabase.)`
            );
          }
        } else {
          if (cancelled) return;
          setSavedId(null);
        }
        lastRunRef.current = JSON.stringify(defaults);
      } catch (err: unknown) {
        if (cancelled) return;
        const issues = (err as Error & { issues?: { message?: string }[] })?.issues ?? (err as any)?.response?.data?.issues;
        const msg = formatClientCatch(err);
        setError(issues?.length ? `${msg}: ${issues.map((i: any) => i.message).join(" · ")}` : msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!calc) {
    return (
      <Section>
        <Container>
          <Card>
            <h1 className="pg-h2" style={{ marginTop: 0 }}>
              Calculator not found
            </h1>
            <p className="pg-lead">Try one of the calculators from the menu.</p>
          </Card>
        </Container>
      </Section>
    );
  }

  const run = async (userInitiated = true) => {
    await runWithValues(calc.slug, values, { userInitiated });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await run();
  };

  const requiredKeys = useMemo(
    () =>
      calc.groups
        .flatMap((g) => g.fields)
        .filter((f) => f.required)
        .map((f) => f.key),
    [calc.groups]
  );

  const hasAllRequired = useMemo(() => {
    if (calc.slug === "noi") {
      const rent = Number(values.rentalIncomeAnnual);
      const items = values.expenseItems;
      if (!Number.isFinite(rent) || rent <= 0) return false;
      if (!Array.isArray(items) || items.length === 0) return false;
      return true;
    }
    if (!requiredKeys.length) return true;
    return requiredKeys.every((k) => values[k] !== undefined && values[k] !== null && String(values[k]).length > 0);
  }, [calc.slug, requiredKeys, values]);

  useEffect(() => {
    if (!autoUpdate) return;
    if (!hasAllRequired) return;
    if (!result) return;
    const current = JSON.stringify(values);
    if (current === lastRunRef.current) return;
    const t = window.setTimeout(() => void runWithValues(calc.slug, values), 450);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoUpdate, hasAllRequired, values]);

  const summary = result?.summary ?? [];
  const chartData = result?.chartData ?? [];
  const chartsToRender = useMemo(() => {
    const raw = (chartData ?? []) as Array<{ chartType: string; title?: string; data?: unknown; options?: unknown }>;
    const hasLine = raw.some((c) => c.chartType === "line");
    const cur = summary.find((m: any) => m.unit === "currency" && m.value != null && Number.isFinite(m.value)) as
      | { label: string; value: number }
      | undefined;
    const illustration = !hasLine && cur ? [buildIllustrativeFiveYearLineChart(cur)] : [];
    return [...illustration, ...raw];
  }, [chartData, summary]);

  const reset = () => {
    const defaults = getCalculatorDefaultValues(calc.slug);
    setValues(defaults);
    setResult(null);
    setError("");
    setSavedId(null);
    lastRunRef.current = "";
    if (calc.slug !== "monthly-payment") {
      void runWithValues(calc.slug, defaults);
    }
  };

  const generateAndDownloadPdf = async () => {
    if (!savedId) return;
    if (!subscriptionLimits.canGenerateReport && subscriptionLimits.limitsActive) {
      setError(subscriptionLimits.upgradeMessage ?? "Report limit reached for your plan.");
      return;
    }
    setPdfBusy(true);
    setError("");
    try {
      const gen = await generateReportViaVercel({ reportType: "CALCULATION", calculationId: String(savedId) });
      const downloadUrl = gen.downloadUrl;
      if (!downloadUrl) throw new Error(gen.error ?? "No download URL returned.");
      if (isAbsoluteHttpUrl(downloadUrl)) {
        window.open(downloadUrl, "_blank", "noopener,noreferrer");
      } else {
        const blob = await fetchPdfBlob(downloadUrl);
        openPdfBlobInNewTab(blob);
      }
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Failed to generate PDF.");
    } finally {
      setPdfBusy(false);
    }
  };

  const pageMeta = getCalculatorToolPageMeta(calc.slug);
  const themedPage = getCalculatorToolPage(calc.slug);

  const relatedSlugs = (themedPage?.relatedSlugs ?? [...MONTHLY_PAYMENT_RELATED]).filter((s) => s !== calc.slug);

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: pageMeta.seoHeading, url });
        return;
      }
    } catch {
      /* user cancelled or unsupported */
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* clipboard unavailable */
    }
  }, [pageMeta.seoHeading]);

  const relatedLinks = relatedSlugs
    .map((s) => calculators.find((c) => c.slug === s))
    .filter(Boolean) as typeof calculators;

  const inputSummaryRows = useMemo(
    () => buildCalculatorInputSummary(calc.slug, calc.groups, values),
    [calc.slug, calc.groups, values]
  );

  const workspaceLayoutClass = ["pg-calc-tool-workspace-grid", "pg-calculator-detail-layout"].join(" ");

  const chartOptionsForViewport = (base: Record<string, unknown> | null | undefined, slug: string) => {
    if (isMobile) return mergeMobileChartOptions(base) as Record<string, unknown>;
    if (slug === "monthly-payment") return (base ?? {}) as Record<string, unknown>;
    return mergeThemedChartOptions(base) as Record<string, unknown>;
  };

  const primarySummaryMetric = summary[0] as SummaryMetricLike | undefined;
  const heroMetricBlocks = summary.slice(1, 5).map((m: SummaryMetricLike) => ({
    label: String(m.label ?? ""),
    value: formatResultsMetricDisplay(m)
  }));
  const extraSummaryMetrics = summary.slice(5);
  const primarySuffix =
    calc.slug === "monthly-payment" && primarySummaryMetric?.unit === "currency" ? " / month" : undefined;

  const calculatorWorkspace = (
    <div className={workspaceLayoutClass}>
        <div id="calculator-inputs-pane" className="pg-calculator-pane pg-calc-tool-col pg-calc-tool-col--inputs">
        <CalculatorToolInputsAccordion
          summaryRows={inputSummaryRows}
          expanded={inputsExpanded}
          onToggleExpanded={() => setInputsExpanded((v) => !v)}
          isMobile={isMobile}
        >
          <form id={CALCULATOR_TOOL_FORM_ID} onSubmit={submit}>
            {calc.groups.map((group) => (
              <div key={group.title} style={{ marginBottom: 18 }}>
                <div className="pg-card-title" style={{ marginBottom: 10 }}>
                  {group.title}
                </div>
                <div className="pg-calculator-input-grid">
                  {group.fields.map((f) => (
                    <Field key={f.key} label={f.label} help={f.help ?? "Use realistic, conservative assumptions."}>
                      {f.type === "select" ? (
                        <select
                          className="pg-input"
                          value={values[f.key] ?? ""}
                          required={Boolean(f.required)}
                          onChange={(e) =>
                            setValues((v) => ({ ...v, [f.key]: selectFieldCoerceValue(f, e.target.value) }))
                          }
                        >
                          <option value="" disabled>
                            Select…
                          </option>
                          {(f.options ?? []).map((o) => (
                            <option key={String(o.value)} value={String(o.value)}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      ) : f.type === "checkbox" ? (
                        <label className="pg-pill" style={{ cursor: "pointer", justifyContent: "flex-start" }}>
                          <input
                            type="checkbox"
                            checked={Boolean(values[f.key])}
                            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.checked }))}
                            style={{ margin: 0 }}
                          />
                          {values[f.key] ? "Yes" : "No"}
                        </label>
                      ) : f.type === "text" ? (
                        <Input
                          type="text"
                          placeholder={f.placeholder}
                          value={values[f.key] ?? ""}
                          required={Boolean(f.required)}
                          onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                        />
                      ) : (
                        <Input
                          type="number"
                          placeholder={f.placeholder}
                          required={Boolean(f.required)}
                          value={values[f.key] ?? ""}
                          onChange={(e) => setValues((v) => ({ ...v, [f.key]: Number(e.target.value) }))}
                        />
                      )}
                    </Field>
                  ))}
                </div>
              </div>
            ))}

            {calc.slug === "noi" ? (
              <>
                <div style={{ marginBottom: 22 }}>
                  <div className="pg-card-title" style={{ marginBottom: 12 }}>
                    1. Income (annual)
                  </div>
                  <div className="pg-calculator-input-grid">
                    <Field label="Rental income (annual) (R)" help="Gross potential rent before vacancy.">
                      <Input
                        type="number"
                        required
                        value={values.rentalIncomeAnnual ?? ""}
                        onChange={(e) =>
                          setValues((v) => ({
                            ...v,
                            rentalIncomeAnnual: e.target.value === "" ? "" : Number(e.target.value)
                          }))
                        }
                      />
                    </Field>
                    <Field label="Other income (annual) (R)" help="Parking, storage, laundry, etc.">
                      <Input
                        type="number"
                        value={values.otherIncomeAnnual ?? ""}
                        onChange={(e) =>
                          setValues((v) => ({
                            ...v,
                            otherIncomeAnnual: e.target.value === "" ? 0 : Number(e.target.value)
                          }))
                        }
                      />
                    </Field>
                  </div>
                </div>

                <div style={{ marginBottom: 22 }}>
                  <div className="pg-card-title" style={{ marginBottom: 12 }}>
                    2. Operating expenses (annual)
                  </div>
                  <div className="pg-noi-expense-list">
                    {(Array.isArray(values.expenseItems) ? values.expenseItems : []).map(
                      (row: { label: string; annualAmount: number }, idx: number) => {
                        const items = (Array.isArray(values.expenseItems) ? values.expenseItems : []) as {
                          label: string;
                          annualAmount: number;
                        }[];
                        const expenseHeading = row.label.trim() || "Expense name";
                        return (
                          <div key={idx} className="pg-noi-expense-row">
                            <Field label={expenseHeading}>
                              <Input
                                type="text"
                                aria-label="Expense name"
                                placeholder="e.g. Rates & levies"
                                value={row.label}
                                onChange={(e) => {
                                  const next = [...items];
                                  next[idx] = { ...next[idx], label: e.target.value };
                                  setValues((v) => ({ ...v, expenseItems: next }));
                                }}
                              />
                            </Field>
                            <Field label="Annual amount (R)">
                              <Input
                                type="number"
                                value={row.annualAmount === 0 ? "" : row.annualAmount}
                                onChange={(e) => {
                                  const n = e.target.value === "" ? 0 : Number(e.target.value);
                                  const next = [...items];
                                  next[idx] = { ...next[idx], annualAmount: Number.isFinite(n) ? Math.max(0, n) : 0 };
                                  setValues((v) => ({ ...v, expenseItems: next }));
                                }}
                              />
                            </Field>
                            {items.length > 1 ? (
                              <div className="pg-noi-expense-row-actions">
                                <Button
                                  type="button"
                                  variant="secondary"
                                  onClick={() => {
                                    const next = items.filter((_, i) => i !== idx);
                                    setValues((v) => ({ ...v, expenseItems: next }));
                                  }}
                                >
                                  Remove
                                </Button>
                              </div>
                            ) : null}
                          </div>
                        );
                      }
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    style={{ marginTop: 12 }}
                    onClick={() =>
                      setValues((v) => ({
                        ...v,
                        expenseItems: [
                          ...(Array.isArray(v.expenseItems) ? v.expenseItems : []),
                          { label: "New expense", annualAmount: 0 }
                        ]
                      }))
                    }
                  >
                    + Add another expense
                  </Button>
                </div>

                <div style={{ marginBottom: 18 }}>
                  <div className="pg-card-title" style={{ marginBottom: 12 }}>
                    3. Vacancy &amp; maintenance
                  </div>
                  <div className="pg-calculator-input-grid">
                    <Field label="Vacancy allowance (%)" help="Expected loss against gross potential income.">
                      <Input
                        type="number"
                        value={values.vacancyRatePercent ?? ""}
                        onChange={(e) =>
                          setValues((v) => ({
                            ...v,
                            vacancyRatePercent: e.target.value === "" ? 0 : Number(e.target.value)
                          }))
                        }
                      />
                    </Field>
                    <Field label="Maintenance (% of effective gross)" help="Applied after vacancy, each year in the projection.">
                      <Input
                        type="number"
                        value={values.maintenancePercentOfEffectiveGross ?? ""}
                        onChange={(e) =>
                          setValues((v) => ({
                            ...v,
                            maintenancePercentOfEffectiveGross: e.target.value === "" ? 0 : Number(e.target.value)
                          }))
                        }
                      />
                    </Field>
                  </div>
                  <LockedFeaturePreview
                    feature="forecasting"
                    title="Unlock growth assumptions and projections with Investor."
                    showPreview={showForecasting}
                  >
                  <div className="pg-calculator-input-grid" style={{ marginTop: 14 }}>
                    <Field label="Rent growth (% p.a.)" help="Drives the 5-year NOI projection.">
                      <Input
                        type="number"
                        value={values.rentGrowthPercentAnnual ?? ""}
                        onChange={(e) =>
                          setValues((v) => ({
                            ...v,
                            rentGrowthPercentAnnual: e.target.value === "" ? 3 : Number(e.target.value)
                          }))
                        }
                      />
                    </Field>
                    <Field label="Operating expense growth (% p.a.)">
                      <Input
                        type="number"
                        value={values.expenseGrowthPercentAnnual ?? ""}
                        onChange={(e) =>
                          setValues((v) => ({
                            ...v,
                            expenseGrowthPercentAnnual: e.target.value === "" ? 3 : Number(e.target.value)
                          }))
                        }
                      />
                    </Field>
                  </div>
                  </LockedFeaturePreview>
                </div>
              </>
            ) : null}

            <div className="pg-calc-tool-form-actions pg-calc-tool-form-actions--inline">
              <Button type="submit" loading={loading}>
                {calc.slug === "noi" ? "Calculate NOI" : "Calculate"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={reset}
                className={calc.slug !== "monthly-payment" ? "pg-calculator-reset-btn" : undefined}
              >
                Reset
              </Button>
              <label className="pg-pill pg-calculator-live-update" style={{ cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={autoUpdate}
                  onChange={(e) => setAutoUpdate(e.target.checked)}
                  style={{ margin: 0 }}
                />
                Live update
              </label>
              <ButtonLink href="/dashboard" variant="ghost">
                My Reports
              </ButtonLink>
              {savedId ? (
                !subscriptionLimits.canGenerateReport && subscriptionLimits.limitsActive ? (
                  <PlanLimitUpgradePrompt context="report" limits={subscriptionLimits} compact />
                ) : (
                  <Button type="button" variant="ghost" onClick={generateAndDownloadPdf} loading={pdfBusy}>
                    PDF
                  </Button>
                )
              ) : null}
            </div>
            {subscriptionLimits.limitsActive && savedId ? (
              <p className="pg-plan-limit-hint" style={{ marginTop: 8 }}>
                {formatReportLimitUsage(
                  subscriptionLimits.currentReportCount,
                  subscriptionLimits.reportLimit,
                  subscriptionLimits.reportPeriodLabel
                )}
              </p>
            ) : null}
          </form>
        </CalculatorToolInputsAccordion>
        <CalculatorToolProTip text={pageMeta.proTip} />
        </div>

        <div className="pg-calculator-pane pg-calc-tool-col pg-calc-tool-col--results">
        <div className="pg-calc-tool-panel pg-calc-tool-panel--results">
          {calc.slug !== "buy-vs-rent" ? (
            <CalculatorToolResultsHero
              title={pageMeta.primaryResultTitle}
              primaryValue={primarySummaryMetric ? formatResultsMetricDisplay(primarySummaryMetric) : undefined}
              primarySuffix={primarySuffix}
              metrics={result ? heroMetricBlocks : []}
              loading={loading && !result}
            />
          ) : null}
          <div className="pg-calculator-results-stack pg-calc-tool-results-stack">
            {!result && !error ? (
              <div className="pg-muted">Run the calculator to see key metrics and charts.</div>
            ) : null}

            {error ? (
              <div className="pg-alert pg-alert-error">
                {error}{" "}
                {error.includes("Subscribe") ? (
                  <ButtonLink href="/subscription" variant="soft">
                    View subscription
                  </ButtonLink>
                ) : null}
              </div>
            ) : null}

            {result ? (
              <div style={{ display: "grid", gap: 16 }}>
                {calc.slug === "buy-vs-rent" && result.breakdown?.simple ? (
                  <BuyVsRentSimpleResults
                    core={result.breakdown.simple as SimpleBuyVsRentCoreResult}
                    charts={chartsToRender as never}
                    interpretationText={result.interpretation?.text ?? ""}
                    warnings={result.interpretation?.warnings ?? []}
                    assumptions={(result.assumptionsUsed?.assumptions as string[]) ?? []}
                    assumptionsNote={result.assumptionsUsed?.note as string | undefined}
                    upgradePrompt={
                      result.assumptionsUsed?.upgradePrompt as { title: string; body: string } | undefined
                    }
                    getChartOptions={(base) => mergeThemedChartOptions(base) as Record<string, unknown>}
                  />
                ) : calc.slug !== "buy-vs-rent" && extraSummaryMetrics.length > 0 ? (
                  <div className="pg-calculator-kpi-grid pg-calculator-kpi-grid--extra">
                    {extraSummaryMetrics.map((m: SummaryMetricLike) => (
                      <Card key={m.key ?? m.label} pad={false} className="pg-card-pad pg-calculator-kpi-card">
                        <div className="pg-kpi">
                          <div className="pg-kpi-value">{formatResultsMetricDisplay(m)}</div>
                          <div className="pg-kpi-label">{m.label}</div>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : null}

                {calc.slug === "transfer-bond-costs" && result?.breakdown?.transferCosts ? (
                  <>
                  <CalculatorToolBreakdownList
                    title="Detailed cost breakdown"
                    rows={(
                      [
                        ["Transfer duty", result.breakdown.transferCosts.transferDuty],
                        ["Transfer attorney (ex VAT)", result.breakdown.transferCosts.transferAttorneyFee],
                        ["VAT on transfer attorney", result.breakdown.transferCosts.transferAttorneyFeeVat],
                        ["Deeds Office transfer fee", result.breakdown.transferCosts.deedsOfficeTransferFee],
                        ["Municipal / rates clearance provision", result.breakdown.transferCosts.municipalRatesClearanceProvision],
                        ["Postages & petties", result.breakdown.transferCosts.postagesAndPettiesEstimate],
                        ["FICA estimate", result.breakdown.transferCosts.ficaFeeEstimate],
                        ["Deeds search estimate", result.breakdown.transferCosts.deedsSearchFeeEstimate],
                        ["Electronic instruction estimate", result.breakdown.transferCosts.electronicInstructionFeeEstimate],
                        ["Transfer subtotal", result.breakdown.transferCosts.transferSubtotal],
                        ["Bond attorney (ex VAT)", result.breakdown.bondCosts.bondAttorneyFee],
                        ["VAT on bond attorney", result.breakdown.bondCosts.bondAttorneyFeeVat],
                        ["Deeds Office bond fee", result.breakdown.bondCosts.deedsOfficeBondFee],
                        ["Bond subtotal", result.breakdown.bondCosts.bondSubtotal]
                      ] as [string, number][]
                    ).map(([label, val]) => ({
                      label,
                      value: typeof val === "number" ? formatZarResultsAmount(val) : "—",
                      variant: label.includes("subtotal") ? ("subtotal" as const) : ("detail" as const)
                    }))}
                  />
                  <Card title="Detailed cost breakdown" className="pg-calc-tool-panel pg-calc-tool-panel--table pg-calc-tool-table--desktop">
                    <table
                      className="pg-table pg-transfer-cost-breakdown"
                      style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}
                    >
                      <tbody>
                        {(
                          [
                            ["Transfer duty", result.breakdown.transferCosts.transferDuty],
                            ["Transfer attorney (ex VAT)", result.breakdown.transferCosts.transferAttorneyFee],
                            ["VAT on transfer attorney", result.breakdown.transferCosts.transferAttorneyFeeVat],
                            ["Deeds Office transfer fee", result.breakdown.transferCosts.deedsOfficeTransferFee],
                            ["Municipal / rates clearance provision", result.breakdown.transferCosts.municipalRatesClearanceProvision],
                            ["Postages & petties", result.breakdown.transferCosts.postagesAndPettiesEstimate],
                            ["FICA estimate", result.breakdown.transferCosts.ficaFeeEstimate],
                            ["Deeds search estimate", result.breakdown.transferCosts.deedsSearchFeeEstimate],
                            ["Electronic instruction estimate", result.breakdown.transferCosts.electronicInstructionFeeEstimate]
                          ] as [string, number][]
                        ).map(([label, val]) => (
                          <tr key={label} className="pg-transfer-cost-breakdown-row pg-transfer-cost-breakdown-row--detail">
                            <td>{label}</td>
                            <td className="pg-transfer-cost-breakdown-amount">
                              {typeof val === "number" ? formatZarResultsAmount(val) : "—"}
                            </td>
                          </tr>
                        ))}
                        <tr className="pg-transfer-cost-breakdown-row pg-transfer-cost-breakdown-row--subtotal">
                          <td>Transfer subtotal</td>
                          <td className="pg-transfer-cost-breakdown-amount">
                            {formatZarResultsAmount(result.breakdown.transferCosts.transferSubtotal)}
                          </td>
                        </tr>
                        {(
                          [
                            ["Bond attorney (ex VAT)", result.breakdown.bondCosts.bondAttorneyFee],
                            ["VAT on bond attorney", result.breakdown.bondCosts.bondAttorneyFeeVat],
                            ["Deeds Office bond fee", result.breakdown.bondCosts.deedsOfficeBondFee]
                          ] as [string, number][]
                        ).map(([label, val]) => (
                          <tr key={label} className="pg-transfer-cost-breakdown-row pg-transfer-cost-breakdown-row--detail">
                            <td>{label}</td>
                            <td className="pg-transfer-cost-breakdown-amount">
                              {typeof val === "number" ? formatZarResultsAmount(val) : "—"}
                            </td>
                          </tr>
                        ))}
                        <tr className="pg-transfer-cost-breakdown-row pg-transfer-cost-breakdown-row--subtotal">
                          <td>Bond subtotal</td>
                          <td className="pg-transfer-cost-breakdown-amount">
                            {formatZarResultsAmount(result.breakdown.bondCosts.bondSubtotal)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </Card>
                  </>
                ) : null}

                {calc.slug === "transfer-bond-costs" && Array.isArray(result?.assumptionsUsed?.assumptions) ? (
                  <Card title="Assumptions">
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.5 }}>
                      {(result.assumptionsUsed.assumptions as string[]).map((a: string) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  </Card>
                ) : null}

                {calc.slug !== "buy-vs-rent" ? (
                  <LockedFeaturePreview feature="graphs" title="Unlock charts with Investor.">
                    {chartsToRender.map((ch, idx) => {
                      const opts = chartOptionsForViewport(ch.options as Record<string, unknown>, calc.slug) as any;
                      const displayTitle =
                        calc.slug === "monthly-payment" && ch.chartType === "bar"
                          ? "Repayment Breakdown"
                          : (ch.title ?? "Chart");
                      return (
                        <Card
                          key={`${ch.title ?? "chart"}-${idx}`}
                          title={displayTitle}
                          className="pg-calc-tool-panel pg-calc-tool-panel--chart"
                        >
                          <div className="pg-calculator-chart-host">
                            {ch.chartType === "line" ? (
                              <Line data={ch.data as any} options={opts} />
                            ) : ch.chartType === "doughnut" ? (
                              <Doughnut data={ch.data as any} options={opts} />
                            ) : (
                              <Bar data={ch.data as any} options={opts} />
                            )}
                          </div>
                        </Card>
                      );
                    })}
                  </LockedFeaturePreview>
                ) : null}

                {calc.slug === "monthly-payment" &&
                Array.isArray(result?.breakdown?.amortisationScheduleMonthly) &&
                Array.isArray(result?.breakdown?.amortisationScheduleYearly) ? (
                  <CalculatorToolAmortisationTable
                    monthly={result.breakdown.amortisationScheduleMonthly}
                    yearly={result.breakdown.amortisationScheduleYearly}
                  />
                ) : null}

                {calc.slug !== "buy-vs-rent" && result?.interpretation?.text ? (
                  <Card title="Interpretation">
                    <div className="pg-muted">{result.interpretation.text}</div>
                    {result.interpretation.warnings?.length ? (
                      <div className="pg-alert pg-alert-error" style={{ marginTop: 12 }}>
                        {result.interpretation.warnings.join(" · ")}
                      </div>
                    ) : null}
                  </Card>
                ) : null}

                {calc.slug === "transfer-bond-costs" && result?.assumptionsUsed?.disclaimer ? (
                  <div className="pg-muted" style={{ fontSize: 12 }}>
                    {String(result.assumptionsUsed.disclaimer)}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
        </div>
    </div>
  );

  const calculatorFooterGrids = (
    <>
      <div style={{ height: 24 }} />

      <Grid cols={2} className={workspaceLayoutClass}>
        <Card title="Tips">
          <div style={{ display: "grid", gap: 10 }}>
            <div className="pg-muted">Use multiple metrics to avoid blind spots.</div>
            <div className="pg-muted">Stress-test assumptions (interest rate, vacancy, repairs).</div>
            <div className="pg-muted">Save a report and compare versions as you learn more.</div>
          </div>
        </Card>

        <Card title={relatedLinks.length ? "Related calculators" : "More calculators"}>
          {relatedLinks.length ? (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {relatedLinks.map((c) => (
                <ButtonLink key={c.slug} href={`/calculators/${c.slug}`} variant="ghost">
                  {c.name}
                </ButtonLink>
              ))}
            </div>
          ) : (
            <ButtonLink href="/calculators" variant="ghost">
              Browse all calculators
            </ButtonLink>
          )}
        </Card>
      </Grid>
    </>
  );

  const transferBondSeo =
    calc.slug === "transfer-bond-costs" ? (
      <details className="pg-calculator-transfer-seo" style={{ marginBottom: 22 }}>
        <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 15, color: "var(--text)" }}>
          Transfer duty, transfer costs &amp; VAT — what&apos;s the difference?
        </summary>
        <div className="pg-muted" style={{ fontSize: 14, lineHeight: 1.55, display: "grid", gap: 10, marginTop: 12 }}>
          <p style={{ margin: 0 }}>
            <strong>What is transfer duty?</strong> A tax levied by SARS on property acquisitions (not the same as conveyancer fees).
            It depends on the value / consideration and is not charged alongside transfer duty on qualifying VAT transactions.
          </p>
          <p style={{ margin: 0 }}>
            <strong>What are transfer costs?</strong> Everything on the transfer attorney’s account: professional fees (plus VAT),
            Deeds Office transfer fee, municipal clearance provision and typical disbursements.
          </p>
          <p style={{ margin: 0 }}>
            <strong>What are bond registration costs?</strong> Bond attorney professional fees (plus VAT) and the Deeds Office bond
            registration fee — separate from transfer duty and from transfer-side fees.
          </p>
          <p style={{ margin: 0 }}>
            <strong>VAT transaction vs transfer duty:</strong> On a qualifying VAT transaction, transfer duty is generally not
            payable; VAT treatment must still be confirmed with the seller and conveyancer.
          </p>
          <p style={{ margin: 0 }}>
            <strong>Why invoices differ:</strong> Firms apply recommended tariffs differently, disbursements vary, and banks may add
            their own charges — use this tool for planning, then confirm quotes in writing.
          </p>
        </div>
      </details>
    ) : null;

  const toolExplainer = getToolExplainer(calc.slug, calc.description);

  const gatedCalculatorWorkspace = calculatorGateFeature ? (
    <LockedFeaturePreview
      feature={calculatorGateFeature}
      title="Upgrade to Investor to unlock this calculator."
      className="pg-calculator-tool-gate"
    >
      {calculatorWorkspace}
    </LockedFeaturePreview>
  ) : (
    calculatorWorkspace
  );

  const calculatorSupplementary = (
    <div className="pg-calculator-tool-explainer">
      {transferBondSeo}
      <p className="pg-lead pg-calculator-tool-explainer-lead">{toolExplainer.usageExplained}</p>
      <div className="pg-calculator-tool-pros-cons">
        <div className="pg-calculator-tool-pros-block">
          <h2 className="pg-calculator-tool-explainer-h">Advantages</h2>
          <ul className="pg-calculator-tool-explainer-list">
            {toolExplainer.advantages.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <div className="pg-calculator-tool-cons-block">
          <h2 className="pg-calculator-tool-explainer-h">Disadvantages &amp; limits</h2>
          <ul className="pg-calculator-tool-explainer-list">
            {toolExplainer.disadvantages.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </div>
      {calculatorFooterGrids}
    </div>
  );

  return (
    <CalculatorToolPageLayout
      slug={calc.slug}
      meta={pageMeta}
      onSave={() => void run(true)}
      onShare={() => void handleShare()}
      saveLoading={loading}
      isMobile={isMobile}
      workspace={gatedCalculatorWorkspace}
      supplementary={calculatorSupplementary}
      stickyBar={
        showStickyActions ? (
          <CalculatorToolStickyBar formId={CALCULATOR_TOOL_FORM_ID} onReset={reset} loading={loading} />
        ) : null
      }
    />
  );
}
