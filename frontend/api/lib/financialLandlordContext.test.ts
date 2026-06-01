import { describe, expect, it, vi } from "vitest";
import { loadFinancialLandlordContext } from "./financialLandlordContext.js";

describe("loadFinancialLandlordContext", () => {
  it("uses business details when use_business_for_financials is true", async () => {
    const from = vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  full_name: "Alex",
                  invoice_payment_details: {},
                  profile_details: { phone: "082111" },
                  business_details: {
                    businessName: "ACME Letting",
                    email: "rents@acme.co.za",
                    phone: "082999"
                  }
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
                data: { use_business_for_financials: true },
                error: null
              })
            }))
          }))
        };
      }
      return {};
    });

    const sb = { from, auth: { getUser: vi.fn() } } as unknown as import("@supabase/supabase-js").SupabaseClient;

    const ctx = await loadFinancialLandlordContext(sb, "user-1", "alex@example.com");
    expect(ctx.useBusinessForFinancials).toBe(true);
    expect(ctx.landlord.name).toBe("ACME Letting");
    expect(ctx.landlord.email).toBe("rents@acme.co.za");
  });
});
