import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";

const m = (l: number, t: number, r: number, b: number) => [l, t, r, b] as [number, number, number, number];

export type InvoicePdfLineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type InvoicePdfLedgerRow = {
  date: string;
  desc: string;
  charge: string;
  payment: string;
};

export type InvoicePdfData = {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  status: string;
  subtotal: number;
  total: number;
  balanceDue: number;
  notes: string | null;
  tenantLines: string[];
  propertyLines: string[];
  unitLabel: string | null;
  leaseLabel: string | null;
  paymentReference: string | null;
  lineItems: InvoicePdfLineItem[];
  ledgerRows: InvoicePdfLedgerRow[];
  totalDueOutstanding: number;
  paymentDetailLines: string[];
  isDraftPreview?: boolean;
};

function formatMoney(n: number) {
  return `R ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function paymentDetailsLines(raw: unknown): string[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return ["Add your banking and payment instructions under Account / profile (invoice payment details)."];
  }
  const d = raw as Record<string, unknown>;
  const lines: string[] = [];
  if (d.bankName) lines.push(`Bank: ${String(d.bankName)}`);
  if (d.accountHolder) lines.push(`Account holder: ${String(d.accountHolder)}`);
  if (d.accountNumber) lines.push(`Account number: ${String(d.accountNumber)}`);
  if (d.branchCode) lines.push(`Branch / universal code: ${String(d.branchCode)}`);
  if (d.referenceNote) lines.push(`Reference: ${String(d.referenceNote)}`);
  if (Array.isArray(d.extraLines)) {
    for (const x of d.extraLines) {
      if (typeof x === "string" && x.trim()) lines.push(x.trim());
    }
  }
  return lines.length
    ? lines
    : ["Add your banking and payment instructions under Account / profile (invoice payment details)."];
}

export function threeMonthBoundsFromInvoiceDate(invoiceDateIso: string, from = new Date()) {
  const inv = new Date(invoiceDateIso);
  const anchor = Number.isNaN(inv.getTime()) ? from : inv;
  const windowStart = new Date(anchor.getUTCFullYear(), anchor.getUTCMonth() - 2, 1);
  const windowEnd = new Date(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1);
  return { windowStart, windowEnd };
}

export function buildInvoicePdfDefinition(data: InvoicePdfData): TDocumentDefinitions {
  const lineItemRows =
    data.lineItems.length > 0
      ? data.lineItems.map((li) => [
          li.description || "—",
          String(li.quantity),
          formatMoney(li.unitPrice),
          formatMoney(li.total)
        ])
      : [["Amount (legacy invoice — no line items stored)", "1", formatMoney(data.subtotal), formatMoney(data.total)]];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lineTableBody: any[] = [
    [
      { text: "Description", style: "th" },
      { text: "Qty", style: "th", alignment: "right" },
      { text: "Unit", style: "th", alignment: "right" },
      { text: "Total", style: "th", alignment: "right" }
    ],
    ...lineItemRows
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ledgerTableBody: any[] = [
    [
      { text: "Date", style: "th" },
      { text: "Details", style: "th" },
      { text: "Invoiced / charged", style: "th", alignment: "right" },
      { text: "Payments", style: "th", alignment: "right" }
    ],
    ...(data.ledgerRows.length
      ? data.ledgerRows.map((r) => [r.date, r.desc, r.charge, r.payment])
      : [[{ text: "—", colSpan: 4 }, {}, {}, {}]])
  ];

  const invDateLabel = data.invoiceDate.slice(0, 10);
  const statusLabel = data.isDraftPreview ? `${data.status} (preview — not finalised)` : data.status;
  const windowStartLabel = data.ledgerRows.length
    ? data.ledgerRows[0]?.date?.slice(0, 7) ?? invDateLabel.slice(0, 7)
    : invDateLabel.slice(0, 7);

  const metaStack: Content[] = [
    { text: "TAX INVOICE", style: "h2", alignment: "right" },
    { text: `Invoice no. ${data.invoiceNumber}`, alignment: "right", margin: m(0, 6, 0, 0) },
    { text: `Issue date: ${invDateLabel}`, alignment: "right" },
    { text: `Due date: ${data.dueDate.slice(0, 10)}`, alignment: "right" },
    { text: `Status: ${statusLabel}`, alignment: "right" },
    { text: `Balance due: ${formatMoney(data.balanceDue)}`, alignment: "right", margin: m(0, 4, 0, 0) }
  ];
  if (data.paymentReference) {
    metaStack.push({ text: `Payment reference: ${data.paymentReference}`, alignment: "right" });
  }

  const propertyStack: Content[] = [
    { text: "Property", style: "subheader" },
    { text: data.propertyLines.join("\n\n") || "—" }
  ];
  if (data.unitLabel) propertyStack.push({ text: `Unit: ${data.unitLabel}`, margin: m(0, 6, 0, 0) });
  if (data.leaseLabel) propertyStack.push({ text: `Lease: ${data.leaseLabel}`, margin: m(0, 4, 0, 0) });

  return {
    info: { title: `Tax invoice ${data.invoiceNumber}` },
    watermark: data.isDraftPreview ? { text: "DRAFT", color: "gray", opacity: 0.12, bold: true, angle: -35 } : undefined,
    content: [
      {
        columns: [
          {
            width: "*",
            stack: [
              { text: "PropLytics", style: "brand" },
              { text: "[Logo placeholder — add file to frontend/assets/images]", style: "muted" }
            ]
          },
          {
            width: 220,
            stack: metaStack
          }
        ],
        margin: m(0, 0, 0, 16)
      },
      {
        columns: [
          {
            width: "*",
            stack: [{ text: "Invoice to", style: "subheader" }, { text: data.tenantLines.join("\n") || "—" }]
          },
          { width: 40, text: "" },
          {
            width: "*",
            stack: propertyStack
          }
        ],
        margin: m(0, 0, 0, 14)
      },
      { text: "This invoice", style: "subheader" },
      {
        table: { headerRows: 1, widths: ["*", 40, 65, 70], body: lineTableBody },
        layout: "lightHorizontalLines",
        margin: m(0, 0, 0, 8)
      },
      {
        columns: [
          { width: "*", text: "" },
          {
            width: 200,
            stack: [
              { text: `Subtotal ${formatMoney(data.subtotal)}`, alignment: "right" },
              { text: `Total ${formatMoney(data.total)}`, alignment: "right", bold: true, margin: m(0, 4, 0, 0) },
              {
                text: `Balance due ${formatMoney(data.balanceDue)}`,
                alignment: "right",
                bold: true,
                margin: m(0, 4, 0, 0)
              }
            ]
          }
        ],
        margin: m(0, 0, 0, 14)
      },
      {
        text: `Recent ledger activity (tenant) — ${windowStartLabel} through ${invDateLabel.slice(0, 7)} window`,
        style: "subheader"
      },
      {
        text: "Includes invoices and received payments recorded against this tenant for the property.",
        style: "muted",
        margin: m(0, 0, 0, 6)
      },
      {
        table: { headerRows: 1, widths: [52, "*", 78, 78], body: ledgerTableBody },
        layout: "lightHorizontalLines",
        margin: m(0, 0, 0, 12)
      },
      {
        text: `Total outstanding (all open invoices for this tenant on this property): ${formatMoney(data.totalDueOutstanding)}`,
        bold: true,
        margin: m(0, 0, 0, 14)
      },
      { text: "Payment details (landlord)", style: "subheader" },
      { ul: data.paymentDetailLines, margin: m(0, 0, 0, 8) },
      ...(data.notes?.trim()
        ? [{ text: `Notes: ${data.notes.trim()}`, style: "muted", margin: m(0, 8, 0, 0) }]
        : [])
    ],
    styles: {
      brand: { fontSize: 20, bold: true, color: "#1a56db" },
      muted: { fontSize: 9, color: "#555555" },
      h2: { fontSize: 14, bold: true },
      subheader: { fontSize: 12, bold: true, margin: [0, 0, 0, 6] },
      th: { bold: true, fontSize: 9 }
    },
    defaultStyle: { font: "Roboto", fontSize: 10 }
  };
}
