import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("../lib/supabaseClient", () => ({
  getSupabase: () => ({ rpc })
}));

describe("operationsSupabase", () => {
  beforeEach(() => {
    vi.resetModules();
    rpc.mockReset();
  });

  const pid = "44444444-4444-4444-4444-444444444444";

  it("createInvoiceFromLease calls RPC", async () => {
    rpc.mockResolvedValue({ data: { ok: true, invoiceId: "inv-1" }, error: null });
    const { createInvoiceFromLease } = await import("./operationsSupabase");
    await createInvoiceFromLease(pid);
    expect(rpc).toHaveBeenCalledWith("create_invoice_from_lease", {
      p_property_id: pid,
      p_lease_id: null
    });
  });

  it("runFinancialHistoricalBackfill passes payload", async () => {
    rpc.mockResolvedValue({ data: { monthsProcessed: 3 }, error: null });
    const { runFinancialHistoricalBackfill } = await import("./operationsSupabase");
    await runFinancialHistoricalBackfill(pid, { startMonth: "2024-01" });
    expect(rpc).toHaveBeenCalledWith("run_financial_historical_backfill", {
      p_property_id: pid,
      p_payload: { startMonth: "2024-01" }
    });
  });
});
