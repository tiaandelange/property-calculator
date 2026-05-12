import type { TDocumentDefinitions } from "pdfmake/interfaces";
import { db } from "../../config/db.js";
import { buildPropertyStatement } from "../../domains/properties/property.statement.service.js";

const m = (l: number, t: number, r: number, b: number) => [l, t, r, b] as [number, number, number, number];

export async function buildPropertySummaryPdfDefinition(opts: {
  userId: number;
  propertyId: number;
  scenarioName?: string | null;
}): Promise<{ ok: true; definition: TDocumentDefinitions } | { ok: false; status: 404; message: string }> {
  const property = await db.property.findFirst({ where: { id: opts.propertyId, userId: opts.userId } });
  if (!property) return { ok: false, status: 404, message: "Property not found" };

  const statement = await buildPropertyStatement(opts.userId, opts.propertyId);
  if (!statement) return { ok: false, status: 404, message: "Could not build statement" };

  const rows = statement.statementRows.slice(-40);
  const tableBody: any[] = [
    [
      { text: "Date", style: "th" },
      { text: "Description", style: "th" },
      { text: "Debit", style: "th" },
      { text: "Credit", style: "th" },
      { text: "Balance", style: "th" }
    ],
    ...rows.map((r) => [
      r.date,
      r.description,
      r.debit != null ? `R ${Number(r.debit).toLocaleString()}` : "—",
      r.credit != null ? `R ${Number(r.credit).toLocaleString()}` : "—",
      r.balance != null ? `R ${Number(r.balance).toLocaleString()}` : "—"
    ])
  ];

  const definition: TDocumentDefinitions = {
    info: { title: `PropLytics — ${property.name}` },
    content: [
      { text: "PropLytics", style: "brand" },
      { text: "(logo placeholder — replace with asset under backend/assets/images)", style: "muted", margin: m(0, 0, 0, 8) },
      { text: "Property ledger summary", style: "tagline" },
      { text: opts.scenarioName?.trim() ? `Note: ${opts.scenarioName}` : "", margin: m(0, 4, 0, 8) },
      { text: property.name, style: "h2", margin: m(0, 8, 0, 4) },
      {
        text: [property.addressLine1, property.city, property.province, property.postalCode].filter(Boolean).join(", "),
        margin: m(0, 0, 0, 12)
      },
      { text: "Summary (this month)", style: "subheader" },
      {
        ul: [
          `Balance due (open invoices): R ${statement.summary.balanceDue.toLocaleString()}`,
          `Received this month: R ${statement.summary.receivedThisMonth.toLocaleString()}`,
          `Expected income (outstanding): R ${statement.summary.expectedThisMonth.toLocaleString()}`,
          `Operating expenses (excl. bond): R ${statement.summary.expensesThisMonth.toLocaleString()}`,
          `Net cash flow: R ${statement.summary.netCashFlow.toLocaleString()}`
        ],
        margin: m(0, 0, 0, 12)
      },
      { text: "Recent statement lines (latest 40)", style: "subheader" },
      { table: { headerRows: 1, widths: [55, "*", 52, 52, 52], body: tableBody }, layout: "lightHorizontalLines", margin: m(0, 0, 0, 12) },
      { text: "Disclaimer: Summary is based on workspace ledger data and is not tax or legal advice.", style: "muted" }
    ],
    styles: {
      brand: { fontSize: 22, bold: true, color: "#1a56db" },
      muted: { fontSize: 9, color: "#666666" },
      tagline: { fontSize: 12, color: "#333333" },
      h2: { fontSize: 16, bold: true },
      subheader: { fontSize: 13, bold: true, margin: [0, 10, 0, 6] },
      th: { bold: true, fontSize: 9 }
    },
    defaultStyle: { font: "Roboto", fontSize: 9 }
  };

  return { ok: true, definition };
}
