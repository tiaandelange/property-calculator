import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Chart as ChartJS, ArcElement, BarElement, CategoryScale, Legend, LinearScale, LineElement, PointElement, Tooltip } from "chart.js";
import { CalculatorToolAdvancedAssumptions } from "../components/calculators/tool/CalculatorToolAdvancedAssumptions";
import { CalculatorToolFormActions } from "../components/calculators/tool/CalculatorToolFormActions";
import { renderCalculatorFieldsByKeys } from "../components/calculators/tool/CalculatorToolFieldRenderer";
import { CalculatorToolSummaryCards } from "../components/calculators/tool/CalculatorToolSummaryCards";
import { getCalculatorFieldLayout } from "../data/calculatorFieldLayout";
import { getCalculatorAdvancedSubtitle, partitionFieldKeysBySlider } from "../data/calculatorFieldPresentation";
import { applyCashFlowBondPaymentPayload, computeCashFlowMonthlyBondPayment } from "../utils/calculatorCashFlowPayload";
import { buildTransferBondBreakdownRows } from "../utils/transferBondBreakdownRows";
import { calculators } from "../data/calculators";
import { getCalculatorDefaultValues } from "../data/calculatorDefaultValues";
import { getCalculatorToolPage } from "../data/calculatorToolPageContent";
import { getToolExplainer, IRR_DECLINING_BY_YEAR_EXPLANATION } from "../data/calculatorToolExplainerContent";
import { getLocalAuthSession } from "../lib/authSession";
import { getSupabase } from "../lib/supabaseClient";
import { runCalculatorLocally, saveCalculationResult } from "../services/calculationsSupabase";
import { fetchPdfBlob, isAbsoluteHttpUrl, openPdfBlobInNewTab } from "../api/pdfBlob";
import { generateReportViaVercel } from "../services/reportsVercel";
import { trackEvent } from "../lib/analytics/analytics";
import { CalculatorToolPageLayout } from "../components/calculators/tool/CalculatorToolPageLayout";
import { CalculatorToolProTip } from "../components/calculators/tool/CalculatorToolProTip";
import { CalculatorToolResultsHero } from "../components/calculators/tool/CalculatorToolResultsHero";
import { CalculatorThemedCharts } from "../components/calculators/tool/CalculatorThemedCharts";
import { CalculatorToolResultsInterpretation } from "../components/calculators/tool/CalculatorToolResultsInterpretation";
import {
  buildCalculatorSummaryCards,
  buildCashFlowInterpretation,
  formatCalculatorZar,
  formatResultsMetricDisplay,
  getPrimaryResultPresentation,
  isCashFlowNegative,
  type SummaryMetricLike
} from "../utils/calculatorResultsPresentation";
import { getCalculatorToolPageMeta } from "../data/calculatorToolPageMeta";
import { BuyVsRentSimpleResults } from "../components/calculators/BuyVsRentSimpleResults";
import type { SimpleBuyVsRentCoreResult } from "@calculatorShared/buyVsRentSimple/simpleBuyVsRentTypes";
import { useCalculatorMobileLayout } from "../hooks/useCalculatorMobileLayout";
import { CalculatorToolInputsAccordion } from "../components/calculators/tool/CalculatorToolInputsAccordion";
import { CalculatorToolBreakdownList } from "../components/calculators/tool/CalculatorToolBreakdownList";
import { CalculatorToolStickyBar } from "../components/calculators/tool/CalculatorToolStickyBar";
import { buildCalculatorInputSummary } from "../utils/formatCalculatorInputSummary";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Grid } from "../components/ui/Grid";
import { Card } from "../components/ui/Card";
import { Field, Input } from "../components/ui/Input";
import { Button, ButtonLink } from "../components/ui/Button";
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

  if (slug === "irr") {
    if (typeof values.annualCashFlows === "string") {
      payload.annualCashFlows = parseNumberList(values.annualCashFlows);
    }
    const growthMode =
      payload.currentEstimatedValue != null &&
      payload.totalCashInvested != null &&
      Number(payload.currentEstimatedValue) > 0;
    if (growthMode) {
      delete payload.sellingCostsPercent;
      delete payload.initialCashInvested;
      delete payload.expectedSalePrice;
      delete payload.remainingLoanBalanceAtSale;
    } else {
      delete payload.estimatedSellingCostPercent;
    }
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

  if (slug === "cash-flow") {
    applyCashFlowBondPaymentPayload(payload);
  }

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
      y: scales.y != null ? mergeAxis(scales.y as Record<string, unknown>) : scales.y,
      y1: scales.y1 != null ? mergeAxis(scales.y1 as Record<string, unknown>) : scales.y1
    }
  };
}

/** Responsive chart options for narrow viewports (no formula changes). */
function mergeMobileChartOptions(
  base: Record<string, unknown> | null | undefined,
  chartType?: string,
  dualAxisCombo?: boolean
): Record<string, unknown> {
  const themed = mergeThemedChartOptions(base);
  if (chartType === "doughnut") {
    return { ...themed, responsive: true, maintainAspectRatio: false };
  }
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
        align: dualAxisCombo ? "center" : "end"
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

const MONTHLY_PAYMENT_RELATED = ["transfer-bond-costs", "ltv", "cash-flow", "dscr"] as const;
const CALCULATOR_TOOL_FORM_ID = "calculator-tool-form";

export function CalculatorPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const calc = useMemo(() => calculators.find((c) => c.slug === slug), [slug]);
  const [values, setValues] = useState<Record<string, any>>(() => getCalculatorDefaultValues(slug ?? ""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<any>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
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
      if (opts?.userInitiated) {
        onCalculateSuccess();
        trackEvent("calculator_used", {
          calculator_type: targetSlug,
          source_page: `${window.location.pathname}${window.location.search}`
        });
      }
      const sessionData = { session: await getLocalAuthSession().catch(() => null) };
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
        const sessionData = { session: await getLocalAuthSession().catch(() => null) };
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
    if (!hasAllRequired) return;
    const current = JSON.stringify(values);
    if (current === lastRunRef.current) return;
    const t = window.setTimeout(() => void runWithValues(calc.slug, values), 450);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAllRequired, values]);

  const summary = result?.summary ?? [];
  const chartData = result?.chartData ?? [];
  const chartsToRender = useMemo(() => {
    const raw = (chartData ?? []) as Array<{ chartType: string; title?: string; data?: unknown; options?: unknown }>;
    const hasProjectionChart = raw.some((c) => c.chartType === "line" || c.chartType === "combo");
    const cur = summary.find((m: any) => m.unit === "currency" && m.value != null && Number.isFinite(m.value)) as
      | { label: string; value: number }
      | undefined;
    const illustration = !hasProjectionChart && cur ? [buildIllustrativeFiveYearLineChart(cur)] : [];
    const combined = [...illustration, ...raw];
    if (calc.slug === "monthly-payment") {
      const combo = raw.filter((c) => c.chartType === "combo");
      if (combo.length) return combo;
      const repaymentChart = combined.find((c) => {
        const datasets = (c.data as { datasets?: Array<{ label?: string }> })?.datasets ?? [];
        const labels = datasets.map((d) => String(d.label ?? "").toLowerCase());
        return labels.some((l) => l.includes("principal")) && labels.some((l) => l.includes("interest"));
      });
      return repaymentChart ? [repaymentChart] : combined.slice(0, 1);
    }
    if (calc.slug === "irr") {
      const combo = raw.filter((c) => c.chartType === "combo");
      return combo.length ? combo : raw.slice(0, 1);
    }
    if (calc.slug === "cash-on-cash-return") {
      return raw.filter((c) => c.chartType === "combo" || c.chartType === "doughnut");
    }
    if (calc.slug === "transfer-bond-costs") {
      return raw.filter((c) => c.chartType === "doughnut");
    }
    if (calc.slug === "buy-vs-rent") {
      return raw;
    }
    return combined;
  }, [chartData, summary, calc.slug]);

  const reset = () => {
    const defaults = getCalculatorDefaultValues(calc.slug);
    setValues(defaults);
    setResult(null);
    setError("");
    setSavedId(null);
    lastRunRef.current = "";
    void runWithValues(calc.slug, defaults);
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
      trackEvent("report_generated", {
        report_type: "calculation",
        source_page: `${window.location.pathname}${window.location.search}`
      });
      if (isAbsoluteHttpUrl(downloadUrl)) {
        window.open(downloadUrl, "_blank", "noopener,noreferrer");
      } else {
        const blob = await fetchPdfBlob(downloadUrl);
        openPdfBlobInNewTab(blob);
      }
      trackEvent("pdf_downloaded", {
        report_type: "calculation",
        source_page: `${window.location.pathname}${window.location.search}`
      });
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

  const handleSaveCalculation = useCallback(async () => {
    const sessionData = { session: await getLocalAuthSession().catch(() => null) };
    if (!sessionData.session) {
      const returnTo = `${location.pathname}${location.search}`;
      navigate(`/login?redirectTo=${encodeURIComponent(returnTo)}`);
      return;
    }
    await run(true);
  }, [location.pathname, location.search, navigate, run]);

  const relatedLinks = relatedSlugs
    .map((s) => calculators.find((c) => c.slug === s))
    .filter(Boolean) as typeof calculators;

  const inputSummaryRows = useMemo(
    () => buildCalculatorInputSummary(calc.slug, calc.groups, values),
    [calc.slug, calc.groups, values]
  );

  const workspaceLayoutClass = ["pg-calc-tool-workspace-grid", "pg-calculator-detail-layout"].join(" ");

  const primarySummaryMetric = summary[0] as SummaryMetricLike | undefined;
  const primaryPresentation = getPrimaryResultPresentation(calc.slug, primarySummaryMetric);
  const summaryCards = buildCalculatorSummaryCards(calc.slug, result);
  const extraSummaryMetrics = summary.slice(5);
  const primarySuffix = primaryPresentation.suffix;
  const primaryValue = primaryPresentation.formattedValue ?? (primarySummaryMetric ? formatResultsMetricDisplay(primarySummaryMetric) : undefined);

  const allFields = useMemo(() => calc.groups.flatMap((g) => g.fields), [calc.groups]);
  const fieldLayout = useMemo(() => getCalculatorFieldLayout(calc.slug, calc), [calc.slug, calc]);
  const coreFieldGroups = useMemo(
    () => partitionFieldKeysBySlider(calc.slug, fieldLayout.core),
    [calc.slug, fieldLayout.core]
  );
  const advancedFieldGroups = useMemo(
    () => partitionFieldKeysBySlider(calc.slug, fieldLayout.advanced),
    [calc.slug, fieldLayout.advanced]
  );
  const onFieldChange = useCallback((key: string, value: unknown) => {
    setValues((v) => ({ ...v, [key]: value }));
  }, []);

  const heroSupportingNote = useMemo(() => {
    const base = pageMeta.primaryResultSupporting;
    if (calc.slug !== "cash-flow") return base;
    const fromResult = result?.breakdown?.monthlyDebtService;
    const payment =
      typeof fromResult === "number" && Number.isFinite(fromResult)
        ? fromResult
        : computeCashFlowMonthlyBondPayment(values);
    if (payment == null) return base;
    return `${base ?? "Based on the inputs provided"} Monthly bond payment: ${formatCalculatorZar(payment)}.`;
  }, [calc.slug, pageMeta.primaryResultSupporting, result, values]);

  const formActions = (
    <CalculatorToolFormActions
      loading={loading}
      calcSlug={calc.slug}
      onReset={reset}
      savedId={savedId}
      pdfBusy={pdfBusy}
      onPdf={() => void generateAndDownloadPdf()}
      subscriptionLimits={subscriptionLimits}
    />
  );

  const renderCoreInputFields = () => (
    <>
      <div className="pg-calc-tool-input-fields">
        {renderCalculatorFieldsByKeys(calc.slug, allFields, coreFieldGroups.plain, values, onFieldChange)}
      </div>
      {coreFieldGroups.sliders.length > 0 ? (
        <div className="pg-calc-tool-input-fields pg-calc-tool-input-fields--sliders">
          {renderCalculatorFieldsByKeys(calc.slug, allFields, coreFieldGroups.sliders, values, onFieldChange)}
        </div>
      ) : null}
    </>
  );

  const noiAdvancedCount = 3;

  const calculatorWorkspace = (
    <div className={workspaceLayoutClass}>
        <div className="pg-calc-tool-col pg-calc-tool-col--inputs">
        <CalculatorToolInputsAccordion
          summaryRows={inputSummaryRows}
          expanded={inputsExpanded}
          onToggleExpanded={() => setInputsExpanded((v) => !v)}
          isMobile={isMobile}
        >
          <form id={CALCULATOR_TOOL_FORM_ID} onSubmit={submit}>
            {calc.slug !== "noi" ? (
              <>
                {renderCoreInputFields()}
                {!advancedOpen ? formActions : null}
                <CalculatorToolAdvancedAssumptions
                  open={advancedOpen}
                  onToggle={() => setAdvancedOpen((v) => !v)}
                  count={fieldLayout.advanced.length}
                  subtitle={getCalculatorAdvancedSubtitle(calc.slug)}
                >
                  <div className="pg-calc-tool-input-fields">
                    {renderCalculatorFieldsByKeys(calc.slug, allFields, advancedFieldGroups.plain, values, onFieldChange)}
                  </div>
                  {advancedFieldGroups.sliders.length > 0 ? (
                    <div className="pg-calc-tool-input-fields pg-calc-tool-input-fields--sliders">
                      {renderCalculatorFieldsByKeys(calc.slug, allFields, advancedFieldGroups.sliders, values, onFieldChange)}
                    </div>
                  ) : null}
                </CalculatorToolAdvancedAssumptions>
                {advancedOpen ? formActions : null}
                <CalculatorToolProTip text={pageMeta.proTip} />
              </>
            ) : (
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
                </div>

                {!advancedOpen ? formActions : null}
                <CalculatorToolAdvancedAssumptions
                  open={advancedOpen}
                  onToggle={() => setAdvancedOpen((v) => !v)}
                  count={noiAdvancedCount}
                  subtitle="Growth assumptions and optional scenario name"
                >
                  <LockedFeaturePreview
                    feature="forecasting"
                    title="Unlock growth assumptions and projections with Investor."
                    showPreview={showForecasting}
                  >
                    <div className="pg-calculator-input-grid">
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
                  <div className="pg-calculator-input-grid pg-calc-tool-input-fields" style={{ marginTop: 14 }}>
                    {renderCalculatorFieldsByKeys(calc.slug, allFields, ["scenarioName"], values, onFieldChange)}
                  </div>
                </CalculatorToolAdvancedAssumptions>
                {advancedOpen ? formActions : null}
                <CalculatorToolProTip text={pageMeta.proTip} />
              </>
            )}
          </form>
        </CalculatorToolInputsAccordion>
        </div>

        <div className="pg-calc-tool-col pg-calc-tool-col--results">
          <div className="pg-calc-tool-panel pg-calc-tool-panel--results">
            <h2 className="pg-calc-tool-panel__title">Results</h2>
            {calc.slug !== "buy-vs-rent" ? (
              <CalculatorToolResultsHero
                embedded
                title={pageMeta.primaryResultTitle}
                primaryValue={primaryValue}
                primarySuffix={primarySuffix}
                supportingNote={heroSupportingNote}
                tone={primaryPresentation.tone}
                badge={primaryPresentation.badge}
                loading={loading && !result}
              />
            ) : null}
            {result && summaryCards.length > 0 && calc.slug !== "buy-vs-rent" ? (
              <CalculatorToolSummaryCards cards={summaryCards} />
            ) : null}
            <div className="pg-calculator-results-stack pg-calc-tool-results-stack">
            {!result && !error ? (
              <div className="pg-muted">Run the calculator to see key metrics and charts.</div>
            ) : null}

            {error ? (
              <div className="pg-alert pg-alert-error">
                {error}{" "}
                {error.includes("Subscribe") ? (
                  <ButtonLink href="/settings?section=subscription" variant="soft">
                    Manage subscription
                  </ButtonLink>
                ) : null}
              </div>
            ) : null}

            {result ? (
              <div className="pg-calc-tool-results-inner">
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
                    graphTitle={pageMeta.graphTitle}
                    isMobile={isMobile}
                    mergeChartOptions={(base) => mergeThemedChartOptions(base) as Record<string, unknown>}
                    mergeMobileChartOptions={mergeMobileChartOptions}
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
                  <CalculatorToolBreakdownList
                    title="Detailed cost breakdown"
                    rows={buildTransferBondBreakdownRows(
                      result.breakdown as Parameters<typeof buildTransferBondBreakdownRows>[0]
                    )}
                  />
                ) : null}

                {calc.slug !== "buy-vs-rent" && chartsToRender.length > 0 ? (
                  <CalculatorThemedCharts
                    slug={calc.slug}
                    charts={chartsToRender as Parameters<typeof CalculatorThemedCharts>[0]["charts"]}
                    graphTitle={pageMeta.graphTitle}
                    isMobile={isMobile}
                    mergeChartOptions={(base) => mergeThemedChartOptions(base) as Record<string, unknown>}
                    mergeMobileChartOptions={mergeMobileChartOptions}
                  />
                ) : null}

                {calc.slug === "transfer-bond-costs" && Array.isArray(result?.assumptionsUsed?.assumptions) ? (
                  <details className="pg-calculator-assumptions-used pg-calc-tool-panel">
                    <summary>Assumptions used</summary>
                    <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 13, lineHeight: 1.5 }}>
                      {(result.assumptionsUsed.assumptions as string[]).map((a: string) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  </details>
                ) : null}

                {calc.slug !== "buy-vs-rent" && result?.interpretation?.text ? (
                  <CalculatorToolResultsInterpretation
                    text={
                      calc.slug === "cash-flow" && result.breakdown
                        ? buildCashFlowInterpretation(result.breakdown as Record<string, unknown>)
                        : result.interpretation.text
                    }
                    warnings={result.interpretation.warnings ?? []}
                    showNegativeFundingNote={calc.slug === "cash-flow" && isCashFlowNegative(result)}
                    supplementaryText={calc.slug === "irr" ? IRR_DECLINING_BY_YEAR_EXPLANATION : undefined}
                  />
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
      onSave={() => void handleSaveCalculation()}
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
