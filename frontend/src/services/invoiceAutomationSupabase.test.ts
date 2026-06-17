import { describe, expect, it, vi, beforeEach } from "vitest";
import { generateDueLeaseInvoices, getInvoiceAutomationSettings } from "./invoiceAutomationSupabase";

const getSession = vi.fn();
const from = vi.fn();
const rpc = vi.fn();

vi.mock("../lib/supabaseClient", () => ({
  getSupabase: () => ({
    auth: { getSession },
    from,
    rpc
  })
}));

vi.mock("./settingsSupabase", () => ({
  getOrCreateUserSettings: vi.fn(() =>
    Promise.resolve({
      invoiceGenerateDaysBeforeDue: 12,
      autoGenerateInvoices: true
    })
  )
}));

describe("invoiceAutomationSupabase", () => {
  beforeEach(() => {
    getSession.mockReset();
    from.mockReset();
    rpc.mockReset();
    getSession.mockResolvedValue({
      data: { session: { user: { id: "u1" } } },
      error: null
    });
  });

  it("generateDueLeaseInvoices calls RPC and maps result", async () => {
    rpc.mockResolvedValue({
      data: {
        leases_checked: 3,
        invoices_created: 1,
        skipped_duplicate: 2,
        skipped_inactive: 0,
        skipped_not_due: 4,
        errors: [],
        as_of_date: "2026-03-01",
        timezone: "Africa/Johannesburg"
      },
      error: null
    });
    const res = await generateDueLeaseInvoices();
    expect(rpc).toHaveBeenCalledWith("generate_due_lease_invoices", {});
    expect(res.leasesChecked).toBe(3);
    expect(res.invoicesCreated).toBe(1);
    expect(res.timezone).toBe("Africa/Johannesburg");
  });

  it("getInvoiceAutomationSettings merges profile and platform defaults", async () => {
    from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() =>
                Promise.resolve({
                  data: { rent_invoice_days_before_due: 12, rent_invoice_grace_period_days: null },
                  error: null
                })
              )
            }))
          }))
        };
      }
      return {
        select: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              maybeSingle: vi.fn(() =>
                Promise.resolve({
                  data: { rent_invoice_days_before_due: 10, rent_invoice_grace_period_days: 7 },
                  error: null
                })
              )
            }))
          }))
        }))
      };
    });
    const settings = await getInvoiceAutomationSettings();
    expect(settings.rentInvoiceDaysBeforeDue).toBe(12);
    expect(settings.autoGenerateInvoices).toBe(true);
    expect(settings.rentInvoiceGracePeriodDays).toBe(7);
  });
});
