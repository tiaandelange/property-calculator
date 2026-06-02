import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  deleteUserReport,
  getCurrentProfile,
  listUserReports,
  updateProfile
} from "./profileSupabase";

const rpc = vi.fn();
const from = vi.fn();
const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: null }, error: null });
const getSession = vi.fn();

vi.mock("../lib/supabaseClient", () => ({
  getSupabase: () => ({
    rpc,
    auth: { getSession },
    from,
    storage: {
      from: () => ({
        createSignedUrl,
        upload: vi.fn()
      })
    }
  })
}));

describe("profileSupabase", () => {
  beforeEach(() => {
    rpc.mockReset();
    from.mockReset();
    createSignedUrl.mockReset();
    createSignedUrl.mockResolvedValue({ data: { signedUrl: null }, error: null });
    getSession.mockResolvedValue({
      data: {
        session: {
          user: { id: "u1", email: "a@b.com", email_confirmed_at: "2026-01-01" }
        }
      },
      error: null
    });
  });

  it("getCurrentProfile merges auth user and profiles row", async () => {
    from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  full_name: "Alex",
                  role: "USER",
                  invoice_payment_details: { bankName: "FNB" },
                  profile_details: { phone: "0820000000" },
                  business_details: {},
                  ui_color_scheme: "light",
                  free_uses_remaining: 3
                },
                error: null
              })
            }))
          }))
        };
      }
      if (table === "user_settings") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { use_business_for_financials: false },
                error: null
              })
            }))
          }))
        };
      }
      return {};
    });

    const me = await getCurrentProfile();
    expect(me.id).toBe("u1");
    expect(me.email).toBe("a@b.com");
    expect(me.name).toBe("Alex");
    expect(me.role).toBe("USER");
    expect(me.uiColorScheme).toBe("light");
    expect(me.freeUsesRemaining).toBe(3);
    expect(me.emailConfirmed).toBe(true);
    expect(me.financialLandlord?.name).toBe("Alex");
    expect(me.useBusinessForFinancials).toBe(false);
  });

  it("updateProfile uses RPC for invoice payment details", async () => {
    const details = { bankName: "Capitec", accountNumber: "123" };
    rpc.mockResolvedValue({
      data: { invoicePaymentDetails: details },
      error: null
    });
    from.mockReturnValue({
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null })
      }))
    });

    const out = await updateProfile({ invoicePaymentDetails: details });
    expect(rpc).toHaveBeenCalledWith("update_invoice_payment_details", { p_details: details });
    expect(out.invoicePaymentDetails).toEqual(details);
  });

  it("updateProfile uses RPC for full name and patches ui_color_scheme on profiles", async () => {
    rpc.mockResolvedValue({
      data: { fullName: "Sam", profileDetails: {}, businessDetails: {} },
      error: null
    });
    const update = vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null })
    }));
    from.mockReturnValue({ update });

    await updateProfile({ fullName: "Sam", uiColorScheme: "dark" });

    expect(rpc).toHaveBeenCalledWith(
      "update_profile_details",
      expect.objectContaining({ p_full_name: "Sam" })
    );
    expect(update).toHaveBeenCalledWith(
      expect.not.objectContaining({
        role: expect.anything(),
        subscription_status: expect.anything(),
        free_uses_remaining: expect.anything(),
        invoice_payment_details: expect.anything()
      })
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        full_name: "Sam",
        ui_color_scheme: "dark",
        updated_at: expect.any(String)
      })
    );
  });

  it("listUserReports merges latest stored_reports and scopes by user_id", async () => {
    const eqChain = vi.fn();
    from.mockImplementation((table: string) => {
      if (table === "calculator_results") {
        return {
          select: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "calc-1",
                  type: "noi",
                  created_at: "2026-01-01T00:00:00Z",
                  input_json: {},
                  result_json: { x: 1 }
                }
              ],
              error: null
            })
          }))
        };
      }
      if (table === "stored_reports") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((col: string, val: string) => {
              eqChain(col, val);
              return {
                in: vi.fn(() => ({
                  order: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: "rep-1",
                        calculation_id: "calc-1",
                        storage_bucket: "reports",
                        storage_key: "u1/reports/rep-1.pdf"
                      }
                    ],
                    error: null
                  })
                }))
              };
            })
          }))
        };
      }
      return {};
    });

    createSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://signed.example/pdf" },
      error: null
    });

    const rows = await listUserReports();
    expect(eqChain).toHaveBeenCalledWith("user_id", "u1");
    expect(rows).toHaveLength(1);
    expect(rows[0].hasPdf).toBe(true);
    expect(rows[0].downloadUrl).toBe("https://signed.example/pdf");
  });

  it("listUserReports returns empty when user has no calculator_results", async () => {
    from.mockImplementation((table: string) => {
      if (table === "calculator_results") {
        return {
          select: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({ data: [], error: null })
          }))
        };
      }
      return {};
    });

    const rows = await listUserReports();
    expect(rows).toEqual([]);
    expect(from).not.toHaveBeenCalledWith("stored_reports");
  });

  it("deleteUserReport removes stored_reports then calculator_results for own user", async () => {
    const eqChain = () => ({
      eq: vi.fn().mockResolvedValue({ data: [], error: null })
    });
    const delChain = () => ({
      eq: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }))
    });

    from.mockImplementation((table: string) => {
      if (table === "stored_reports") {
        return {
          select: vi.fn(() => ({ eq: vi.fn(() => eqChain()) })),
          delete: vi.fn(() => delChain())
        };
      }
      if (table === "calculator_results") {
        return { delete: vi.fn(() => delChain()) };
      }
      return {};
    });

    await deleteUserReport("calc-1");
    expect(from).toHaveBeenCalledWith("stored_reports");
    expect(from).toHaveBeenCalledWith("calculator_results");
  });
});
