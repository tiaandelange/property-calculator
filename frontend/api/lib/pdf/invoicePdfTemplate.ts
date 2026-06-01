import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import { formatPdfZar } from "./pdfFormat.js";
import {
  bankingDetailsBlock,
  brandedHeader,
  buildDefaultPdfStyles,
  buildPdfFooter,
  detailsTable,
  documentSummaryStrip,
  landlordRightStack,
  notesBlock,
  optionalSummaryStack,
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

function landlordLines(data: InvoicePdfDocumentData): string[] {
  const l = data.landlord;
  return [l.name, l.email, l.phone, l.address].filter((x): x is string => Boolean(x?.trim()));
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

function buildTotals(data: InvoicePdfDocumentData): Content {
  const lines: TotalLine[] = [{ label: "Subtotal", value: formatPdfZar(data.subtotal) }];

  if (data.taxTotal != null && data.taxTotal > 0) {
    lines.push({ label: "VAT", value: formatPdfZar(data.taxTotal) });
  }

  for (const p of data.payments) {
    const ref = p.reference?.trim() ? ` · ${p.reference.trim()}` : "";
    lines.push({
      label: `Payment ${p.date.slice(0, 10)}${ref}`,
      value: `−${formatPdfZar(p.amount)}`,
      success: true
    });
  }

  if (data.amountPaid != null && data.amountPaid > 0) {
    lines.push({
      label: "Payments received",
      value: `−${formatPdfZar(data.amountPaid)}`,
      success: true
    });
  }

  lines.push(
    { label: "Invoice total", value: formatPdfZar(data.total), emphasis: true },
    { label: "Balance due", value: formatPdfZar(data.balanceDue), emphasis: true }
  );

  return totalsBlock(lines);
}

export function buildInvoicePdfDocumentDefinition(data: InvoicePdfDocumentData): TDocumentDefinitions {
  const theme = data.branding.theme;
  const statusLabel = data.isDraftPreview ? `${data.status} (preview — not finalised)` : data.status;
  const showLogo = data.branding.pdfBrandingEnabled;

  const content: Content[] = [
    brandedHeader({
      logoDataUrl: showLogo ? data.branding.logoDataUrl : null,
      rightStack: landlordRightStack({
        title: "TAX INVOICE",
        landlordLines: landlordLines(data),
        invoiceNumber: data.invoiceNumber,
        invoiceDate: data.invoiceDate,
        dueDate: data.dueDate,
        statusLabel
      })
    }),
    pdfDivider(theme),
    (() => {
      const summaryStack = optionalSummaryStack({
        dueDate: data.dueDate,
        statusLabel,
        balanceDueLabel: formatPdfZar(data.balanceDue)
      });
      return {
        columns: [
          { width: "*", stack: [recipientBlock({ label: "To", lines: tenantLines(data) })] },
          summaryStack ? { width: 160, stack: summaryStack } : { width: 0, text: "" }
        ],
        columnGap: 16,
        margin: pdfMargin(0, 0, 0, PDF_SPACING.section)
      };
    })(),
    documentSummaryStrip([
      { label: "Invoice number", value: data.invoiceNumber },
      { label: "Invoice date", value: data.invoiceDate.slice(0, 10) },
      { label: "Due date", value: data.dueDate.slice(0, 10) },
      { label: "Status", value: statusLabel }
    ]),
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
