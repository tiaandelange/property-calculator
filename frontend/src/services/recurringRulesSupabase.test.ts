import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listRecurringIncomeRules,
  activateRecurringIncomeRule,
  listRecurringInvoiceRules,
  createRecurringInvoiceRule,
  updateRecurringInvoiceRule,
  deleteRecurringInvoiceRule,
  listRecurringExpenseTemplates,
  createRecurringExpenseTemplate,
  updateRecurringExpenseTemplate
} from "./recurringRulesSupabase";

const getUser = vi.fn();
const from = vi.fn();

vi.mock("../lib/supabaseClient", () => ({
  getSupabase: () => ({
    auth: { getUser },
    from
  })
}));

describe("recurringRulesSupabase", () => {
  beforeEach(() => {
    getUser.mockReset();
    from.mockReset();
  });

  it("listRecurringIncomeRules throws when logged out", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(listRecurringIncomeRules({ propertyId: "p1" })).rejects.toThrow(/Not signed in/i);
  });

  it("listRecurringIncomeRules queries property_id or lease_id", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const eqMock = vi.fn(() => ({
      order: vi.fn(() => Promise.resolve({ data: [], error: null }))
    }));
    from.mockReturnValue({
      select: vi.fn(() => ({
        eq: eqMock
      }))
    });
    await listRecurringIncomeRules({ propertyId: "pid" });
    expect(from).toHaveBeenCalledWith("recurring_income_rules");
    expect(eqMock).toHaveBeenCalledWith("property_id", "pid");

    eqMock.mockClear();
    await listRecurringIncomeRules({ leaseId: "lid" });
    expect(eqMock).toHaveBeenCalledWith("lease_id", "lid");
  });

  it("activateRecurringIncomeRule updates status ACTIVE", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const row = { id: "r1", user_id: "u1", status: "ACTIVE" };
    from.mockReturnValue({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: row, error: null }))
            }))
          }))
        }))
      }))
    });
    const out = await activateRecurringIncomeRule("r1");
    expect(out.status).toBe("ACTIVE");
    expect(from).toHaveBeenCalledWith("recurring_income_rules");
  });

  it("createRecurringInvoiceRule requires tenantId", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    await expect(createRecurringInvoiceRule("p1", {})).rejects.toThrow(/tenantId/i);
  });

  it("createRecurringInvoiceRule inserts snake_case row", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const insert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() =>
          Promise.resolve({
            data: {
              id: "inv-rule-1",
              user_id: "u1",
              property_id: "p1",
              tenant_id: "t1",
              next_run_date: "2026-06-01T12:00:00.000Z"
            },
            error: null
          })
        )
      }))
    }));
    from.mockReturnValue({ insert });
    const created = await createRecurringInvoiceRule("p1", {
      tenantId: "t1",
      nextRunDate: "2026-06-01",
      rentAmount: 5000
    });
    expect(insert).toHaveBeenCalled();
    const [[arg]] = insert.mock.calls as unknown as [[Record<string, unknown>]];
    expect(arg.user_id).toBe("u1");
    expect(arg.property_id).toBe("p1");
    expect(arg.tenant_id).toBe("t1");
    expect(arg.rent_amount).toBe(5000);
    expect(created.nextRunDate).toBeDefined();
  });

  it("listRecurringExpenseTemplates filters template rows", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn(() => ({
              neq: vi.fn(() => ({
                order: vi.fn(() => Promise.resolve({ data: [], error: null }))
              }))
            }))
          }))
        }))
      }))
    });
    await listRecurringExpenseTemplates("p1");
    expect(from).toHaveBeenCalledWith("expense_entries");
  });

  it("updateRecurringExpenseTemplate chains is_recurring and null parent", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const single = vi.fn(() =>
      Promise.resolve({
        data: {
          id: "e1",
          is_recurring: true,
          recurring_schedule_parent_id: null,
          expense_date: "2026-01-01T12:00:00.000Z"
        },
        error: null
      })
    );
    from.mockReturnValue({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              is: vi.fn(() => ({
                select: vi.fn(() => ({
                  single
                }))
              }))
            }))
          }))
        }))
      }))
    });
    await updateRecurringExpenseTemplate("e1", { amount: 100 });
    expect(single).toHaveBeenCalled();
  });

  it("deleteRecurringInvoiceRule calls delete with id and user_id", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    from.mockReturnValue({
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null }))
        }))
      }))
    });
    await deleteRecurringInvoiceRule("x1");
    expect(from).toHaveBeenCalledWith("recurring_invoice_rules");
  });

  it("listRecurringInvoiceRules orders by created_at", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const order = vi.fn(() => Promise.resolve({ data: [], error: null }));
    from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order
        }))
      }))
    });
    await listRecurringInvoiceRules("p9");
    expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("updateRecurringInvoiceRule builds partial patch", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const single = vi.fn(() =>
      Promise.resolve({
        data: { id: "r1", enabled: false, rent_amount: 100 },
        error: null
      })
    );
    const update = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single
          }))
        }))
      }))
    }));
    from.mockReturnValue({ update });
    await updateRecurringInvoiceRule("r1", { enabled: false });
    expect(update).toHaveBeenCalled();
    const [[patch]] = update.mock.calls as unknown as [[Record<string, unknown>]];
    expect(patch.enabled).toBe(false);
  });

  it("createRecurringExpenseTemplate sets is_recurring and null parent", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const insert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() =>
          Promise.resolve({
            data: {
              id: "e-new",
              is_recurring: true,
              recurring_schedule_parent_id: null,
              expense_date: "2026-03-01T12:00:00.000Z"
            },
            error: null
          })
        )
      }))
    }));
    from.mockReturnValue({ insert });
    await createRecurringExpenseTemplate("p1", {
      category: "WATER",
      description: "Muni",
      amount: 50,
      expenseDate: "2026-03-01",
      recurringStartDate: "2026-03-01",
      recurringOpenEnded: true,
      recurringMonthAnchor: "FIRST_OF_MONTH"
    });
    expect(insert).toHaveBeenCalled();
    const [[arg]] = insert.mock.calls as unknown as [[Record<string, unknown>]];
    expect(arg.is_recurring).toBe(true);
    expect(arg.recurring_schedule_parent_id).toBeNull();
  });
});
