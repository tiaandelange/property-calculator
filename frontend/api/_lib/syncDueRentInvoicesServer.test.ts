import { describe, expect, it, vi } from "vitest";
import { syncDueRentInvoicesForUserProperty } from "./syncDueRentInvoicesServer";

describe("syncDueRentInvoicesForUserProperty", () => {
  it("validates property access and maps RPC summary", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        leases_checked: 2,
        invoices_created: 1,
        statement_lines_created: 1,
        skipped_duplicate: 0,
        skipped_inactive: 0,
        skipped_not_due: 1,
        skipped_outside_lease: 0,
        skipped_auto_disabled: 0,
        errors: [],
        as_of_date: "2026-06-21",
        timezone: "Africa/Johannesburg"
      },
      error: null
    });
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: "prop-1" }, error: null });
    const eq2 = vi.fn(() => ({ maybeSingle }));
    const eq1 = vi.fn(() => ({ eq: eq2 }));
    const select = vi.fn(() => ({ eq: eq1 }));
    const from = vi.fn(() => ({ select }));
    const sb = { from, rpc } as unknown as Parameters<typeof syncDueRentInvoicesForUserProperty>[0]["sb"];

    const summary = await syncDueRentInvoicesForUserProperty({
      sb,
      userId: "user-1",
      propertyId: "prop-1"
    });

    expect(from).toHaveBeenCalledWith("properties");
    expect(rpc).toHaveBeenCalledWith("generate_due_lease_invoices", { p_property_id: "prop-1" });
    expect(summary.invoicesCreated).toBe(1);
    expect(summary.statementLinesCreated).toBe(1);
    expect(summary.leasesSkippedNotInWindow).toBe(1);
  });

  it("rejects when property is not owned", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eq2 = vi.fn(() => ({ maybeSingle }));
    const eq1 = vi.fn(() => ({ eq: eq2 }));
    const select = vi.fn(() => ({ eq: eq1 }));
    const sb = {
      from: vi.fn(() => ({ select })),
      rpc: vi.fn()
    } as unknown as Parameters<typeof syncDueRentInvoicesForUserProperty>[0]["sb"];

    await expect(
      syncDueRentInvoicesForUserProperty({
        sb,
        userId: "user-1",
        propertyId: "prop-1"
      })
    ).rejects.toThrow(/access denied/i);
  });
});
