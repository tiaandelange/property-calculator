import { describe, expect, it } from "vitest";
import type { InvoiceDirectoryRow } from "./invoiceDirectoryTypes";
import { computeInvoiceMetrics, isInvoiceOverdue, matchesInvoiceFilters } from "./invoiceDirectoryUtils";

const baseRow = (patch: Partial<InvoiceDirectoryRow>): InvoiceDirectoryRow => ({
  id: "1",
  invoiceNumber: "INV-001",
  leaseReference: "LSE-26-0001",
  tenantId: "t1",
  tenantName: "Jane Doe",
  propertyId: "p1",
  propertyName: "Ocean View",
  unitId: null,
  unitLabel: null,
  leaseId: "l1",
  leaseLabel: "Lease",
  invoicePeriod: "2026-05",
  issueDate: "2026-05-01T12:00:00.000Z",
  dueDate: "2026-05-07T12:00:00.000Z",
  total: 10000,
  balanceDue: 10000,
  status: "SENT",
  isEditable: false,
  hasPdf: false,
  invoiceType: "RENT",
  ...patch
});

describe("invoiceDirectoryUtils", () => {
  it("detects overdue unpaid invoices", () => {
    const today = new Date("2026-05-20T12:00:00.000Z");
    expect(isInvoiceOverdue(baseRow({ status: "SENT", dueDate: "2026-05-01T12:00:00.000Z" }), today)).toBe(true);
    expect(isInvoiceOverdue(baseRow({ status: "PAID" }), today)).toBe(false);
  });

  it("filters by search query", () => {
    const rows = [
      baseRow({ id: "1", invoiceNumber: "INV-100", tenantName: "Jane Doe" }),
      baseRow({ id: "2", invoiceNumber: "INV-200", tenantName: "John Smith", status: "PAID", balanceDue: 0 })
    ];
    expect(matchesInvoiceFilters(rows[0], { q: "jane", propertyId: "ALL", status: "ALL", dateFrom: "", dateTo: "" })).toBe(true);
    expect(matchesInvoiceFilters(rows[0], { q: "nomatch", propertyId: "ALL", status: "ALL", dateFrom: "", dateTo: "" })).toBe(false);
  });

  it("computes portfolio metrics", () => {
    const today = new Date("2026-05-15T12:00:00.000Z");
    const metrics = computeInvoiceMetrics(
      [
        baseRow({ balanceDue: 5000, status: "SENT" }),
        baseRow({ id: "2", total: 3000, balanceDue: 0, status: "PAID", issueDate: "2026-05-10T12:00:00.000Z" })
      ],
      today
    );
    expect(metrics.totalOutstanding).toBe(5000);
    expect(metrics.paidThisMonth).toBe(3000);
  });
});
