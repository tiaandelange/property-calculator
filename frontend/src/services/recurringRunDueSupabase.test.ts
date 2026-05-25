import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("../lib/supabaseClient", () => ({
  getSupabase: () => ({ rpc })
}));

describe("recurringRunDueSupabase", () => {
  beforeEach(() => {
    vi.resetModules();
    rpc.mockReset();
  });

  it("runDueRecurringIncome calls run_due_recurring_income", async () => {
    rpc.mockResolvedValue({ data: { created_count: 2 }, error: null });
    const { runDueRecurringIncome } = await import("./recurringRunDueSupabase");
    const out = await runDueRecurringIncome();
    expect(rpc).toHaveBeenCalledWith("run_due_recurring_income");
    expect(out.created_count).toBe(2);
  });

  it("runDueRecurringInvoices calls run_due_recurring_invoices", async () => {
    rpc.mockResolvedValue({ data: { created_count: 1 }, error: null });
    const { runDueRecurringInvoices } = await import("./recurringRunDueSupabase");
    await runDueRecurringInvoices();
    expect(rpc).toHaveBeenCalledWith("run_due_recurring_invoices");
  });
});
