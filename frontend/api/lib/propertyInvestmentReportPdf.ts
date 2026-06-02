import type { Content, StyleDictionary, TDocumentDefinitions } from "pdfmake/interfaces";
import {
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

  const byLabel = (labelNeedle: string): string => {
    const needle = labelNeedle.toLowerCase();
    const row = model.propertyInfo.find((r) => r.label.toLowerCase().includes(needle));
    return row ? dash(row.value) : "—";
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
  const yIrr = projectionRow("Internal rate of return");

  const chartValueEquityLoanBars = [
    { label: "Property value", amount: parseZar(yValue?.[0]) ?? 0 },
    { label: "Equity", amount: parseZar(yEquity?.[0]) ?? 0 },
    { label: "Loan balance", amount: parseZar(yLoan?.[0]) ?? 0 }
  ].filter((i) => i.amount > 0);

  const chartIncomeExpenseBars = [
    { label: "Annual income (Y1)", amount: parseZar(yIncome?.[0]) ?? 0 },
    { label: "Annual expenses (Y1)", amount: parseZar(yExpenses?.[0]) ?? 0 },
    { label: "Annual cash flow (Y1)", amount: parseZar(yCash?.[0]) ?? 0 }
  ].filter((i) => i.amount > 0);

  const xLabels = yearCols.map((y) => `Y${y}`);
  const seriesIncome = (yIncome ?? []).map((v) => parseZar(v));
  const seriesExpenses = (yExpenses ?? []).map((v) => parseZar(v));
  const seriesValue = (yValue ?? []).map((v) => parseZar(v));
  const seriesEquity = (yEquity ?? []).map((v) => parseZar(v));
  const seriesLoan = (yLoan ?? []).map((v) => parseZar(v));

  const expenseItems = model.expenseBreakdown
    .filter((i) => i.amount > 0)
    .filter((i) => !/rental income/i.test(i.label))
    .filter((i) => !/income/i.test(i.label));

  const pickExpense = (re: RegExp): number => expenseItems.find((x) => re.test(x.label))?.amount ?? 0;
  const debtService = pickExpense(/bond|loan|debt/i);
  const expRates = pickExpense(/rates|property\s*tax/i);
  const expInsurance = pickExpense(/insurance/i);
  const expHoa = pickExpense(/hoa|levy/i);
  const expMgmt = pickExpense(/management/i);
  const expMaint = pickExpense(/maintenance|repair/i);
  const expUtilities = pickExpense(/utilities/i);
  const matched =
    (debtService ? debtService : 0) +
    expRates +
    expInsurance +
    expHoa +
    expMgmt +
    expMaint +
    expUtilities;
  const otherExpenses = Math.max(
    0,
    expenseItems.reduce((a, x) => a + x.amount, 0) - matched
  );

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
      addressLine: model.property.address || "—",
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
              label: "Market Value",
              value: byLabel("market value"),
              helperText: "Est. current value"
            }),
            metricCard({
              theme,
              label: "Purchase Price",
              value: byLabel("purchase price"),
              helperText: "At acquisition"
            }),
            metricCard({
              theme,
              label: "Equity",
              value: byLabel("equity"),
              helperText: "Est. equity"
            }),
            metricCard({
              theme,
              label: "Monthly Income",
              value: metricCurrency(model.metrics.monthlyIncome),
              helperText: "Gross"
            })
          ]
        },
        {
          width: "*",
          stack: [
            metricCard({
              theme,
              label: "Monthly Expenses",
              value: metricCurrency(model.metrics.monthlyExpenses),
              helperText: "Total expenses"
            }),
            metricCard({
              theme,
              label: "Monthly Cash Flow",
              value: metricCurrency(model.metrics.monthlyCashFlow),
              helperText: "After expenses"
            }),
            metricCard({
              theme,
              label: "Cash on Cash ROI",
              value: formatPct(model.metrics.cashOnCashRoi),
              helperText: "Annualized"
            }),
            metricCard({
              theme,
              label: "IRR",
              value: formatPct(model.metrics.internalRateOfReturn),
              helperText: "Year 1"
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
              rows: [
                { label: "Property Type", value: dash(model.property.propertyType) },
                { label: "Bedrooms / Bathrooms", value: byLabel("bed") !== "—" ? byLabel("bed") : "—" },
                { label: "Living Area / Size", value: byLabel("living") !== "—" ? byLabel("living") : byLabel("size") },
                { label: "Lot Size", value: byLabel("lot") },
                { label: "Year Built", value: byLabel("year") },
                { label: "Parking", value: byLabel("parking") },
                { label: "Property Tax / Rates", value: byLabel("rates") !== "—" ? byLabel("rates") : byLabel("tax") },
                { label: "HOA / Levies", value: byLabel("hoa") !== "—" ? byLabel("hoa") : byLabel("lev") },
                { label: "Insurance", value: byLabel("insurance") },
                { label: "Zoning", value: byLabel("zoning") },
                { label: "Notes", value: "—" }
              ]
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
              rows: [
                { label: "Gross Rent", value: metricCurrency(model.metrics.monthlyIncome) },
                { label: "Other Income", value: "—" },
                { label: "Total Income", value: metricCurrency(model.metrics.monthlyIncome) },
                { label: "Property Tax / Rates", value: expRates > 0 ? metricCurrency(expRates) : "—" },
                { label: "Insurance", value: expInsurance > 0 ? metricCurrency(expInsurance) : "—" },
                { label: "HOA / Levies", value: expHoa > 0 ? metricCurrency(expHoa) : "—" },
                { label: "Property Management", value: expMgmt > 0 ? metricCurrency(expMgmt) : "—" },
                { label: "Maintenance & Repairs", value: expMaint > 0 ? metricCurrency(expMaint) : "—" },
                { label: "Utilities", value: expUtilities > 0 ? metricCurrency(expUtilities) : "—" },
                ...(debtService > 0 ? [{ label: "Debt Service", value: metricCurrency(debtService) }] : []),
                { label: "Other Expenses", value: otherExpenses > 0 ? metricCurrency(otherExpenses) : "—" },
                { label: "Total Expenses", value: metricCurrency(model.metrics.monthlyExpenses) }
              ]
            })
          ]
        },
        {
          width: "33.3%",
          stack: [
            sectionCard({
              theme,
              title: "Assumptions",
              iconText: "⚙",
              rows: [
                { label: "Purchase Date", value: "—" },
                { label: "Holding Period", value: model.assumptions.find((a) => /horizon/i.test(a.label))?.value ?? "—" },
                { label: "Annual Rent Growth", value: model.assumptions.find((a) => /income growth/i.test(a.label))?.value ?? "—" },
                { label: "Expense Inflation", value: model.assumptions.find((a) => /expense growth/i.test(a.label))?.value ?? "—" },
                { label: "Property Appreciation", value: model.assumptions.find((a) => /property value growth/i.test(a.label))?.value ?? "—" },
                { label: "Loan Amount", value: byLabel("loan amount") },
                { label: "Loan Interest Rate", value: model.assumptions.find((a) => /interest rate/i.test(a.label))?.value ?? byLabel("interest rate") },
                { label: "Loan Term", value: byLabel("amortised") },
                { label: "Down Payment / Cash Invested", value: byLabel("cash invested") },
                { label: "Closing Costs", value: byLabel("transfer") !== "—" ? byLabel("transfer") : "—" },
                { label: "Income Tax Rate", value: "—" }
              ]
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
          metric: "IRR",
          ...Object.fromEntries(yearCols.map((y, i) => [`y${y}`, dash(String(yIrr?.[i] ?? "—"))]))
        }
      ]
    }),

    dataTable({
      theme,
      title: "Projected vs Actual Comparison (Year 1)",
      columns: [
        { header: "Metric", key: "metric", width: 120 },
        { header: "Projected", key: "projected", alignment: "right" },
        { header: "Actual", key: "actual", alignment: "right" },
        { header: "Variance", key: "difference", alignment: "right" },
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
      : []),

    {
      columns: [
        {
          width: "33.3%",
          stack: [
            chartCard({
              theme,
              title: "Income vs Expenses Over Time",
              subtitle: "Projection",
              fallbackSeries: [
                { label: "Income", color: theme.primaryColor, values: seriesIncome, xLabels },
                { label: "Expenses", color: theme.dangerColor, values: seriesExpenses, xLabels }
              ],
              fallbackBars: chartIncomeExpenseBars
            })
          ]
        },
        {
          width: "33.3%",
          stack: [
            chartCard({
              theme,
              title: "Property Value vs Equity vs Loan Balance",
              subtitle: "Projection",
              fallbackSeries: [
                { label: "Property value", color: theme.primaryColor, values: seriesValue, xLabels },
                { label: "Equity", color: theme.successColor, values: seriesEquity, xLabels },
                { label: "Loan balance", color: theme.mutedTextColor, values: seriesLoan, xLabels }
              ],
              fallbackBars: chartValueEquityLoanBars
            })
          ]
        },
        {
          width: "33.3%",
          stack: [
            chartCard({
              theme,
              title: "Expense Breakdown (Monthly)",
              subtitle: "Top categories",
              fallbackBars: expenseItems.slice(0, 8)
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
              rows: [
                { label: "Monthly Gross Rent", value: metricCurrency(model.metrics.monthlyIncome) },
                { label: "50% of Gross Rent", value: metricCurrency(model.metrics.monthlyIncome * 0.5) },
                { label: "Total Monthly Expenses", value: metricCurrency(model.metrics.monthlyExpenses) },
                { label: "Result", value: meets50 ? "Meets 50% Rule" : "Does Not Meet 50% Rule" },
                {
                  label: "Explanation",
                  value: expPctOfGross != null ? `Expenses are ${metricPct(expPctOfGross)} of gross rent` : "—"
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
}
