import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import { assemblePropertyInvestmentReportData, type PropertyInvestmentReportModel } from "./propertyInvestmentReportData.js";
import { buildPropertyInvestmentReportPdfDefinition } from "./propertyInvestmentReportPdf.js";
import {
  buildDefaultPdfStyles,
  buildGlobalPdfTheme,
  chartCard,
  dataTable,
  metricCard,
  pdfDivider,
  pdfMargin,
  PDF_PAGE_MARGINS,
  PDF_SPACING,
  reportHeader,
  sectionCard
} from "./pdf/index.js";
import { loadProplyticLogoDataUrl } from "./pdf/pdfLogoAsset.js";
import { formatPdfDate, formatPdfZar } from "./pdf/pdfFormat.js";

const m = (l: number, t: number, r: number, b: number) => [l, t, r, b] as [number, number, number, number];

/** 1×1 PNG — chart area uses a static placeholder (no chartjs-node-canvas on Vercel). */
const PLACEHOLDER_CHART_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const TRANSFER_BOND_DISCLAIMER =
  "This is an estimate and not legal, tax or financial advice. Confirm costs with your conveyancer, bank and SARS.";

const CHART_OMITTED_NOTE =
  "Interactive charts are not rendered in serverless PDFs (Chart.js canvas omitted on Vercel). Export values and tables below remain complete.";

function formatZar(n: number): string {
  const v = Math.round((Number(n) || 0) + Number.EPSILON);
  return `R ${v.toLocaleString("en-ZA")}`;
}

function kvTable(rows: [string, string][]): Content {
  return {
    table: { widths: ["38%", "*"], body: rows.map(([k, v]) => [k, v]) },
    layout: "lightHorizontalLines",
    margin: m(0, 0, 0, 8)
  };
}

function buildTransferBondPdfSections(
  input: Record<string, unknown>,
  breakdown: Record<string, unknown>,
  assumptionsUsed: Record<string, unknown>
): Content[] {
  const inp = breakdown.input as Record<string, unknown> | undefined;
  const tc = breakdown.transferCosts as Record<string, unknown> | undefined;
  const bc = breakdown.bondCosts as Record<string, unknown> | undefined;
  const totals = breakdown.totals as Record<string, unknown> | undefined;
  if (!inp || !tc || !bc || !totals) return [];

  const assumptions = Array.isArray(assumptionsUsed?.assumptions) ? (assumptionsUsed.assumptions as string[]) : [];

  const inputRows: [string, string][] = [
    ["Purchase price", formatZar(Number(input.purchasePrice))],
    ["Market value (if supplied)", input.marketValue != null ? formatZar(Number(input.marketValue)) : "—"],
    ["Property value used for duty / Deeds transfer", formatZar(Number(inp.propertyValueUsed))],
    ["Bond amount", formatZar(Number(inp.bondAmount))],
    ["Deposit amount", formatZar(Number(inp.depositAmount))],
    ["Transaction type", String(inp.transactionType ?? "")],
    ["Buyer type", String(inp.buyerType ?? "")],
    ["Include bond registration", inp.includeBondRegistration === true ? "Yes" : "No"],
    ["Attorney fee mode", String(inp.attorneyFeeMode ?? "")],
    ["Fee year (Deeds Office table)", String(inp.feeYear ?? assumptionsUsed.feeYear ?? "")],
    ["VAT rate (%)", String(assumptionsUsed.vatRatePercent ?? input.vatRate ?? "—")],
    ["Include deposit in cash-required total", inp.includeDepositInCashRequired === true ? "Yes" : "No"]
  ];
  if (input.province) inputRows.push(["Province", String(input.province)]);
  if (input.municipality) inputRows.push(["Municipality", String(input.municipality)]);

  return [
    { text: "Input summary", style: "subheader", margin: m(0, 8, 0, 0) },
    kvTable(inputRows),

    { text: "Transfer duty", style: "subheader" },
    {
      text: `Based on property value used (${formatZar(Number(inp.propertyValueUsed))}) and transaction type ${String(inp.transactionType)}.`,
      margin: m(0, 0, 0, 4)
    },
    { text: `Transfer duty (estimate): ${formatZar(Number(tc.transferDuty))}`, bold: true, margin: m(0, 0, 0, 10) },

    { text: "Transfer cost breakdown", style: "subheader" },
    kvTable([
      ["Transfer duty", formatZar(Number(tc.transferDuty))],
      ["Transfer attorney fee (ex VAT)", formatZar(Number(tc.transferAttorneyFee))],
      ["VAT on transfer attorney fee", formatZar(Number(tc.transferAttorneyFeeVat))],
      ["Deeds Office transfer fee", formatZar(Number(tc.deedsOfficeTransferFee))],
      ["Municipal / rates clearance provision", formatZar(Number(tc.municipalRatesClearanceProvision))],
      ["Postages & petties (estimate)", formatZar(Number(tc.postagesAndPettiesEstimate))],
      ["FICA fee (estimate)", formatZar(Number(tc.ficaFeeEstimate))],
      ["Deeds search fee (estimate)", formatZar(Number(tc.deedsSearchFeeEstimate))],
      ["Electronic instruction fee (estimate)", formatZar(Number(tc.electronicInstructionFeeEstimate))],
      ["Transfer subtotal", formatZar(Number(tc.transferSubtotal))]
    ]),

    { text: "Bond registration cost breakdown", style: "subheader", margin: m(0, 10, 0, 0) },
    kvTable([
      ["Bond attorney fee (ex VAT)", formatZar(Number(bc.bondAttorneyFee))],
      ["VAT on bond attorney fee", formatZar(Number(bc.bondAttorneyFeeVat))],
      ["Deeds Office bond registration fee", formatZar(Number(bc.deedsOfficeBondFee))],
      ["Bond admin fees", formatZar(Number(bc.bondAdminFees))],
      ["Bond subtotal", formatZar(Number(bc.bondSubtotal))]
    ]),

    { text: "Totals", style: "subheader", margin: m(0, 10, 0, 0) },
    kvTable([
      ["Total transfer costs", formatZar(Number(totals.totalTransferCosts))],
      ["Total bond registration costs", formatZar(Number(totals.totalBondRegistrationCosts))],
      ["Total transfer and bond costs", formatZar(Number(totals.totalTransferAndBondCosts))],
      ["Deposit (reference)", formatZar(Number(totals.depositAmount))],
      ["Total cash required (excl. deposit)", formatZar(Number(totals.totalCashRequiredExcludingDeposit))],
      ["Total cash required (incl. deposit if enabled)", formatZar(Number(totals.totalCashRequiredIncludingDeposit))],
      ["Total acquisition cost (purchase + costs)", formatZar(Number(totals.totalAcquisitionCost))]
    ]),

    ...(assumptions.length
      ? [
          { text: "Assumptions", style: "subheader", margin: m(0, 10, 0, 0) },
          { ul: assumptions, margin: m(0, 0, 0, 8) }
        ]
      : [])
  ];
}

function asRecord(v: unknown): Record<string, unknown> {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

export function buildCalculationReportPdfDefinition(opts: {
  calculationId: string;
  calcType: string;
  inputJson: unknown;
  resultJson: unknown;
  preparedForLabel: string;
  scenarioNameOverride?: string | null;
}): { definition: TDocumentDefinitions; scenarioName: string | null } {
  const input =
    typeof opts.inputJson === "string" ? (JSON.parse(opts.inputJson) as Record<string, unknown>) : asRecord(opts.inputJson);
  const result =
    typeof opts.resultJson === "string" ? (JSON.parse(opts.resultJson) as Record<string, unknown>) : asRecord(opts.resultJson);

  const r = result as Record<string, unknown>;
  const asCalc = typeof r.calculator === "string" ? r : null;
  const scenarioName =
    opts.scenarioNameOverride ??
    (asCalc?.scenarioName as string | undefined) ??
    (input.scenarioName as string | undefined) ??
    null;
  const interpretation = asRecord(asCalc?.interpretation as unknown);
  const interpretationText = (interpretation.text as string) ?? "No interpretation available.";
  const warnings = Array.isArray(interpretation.warnings) ? (interpretation.warnings as string[]) : [];
  const assumptionsUsed = asRecord(asCalc?.assumptionsUsed as unknown);
  const breakdown = asRecord(asCalc?.breakdown as unknown) || result;

  const isTransferBond = opts.calcType === "transfer-bond-costs";
  const transferBondSections = isTransferBond
    ? buildTransferBondPdfSections(input, breakdown, assumptionsUsed)
    : [];

  const summary = asCalc?.summary ?? result;

  const disclaimerText = isTransferBond
    ? TRANSFER_BOND_DISCLAIMER
    : "This report is an estimate for educational purposes and is not financial, tax or legal advice.";

  const definition: TDocumentDefinitions = {
    info: { title: `PropLytics Report — ${opts.calcType}` },
    content: [
      { text: "PropLytics", style: "brand" },
      { text: "(logo placeholder)", style: "muted", margin: m(0, 0, 0, 8) },
      { text: "South African Property Investment Report", style: "tagline" },
      { text: `Report calculation ID: ${opts.calculationId}`, margin: m(0, 8, 0, 0) },
      { text: `Generated: ${new Date().toISOString()}` },
      { text: `Prepared for: ${opts.preparedForLabel}` },
      { text: `Calculator: ${opts.calcType}`, margin: m(0, 8, 0, 0) },
      { text: `Scenario: ${scenarioName ?? "Untitled scenario"}`, margin: m(0, 4, 0, 8) },
      ...(isTransferBond && transferBondSections.length
        ? transferBondSections
        : [
            { text: "Inputs", style: "subheader" },
            { text: JSON.stringify(input, null, 2), style: "code" },
            { text: "Detailed breakdown (intermediate calculations)", style: "subheader", margin: m(0, 10, 0, 0) },
            { text: JSON.stringify(breakdown, null, 2), style: "code" }
          ]),
      { text: "Outputs (summary metrics)", style: "subheader", margin: m(0, 10, 0, 0) },
      { text: JSON.stringify(summary, null, 2), style: "code" },
      { text: "Interpretation", style: "subheader", margin: m(0, 10, 0, 0) },
      { text: interpretationText },
      ...(warnings.length
        ? [{ text: "Warnings", style: "subheader", margin: m(0, 10, 0, 0) }, { text: warnings.map((w) => `- ${w}`).join("\n") }]
        : []),
      ...(isTransferBond
        ? []
        : [
            { text: "Assumptions (raw)", style: "subheader", margin: m(0, 10, 0, 0) },
            { text: JSON.stringify(assumptionsUsed, null, 2), style: "code" }
          ]),
      { text: "Chart summary", style: "subheader", margin: m(0, 10, 0, 4) },
      { text: CHART_OMITTED_NOTE, style: "muted", margin: m(0, 0, 0, 4) },
      { image: PLACEHOLDER_CHART_PNG, width: 480 },
      {
        text: `Disclaimer: ${disclaimerText}`,
        margin: m(0, 16, 0, 0)
      }
    ],
    styles: {
      brand: { fontSize: 22, bold: true, color: "#1a56db" },
      muted: { fontSize: 9, color: "#666666" },
      tagline: { fontSize: 12, color: "#333333" },
      subheader: { fontSize: 14, bold: true, margin: [0, 12, 0, 6] },
      code: { fontSize: 9 }
    },
    defaultStyle: { font: "Roboto" }
  };

  return { definition, scenarioName };
}

/** Calculator-only PDF (INVESTMENT_REPORT). Property workspace uses PROPERTY_SUMMARY + assemblePropertyInvestmentReportData. */
export function buildInvestmentReportPdfDefinition(opts: {
  propertyType: string;
  answers: Record<string, unknown>;
  metrics: Record<string, unknown>;
}): { definition: TDocumentDefinitions } {
  const propertyType = String(opts.propertyType || "").trim() || "Property";
  const metrics = (opts.metrics ?? {}) as Record<string, unknown>;
  const answers = (opts.answers ?? {}) as Record<string, unknown>;

  const theme = buildGlobalPdfTheme({});
  const styles = {
    ...buildDefaultPdfStyles(theme),
    sectionHeading: {
      fontSize: 13,
      bold: true,
      color: theme.primaryColor,
      margin: pdfMargin(0, 8, 0, 6)
    }
  };

  const dash = (v: unknown): string => {
    const s = String(v ?? "").trim();
    return s.length ? s : "—";
  };
  const num = (v: unknown): number | null => {
    const x = typeof v === "string" ? Number(v.replace(/[^\d.-]/g, "")) : Number(v);
    return Number.isFinite(x) ? x : null;
  };
  const zar = (v: unknown): string => {
    const n = num(v);
    return n == null ? "—" : formatPdfZar(n);
  };
  const pct = (v: unknown): string => {
    const n = num(v);
    return n == null ? "—" : `${n.toFixed(2)}%`;
  };

  // Canonical keys used in calculator metrics payload
  const monthlyIncome = metrics.monthlyIncome;
  const monthlyExpenses = metrics.monthlyExpenses;
  const monthlyCashFlow = metrics.projectedCashFlow ?? metrics.monthlyCashFlow;
  const grossYield = metrics.grossYield;
  const cashOnCash = metrics.cashOnCashRoi;
  const irr = metrics.internalRateofReturn ?? metrics.internalRateOfReturn;
  const ltv = metrics.ltv;

  const generatedLabel = formatPdfDate(new Date().toISOString().slice(0, 10));

  const content: Content[] = [
    reportHeader({
      theme,
      logoDataUrl: loadProplyticLogoDataUrl(),
      brandTitle: "Proplytic",
      reportTitle: "Property Investment Report",
      propertyName: propertyType,
      addressLine: "",
      reportDateLine: `Report Date: ${generatedLabel}`,
      propertyImageDataUrl: null
    }),
    pdfDivider(theme),

    // Top metric cards (two columns x four rows)
    {
      columns: [
        {
          width: "*",
          stack: [
            metricCard({ theme, label: "Monthly Income", value: zar(monthlyIncome), helperText: "Gross" }),
            metricCard({ theme, label: "Monthly Expenses", value: zar(monthlyExpenses), helperText: "Total" }),
            metricCard({ theme, label: "Monthly Cash Flow", value: zar(monthlyCashFlow), helperText: "Projected" }),
            metricCard({ theme, label: "Gross Yield", value: pct(grossYield), helperText: "Annualized" })
          ]
        },
        {
          width: "*",
          stack: [
            metricCard({ theme, label: "Cash on Cash ROI", value: pct(cashOnCash), helperText: "Annualized" }),
            metricCard({ theme, label: "IRR", value: pct(irr), helperText: "Annualized" }),
            metricCard({ theme, label: "LTV", value: pct(ltv), helperText: "Loan-to-value" }),
            metricCard({ theme, label: "Property Type", value: dash(propertyType), helperText: "Calculator" })
          ]
        }
      ],
      columnGap: 10,
      margin: pdfMargin(0, 0, 0, PDF_SPACING.section)
    },

    {
      columns: [
        {
          width: "50%",
          stack: [
            sectionCard({
              theme,
              title: "Inputs (Selected)",
              iconText: "⌂",
              rows: Object.entries(answers)
                .slice(0, 12)
                .map(([k, v]) => ({ label: k, value: dash(v) }))
            })
          ]
        },
        {
          width: "50%",
          stack: [
            sectionCard({
              theme,
              title: "Key Metrics",
              iconText: "↗",
              rows: [
                { label: "Monthly income", value: zar(monthlyIncome) },
                { label: "Monthly expenses", value: zar(monthlyExpenses) },
                { label: "Monthly cash flow", value: zar(monthlyCashFlow) },
                { label: "Gross yield", value: pct(grossYield) },
                { label: "Cash on cash ROI", value: pct(cashOnCash) },
                { label: "IRR", value: pct(irr) },
                { label: "LTV", value: pct(ltv) }
              ]
            })
          ]
        }
      ],
      columnGap: 10
    },

    {
      columns: [
        {
          width: "33.3%",
          stack: [
            chartCard({
              theme,
              title: "Income vs Expenses Over Time",
              subtitle: "Fallback",
              fallbackBars: [
                { label: "Monthly income", amount: num(monthlyIncome) ?? 0 },
                { label: "Monthly expenses", amount: num(monthlyExpenses) ?? 0 },
                { label: "Monthly cash flow", amount: num(monthlyCashFlow) ?? 0 }
              ].filter((x) => x.amount > 0)
            })
          ]
        },
        {
          width: "33.3%",
          stack: [
            chartCard({
              theme,
              title: "Return Snapshot",
              subtitle: "Fallback",
              fallbackBars: [
                { label: "Gross yield", amount: Math.max(0, num(grossYield) ?? 0) },
                { label: "Cash on cash", amount: Math.max(0, num(cashOnCash) ?? 0) },
                { label: "IRR", amount: Math.max(0, num(irr) ?? 0) }
              ].filter((x) => x.amount > 0)
            })
          ]
        },
        {
          width: "33.3%",
          stack: [
            chartCard({
              theme,
              title: "Expense Breakdown (Monthly)",
              subtitle: "Fallback",
              fallbackBars: []
            })
          ]
        }
      ],
      columnGap: 10
    }
  ];

  const definition: TDocumentDefinitions = {
    info: { title: `Proplytic Investment Report — ${propertyType}` },
    pageMargins: PDF_PAGE_MARGINS,
    background: () => ({
      canvas: [{ type: "rect", x: 0, y: 0, w: 595.28, h: 841.89, color: theme.backgroundColor }]
    }),
    content,
    styles: styles as any,
    defaultStyle: { font: theme.fontFamily, fontSize: 10, color: theme.textColor },
    footer: (currentPage: number, pageCount: number) => ({
      margin: pdfMargin(48, 0, 48, 24),
      columns: [
        {
          width: "*",
          stack: [
            { text: "Proplytic", style: "footerText" },
            {
              text: "This report is for informational purposes only and does not constitute financial, legal, or tax advice.",
              style: "footerText",
              margin: pdfMargin(0, 2, 0, 0)
            }
          ]
        },
        { width: 140, text: `Page ${currentPage} of ${pageCount}`, style: "footerText", alignment: "right" }
      ]
    })
  };

  return { definition };
}

export type PropertyHeader = {
  name: string;
  addressLine1: string;
  city: string;
  province: string;
  postalCode: string;
};

export function buildPropertySummaryPdfDefinition(opts: {
  property?: PropertyHeader;
  summary?: Record<string, unknown>;
  statementRows?: unknown[];
  scenarioName?: string | null;
  reportModel?: PropertyInvestmentReportModel;
  accentColor?: string | null;
}): TDocumentDefinitions {
  if (opts.reportModel) {
    return buildPropertyInvestmentReportPdfDefinition(opts.reportModel, opts.accentColor);
  }
  const model = assemblePropertyInvestmentReportData({
    propertyRow: {
      name: opts.property?.name ?? "Property",
      address_line1: opts.property?.addressLine1 ?? "",
      city: opts.property?.city ?? "",
      province: opts.property?.province ?? "",
      postal_code: opts.property?.postalCode ?? ""
    },
    statement: { summary: opts.summary ?? {}, recurringCharges: [], bondFinance: {} },
    leases: [],
    invoices: []
  });
  return buildPropertyInvestmentReportPdfDefinition(model, opts.accentColor);
}
