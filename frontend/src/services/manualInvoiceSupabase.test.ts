import { describe, expect, it, vi, beforeEach } from "vitest";

const rpc = vi.fn();

vi.mock("../lib/supabaseClient", () => ({
  getSupabase: () => ({ rpc })
}));

describe("manualInvoiceSupabase", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("calls manual_generate_lease_invoice RPC with lease id", async () => {
    rpc.mockResolvedValue({
      data: { ok: true, invoiceId: "inv-1", tenantId: "ten-1", propertyId: "prop-1" },
      error: null
    });
    const { manualGenerateLeaseInvoice } = await import("./manualInvoiceSupabase");
    const leaseId = "11111111-1111-1111-1111-111111111111";
    const res = await manualGenerateLeaseInvoice({
      leaseId,
      invoicePeriod: "2026-05",
      invoiceType: "RENT",
      dueDate: "2026-05-07",
      amount: 12000
    });
    expect(rpc).toHaveBeenCalledWith("manual_generate_lease_invoice", {
      p_lease_id: leaseId,
      p_invoice_period: "2026-05",
      p_invoice_type: "RENT",
      p_due_date: "2026-05-07",
      p_amount: 12000,
      p_notes: null
    });
    expect(res.ok).toBe(true);
    expect(res.invoiceId).toBe("inv-1");
  });

  it("returns duplicate payload without throwing", async () => {
    rpc.mockResolvedValue({
      data: {
        ok: false,
        duplicate: true,
        message: "An invoice already exists for this lease and period.",
        invoiceId: "existing-1"
      },
      error: null
    });
    const { manualGenerateLeaseInvoice } = await import("./manualInvoiceSupabase");
    const res = await manualGenerateLeaseInvoice({
      leaseId: "11111111-1111-1111-1111-111111111111",
      invoicePeriod: "2026-05",
      invoiceType: "RENT",
      dueDate: "2026-05-07",
      amount: 12000
    });
    expect(res.ok).toBe(false);
    expect(res.duplicate).toBe(true);
    expect(res.invoiceId).toBe("existing-1");
  });
});
