import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  markInvoicePaid,
  markInvoiceSent
} from "./invoicesSupabase";

const getUser = vi.fn();
const from = vi.fn();
const rpc = vi.fn();
const storageRemove = vi.fn(() => Promise.resolve({ data: [], error: null }));
const storageFrom = vi.fn(() => ({ remove: storageRemove }));

vi.mock("../lib/supabaseClient", () => ({
  getSupabase: () => ({
    auth: { getUser },
    from,
    rpc,
    storage: { from: storageFrom }
  })
}));

describe("invoicesSupabase", () => {
  beforeEach(() => {
    getUser.mockReset();
    from.mockReset();
    rpc.mockReset();
    storageRemove.mockClear();
    storageFrom.mockClear();
  });

  it("listInvoices throws when logged out", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(listInvoices("p1")).rejects.toThrow(/Not signed in/i);
  });

  it("listInvoices maps rows with line items", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() =>
            Promise.resolve({
              data: [
                {
                  id: "inv-1",
                  user_id: "u1",
                  property_id: "p1",
                  tenant_id: "t1",
                  invoice_number: "INV-001",
                  invoice_date: "2026-01-01T12:00:00.000Z",
                  due_date: "2026-01-15T12:00:00.000Z",
                  status: "DRAFT",
                  subtotal: 100,
                  total: 100,
                  notes: null,
                  pdf_path: null,
                  invoice_line_items: [
                    {
                      id: "li-1",
                      invoice_id: "inv-1",
                      description: "Rent",
                      quantity: 1,
                      unit_price: 100,
                      total: 100
                    }
                  ]
                }
              ],
              error: null
            })
          )
        }))
      }))
    });
    const rows = await listInvoices("p1");
    expect(from).toHaveBeenCalledWith("invoices");
    expect(rows).toHaveLength(1);
    expect(rows[0].invoiceNumber).toBe("INV-001");
    expect((rows[0].lineItems as unknown[]).length).toBe(1);
    expect((rows[0].lineItems as { unitPrice: number }[])[0].unitPrice).toBe(100);
  });

  it("createInvoice calls RPC with line items", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    rpc.mockResolvedValue({
      data: {
        invoice: {
          id: "new-inv",
          user_id: "u1",
          property_id: "p1",
          tenant_id: "t1",
          invoice_number: "INV-000000000042",
          invoice_date: "2026-02-01T12:00:00.000Z",
          due_date: "2026-02-10T12:00:00.000Z",
          status: "DRAFT",
          subtotal: 50,
          total: 50,
          pdf_path: null
        },
        line_items: [
          {
            id: "li-new",
            invoice_id: "new-inv",
            description: "Water",
            quantity: 1,
            unit_price: 50,
            total: 50
          }
        ]
      },
      error: null
    });
    const out = await createInvoice("p1", {
      tenantId: "t1",
      invoiceDate: "2026-02-01",
      dueDate: "2026-02-10",
      lineItems: [{ description: "Water", quantity: 1, unitPrice: 50, total: 50 }]
    });
    expect(rpc).toHaveBeenCalledWith(
      "create_invoice_with_line_items",
      expect.objectContaining({
        p_property_id: "p1",
        p_tenant_id: "t1",
        p_line_items: expect.arrayContaining([
          expect.objectContaining({ description: "Water", unit_price: 50 })
        ])
      })
    );
    expect(out.id).toBe("new-inv");
    expect((out.lineItems as unknown[]).length).toBe(1);
  });

  it("createInvoice requires tenantId", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    await expect(createInvoice("p1", { lineItems: [{ description: "x", quantity: 1, unitPrice: 1, total: 1 }] })).rejects.toThrow(
      /tenantId/i
    );
  });

  it("updateInvoice without lineItems uses table update", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    let fromCalls = 0;
    from.mockImplementation(() => {
      fromCalls++;
      if (fromCalls === 1) {
        return {
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                maybeSingle: vi.fn(() => Promise.resolve({ data: { id: "inv-1" }, error: null }))
              }))
            }))
          }))
        };
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() =>
              Promise.resolve({
                data: {
                  id: "inv-1",
                  user_id: "u1",
                  property_id: "p1",
                  tenant_id: "t1",
                  lease_id: null,
                  invoice_number: "N",
                  invoice_date: "2026-01-01T12:00:00.000Z",
                  due_date: "2026-01-02T12:00:00.000Z",
                  status: "SENT",
                  subtotal: 200,
                  total: 200,
                  notes: null,
                  pdf_path: null,
                  invoice_line_items: [],
                  tenants: null
                },
                error: null
              })
            )
          }))
        }))
      };
    });
    const out = await updateInvoice("inv-1", { total: 200, status: "SENT" });
    expect(rpc).not.toHaveBeenCalled();
    expect(out.total).toBe(200);
  });

  it("updateInvoice with lineItems uses RPC", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    rpc.mockResolvedValue({
      data: {
        invoice: { id: "inv-1", total: 99, subtotal: 99 },
        line_items: []
      },
      error: null
    });
    await updateInvoice("inv-1", {
      lineItems: [{ description: "A", quantity: 1, unitPrice: 99, total: 99 }]
    });
    expect(rpc).toHaveBeenCalledWith("update_invoice_with_line_items", expect.any(Object));
  });

  it("deleteInvoice removes storage object then calls hard_delete_invoice RPC", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() =>
              Promise.resolve({
                data: { pdf_storage_bucket: "invoices", pdf_storage_key: "u1/invoices/inv-9.pdf" },
                error: null
              })
            )
          }))
        }))
      }))
    });
    rpc.mockResolvedValue({ data: { message: "Deleted" }, error: null });
    const out = await deleteInvoice("inv-9");
    expect(storageRemove).toHaveBeenCalledWith(["u1/invoices/inv-9.pdf"]);
    expect(rpc).toHaveBeenCalledWith("hard_delete_invoice", { p_id: "inv-9" });
    expect(out.message).toBe("Deleted");
  });

  it("markInvoiceSent sets status SENT and sent_at", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    let fromCalls = 0;
    from.mockImplementation(() => {
      fromCalls++;
      if (fromCalls === 1) {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(() =>
                  Promise.resolve({ data: { id: "inv-1", status: "DRAFT" }, error: null })
                )
              }))
            }))
          }))
        };
      }
      return {
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(() =>
                  Promise.resolve({
                    data: {
                      id: "inv-1",
                      user_id: "u1",
                      property_id: "p1",
                      tenant_id: "t1",
                      invoice_number: "INV-1",
                      invoice_date: "2026-01-01T12:00:00.000Z",
                      due_date: "2026-01-15T12:00:00.000Z",
                      status: "SENT",
                      sent_at: "2026-01-02T12:00:00.000Z",
                      subtotal: 100,
                      total: 100,
                      notes: null,
                      pdf_path: null
                    },
                    error: null
                  })
                )
              }))
            }))
          }))
        }))
      };
    });

    const out = await markInvoiceSent("inv-1");
    expect(out.status).toBe("SENT");
    expect(out.sentAt).toBeTruthy();
  });

  it("markInvoiceSent rejects non-editable status", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() =>
              Promise.resolve({ data: { id: "inv-1", status: "SENT" }, error: null })
            )
          }))
        }))
      }))
    });
    await expect(markInvoiceSent("inv-1")).rejects.toThrow(/cannot be marked as sent/i);
  });

  it("markInvoicePaid updates row", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const single = vi.fn(() =>
      Promise.resolve({
        data: {
          id: "inv-1",
          user_id: "u1",
          status: "PAID",
          invoice_number: "INV-1",
          invoice_date: "2026-01-01T12:00:00.000Z",
          due_date: "2026-01-01T12:00:00.000Z",
          subtotal: 1,
          total: 1,
          paid_at: "2026-03-01T12:00:00.000Z",
          pdf_path: null
        },
        error: null
      })
    );
    from.mockReturnValue({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single
            }))
          }))
        }))
      }))
    });
    const row = await markInvoicePaid("inv-1");
    expect(row.status).toBe("PAID");
  });

  it("getInvoice uses detail select", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const maybeSingle = vi.fn(() =>
      Promise.resolve({
        data: {
          id: "inv-1",
          user_id: "u1",
          property_id: "p1",
          tenant_id: "t1",
          invoice_number: "X",
          invoice_date: "2026-01-01T12:00:00.000Z",
          due_date: "2026-01-01T12:00:00.000Z",
          status: "DRAFT",
          subtotal: 0,
          total: 0,
          invoice_line_items: [],
          tenants: { id: "t1", first_name: "A", last_name: "B", email: null, phone: null }
        },
        error: null
      })
    );
    from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle
        }))
      }))
    });
    const inv = await getInvoice("inv-1");
    expect(inv.tenant).toBeDefined();
    expect((inv.tenant as { firstName: string }).firstName).toBe("A");
  });
});
