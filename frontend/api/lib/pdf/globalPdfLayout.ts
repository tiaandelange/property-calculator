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
    brandWordmark: { fontSize: 18, bold: true, color: theme.primaryColor },
    statusBadge: { fontSize: 9, color: theme.textColor, bold: true }
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
    leftStack.push({ text: brandTitle, style: "brandWordmark" });
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

export function landlordRightStack(opts: {
  title: string;
  landlordLines: string[];
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  statusLabel?: string;
}): Content[] {
  const stack: Content[] = [
    { text: opts.title, style: "documentTitle", alignment: "right" },
    ...opts.landlordLines.map((line) => ({ text: line, style: "bodyText", alignment: "right" as const })),
    { text: `Invoice date: ${formatPdfDate(opts.invoiceDate)}`, style: "bodyText", alignment: "right", margin: pdfMargin(0, 6, 0, 0) },
    { text: `Invoice no. ${opts.invoiceNumber}`, style: "bodyText", alignment: "right" },
    ...(opts.dueDate
      ? [{ text: `Due date: ${formatPdfDate(opts.dueDate)}`, style: "bodyText", alignment: "right" as const }]
      : []),
    ...(opts.statusLabel
      ? [{ text: `Status: ${opts.statusLabel}`, style: "mutedText", alignment: "right" as const, margin: pdfMargin(0, 2, 0, 0) }]
      : [])
  ];
  return stack;
}

export function optionalSummaryColumn(opts: {
  dueDate?: string;
  statusLabel?: string;
  balanceDueLabel?: string;
}): Content | null {
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
  if (!items.length) return null;
  return { width: 160, stack: items };
}
