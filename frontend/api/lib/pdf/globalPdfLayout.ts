import type { Content, StyleDictionary, TableCell, TDocumentDefinitions } from "pdfmake/interfaces";
import type { GlobalPdfTheme } from "./globalPdfTheme.js";
import { formatPdfDate } from "./pdfFormat.js";

export type PdfDocumentKind = "invoice" | "statement" | "report" | "lease" | "generic";

export const PDF_PAGE_MARGINS: [number, number, number, number] = [48, 48, 48, 56];

export const PDF_SPACING = {
  section: 14,
  block: 8,
  tight: 4
} as const;

export function pdfMargin(l: number, t: number, r: number, b: number): [number, number, number, number] {
  return [l, t, r, b];
}

export function buildDefaultPdfStyles(theme: GlobalPdfTheme): StyleDictionary {
  return {
    headerTitle: { fontSize: 11, bold: true, color: theme.mutedTextColor, characterSpacing: 0.5 },
    documentTitle: { fontSize: 16, bold: true, color: theme.textColor },
    reportTitle: { fontSize: 14, bold: true, color: theme.textColor },
    sectionLabel: { fontSize: 10, bold: true, color: theme.textColor, margin: [0, 0, 0, 4] },
    bodyText: { fontSize: 10, color: theme.textColor, lineHeight: 1.25 },
    mutedText: { fontSize: 9, color: theme.mutedTextColor, lineHeight: 1.25 },
    tableHeader: {
      fontSize: 9,
      bold: true,
      color: theme.tableHeaderText,
      fillColor: theme.tableHeaderFill
    },
    tableCell: { fontSize: 9, color: theme.textColor },
    totalLabel: { fontSize: 10, color: theme.textColor },
    totalValue: { fontSize: 10, color: theme.textColor },
    totalEmphasis: { fontSize: 11, bold: true, color: theme.primaryColor },
    footerText: { fontSize: 8, color: theme.mutedTextColor },
    brandWordmark: { fontSize: 18, bold: true, color: theme.primaryColor, noWrap: true },
    statusBadge: { fontSize: 9, color: theme.textColor, bold: true },
    cardLabel: { fontSize: 8, color: theme.primaryColor, bold: true },
    cardValue: { fontSize: 14, color: theme.textColor, bold: true },
    cardHelper: { fontSize: 8, color: theme.mutedTextColor },
    cardTitle: { fontSize: 10, bold: true, color: theme.textColor },
    cardTitleIcon: { fontSize: 9, bold: true, color: theme.primaryColor }
  };
}

/** Subtle horizontal rule between header and body. */
export function pdfDivider(theme: GlobalPdfTheme): Content {
  return {
    canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: theme.borderColor }],
    margin: pdfMargin(0, 0, 0, PDF_SPACING.section)
  };
}

export type BrandedHeaderInput = {
  logoDataUrl?: string | null;
  brandTitle?: string;
  rightStack: Content[];
};

export function brandedHeader(input: BrandedHeaderInput): Content {
  const brandTitle = input.brandTitle ?? "Proplytic";
  const leftStack: Content[] = [];

  if (input.logoDataUrl) {
    leftStack.push({
      image: input.logoDataUrl,
      width: 44,
      margin: pdfMargin(0, 0, 0, 4)
    });
  } else {
    leftStack.push({ text: brandTitle, style: "brandWordmark", noWrap: true });
  }

  return {
    columns: [
      { width: "*", stack: leftStack },
      { width: 240, stack: input.rightStack }
    ],
    columnGap: 16,
    margin: pdfMargin(0, 0, 0, PDF_SPACING.block)
  };
}

export type ReportHeaderInput = {
  theme: GlobalPdfTheme;
  logoDataUrl?: string | null;
  brandTitle?: string;
  reportTitle: string;
  propertyName?: string;
  addressLine?: string;
  reportDateLine?: string;
  /** Optional embedded image data url (png/jpg). */
  propertyImageDataUrl?: string | null;
  /** Width in points for the image block. */
  propertyImageWidth?: number;
};

/**
 * Report header block:
 * - Brand left (logo or wordmark)
 * - Title + property + address + date in the center/right
 * - Optional property image on the far right
 */
export const EMPTY_CHART_MESSAGE = "Not enough data to display this chart.";

export function emptyChartState(theme: GlobalPdfTheme): Content {
  return {
    table: {
      widths: ["*"],
      body: [
        [
          {
            text: EMPTY_CHART_MESSAGE,
            style: "mutedText",
            alignment: "center" as const,
            margin: pdfMargin(0, 18, 0, 18)
          }
        ]
      ]
    },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      fillColor: () => theme.tableHeaderFill
    },
    margin: pdfMargin(0, 6, 0, 0)
  };
}

export function reportHeader(input: ReportHeaderInput): Content {
  const imageW = input.propertyImageWidth ?? 120;

  const brandCol: Content = input.logoDataUrl
    ? { image: input.logoDataUrl, width: 44, margin: pdfMargin(0, 0, 0, 0) }
    : { text: input.brandTitle ?? "Proplytic", style: "brandWordmark", noWrap: true };

  const imageNote = "No property image available";
  const imgCol: Content = input.propertyImageDataUrl
    ? {
        image: String(input.propertyImageDataUrl),
        width: imageW,
        alignment: "right" as const
      }
    : {
        table: {
          widths: [imageW],
          body: [
            [
              {
                text: imageNote,
                style: "mutedText",
                alignment: "center" as const,
                margin: pdfMargin(8, 24, 8, 24)
              }
            ]
          ]
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => input.theme.borderColor,
          vLineColor: () => input.theme.borderColor,
          fillColor: () => input.theme.tableHeaderFill
        }
      };

  const metaStack: Content[] = [
    { text: input.reportTitle, style: "reportTitle" },
    ...(input.propertyName
      ? [
          {
            text: input.propertyName,
            style: "bodyText",
            bold: true,
            color: input.theme.primaryColor,
            margin: pdfMargin(0, 2, 0, 0)
          }
        ]
      : []),
    ...(input.addressLine ? [{ text: input.addressLine, style: "mutedText", margin: pdfMargin(0, 2, 0, 0) }] : []),
    ...(input.reportDateLine ? [{ text: input.reportDateLine, style: "mutedText", margin: pdfMargin(0, 2, 0, 0) }] : [])
  ];

  return {
    columns: [
      { width: 70, stack: [brandCol] },
      { width: "*", stack: metaStack },
      { width: imageW, stack: [imgCol] }
    ],
    columnGap: 14,
    margin: pdfMargin(0, 0, 0, PDF_SPACING.block)
  };
}

/** Alias for report header block used in investment reports. */
export const reportHeaderBlock = reportHeader;

export type PartyBlockInput = {
  label: string;
  lines: string[];
};

export function partyBlock(input: PartyBlockInput): Content {
  const lines = input.lines.filter((l) => l.trim().length > 0);
  return {
    stack: [
      { text: input.label, style: "sectionLabel" },
      { text: lines.length ? lines.join("\n") : "—", style: "bodyText" }
    ]
  };
}

export function recipientBlock(tenant: PartyBlockInput): Content {
  return partyBlock({ label: "To", lines: tenant.lines });
}

export type DocumentSummaryItem = { label: string; value: string };

export function documentSummaryStrip(items: DocumentSummaryItem[]): Content {
  const cols = items.map((item) => ({
    width: "auto",
    stack: [
      { text: item.label, style: "mutedText" },
      { text: item.value, style: "bodyText", bold: true, margin: pdfMargin(0, 2, 12, 0) }
    ]
  }));
  return {
    columns: cols,
    margin: pdfMargin(0, 0, 0, PDF_SPACING.section)
  };
}

export type MetricCardInput = {
  theme: GlobalPdfTheme;
  label: string;
  value: string;
  helperText?: string;
  /** Optional short icon glyph (e.g. "R", "%", "●") */
  iconText?: string;
};

export function metricCard(input: MetricCardInput): Content {
  const icon = input.iconText ? { text: input.iconText, style: "cardLabel", margin: pdfMargin(0, 0, 6, 0) } : null;
  const headerCols: Content = {
    columns: [
      ...(icon ? [{ width: "auto", text: (icon as any).text, style: "cardLabel" }] : []),
      { width: "*", text: input.label, style: "cardLabel" }
    ],
    columnGap: 4,
    margin: pdfMargin(0, 0, 0, 4)
  };

  return {
    table: {
      widths: ["*"],
      body: [
        [
          {
            stack: [
              headerCols,
              { text: input.value, style: "cardValue", margin: pdfMargin(0, 0, 0, 2) },
              ...(input.helperText ? [{ text: input.helperText, style: "cardHelper" } as Content] : [])
            ],
            margin: pdfMargin(0, 0, 0, 0)
          }
        ]
      ]
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => input.theme.borderColor,
      vLineColor: () => input.theme.borderColor,
      paddingLeft: () => 10,
      paddingRight: () => 10,
      paddingTop: () => 10,
      paddingBottom: () => 10
    },
    margin: pdfMargin(0, 0, 0, PDF_SPACING.tight)
  };
}

export type SectionCardInput = {
  theme: GlobalPdfTheme;
  title: string;
  iconText?: string;
  /** Optional subtitle/description shown in header */
  subtitle?: string;
  /** Key/value rows rendered as a light table */
  rows: { label: string; value: string }[];
  /** Optional columns width overrides */
  labelWidth?: number;
};

export function sectionCard(input: SectionCardInput): Content {
  const labelW = input.labelWidth ?? 190;
  const header: TableCell = {
    stack: [
      {
        columns: [
          ...(input.iconText
            ? [{ width: "auto", text: input.iconText, style: "cardTitleIcon", margin: pdfMargin(0, 0, 6, 0) } as any]
            : []),
          { width: "*", text: input.title, style: "cardTitle" },
          ...(input.subtitle ? [{ width: "auto", text: input.subtitle, style: "mutedText" } as any] : [])
        ],
        columnGap: 6
      }
    ],
    fillColor: input.theme.tableHeaderFill
  };

  const body: TableCell[][] = [
    [header],
    ...input.rows.map((r) => [
      {
        columns: [
          { width: labelW, text: r.label, style: "mutedText" },
          { width: "*", text: r.value ?? "—", style: "bodyText", alignment: "right" as const }
        ],
        columnGap: 10
      } as any
    ])
  ];

  return {
    table: { widths: ["*"], body },
    layout: {
      hLineWidth: (i: number) => (i === 0 ? 0.5 : 0.25),
      vLineWidth: () => 0.5,
      hLineColor: () => input.theme.borderColor,
      vLineColor: () => input.theme.borderColor,
      paddingLeft: () => 10,
      paddingRight: () => 10,
      paddingTop: (i: number) => (i === 0 ? 9 : 7),
      paddingBottom: () => 7
    },
    margin: pdfMargin(0, 0, 0, PDF_SPACING.section)
  };
}

export type DetailsTableColumn = {
  header: string;
  key: string;
  width?: number | string;
  alignment?: "left" | "right" | "center";
};

export function detailsTable(opts: {
  theme: GlobalPdfTheme;
  columns: DetailsTableColumn[];
  rows: Record<string, string>[];
}): Content {
  const widths = opts.columns.map((c) => c.width ?? "*");
  const headerRow: TableCell[] = opts.columns.map((c) => ({
    text: c.header,
    style: "tableHeader",
    alignment: c.alignment ?? "left"
  }));

  const bodyRows: TableCell[][] = opts.rows.map((row, rowIndex) =>
    opts.columns.map((col) => ({
      text: row[col.key] ?? "—",
      style: "tableCell",
      alignment: col.alignment ?? "left",
      fillColor: rowIndex % 2 === 1 ? opts.theme.zebraFill : undefined
    }))
  );

  return {
    table: {
      headerRows: 1,
      widths,
      body: [headerRow, ...bodyRows],
      dontBreakRows: false
    },
    layout: {
      hLineWidth: (i: number, node: { table: { body: unknown[] } }) =>
        i === 0 || i === 1 || i === node.table.body.length ? 0.5 : 0.25,
      vLineWidth: () => 0,
      hLineColor: (i: number) => (i <= 1 ? opts.theme.borderColor : opts.theme.borderColor),
      paddingLeft: () => 6,
      paddingRight: () => 6,
      paddingTop: () => 5,
      paddingBottom: () => 5
    },
    margin: pdfMargin(0, 0, 0, PDF_SPACING.block)
  };
}

export function dataTable(opts: {
  theme: GlobalPdfTheme;
  title?: string;
  columns: DetailsTableColumn[];
  rows: Record<string, string>[];
}): Content {
  const table = detailsTable({ theme: opts.theme, columns: opts.columns, rows: opts.rows });
  if (!opts.title) return table;
  return {
    stack: [
      {
        columns: [
          { width: "auto", text: "▮", style: "cardTitleIcon", margin: pdfMargin(0, 0, 6, 0) } as any,
          { width: "*", text: opts.title, style: "cardTitle" }
        ],
        columnGap: 6,
        margin: pdfMargin(0, 0, 0, 6)
      },
      table
    ],
    margin: pdfMargin(0, 0, 0, PDF_SPACING.section)
  };
}

export type ChartCardInput = {
  theme: GlobalPdfTheme;
  title: string;
  subtitle?: string;
  /**
   * Chart image data URL (png/jpg). If not provided, we render a PDF-safe fallback.
   */
  imageDataUrl?: string | null;
  /**
   * Fallback series (sparkline-like) when no image is available.
   * Values are plotted on a simple canvas with a small legend.
   */
  fallbackSeries?: { label: string; color?: string; values: (number | null)[]; xLabels?: string[] }[];
  /**
   * Fallback bar items (pdfmake canvas) when no image is available.
   */
  fallbackBars?: { label: string; amount: number }[];
};

function isValidImageDataUrl(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const s = v.trim();
  if (!s.startsWith("data:image/")) return false;
  // keep minimal validation; pdfmake will still throw on malformed base64,
  // so we avoid passing obviously wrong strings.
  return s.includes(";base64,") || s.includes(",");
}

function miniBarList(opts: { theme: GlobalPdfTheme; items: { label: string; amount: number }[]; maxWidth: number }): Content {
  const max = Math.max(...opts.items.map((i) => i.amount), 1);
  const rows: Content[] = opts.items.slice(0, 8).map((item) => {
    const w = Math.max(4, Math.round((item.amount / max) * opts.maxWidth));
    return {
      columns: [
        { width: 120, text: item.label, style: "mutedText", fontSize: 8 },
        {
          width: "*",
          stack: [
            {
              canvas: [{ type: "rect", x: 0, y: 0, w, h: 10, color: opts.theme.primaryColor }],
              margin: pdfMargin(0, 2, 0, 2)
            }
          ]
        }
      ],
      columnGap: 8,
      margin: pdfMargin(0, 0, 0, 4)
    };
  });
  return { stack: rows };
}

function legendRow(opts: { theme: GlobalPdfTheme; items: { label: string; color: string }[] }): Content {
  return {
    columns: opts.items.map((i) => ({
      width: "auto",
      columns: [
        {
          width: 10,
          canvas: [{ type: "rect", x: 0, y: 0, w: 8, h: 8, color: i.color }],
          margin: pdfMargin(0, 2, 4, 0)
        },
        { width: "auto", text: i.label, style: "mutedText", fontSize: 8, margin: pdfMargin(0, 0, 10, 0) }
      ],
      columnGap: 4
    })),
    columnGap: 10,
    margin: pdfMargin(0, 6, 0, 2)
  };
}

function sparklineChart(opts: {
  theme: GlobalPdfTheme;
  series: { label: string; color: string; values: (number | null)[] }[];
  width: number;
  height: number;
  xLabels?: string[];
}): Content {
  const allVals = opts.series.flatMap((s) => s.values.filter((v): v is number => v != null && Number.isFinite(v)));
  if (!allVals.length) {
    return emptyChartState(opts.theme);
  }

  const min = Math.min(...allVals);
  const max = Math.max(...allVals);
  const range = Math.max(1, max - min);
  const nPoints = Math.max(...opts.series.map((s) => s.values.length), 0);
  if (nPoints < 2) {
    return emptyChartState(opts.theme);
  }

  const padL = 4;
  const padT = 6;
  const padB = 12;
  const innerW = opts.width - padL - 2;
  const innerH = opts.height - padT - padB;

  const xFor = (i: number) => padL + (innerW * i) / (nPoints - 1);
  const yFor = (v: number) => padT + innerH - ((v - min) / range) * innerH;

  const canvas: any[] = [];
  // subtle baseline grid (top + mid + bottom)
  canvas.push({ type: "line", x1: padL, y1: padT, x2: padL + innerW, y2: padT, lineWidth: 0.25, lineColor: opts.theme.borderColor });
  canvas.push({
    type: "line",
    x1: padL,
    y1: padT + innerH / 2,
    x2: padL + innerW,
    y2: padT + innerH / 2,
    lineWidth: 0.25,
    lineColor: opts.theme.borderColor
  });
  canvas.push({
    type: "line",
    x1: padL,
    y1: padT + innerH,
    x2: padL + innerW,
    y2: padT + innerH,
    lineWidth: 0.25,
    lineColor: opts.theme.borderColor
  });

  for (const s of opts.series) {
    const pts = s.values
      .map((v, i) => (v != null && Number.isFinite(v) ? { x: xFor(i), y: yFor(v) } : null))
      .filter((p): p is { x: number; y: number } => p != null);
    for (let i = 1; i < pts.length; i++) {
      canvas.push({ type: "line", x1: pts[i - 1].x, y1: pts[i - 1].y, x2: pts[i].x, y2: pts[i].y, lineWidth: 1, lineColor: s.color });
    }
    // small end dot
    const last = pts[pts.length - 1];
    if (last) canvas.push({ type: "ellipse", x: last.x, y: last.y, r1: 2, r2: 2, color: s.color });
  }

  const labelRow: Content | null =
    opts.xLabels && opts.xLabels.length >= 2
      ? {
          columns: [
            { width: "*", text: String(opts.xLabels[0] ?? ""), style: "mutedText", fontSize: 7 },
            { width: "auto", text: String(opts.xLabels[opts.xLabels.length - 1] ?? ""), style: "mutedText", fontSize: 7, alignment: "right" }
          ],
          margin: pdfMargin(0, 2, 0, 0)
        }
      : null;

  return {
    stack: [{ canvas, margin: pdfMargin(0, 6, 0, 0) }, ...(labelRow ? [labelRow] : [])]
  };
}

export function chartCard(input: ChartCardInput): Content {
  const body: Content[] = [];
  if (isValidImageDataUrl(input.imageDataUrl)) {
    body.push({ image: String(input.imageDataUrl), width: 480, margin: pdfMargin(0, 6, 0, 0) });
  } else if (input.fallbackSeries?.length) {
    const series = input.fallbackSeries
      .map((s, idx) => ({
        label: s.label,
        color: s.color ?? (idx === 0 ? input.theme.primaryColor : idx === 1 ? input.theme.accentColor : input.theme.mutedTextColor),
        values: s.values
      }))
      .slice(0, 3);
    body.push(
      legendRow({
        theme: input.theme,
        items: series.map((s) => ({ label: s.label, color: s.color }))
      })
    );
    body.push(
      sparklineChart({
        theme: input.theme,
        series,
        width: 480,
        height: 120,
        xLabels: input.fallbackSeries[0]?.xLabels
      })
    );
  } else if (input.fallbackBars?.length) {
    body.push(miniBarList({ theme: input.theme, items: input.fallbackBars, maxWidth: 260 }));
  } else {
    body.push(emptyChartState(input.theme));
  }

  return {
    table: {
      widths: ["*"],
      body: [
        [
          {
            stack: [
              {
                columns: [
                  { width: "auto", text: "▮", style: "cardTitleIcon", margin: pdfMargin(0, 0, 6, 0) } as any,
                  { width: "*", text: input.title, style: "cardTitle" }
                ],
                columnGap: 6
              },
              ...body
            ]
          }
        ]
      ]
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => input.theme.borderColor,
      vLineColor: () => input.theme.borderColor,
      paddingLeft: () => 10,
      paddingRight: () => 10,
      paddingTop: () => 10,
      paddingBottom: () => 10
    },
    margin: pdfMargin(0, 0, 0, PDF_SPACING.section)
  };
}

export type TotalLine = {
  label: string;
  value: string;
  emphasis?: boolean;
  success?: boolean;
};

export function totalsBlock(lines: TotalLine[]): Content {
  const stack: Content[] = lines.map((line) => ({
    columns: [
      { width: "*", text: line.label, style: line.emphasis ? "totalEmphasis" : "totalLabel" },
      {
        width: 110,
        text: line.value,
        alignment: "right",
        style: line.emphasis ? "totalEmphasis" : "totalValue",
        color: line.success ? "#166534" : undefined
      }
    ],
    margin: pdfMargin(0, line.emphasis ? 4 : 2, 0, 0)
  }));

  return {
    columns: [{ width: "*", text: "" }, { width: 240, stack }],
    margin: pdfMargin(0, 0, 0, PDF_SPACING.section)
  };
}

export function bankingDetailsBlock(opts: { title?: string; lines: string[]; emptyMessage: string }): Content {
  const lines = opts.lines.filter((l) => l.trim().length > 0);
  const body: Content =
    lines.length > 0
      ? { ul: lines, style: "bodyText", margin: pdfMargin(0, 0, 0, 0) }
      : { text: opts.emptyMessage, style: "mutedText" };

  return {
    stack: [{ text: opts.title ?? "Payment details", style: "sectionLabel" }, body],
    margin: pdfMargin(0, 0, 0, PDF_SPACING.section)
  };
}

export function notesBlock(notes: string | null | undefined): Content[] {
  const text = notes?.trim();
  if (!text) return [];
  return [
    {
      stack: [
        { text: "Notes", style: "sectionLabel" },
        { text, style: "bodyText" }
      ],
      margin: pdfMargin(0, 0, 0, PDF_SPACING.section)
    }
  ];
}

export function buildPdfFooter(theme: GlobalPdfTheme, brandName = "Proplytic"): TDocumentDefinitions["footer"] {
  return (currentPage: number, pageCount: number) => ({
    margin: pdfMargin(48, 0, 48, 24),
    columns: [
      { text: `Generated by ${brandName}`, style: "footerText", alignment: "left" },
      {
        text: `Page ${currentPage} of ${pageCount}`,
        style: "footerText",
        alignment: "right",
        color: theme.mutedTextColor
      }
    ]
  });
}

export function buildReportFooter(opts: {
  theme: GlobalPdfTheme;
  brandName?: string;
  disclaimer?: string;
  /** Optional ISO date shown in footer (format: YYYY-MM-DD) */
  generatedDateIso?: string | null;
}): TDocumentDefinitions["footer"] {
  const brand = opts.brandName ?? "Proplytic";
  const disclaimer =
    opts.disclaimer ??
    "This report is for informational purposes only and does not constitute financial, legal, or tax advice.";
  const dateLabel = opts.generatedDateIso ? `Generated ${formatPdfDate(opts.generatedDateIso)}` : null;
  return (currentPage: number, pageCount: number) => ({
    margin: pdfMargin(48, 0, 48, 24),
    columns: [
      {
        width: "*",
        stack: [
          { text: `Generated by ${brand}`, style: "footerText" },
          { text: disclaimer, style: "footerText", margin: pdfMargin(0, 2, 0, 0) },
          ...(dateLabel ? [{ text: dateLabel, style: "footerText", margin: pdfMargin(0, 2, 0, 0) } as any] : [])
        ]
      },
      { width: 140, text: `Page ${currentPage} of ${pageCount}`, style: "footerText", alignment: "right" }
    ]
  });
}

/** Top-right block: document title + issuer (landlord or business) lines only. */
export function landlordRightStack(opts: { title: string; landlordLines: string[] }): Content[] {
  return [
    { text: opts.title, style: "documentTitle", alignment: "right" },
    ...opts.landlordLines.map((line) => ({ text: line, style: "bodyText", alignment: "right" as const }))
  ];
}

/** Stack items for the optional right column beside the recipient block. */
export function optionalSummaryStack(opts: {
  dueDate?: string;
  statusLabel?: string;
  balanceDueLabel?: string;
}): Content[] | null {
  const items: Content[] = [];
  if (opts.dueDate) {
    items.push({ text: "Due date", style: "sectionLabel" });
    items.push({ text: formatPdfDate(opts.dueDate), style: "bodyText", bold: true, margin: pdfMargin(0, 0, 0, 6) });
  }
  if (opts.statusLabel) {
    items.push({ text: "Status", style: "sectionLabel", margin: pdfMargin(0, 4, 0, 0) });
    items.push({ text: opts.statusLabel, style: "statusBadge" });
  }
  if (opts.balanceDueLabel) {
    items.push({ text: "Balance due", style: "sectionLabel", margin: pdfMargin(0, 8, 0, 0) });
    items.push({ text: opts.balanceDueLabel, style: "totalEmphasis" });
  }
  return items.length ? items : null;
}
