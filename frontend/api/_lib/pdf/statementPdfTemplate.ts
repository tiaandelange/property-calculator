import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import { formatPdfDate, formatPdfZar } from "./pdfFormat.js";
import {
  brandedHeader,
  buildDefaultPdfStyles,
  buildPdfFooter,
  detailsTable,
  landlordRightStack,
  notesBlock,
  partyBlock,
  PDF_PAGE_MARGINS,
  pdfDivider,
  PDF_SPACING,
  totalsBlock,
  type TotalLine
} from "./globalPdfLayout.js";
import type { GlobalPdfTheme } from "./globalPdfTheme.js";

export type StatementPdfLineItem = {
  date?: string | null;
  description: string;
  entryType: "DEBIT" | "CREDIT";
  amount: number;
};

export type StatementPdfData = {
  statementId: string;
  statementNumber: string;
  statementType: "FINANCIAL" | "DEPOSIT";
  statementDate: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  openingBalance?: number;
  total: number;
  notes?: string | null;
  tenantLines: string[];
  propertyLines: string[];
  landlordName: string;
  lineItems: StatementPdfLineItem[];
  isDraftPreview?: boolean;
  theme: GlobalPdfTheme;
  logoDataUrl?: string | null;
  pdfBrandingEnabled?: boolean;
};

function documentTitle(type: StatementPdfData["statementType"]): string {
  return type === "DEPOSIT" ? "Deposit Statement" : "Financial Statement";
}

function issuerLines(data: StatementPdfData): string[] {
  return [data.landlordName].filter(Boolean);
}

function buildLineTable(data: StatementPdfData): Content {
  const theme = data.theme;
  const rows =
    data.lineItems.length > 0
      ? data.lineItems.map((li) => ({
          date: li.date ? formatPdfDate(li.date) : "—",
          description: li.description || "—",
          debit: li.entryType === "DEBIT" ? formatPdfZar(li.amount) : "",
          credit: li.entryType === "CREDIT" ? formatPdfZar(li.amount) : ""
        }))
      : [{ date: "—", description: "No line items", debit: "", credit: "" }];

  return detailsTable({
    theme,
    columns: [
      { header: "Date", key: "date", width: 55 },
      { header: "Description", key: "description", width: "*" },
      { header: "Charges", key: "debit", width: 65, alignment: "right" },
      { header: "Credits", key: "credit", width: 65, alignment: "right" }
    ],
    rows
  });
}

function balanceLabel(data: StatementPdfData): string {
  if (data.statementType === "DEPOSIT") return "Refund due to tenant";
  return "Balance due";
}

export function buildStatementPdfDocumentDefinition(data: StatementPdfData): TDocumentDefinitions {
  const theme = data.theme;
  const title = documentTitle(data.statementType);
  const showLogo = data.pdfBrandingEnabled !== false;

  const summaryItems: { label: string; value: string }[] = [
    { label: "Statement #", value: data.statementNumber },
    { label: "Date", value: formatPdfDate(data.statementDate) }
  ];
  if (data.periodStart && data.periodEnd) {
    summaryItems.push({
      label: "Period",
      value: `${formatPdfDate(data.periodStart)} – ${formatPdfDate(data.periodEnd)}`
    });
  }

  const totalLines: TotalLine[] = [
    { label: balanceLabel(data), value: formatPdfZar(data.total), emphasis: true }
  ];

  const content: Content[] = [
    brandedHeader({
      logoDataUrl: showLogo ? data.logoDataUrl : null,
      rightStack: landlordRightStack({ title, landlordLines: issuerLines(data) })
    }),
    pdfDivider(theme),
    {
      columns: [
        { width: "*", stack: [partyBlock({ label: "Tenant", lines: data.tenantLines })] },
        { width: "*", stack: [partyBlock({ label: "Property", lines: data.propertyLines })] }
      ],
      columnGap: 24,
      margin: [0, 0, 0, PDF_SPACING.section]
    },
    {
      columns: summaryItems.map((item) => ({
        width: "auto",
        stack: [
          { text: item.label, style: "mutedText" },
          { text: item.value, style: "bodyText", bold: true, margin: [0, 2, 16, 0] }
        ]
      })),
      margin: [0, 0, 0, PDF_SPACING.section]
    },
    buildLineTable(data),
    totalsBlock(totalLines),
    ...notesBlock(data.notes)
  ];

  return {
    info: { title: `${title} ${data.statementNumber}` },
    pageMargins: PDF_PAGE_MARGINS,
    background: () => ({
      canvas: [{ type: "rect", x: 0, y: 0, w: 595.28, h: 841.89, color: theme.backgroundColor }]
    }),
    watermark: data.isDraftPreview
      ? { text: "DRAFT", color: "gray", opacity: 0.12, bold: true, angle: -35 }
      : undefined,
    content,
    styles: buildDefaultPdfStyles(theme),
    defaultStyle: { font: theme.fontFamily, fontSize: 10, color: theme.textColor },
    footer: buildPdfFooter(theme, data.landlordName)
  };
}
