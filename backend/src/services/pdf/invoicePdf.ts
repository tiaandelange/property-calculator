import type { InvoiceLineItem } from "@prisma/client";
import type { TDocumentDefinitions } from "pdfmake/interfaces";
import { db } from "../../config/db.js";
import { readInvoicePaymentDetails } from "../../utils/invoicePaymentDetails.js";
import { generateReportBasename } from "../../utils/safeFileNames.js";

const m = (l: number, t: number, r: number, b: number) => [l, t, r, b] as [number, number, number, number];

type PaymentDetailsShape = {
  bankName?: string;
  accountHolder?: string;
  accountNumber?: string;
  branchCode?: string;
  referenceNote?: string;
  extraLines?: string[];
};

function formatMoney(n: number) {
  return `R ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function threeMonthBounds(from = new Date()) {
  const windowStart = new Date(from.getFullYear(), from.getMonth() - 2, 1);
  const windowEnd = new Date(from.getFullYear(), from.getMonth() + 1, 1);
  return { windowStart, windowEnd };
}

function paymentDetailsLines(raw: unknown): string[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return ["Add your banking and payment instructions under Account / profile (invoice payment details)."];
  }
  const d = raw as PaymentDetailsShape;
  const lines: string[] = [];
  if (d.bankName) lines.push(`Bank: ${d.bankName}`);
  if (d.accountHolder) lines.push(`Account holder: ${d.accountHolder}`);
  if (d.accountNumber) lines.push(`Account number: ${d.accountNumber}`);
  if (d.branchCode) lines.push(`Branch / universal code: ${d.branchCode}`);
  if (d.referenceNote) lines.push(`Reference: ${d.referenceNote}`);
  if (Array.isArray(d.extraLines)) for (const x of d.extraLines) if (typeof x === "string" && x.trim()) lines.push(x.trim());
  return lines.length ? lines : ["Add your banking and payment instructions under Account / profile (invoice payment details)."];
}

export async function buildInvoicePdfDefinition(
  invoiceId: number,
  userId: number
): Promise<
  | { ok: true; definition: TDocumentDefinitions; fileName: string }
  | { ok: false; status: 404; message: string }
> {
  const invoice = await db.invoice.findFirst({
    where: { id: invoiceId, userId },
    include: { lineItems: true, property: true, tenant: true, lease: true }
  });
  if (!invoice) return { ok: false, status: 404, message: "Invoice not found" };

  const owner = await db.user.findUnique({
    where: { id: userId },
    select: { id: true }
  });
  if (!owner) return { ok: false, status: 404, message: "User not found" };

  const paymentDetailsRaw = await readInvoicePaymentDetails(userId);

  const { windowStart, windowEnd } = threeMonthBounds(new Date(invoice.invoiceDate));

  const [historyInvoices, historyIncome, openForTenant] = await Promise.all([
    db.invoice.findMany({
      where: {
        userId,
        propertyId: invoice.propertyId,
        tenantId: invoice.tenantId,
        invoiceDate: { gte: windowStart, lt: windowEnd },
        status: { not: "CANCELLED" }
      },
      orderBy: [{ invoiceDate: "asc" }, { id: "asc" }]
    }),
    db.propertyIncome.findMany({
      where: {
        userId,
        propertyId: invoice.propertyId,
        tenantId: invoice.tenantId,
        incomeDate: { gte: windowStart, lt: windowEnd },
        status: { not: "ARCHIVED" }
      },
      orderBy: [{ incomeDate: "asc" }, { id: "asc" }]
    }),
    db.invoice.findMany({
      where: {
        userId,
        propertyId: invoice.propertyId,
        tenantId: invoice.tenantId,
        status: { in: ["DRAFT", "SENT", "OVERDUE"] }
      }
    })
  ]);

  const totalDueOutstanding = openForTenant.reduce((a, i) => a + Number(i.total ?? 0), 0);

  type LedgerRow = { date: string; desc: string; charge: string; payment: string };
  const ledgerRows: LedgerRow[] = [];

  for (const hi of historyInvoices) {
    const paid = hi.status === "PAID";
    ledgerRows.push({
      date: hi.invoiceDate.toISOString().slice(0, 10),
      desc: `Invoice ${hi.invoiceNumber} (${hi.status})`,
      charge: paid ? "—" : formatMoney(hi.total),
      payment: paid ? formatMoney(hi.total) : "—"
    });
  }

  for (const inc of historyIncome) {
    if (inc.status !== "RECEIVED") continue;
    ledgerRows.push({
      date: inc.incomeDate.toISOString().slice(0, 10),
      desc: `Payment recorded · ${inc.category}: ${inc.description}`,
      charge: "—",
      payment: formatMoney(inc.amount)
    });
  }

  ledgerRows.sort((a, b) => a.date.localeCompare(b.date) || a.desc.localeCompare(b.desc));

  const tenantLines = [
    `${invoice.tenant.firstName ?? ""} ${invoice.tenant.lastName ?? ""}`.trim(),
    invoice.tenant.email ?? "",
    invoice.tenant.phone ?? "",
    invoice.tenant.idNumber ? `ID: ${invoice.tenant.idNumber}` : ""
  ].filter(Boolean);
  const tenantBlock = tenantLines.length ? tenantLines : ["—"];

  const property = invoice.property;
  const addr = [property.addressLine1, property.addressLine2, property.suburb, property.city, property.province, property.postalCode]
    .filter(Boolean)
    .join(", ");
  const propertyLines = [property.name?.trim(), addr].filter(Boolean) as string[];
  const propertyBlock = propertyLines.length ? propertyLines : ["—"];

  const lineItemRows =
    invoice.lineItems.length > 0
      ? invoice.lineItems.map((li: InvoiceLineItem) => [
          li.description || "—",
          String(li.quantity),
          formatMoney(Number(li.unitPrice)),
          formatMoney(Number(li.total))
        ])
      : [
          [
            "Amount (legacy invoice — no line items stored)",
            "1",
            formatMoney(Number(invoice.subtotal)),
            formatMoney(Number(invoice.total))
          ]
        ];

  const lineTableBody: any[] = [
    [
      { text: "Description", style: "th" },
      { text: "Qty", style: "th", alignment: "right" },
      { text: "Unit", style: "th", alignment: "right" },
      { text: "Total", style: "th", alignment: "right" }
    ],
    ...lineItemRows
  ];

  const ledgerTableBody: any[] = [
    [
      { text: "Date", style: "th" },
      { text: "Details", style: "th" },
      { text: "Invoiced / charged", style: "th", alignment: "right" },
      { text: "Payments", style: "th", alignment: "right" }
    ],
    ...(ledgerRows.length
      ? ledgerRows.map((r) => [r.date, r.desc, r.charge, r.payment])
      : [[{ text: "—", colSpan: 4 }, {}, {}, {}]])
  ];

  const paymentLines = paymentDetailsLines(paymentDetailsRaw);

  const definition: TDocumentDefinitions = {
    info: { title: `Tax invoice ${invoice.invoiceNumber}` },
    content: [
      {
        columns: [
          {
            width: "*",
            stack: [
              { text: "PropLytics", style: "brand" },
              { text: "[Logo placeholder — add file to backend/assets/images]", style: "muted" }
            ]
          },
          {
            width: 200,
            stack: [
              { text: "TAX INVOICE", style: "h2", alignment: "right" },
              { text: `Invoice no. ${invoice.invoiceNumber}`, alignment: "right", margin: m(0, 6, 0, 0) },
              { text: `Invoice date: ${invoice.invoiceDate.toISOString().slice(0, 10)}`, alignment: "right" },
              { text: `Due date: ${invoice.dueDate.toISOString().slice(0, 10)}`, alignment: "right" },
              { text: `Status: ${invoice.status}`, alignment: "right" }
            ]
          }
        ],
        margin: m(0, 0, 0, 16)
      },
      {
        columns: [
          {
            width: "*",
            stack: [{ text: "Invoice to", style: "subheader" }, { text: tenantBlock.join("\n") }]
          },
          { width: 40, text: "" },
          {
            width: "*",
            stack: [{ text: "Property", style: "subheader" }, { text: propertyBlock.join("\n\n") }]
          }
        ],
        margin: m(0, 0, 0, 14)
      },
      { text: "This invoice", style: "subheader" },
      { table: { headerRows: 1, widths: ["*", 40, 65, 70], body: lineTableBody }, layout: "lightHorizontalLines", margin: m(0, 0, 0, 8) },
      {
        columns: [
          { width: "*", text: "" },
          {
            width: 200,
            stack: [
              { text: `Subtotal ${formatMoney(invoice.subtotal)}`, alignment: "right" },
              { text: `Total ${formatMoney(invoice.total)}`, alignment: "right", bold: true, margin: m(0, 4, 0, 0) }
            ]
          }
        ],
        margin: m(0, 0, 0, 14)
      },
      {
        text: `Recent ledger activity (tenant) — ${windowStart.toISOString().slice(0, 7)} through ${invoice.invoiceDate.toISOString().slice(0, 7)} window`,
        style: "subheader"
      },
      { text: "Includes invoices and received payments recorded against this tenant for the property.", style: "muted", margin: m(0, 0, 0, 6) },
      { table: { headerRows: 1, widths: [52, "*", 78, 78], body: ledgerTableBody }, layout: "lightHorizontalLines", margin: m(0, 0, 0, 12) },
      {
        text: `Total outstanding (all open invoices for this tenant on this property): ${formatMoney(totalDueOutstanding)}`,
        bold: true,
        margin: m(0, 0, 0, 14)
      },
      { text: "Payment details (landlord)", style: "subheader" },
      { ul: paymentLines, margin: m(0, 0, 0, 8) },
      ...(invoice.notes?.trim()
        ? [{ text: `Notes: ${invoice.notes.trim()}`, style: "muted", margin: m(0, 8, 0, 0) }]
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

  const fileName = `invoices/${generateReportBasename("invoice", Number(invoice.id))}`;
  return { ok: true, definition, fileName };
}
