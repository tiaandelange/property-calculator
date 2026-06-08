import type { Content, StyleDictionary, TDocumentDefinitions } from "pdfmake/interfaces";
import {
  buildReportFooter,
  dataTable,
  buildDefaultPdfStyles,
  pdfMargin,
  REPORT_PAGE_MARGINS,
  REPORT_PAGE_ORIENTATION,
  REPORT_PAGE_SIZE,
  REPORT_PAGE_WIDTH_SAFE,
  PDF_SPACING
} from "./pdf/globalPdfLayout.js";
import { buildGlobalPdfTheme } from "./pdf/globalPdfTheme.js";
import { formatPdfDate, formatPdfPercent, formatPdfZar, parsePdfZar } from "./pdf/pdfFormat.js";
import { loadProplyticLogoDataUrl } from "./pdf/pdfLogoAsset.js";
import type { PropertyInvestmentReportModel } from "./propertyInvestmentReportData.js";
import { formatPct } from "./propertyInvestmentReportData.js";

function formatZar(amount: number): string {
  return formatPdfZar(amount);
}

export function buildPropertyInvestmentReportPdfDefinition(
  model: PropertyInvestmentReportModel,
  accentColor?: string | null
): TDocumentDefinitions {
  const theme = buildGlobalPdfTheme({ accentColor });
  const styles: StyleDictionary = {
    ...buildDefaultPdfStyles(theme),
    sectionHeading: {
      fontSize: 13,
      bold: true,
      color: theme.primaryColor,
      margin: pdfMargin(0, 8, 0, 6)
    }
  };

  const generatedLabel = formatPdfDate(model.generatedAt.slice(0, 10));

  const dash = (v: string | null | undefined): string => {
    const s = String(v ?? "").trim();
    return s.length ? s : "—";
  };

  const sanitizeDisplayText = (v: unknown): string => {
    if (v == null) return "—";
    const s = String(v).trim();
    if (!s || s === "undefined" || s === "null" || /^nan$/i.test(s) || /NaN%/.test(s)) return "—";
    return s;
  };

  const metricCurrency = (n: number | null | undefined): string => {
    if (n == null || !Number.isFinite(n)) return "—";
    return formatZar(n);
  };

  const metricPct = (n: number | null | undefined): string => {
    if (n == null || !Number.isFinite(n)) return "—";
    return `${Number(n).toFixed(2)}%`;
  };

  type KeyValueRow = { label: string; value: string; fullWidth?: boolean };

  const PERCENT_PROJECTION_ROWS = new Set(["IRR", "Cash on cash ROI"]);

  const buildKeyValueCard = (opts: {
    title: string;
    iconText?: string;
    rows: KeyValueRow[];
    unbreakable?: boolean;
  }): Content => {
    const bodyRows: any[][] = [
      [
        {
          colSpan: 2,
          stack: [
            {
              columns: [
                ...(opts.iconText
                  ? [{ width: "auto", text: opts.iconText, color: theme.primaryColor, bold: true, fontSize: 9, margin: pdfMargin(0, 0, 6, 0) } as any]
                  : []),
                { width: "*", text: opts.title, fontSize: 11, bold: true, color: theme.primaryColor }
              ],
              columnGap: 6
            }
          ],
          fillColor: theme.tableHeaderFill,
          margin: pdfMargin(0, 0, 0, 0)
        } as any,
        {}
      ],
      ...opts.rows.map((r) => {
        if (r.fullWidth) {
          return [
            {
              colSpan: 2,
              text: String(r.value ?? "—"),
              fontSize: 9,
              color: theme.textColor,
              noWrap: true,
              margin: pdfMargin(0, 2, 0, 2)
            } as any
          ];
        }
        const v = sanitizeDisplayText(r.value);
        const vText = v;
        const keepTogether = /meets 50%|does not meet|insufficient data/i.test(vText);
        return [
          { text: r.label, fontSize: 9, color: theme.mutedTextColor },
          {
            text: vText,
            fontSize: 9,
            color: theme.textColor,
            alignment: "right" as const,
            noWrap: keepTogether || vText.length < 42
          }
        ];
      })
    ];

    const card: Content = {
      table: { widths: ["55%", "45%"], body: bodyRows },
      layout: {
        hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length ? 0.5 : 0.25),
        vLineWidth: () => 0.5,
        hLineColor: () => theme.borderColor,
        vLineColor: () => theme.borderColor,
        paddingLeft: () => 10,
        paddingRight: () => 10,
        paddingTop: (i: number) => (i === 0 ? 9 : 6),
        paddingBottom: (i: number) => (i === 0 ? 9 : 6)
      },
      margin: pdfMargin(0, 0, 0, 10)
    };

    return opts.unbreakable ? { unbreakable: true, ...card } : card;
  };

  const buildBarChartCard = (opts: {
    title: string;
    legend?: Array<{ label: string; color: string }>;
    rows: Array<{ label: string; valueLabel: string; valueNumber: number; color: string }>;
  }): Content => {
    const maxBarWidth = 180;
    const safeRows = opts.rows.filter((r) => Number.isFinite(r.valueNumber) && r.valueNumber > 0);
    const maxVal = Math.max(...safeRows.map((r) => r.valueNumber), 1);

    const legend: Content | null =
      opts.legend && opts.legend.length
        ? {
            columns: opts.legend.map((i) => ({
              width: "auto",
              columns: [
                {
                  width: 10,
                  canvas: [{ type: "rect", x: 0, y: 0, w: 8, h: 8, color: i.color }],
                  margin: pdfMargin(0, 2, 4, 0)
                },
                { width: "auto", text: i.label, fontSize: 8, color: theme.mutedTextColor, margin: pdfMargin(0, 0, 10, 0) }
              ],
              columnGap: 4
            })),
            columnGap: 8,
            margin: pdfMargin(0, 6, 0, 0)
          }
        : null;

    const barTable: Content =
      safeRows.length > 0
        ? {
            table: {
              widths: ["35%", "45%", "20%"],
              body: safeRows.slice(0, 10).map((r) => {
                const w = Math.max(6, Math.min(maxBarWidth, Math.round((r.valueNumber / maxVal) * maxBarWidth)));
                return [
                  { text: r.label, fontSize: 9, color: theme.mutedTextColor },
                  {
                    canvas: [{ type: "rect", x: 0, y: 0, w, h: 10, color: r.color }],
                    margin: pdfMargin(0, 4, 0, 4)
                  } as any,
                  {
                    text: r.valueLabel,
                    fontSize: 9,
                    color: theme.textColor,
                    alignment: "right" as const,
                    noWrap: true
                  }
                ];
              })
            },
            layout: {
              hLineWidth: () => 0,
              vLineWidth: () => 0,
              paddingLeft: () => 0,
              paddingRight: () => 0,
              paddingTop: () => 0,
              paddingBottom: () => 0
            },
            margin: pdfMargin(0, 4, 0, 0)
          }
        : { text: "Not enough data to display this chart.", style: "mutedText", italics: true, margin: pdfMargin(0, 10, 0, 0) };

    return {
      table: {
        widths: ["*"],
        body: [
          [
            {
              stack: [{ text: opts.title, fontSize: 11, bold: true, color: theme.primaryColor }, ...(legend ? [legend] : []), barTable]
            }
          ]
        ]
      },
      layout: {
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
        hLineColor: () => theme.borderColor,
        vLineColor: () => theme.borderColor,
        paddingLeft: () => 10,
        paddingRight: () => 10,
        paddingTop: () => 10,
        paddingBottom: () => 10
      },
      margin: pdfMargin(0, 0, 0, 10)
    };
  };

  const buildMetricCard = (input: { label: string; value: string; helperText?: string; iconText?: string }): Content => {
    const valueText = String(input.value ?? "—");
    const compactValueFontSize = valueText.length > 14 ? 11 : valueText.length > 11 ? 12 : 13;

    return {
      table: {
        widths: ["*"],
        body: [
          [
            {
              stack: [
                {
                  columns: [
                    ...(input.iconText
                      ? [{ width: "auto", text: input.iconText, color: theme.primaryColor, bold: true, fontSize: 8, margin: pdfMargin(0, 0, 6, 0) } as any]
                      : []),
                    { width: "*", text: input.label, color: theme.primaryColor, bold: true, fontSize: 8 }
                  ],
                  columnGap: 4,
                  margin: pdfMargin(0, 0, 0, 3)
                },
                {
                  text: valueText,
                  fontSize: compactValueFontSize,
                  bold: true,
                  color: theme.textColor,
                  noWrap: true,
                  margin: pdfMargin(0, 0, 0, 2)
                },
                ...(input.helperText ? [{ text: input.helperText, fontSize: 8, color: theme.mutedTextColor } as any] : [])
              ]
            }
          ]
        ]
      },
      layout: {
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
        hLineColor: () => theme.borderColor,
        vLineColor: () => theme.borderColor,
        paddingLeft: () => 8,
        paddingRight: () => 8,
        paddingTop: () => 8,
        paddingBottom: () => 8
      }
    };
  };

  const projectionRow = (label: string): (string | number | null)[] | null => {
    const r = model.projection.rows.find((x) => x.label === label);
    return r ? r.values : null;
  };

  const formatCompactZar = (n: number): string => {
    const abs = Math.abs(n);
    if (abs >= 1_000_000) {
      const m = n / 1_000_000;
      const s = m.toFixed(1).replace(/\.0$/, "");
      return `R\u00A0${s}m`;
    }
    if (abs >= 10_000) {
      const k = Math.round(n / 1_000);
      return `R\u00A0${k}k`;
    }
    const rounded = Math.round(n + Number.EPSILON);
    const grouped = rounded.toLocaleString("en-ZA").replace(/,/g, " ");
    return `R\u00A0${grouped}`;
  };

  const formatProjectionCell = (rowLabel: string, raw: unknown): string => {
    if (raw == null) return "—";
    if (typeof raw === "number") {
      if (!Number.isFinite(raw)) return "—";
      if (PERCENT_PROJECTION_ROWS.has(rowLabel)) return formatPdfPercent(raw);
      return formatCompactZar(raw);
    }
    const s = sanitizeDisplayText(raw);
    if (s === "—") return "—";
    if (/%$/.test(s)) return s;
    const parsed = parsePdfZar(s);
    if (parsed != null) {
      if (PERCENT_PROJECTION_ROWS.has(rowLabel)) return formatPdfPercent(parsed);
      return formatCompactZar(parsed);
    }
    return s;
  };

  const parseProjectionNum = (raw: unknown): number | null => {
    if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
    return parsePdfZar(raw);
  };

  const yearCols = model.projection.years;
  const yMonthlyGross = projectionRow("Monthly gross rent");
  const yIncome = projectionRow("Total annual income");
  const yExpenses = projectionRow("Total annual expenses");
  const yNoi = projectionRow("Net operating income");
  const yCash = projectionRow("Total annual cash flow");
  const yValue = projectionRow("Property value");
  const yLoan = projectionRow("Loan balance");
  const yEquity = projectionRow("Equity");
  const yCoC = projectionRow("Cash on cash ROI");
  const yIrr = projectionRow("IRR");

  const chartIncomeExpenseBars = [
    { label: "Annual income (Y1)", amount: parseProjectionNum(yIncome?.[0]) ?? 0 },
    { label: "Annual expenses (Y1)", amount: parseProjectionNum(yExpenses?.[0]) ?? 0 },
    { label: "Annual cash flow (Y1)", amount: parseProjectionNum(yCash?.[0]) ?? 0 }
  ].filter((i) => i.amount > 0);

  const expenseItems = model.expenseBreakdown
    .filter((i) => i.amount > 0)
    .filter((i) => !/rental income/i.test(i.label))
    .filter((i) => !/income/i.test(i.label));

  const ratingLabel = model.investmentRating.label;

  const buildFiftyPercentRuleRows = (): KeyValueRow[] => {
    const rows: KeyValueRow[] = [];
    let expenseNote: string | null = null;

    for (const r of model.fiftyPercentRule) {
      const label = String(r.label ?? "").trim();
      const value = String(r.value ?? "—").trim();
      if (/operating costs vs gross rent/i.test(label) || /^operating costs are/i.test(value)) {
        expenseNote = value.endsWith(".") ? value : `${value.replace(/\.$/, "")}.`;
        continue;
      }
      rows.push({ label, value });
    }

    if (expenseNote) rows.push({ label: "", value: expenseNote, fullWidth: true });
    return rows;
  };

  const cocDisplay =
    model.metrics.totalCashNeeded != null &&
    model.metrics.totalCashNeeded > 0 &&
    model.metrics.cashOnCashRoi != null
      ? formatPct(model.metrics.cashOnCashRoi)
      : "—";

  const content: Content[] = [
    {
      stack: [
        (() => {
          const logo = loadProplyticLogoDataUrl();
          return logo
            ? { image: logo, width: 44, margin: pdfMargin(0, 0, 0, 8) }
            : { text: "Proplytic", style: "brandWordmark", noWrap: true, margin: pdfMargin(0, 0, 0, 8) };
        })(),
        { text: "Property Investment Report", style: "documentTitle", margin: pdfMargin(0, 0, 0, 4) },
        {
          text: model.property.name,
          style: "bodyText",
          bold: true,
          color: theme.primaryColor,
          margin: pdfMargin(0, 0, 0, 2)
        },
        { text: `Report Date: ${generatedLabel}`, style: "mutedText", margin: pdfMargin(0, 0, 0, 10) },
        {
          canvas: [
            { type: "line", x1: 0, y1: 0, x2: REPORT_PAGE_WIDTH_SAFE, y2: 0, lineWidth: 1, lineColor: theme.primaryColor }
          ],
          margin: pdfMargin(0, 0, 0, PDF_SPACING.section)
        }
      ],
      margin: pdfMargin(0, 0, 0, 0)
    },
    {
      text: "Executive Summary",
      style: "sectionHeading",
      margin: pdfMargin(0, 0, 0, 4)
    },
    {
      stack: model.executiveSummary.map((paragraph) => ({
        text: paragraph,
        style: "bodyText",
        margin: pdfMargin(0, 0, 0, 6)
      })),
      margin: pdfMargin(0, 0, 0, PDF_SPACING.section)
    },
    {
      table: {
        widths: ["*", "*"],
        body: [
          [
            buildMetricCard({ label: "Monthly Income", value: metricCurrency(model.metrics.monthlyIncome), helperText: "Gross rent" }),
            buildMetricCard({ label: "Monthly Expenses", value: metricCurrency(model.metrics.monthlyExpenses), helperText: "Total monthly" })
          ],
          [
            buildMetricCard({ label: "Monthly Cash Flow", value: metricCurrency(model.metrics.monthlyCashFlow), helperText: "After debt & expenses" }),
            buildMetricCard({ label: "Gross Yield", value: formatPct(model.metrics.grossRentalYield), helperText: "Annualized" })
          ],
          [
            buildMetricCard({ label: "Cash on Cash ROI", value: cocDisplay, helperText: "Annualized" }),
            buildMetricCard({ label: "LTV", value: formatPct(model.metrics.ltv), helperText: "Loan-to-value" })
          ],
          [
            buildMetricCard({ label: "IRR", value: formatPct(model.metrics.internalRateOfReturn), helperText: "Projected" }),
            buildMetricCard({ label: "Occupancy", value: model.metrics.occupancyLabel ?? "—", helperText: "Current" })
          ]
        ]
      },
      layout: {
        hLineWidth: () => 0,
        vLineWidth: () => 0,
        paddingLeft: () => 0,
        paddingRight: () => 0,
        paddingTop: () => 0,
        paddingBottom: () => 8
      },
      columnGap: 12,
      margin: pdfMargin(0, 0, 0, PDF_SPACING.section)
    },

    {
      stack: [
        buildKeyValueCard({ title: "Property Information", rows: model.propertyDetails }),
        buildKeyValueCard({ title: "Income & Expenses (Monthly)", rows: model.monthlyIncomeExpense }),
        buildKeyValueCard({ title: "Assumptions", rows: model.keyAssumptions }),
        buildKeyValueCard({ title: "Loan & Assumptions", rows: model.assumptions })
      ]
    },

    {
      text: "Analysis Over Time",
      style: "sectionHeading",
      margin: pdfMargin(0, 0, 0, 6)
    },
    {
      table: {
        headerRows: 1,
        widths: [100, ...yearCols.map(() => "*")],
        body: [
          [
            { text: "Metric", style: "tableHeader", fontSize: 8 },
            ...yearCols.map((y) => ({ text: `Y${y}`, style: "tableHeader", alignment: "right" as const, fontSize: 8 }))
          ],
          [
            { text: "Gross Rent", style: "tableCell", fontSize: 8 },
            ...yearCols.map((_, i) => ({
              text: formatProjectionCell("Monthly gross rent", yMonthlyGross?.[i] ?? yIncome?.[i]),
              style: "tableCell",
              fontSize: 8,
              alignment: "right" as const,
              noWrap: true
            }))
          ],
          [
            { text: "Total Expenses", style: "tableCell", fontSize: 8 },
            ...yearCols.map((_, i) => ({
              text: formatProjectionCell("Total annual expenses", yExpenses?.[i]),
              style: "tableCell",
              fontSize: 8,
              alignment: "right" as const,
              noWrap: true
            }))
          ],
          [
            { text: "Net Operating Income", style: "tableCell", fontSize: 8 },
            ...yearCols.map((_, i) => ({
              text: formatProjectionCell("Net operating income", yNoi?.[i]),
              style: "tableCell",
              fontSize: 8,
              alignment: "right" as const,
              noWrap: true
            }))
          ],
          [
            { text: "Cash Flow After Debt Service", style: "tableCell", fontSize: 8 },
            ...yearCols.map((_, i) => ({
              text: formatProjectionCell("Total annual cash flow", yCash?.[i]),
              style: "tableCell",
              fontSize: 8,
              alignment: "right" as const,
              noWrap: true
            }))
          ],
          [
            { text: "Property Value", style: "tableCell", fontSize: 8 },
            ...yearCols.map((_, i) => ({
              text: formatProjectionCell("Property value", yValue?.[i]),
              style: "tableCell",
              fontSize: 8,
              alignment: "right" as const,
              noWrap: true
            }))
          ],
          [
            { text: "Loan Balance", style: "tableCell", fontSize: 8 },
            ...yearCols.map((_, i) => ({
              text: formatProjectionCell("Loan balance", yLoan?.[i]),
              style: "tableCell",
              fontSize: 8,
              alignment: "right" as const,
              noWrap: true
            }))
          ],
          [
            { text: "Equity", style: "tableCell", fontSize: 8 },
            ...yearCols.map((_, i) => ({
              text: formatProjectionCell("Equity", yEquity?.[i]),
              style: "tableCell",
              fontSize: 8,
              alignment: "right" as const,
              noWrap: true
            }))
          ],
          [
            { text: "Cash on Cash ROI", style: "tableCell", fontSize: 8 },
            ...yearCols.map((_, i) => ({
              text: formatProjectionCell("Cash on cash ROI", yCoC?.[i]),
              style: "tableCell",
              fontSize: 8,
              alignment: "right" as const,
              noWrap: true
            }))
          ],
          [
            { text: "IRR", style: "tableCell", fontSize: 8 },
            ...yearCols.map((_, i) => ({
              text: formatProjectionCell("IRR", yIrr?.[i]),
              style: "tableCell",
              fontSize: 8,
              alignment: "right" as const,
              noWrap: true
            }))
          ]
        ]
      },
      layout: {
        hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length ? 0.5 : 0.25),
        vLineWidth: () => 0,
        hLineColor: () => theme.borderColor,
        paddingLeft: () => 6,
        paddingRight: () => 6,
        paddingTop: () => 4,
        paddingBottom: () => 4,
        fillColor: (rowIndex: number) => (rowIndex > 1 && rowIndex % 2 === 0 ? theme.zebraFill : null)
      },
      margin: pdfMargin(0, 0, 0, PDF_SPACING.section)
    },

    { text: "", pageBreak: "before" as const },

    {
      stack: [
        buildBarChartCard({
          title: "Income vs Expenses Over Time",
          legend: [
            { label: "Income", color: theme.primaryColor },
            { label: "Expenses", color: theme.dangerColor },
            { label: "Cash flow", color: theme.successColor }
          ],
          rows: [
            {
              label: "Annual income (Y1)",
              valueLabel: formatProjectionCell("Total annual income", yIncome?.[0]),
              valueNumber: parseProjectionNum(yIncome?.[0]) ?? 0,
              color: theme.primaryColor
            },
            {
              label: "Annual expenses (Y1)",
              valueLabel: formatProjectionCell("Total annual expenses", yExpenses?.[0]),
              valueNumber: parseProjectionNum(yExpenses?.[0]) ?? 0,
              color: theme.dangerColor
            },
            {
              label: "Annual cash flow (Y1)",
              valueLabel: formatProjectionCell("Total annual cash flow", yCash?.[0]),
              valueNumber: parseProjectionNum(yCash?.[0]) ?? 0,
              color: theme.successColor
            }
          ]
        }),
        buildBarChartCard({
          title: "Return Snapshot",
          rows: [
            {
              label: "Gross yield",
              valueLabel: formatPct(model.metrics.grossRentalYield),
              valueNumber: model.metrics.grossRentalYield ?? 0,
              color: theme.primaryColor
            },
            {
              label: "Cash on cash ROI",
              valueLabel: formatPct(model.metrics.cashOnCashRoi),
              valueNumber: model.metrics.cashOnCashRoi ?? 0,
              color: theme.accentColor
            },
            {
              label: "IRR",
              valueLabel: formatPct(model.metrics.internalRateOfReturn),
              valueNumber: model.metrics.internalRateOfReturn ?? 0,
              color: theme.successColor
            }
          ]
        }),
        buildBarChartCard({
          title: "Expense Breakdown Monthly",
          rows: expenseItems.slice(0, 8).map((i) => ({
            label: i.label,
            valueLabel: formatZar(i.amount),
            valueNumber: i.amount,
            color: theme.primaryColor
          }))
        })
      ]
    },

    dataTable({
      theme,
      title: "Projected vs Actual Comparison",
      columns: [
        { header: "Metric", key: "metric", width: 120 },
        { header: "Projected", key: "projected", alignment: "right" },
        { header: "Actual", key: "actual", alignment: "right" },
        { header: "Variance", key: "difference", alignment: "right" },
        { header: "Variance %", key: "variancePercent", alignment: "right", width: 70 },
        { header: "Status", key: "status", width: 90 }
      ],
      rows: model.comparison
    }),

    ...(model.leases.length
      ? [
          dataTable({
            theme,
            title: "Lease / Tenant Summary",
            columns: [
              { header: "Unit", key: "unit", width: 55 },
              { header: "Tenants", key: "tenants", width: "*" },
              { header: "Status", key: "status", width: 60 },
              { header: "Rent", key: "monthlyRent", alignment: "right", width: 65 },
              { header: "Start", key: "start", width: 60 },
              { header: "End", key: "end", width: 60 }
            ],
            rows: model.leases as any
          })
        ]
      : [
          buildKeyValueCard({
            title: "Lease / Tenant Summary",
            rows: [{ label: "Status", value: "No lease data available" }],
            unbreakable: true
          })
        ]),

    buildKeyValueCard({
      title: "2% Rule",
      rows: [
        { label: "2% Rule", value: formatPct(model.metrics.twoPercentRule) },
        { label: "Target", value: "2.00%" }
      ],
      unbreakable: true
    }),

    buildKeyValueCard({
      title: "50% Rule Projection",
      rows: buildFiftyPercentRuleRows(),
      unbreakable: true
    }),

    buildKeyValueCard({
      title: "Investment Rating",
      rows: [
        { label: "Rating", value: ratingLabel },
        { label: "Summary", value: model.investmentRating.summary, fullWidth: true }
      ],
      unbreakable: true
    })
  ];

  return {
    info: { title: `Proplytic — ${model.property.name}` },
    pageSize: REPORT_PAGE_SIZE,
    pageOrientation: REPORT_PAGE_ORIENTATION,
    pageMargins: REPORT_PAGE_MARGINS,
    background: () => ({
      canvas: [
        {
          type: "rect",
          x: 0,
          y: 0,
          w: 595.28,
          h: 841.89,
          color: theme.backgroundColor
        }
      ]
    }),
    content,
    styles,
    defaultStyle: { font: theme.fontFamily, fontSize: 10, color: theme.textColor },
    footer: buildReportFooter({
      theme,
      brandName: "Proplytic",
      generatedDateIso: model.generatedAt.slice(0, 10)
    })
  };
}
