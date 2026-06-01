import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import { formatPdfZar } from "./pdfFormat.js";
import {
  bankingDetailsBlock,
  brandedHeader,
  buildDefaultPdfStyles,
  buildPdfFooter,
  detailsTable,
  landlordRightStack,
  notesBlock,
  PDF_PAGE_MARGINS,
  pdfDivider,
  pdfMargin,
  PDF_SPACING,
  recipientBlock,
  totalsBlock,
  type TotalLine
} from "./globalPdfLayout.js";
import type { InvoicePdfDocumentData } from "./invoicePdfTypes.js";

const BANKING_EMPTY = "Banking details have not been configured.";
const VAT_RATE_LABEL = "VAT (15%)";

function bankingLines(data: InvoicePdfDocumentData): string[] {
  const b = data.banking;
  const lines: string[] = [];
  if (b.accountHolder) lines.push(`Account holder: ${b.accountHolder}`);
  if (b.bankName) lines.push(`Bank: ${b.bankName}`);
  if (b.accountNumber) lines.push(`Account number: ${b.accountNumber}`);
  if (b.branchCode) lines.push(`Branch / universal code: ${b.branchCode}`);
  if (b.accountType) lines.push(`Account type: ${b.accountType}`);
  if (b.reference) lines.push(`Reference: ${b.reference}`);
  for (const x of b.extraLines ?? []) {
    if (x.trim()) lines.push(x.trim());
  }
  return lines;
}

/** Issuer lines for the header — business when enabled in settings, otherwise personal/landlord. */
function issuerLines(data: InvoicePdfDocumentData): string[] {
  const l = data.landlord;
  const lines = [l.name, l.email, l.phone, l.address].filter((x): x is string => Boolean(x?.trim()));
  return lines.length ? lines : ["—"];
}

function tenantLines(data: InvoicePdfDocumentData): string[] {
  const t = data.tenant;
  return [t.name, t.email, t.phone, t.address].filter((x): x is string => Boolean(x?.trim()));
}

function buildLineItemTable(data: InvoicePdfDocumentData): Content {
  const theme = data.branding.theme;
  const hasQty = data.lineItems.some((li) => li.quantity != null && String(li.quantity) !== "");
  const hasUnit = data.lineItems.some((li) => li.unitAmount != null && Number.isFinite(li.unitAmount));

  const columns = [
    { header: "Description", key: "description", width: "*" as const },
    ...(hasQty ? [{ header: "Qty", key: "qty", width: 40 as const, alignment: "right" as const }] : []),
    ...(hasUnit ? [{ header: "Unit", key: "unit", width: 70 as const, alignment: "right" as const }] : []),
    { header: "Amount", key: "amount", width: 75 as const, alignment: "right" as const }
  ];

  const rows =
    data.lineItems.length > 0
      ? data.lineItems.map((li) => {
          const row: Record<string, string> = {
            description: li.description || "—",
            amount: formatPdfZar(li.amount)
          };
          if (hasQty) row.qty = li.quantity != null ? String(li.quantity) : "—";
          if (hasUnit) row.unit = li.unitAmount != null ? formatPdfZar(li.unitAmount) : "—";
          return row;
        })
      : [
          {
            description: "Amount (legacy invoice — no line items stored)",
            qty: "1",
            unit: formatPdfZar(data.subtotal),
            amount: formatPdfZar(data.total)
          }
        ];

  return detailsTable({ theme, columns, rows });
}

function vatAmountForInvoice(data: InvoicePdfDocumentData): number {
  if (data.taxTotal != null && Number.isFinite(data.taxTotal)) return Math.max(0, data.taxTotal);
  const diff = (Number(data.total) || 0) - (Number(data.subtotal) || 0);
  return Math.max(0, diff);
}

function buildTotals(data: InvoicePdfDocumentData): Content {
  const lines: TotalLine[] = [
    { label: "Subtotal", value: formatPdfZar(data.subtotal) },
    { label: VAT_RATE_LABEL, value: formatPdfZar(vatAmountForInvoice(data)) },
    { label: "Balance due", value: formatPdfZar(data.balanceDue), emphasis: true }
  ];
  return totalsBlock(lines);
}

export function buildInvoicePdfDocumentDefinition(data: InvoicePdfDocumentData): TDocumentDefinitions {
  const theme = data.branding.theme;
  const showLogo = data.branding.pdfBrandingEnabled;

  const content: Content[] = [
    brandedHeader({
      logoDataUrl: showLogo ? data.branding.logoDataUrl : null,
      rightStack: landlordRightStack({
        title: "TAX INVOICE",
        landlordLines: issuerLines(data)
      })
    }),
    pdfDivider(theme),
    {
      ...recipientBlock({ label: "Bill To", lines: tenantLines(data) }),
      margin: pdfMargin(0, 0, 0, PDF_SPACING.section)
    },
    buildLineItemTable(data),
    buildTotals(data),
    bankingDetailsBlock({
      lines: bankingLines(data),
      emptyMessage: BANKING_EMPTY
    }),
    ...notesBlock(data.notes)
  ];

  return {
    info: { title: `Tax invoice ${data.invoiceNumber}` },
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
    watermark: data.isDraftPreview
      ? { text: "DRAFT", color: "gray", opacity: 0.12, bold: true, angle: -35 }
      : undefined,
    content,
    styles: buildDefaultPdfStyles(theme),
    defaultStyle: { font: theme.fontFamily, fontSize: 10, color: theme.textColor },
    footer: buildPdfFooter(theme)
  };
}
