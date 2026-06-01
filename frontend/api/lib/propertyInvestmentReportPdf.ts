import type { Content, StyleDictionary, TDocumentDefinitions } from "pdfmake/interfaces";
import {
  brandedHeader,
  buildDefaultPdfStyles,
  buildPdfFooter,
  detailsTable,
  documentSummaryStrip,
  pdfDivider,
  pdfMargin,
  PDF_PAGE_MARGINS,
  PDF_SPACING
} from "./pdf/globalPdfLayout.js";
import { buildGlobalPdfTheme } from "./pdf/globalPdfTheme.js";
import { formatPdfDate, formatPdfZar } from "./pdf/pdfFormat.js";
import { loadProplyticLogoDataUrl } from "./pdf/pdfLogoAsset.js";
import type { PropertyInvestmentReportModel } from "./propertyInvestmentReportData.js";
import { formatPct } from "./propertyInvestmentReportData.js";

function formatZar(amount: number): string {
  return formatPdfZar(amount);
}

function sectionTitle(text: string, pageBreak = false): Content {
  return {
    text,
    style: "sectionHeading",
    ...(pageBreak ? { pageBreak: "before" as const } : {}),
    margin: pdfMargin(0, pageBreak ? 12 : 8, 0, 6)
  };
}

function kvTable(rows: { label: string; value: string }[]): Content {
  return {
    table: {
      widths: ["42%", "*"],
      body: rows.map((r) => [
        { text: r.label, style: "tableCell", color: "#6b7280" },
        { text: r.value, style: "tableCell", alignment: "right" }
      ])
    },
    layout: "lightHorizontalLines",
    margin: pdfMargin(0, 0, 0, PDF_SPACING.block)
  };
}

function horizontalBarChart(opts: {
  items: { label: string; amount: number }[];
  maxWidth: number;
  barColor: string;
}): Content {
  const max = Math.max(...opts.items.map((i) => i.amount), 1);
  const rows: Content[] = opts.items.slice(0, 8).map((item) => {
    const w = Math.max(4, Math.round((item.amount / max) * opts.maxWidth));
    return {
      columns: [
        { width: 90, text: item.label, style: "mutedText", fontSize: 8 },
        {
          width: opts.maxWidth + 60,
          stack: [
            {
              canvas: [
                {
                  type: "rect",
                  x: 0,
                  y: 0,
                  w,
                  h: 10,
                  color: opts.barColor
                }
              ],
              margin: pdfMargin(0, 2, 0, 2)
            },
            { text: formatZar(item.amount), style: "mutedText", fontSize: 7, alignment: "left" }
          ]
        }
      ],
      columnGap: 6,
      margin: pdfMargin(0, 0, 0, 4)
    };
  });
  return { stack: rows };
}

function projectionTable(model: PropertyInvestmentReportModel, theme: ReturnType<typeof buildGlobalPdfTheme>): Content {
  const headers = ["", ...model.projection.years.map((y) => `Year ${y}`)];
  const body: unknown[][] = [
    headers.map((h, i) => ({
      text: h,
      style: i === 0 ? "tableCell" : "tableHeader",
      alignment: i === 0 ? "left" : "right",
      fillColor: i === 0 ? undefined : theme.tableHeaderFill,
      bold: i > 0
    })),
    ...model.projection.rows.map((row) => [
      { text: row.label, style: "tableCell", bold: true },
      ...row.values.map((v) => ({
        text: String(v ?? "—"),
        style: "tableCell",
        alignment: "right" as const
      }))
    ])
  ];
  return {
    table: {
      headerRows: 1,
      widths: [110, ...model.projection.years.map(() => "*")],
      body: body as Content[][]
    },
    layout: {
      hLineWidth: (i: number, node: { table: { body: unknown[] } }) =>
        i === 0 || i === 1 || i === node.table.body.length ? 0.5 : 0.25,
      vLineWidth: () => 0,
      hLineColor: () => theme.borderColor,
      paddingLeft: () => 5,
      paddingRight: () => 5,
      paddingTop: () => 4,
      paddingBottom: () => 4
    },
    margin: pdfMargin(0, 0, 0, PDF_SPACING.section)
  };
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

  const parseZarCell = (s: unknown) => {
    if (typeof s !== "string") return 0;
    const num = Number(s.replace(/[^\d.-]/g, ""));
    return Number.isFinite(num) ? num : 0;
  };
  const valueRow = model.projection.rows.find((r) => r.label === "Property value");
  const equityRow = model.projection.rows.find((r) => r.label === "Equity");
  const loanRow = model.projection.rows.find((r) => r.label === "Loan balance");
  const valueEquityChart = [
    { label: "Property value (Y1)", amount: parseZarCell(valueRow?.values[0]) },
    { label: "Equity (Y1)", amount: parseZarCell(equityRow?.values[0]) },
    { label: "Loan balance (Y1)", amount: parseZarCell(loanRow?.values[0]) }
  ].filter((i) => i.amount > 0);

  const content: Content[] = [
    brandedHeader({
      logoDataUrl: loadProplyticLogoDataUrl(),
      brandTitle: "Proplytic",
      rightStack: [
        { text: "Property Investment Report", style: "documentTitle", alignment: "right" },
        { text: model.property.name, style: "bodyText", alignment: "right", bold: true },
        { text: generatedLabel, style: "mutedText", alignment: "right" }
      ]
    }),
    pdfDivider(theme),
    {
      fillColor: theme.lightFill,
      margin: pdfMargin(0, 0, 0, PDF_SPACING.section),
      table: {
        widths: ["*"],
        body: [
          [
            {
              stack: [
                { text: model.property.name, style: "documentTitle", margin: pdfMargin(8, 8, 8, 2) },
                { text: model.property.address || "—", style: "bodyText", margin: pdfMargin(8, 0, 8, 2) },
                {
                  text: `${model.property.propertyType} · ${model.property.investmentType}`,
                  style: "mutedText",
                  margin: pdfMargin(8, 0, 8, 2)
                },
                {
                  text: `Reporting period: ${model.reportingPeriodLabel}`,
                  style: "mutedText",
                  margin: pdfMargin(8, 0, 8, 8)
                },
                { text: model.property.imageNote, style: "mutedText", italics: true, margin: pdfMargin(8, 0, 8, 8) }
              ]
            }
          ]
        ]
      },
      layout: {
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
        hLineColor: () => theme.borderColor,
        vLineColor: () => theme.borderColor
      }
    },
    documentSummaryStrip([
      { label: "Monthly income", value: formatZar(model.metrics.monthlyIncome) },
      { label: "Monthly expenses", value: formatZar(model.metrics.monthlyExpenses) },
      { label: "Monthly cash flow", value: formatZar(model.metrics.monthlyCashFlow) },
      { label: "Gross yield", value: formatPct(model.metrics.grossRentalYield) }
    ]),
    documentSummaryStrip([
      { label: "Cash on cash ROI", value: formatPct(model.metrics.cashOnCashRoi) },
      { label: "Cap rate", value: formatPct(model.metrics.capRate) },
      { label: "2% rule", value: formatPct(model.metrics.twoPercentRule) },
      { label: "Total cash needed", value: model.metrics.totalCashNeeded != null ? formatZar(model.metrics.totalCashNeeded) : "—" }
    ]),
    { text: "Property information", style: "sectionHeading", margin: pdfMargin(0, 4, 0, 6) },
    kvTable(model.propertyInfo),
    { text: "Income & expenses", style: "sectionHeading", margin: pdfMargin(0, 8, 0, 6) },
    {
      columns: [
        {
          width: "48%",
          stack: [
            kvTable([
              { label: "Monthly income", value: formatZar(model.metrics.monthlyIncome) },
              { label: "Monthly expenses", value: formatZar(model.metrics.monthlyExpenses) },
              { label: "Monthly cash flow", value: formatZar(model.metrics.monthlyCashFlow) }
            ])
          ]
        },
        {
          width: "52%",
          stack: [
            { text: "Expense breakdown", style: "sectionLabel" },
            horizontalBarChart({
              items: model.expenseBreakdown,
              maxWidth: 160,
              barColor: theme.primaryColor
            })
          ]
        }
      ],
      columnGap: 12
    },
    { text: "Assumptions", style: "sectionHeading" },
    kvTable(model.assumptions),
    sectionTitle("Analysis over time"),
    projectionTable(model, theme),
    ...(valueEquityChart.length
      ? [
          { text: "Property value vs equity vs loan (year 1)", style: "sectionLabel", margin: pdfMargin(0, 10, 0, 4) },
          horizontalBarChart({ items: valueEquityChart, maxWidth: 200, barColor: theme.primaryColor })
        ]
      : []),
    sectionTitle("Actual / received financials", true),
    kvTable(model.actuals),
    sectionTitle("Projected vs actual"),
    detailsTable({
      theme,
      columns: [
        { header: "Metric", key: "metric", width: 90 },
        { header: "Projected", key: "projected", alignment: "right" },
        { header: "Actual", key: "actual", alignment: "right" },
        { header: "Difference", key: "difference", alignment: "right" },
        { header: "Status", key: "status", width: 80 }
      ],
      rows: model.comparison
    }),
    ...(model.leases.length
      ? [
          sectionTitle("Lease / tenant summary"),
          detailsTable({
            theme,
            columns: [
              { header: "Tenants", key: "tenants", width: "*" },
              { header: "Status", key: "status", width: 70 },
              { header: "Rent", key: "monthlyRent", alignment: "right", width: 65 },
              { header: "Start", key: "start", width: 58 },
              { header: "End", key: "end", width: 58 }
            ],
            rows: model.leases
          })
        ]
      : []),
    sectionTitle("50% rule projection"),
    kvTable(model.fiftyPercentRule),
    {
      text: "This report is generated from property, lease, invoice, payment, expense and statement data available in Proplytic at the time of generation.",
      style: "mutedText",
      margin: pdfMargin(0, 16, 0, 0)
    }
  ];

  return {
    info: { title: `Proplytic — ${model.property.name}` },
    pageMargins: PDF_PAGE_MARGINS,
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
    footer: buildPdfFooter(theme, "Proplytic")
  };
}
