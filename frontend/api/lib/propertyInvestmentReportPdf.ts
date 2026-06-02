import type { Content, StyleDictionary, TDocumentDefinitions } from "pdfmake/interfaces";
import {
  buildReportFooter,
  chartCard,
  dataTable,
  metricCard,
  reportHeader,
  sectionCard,
  buildDefaultPdfStyles,
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

  const metricCurrency = (n: number | null | undefined): string => {
    if (n == null || !Number.isFinite(n)) return "—";
    return formatZar(n);
  };

  const metricPct = (n: number | null | undefined): string => {
    if (n == null || !Number.isFinite(n)) return "—";
    return `${Number(n).toFixed(2)}%`;
  };

  const projectionRow = (label: string): (string | number | null)[] | null => {
    const r = model.projection.rows.find((x) => x.label === label);
    return r ? r.values : null;
  };

  const parseZar = (s: unknown): number | null => {
    if (typeof s !== "string") return null;
    const num = Number(s.replace(/[^\d.-]/g, ""));
    return Number.isFinite(num) ? num : null;
  };

  const yearCols = model.projection.years;
  const yIncome = projectionRow("Total annual income");
  const yExpenses = projectionRow("Total annual expenses");
  const yNoi = projectionRow("Net operating income");
  const yCash = projectionRow("Total annual cash flow");
  const yValue = projectionRow("Property value");
  const yLoan = projectionRow("Loan balance");
  const yEquity = projectionRow("Equity");
  const yCoC = projectionRow("Cash on cash ROI");

  const chartIncomeExpenseBars = [
    { label: "Annual income (Y1)", amount: parseZar(yIncome?.[0]) ?? 0 },
    { label: "Annual expenses (Y1)", amount: parseZar(yExpenses?.[0]) ?? 0 },
    { label: "Annual cash flow (Y1)", amount: parseZar(yCash?.[0]) ?? 0 }
  ].filter((i) => i.amount > 0);

  const xLabels = yearCols.map((y) => `Y${y}`);
  const seriesIncome = (yIncome ?? []).map((v) => parseZar(v));
  const seriesExpenses = (yExpenses ?? []).map((v) => parseZar(v));
  const expenseItems = model.expenseBreakdown
    .filter((i) => i.amount > 0)
    .filter((i) => !/rental income/i.test(i.label))
    .filter((i) => !/income/i.test(i.label));

  const monthlyGross = model.metrics.monthlyIncome;
  const monthlyExpTotal = model.metrics.monthlyExpenses;
  const expPctOfGross =
    monthlyGross > 0 && Number.isFinite(monthlyGross) && Number.isFinite(monthlyExpTotal)
      ? (monthlyExpTotal / monthlyGross) * 100
      : null;
  const meets50 = monthlyGross > 0 ? monthlyExpTotal <= monthlyGross * 0.5 : false;

  const rating = (() => {
    const cf = model.metrics.monthlyCashFlow;
    if (!Number.isFinite(cf)) return { label: "—", color: theme.mutedTextColor, helper: "Insufficient data" };
    if (cf > 0 && meets50) return { label: "Excellent", color: theme.successColor, helper: "Positive cash flow and meets 50% rule" };
    if (meets50) return { label: "Good", color: theme.warningColor, helper: "Meets 50% rule; cash flow may be negative" };
    return { label: "Bad", color: theme.dangerColor, helper: "Does not meet 50% rule or negative cash flow" };
  })();

  const content: Content[] = [
    reportHeader({
      theme,
      logoDataUrl: loadProplyticLogoDataUrl(),
      brandTitle: "Proplytic",
      reportTitle: "Property Investment Report",
      propertyName: model.property.name,
      addressLine: model.property.address?.trim() || undefined,
      reportDateLine: `Report Date: ${generatedLabel}`,
      propertyImageDataUrl: null
    }),
    pdfDivider(theme),
    {
      columns: [
        {
          width: "*",
          stack: [
            metricCard({
              theme,
              label: "Monthly Income",
              value: metricCurrency(model.metrics.monthlyIncome),
              helperText: "Gross rent",
              iconText: "↑"
            }),
            metricCard({
              theme,
              label: "Monthly Expenses",
              value: metricCurrency(model.metrics.monthlyExpenses),
              helperText: "Total monthly",
              iconText: "↓"
            }),
            metricCard({
              theme,
              label: "Monthly Cash Flow",
              value: metricCurrency(model.metrics.monthlyCashFlow),
              helperText: "After debt & expenses",
              iconText: "◎"
            }),
            metricCard({
              theme,
              label: "Gross Yield",
              value: formatPct(model.metrics.grossRentalYield),
              helperText: "Annualized",
              iconText: "%"
            })
          ]
        },
        {
          width: "*",
          stack: [
            metricCard({
              theme,
              label: "Cash on Cash ROI",
              value: formatPct(model.metrics.cashOnCashRoi),
              helperText: "Annualized",
              iconText: "%"
            }),
            metricCard({
              theme,
              label: "LTV",
              value: formatPct(model.metrics.ltv),
              helperText: "Loan-to-value",
              iconText: "L"
            }),
            metricCard({
              theme,
              label: "IRR",
              value: formatPct(model.metrics.internalRateOfReturn),
              helperText: "Projected",
              iconText: "↗"
            }),
            metricCard({
              theme,
              label: "Occupancy",
              value: model.metrics.occupancyLabel ?? "—",
              helperText: "Current",
              iconText: "◉"
            })
          ]
        }
      ],
      columnGap: 10,
      margin: pdfMargin(0, 0, 0, PDF_SPACING.section)
    },

    {
      columns: [
        {
          width: "33.3%",
          stack: [
            sectionCard({
              theme,
              title: "Property Information",
              iconText: "⌂",
              rows: model.propertyDetails
            })
          ]
        },
        {
          width: "33.3%",
          stack: [
            sectionCard({
              theme,
              title: "Income & Expenses (Monthly)",
              iconText: "$",
              rows: model.monthlyIncomeExpense
            })
          ]
        },
        {
          width: "33.3%",
          stack: [
            sectionCard({
              theme,
              title: "Loan & Assumptions",
              iconText: "⚙",
              rows: model.assumptions
            })
          ]
        }
      ],
      columnGap: 10
    },

    {
      text: "Analysis Over Time",
      style: "sectionHeading",
      margin: pdfMargin(0, 0, 0, 6)
    },
    dataTable({
      theme,
      columns: [
        { header: "Year", key: "metric", width: 130 },
        ...yearCols.map((y) => ({ header: `Year ${y}`, key: `y${y}`, alignment: "right" as const }))
      ],
      rows: [
        {
          metric: "Gross Rent",
          ...Object.fromEntries(yearCols.map((y, i) => [`y${y}`, dash(String(yIncome?.[i] ?? "—"))]))
        },
        {
          metric: "Total Expenses",
          ...Object.fromEntries(yearCols.map((y, i) => [`y${y}`, dash(String(yExpenses?.[i] ?? "—"))]))
        },
        {
          metric: "Net Operating Income",
          ...Object.fromEntries(yearCols.map((y, i) => [`y${y}`, dash(String(yNoi?.[i] ?? "—"))]))
        },
        {
          metric: "Cash Flow After Debt Service",
          ...Object.fromEntries(yearCols.map((y, i) => [`y${y}`, dash(String(yCash?.[i] ?? "—"))]))
        },
        {
          metric: "Property Value",
          ...Object.fromEntries(yearCols.map((y, i) => [`y${y}`, dash(String(yValue?.[i] ?? "—"))]))
        },
        {
          metric: "Loan Balance",
          ...Object.fromEntries(yearCols.map((y, i) => [`y${y}`, dash(String(yLoan?.[i] ?? "—"))]))
        },
        {
          metric: "Equity",
          ...Object.fromEntries(yearCols.map((y, i) => [`y${y}`, dash(String(yEquity?.[i] ?? "—"))]))
        },
        {
          metric: "Cash on Cash ROI",
          ...Object.fromEntries(yearCols.map((y, i) => [`y${y}`, dash(String(yCoC?.[i] ?? "—"))]))
        }
      ]
    }),

    { text: "", pageBreak: "before" as const },

    {
      columns: [
        {
          width: "33.3%",
          stack: [
            chartCard({
              theme,
              title: "Income vs Expenses Over Time",
              fallbackSeries: [
                { label: "Income", color: theme.primaryColor, values: seriesIncome, xLabels },
                { label: "Expenses", color: theme.dangerColor, values: seriesExpenses, xLabels }
              ],
              fallbackBars: chartIncomeExpenseBars.length ? chartIncomeExpenseBars : undefined
            })
          ]
        },
        {
          width: "33.3%",
          stack: [
            chartCard({
              theme,
              title: "Return Snapshot",
              fallbackBars: [
                { label: "Gross yield", amount: model.metrics.grossRentalYield ?? 0 },
                { label: "Cash on cash", amount: model.metrics.cashOnCashRoi ?? 0 },
                { label: "IRR", amount: model.metrics.internalRateOfReturn ?? 0 }
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
              fallbackBars: expenseItems.slice(0, 8)
            })
          ]
        }
      ],
      columnGap: 10
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
          sectionCard({
            theme,
            title: "Lease / Tenant Summary",
            iconText: "⌂",
            rows: [{ label: "Status", value: "No lease data available" }]
          })
        ]),

    {
      columns: [
        {
          width: "33.3%",
          stack: [
            sectionCard({
              theme,
              title: "2% Rule",
              iconText: "↗",
              rows: [
                { label: "2% Rule", value: formatPct(model.metrics.twoPercentRule) },
                { label: "Target", value: "2.00%" }
              ]
            })
          ]
        },
        {
          width: "33.3%",
          stack: [
            sectionCard({
              theme,
              title: "50% Rule Projection",
              iconText: "½",
              rows:
                model.fiftyPercentRule.length > 0
                  ? model.fiftyPercentRule
                  : [
                      { label: "Monthly Gross Rent", value: metricCurrency(model.metrics.monthlyIncome) },
                      { label: "50% of Gross Rent", value: metricCurrency(model.metrics.monthlyIncome * 0.5) },
                      { label: "Total Monthly Expenses", value: metricCurrency(model.metrics.monthlyExpenses) },
                      {
                        label: "Result",
                        value:
                          monthlyGross <= 0
                            ? "Insufficient Data"
                            : meets50
                              ? "Meets 50% Rule"
                              : "Does Not Meet 50% Rule"
                      },
                      {
                        label: "Expenses vs gross rent",
                        value:
                          expPctOfGross != null
                            ? `Expenses are ${metricPct(expPctOfGross)} of gross rent`
                            : "—"
                      }
                    ]
            })
          ]
        },
        {
          width: "33.3%",
          stack: [
            sectionCard({
              theme,
              title: "Investment Rating",
              iconText: "★",
              rows: [
                { label: "Rating", value: rating.label },
                { label: "Summary", value: rating.helper }
              ]
            })
          ]
        }
      ],
      columnGap: 10
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
    footer: buildReportFooter({
      theme,
      brandName: "Proplytic",
      generatedDateIso: model.generatedAt.slice(0, 10)
    })
  };
}
