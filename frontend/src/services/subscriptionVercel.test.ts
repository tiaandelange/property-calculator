import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();

vi.mock("../lib/supabaseClient", () => ({
  getSupabase: () => ({ auth: { getSession } })
}));

describe("subscriptionVercel", () => {
  beforeEach(() => {
    vi.resetModules();
    getSession.mockReset();
    global.fetch = vi.fn();
  });

  it("POSTs checkout with Bearer token and plan body", async () => {
    getSession.mockResolvedValue({
      data: { session: { access_token: "sub-tok" } },
      error: null
    });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        checkoutUrl: "https://www.proplytic.co.za/subscription/success?mock=true",
        reference: "mock_1_user",
        provider: "mock"
      })
    });

    const { startSubscriptionCheckout } = await import("./subscriptionVercel");
    const out = await startSubscriptionCheckout({ planCode: "investor", billingPeriod: "monthly" });
    expect(out.checkoutUrl).toContain("mock=true");
    expect(out.provider).toBe("mock");
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/subscription/checkout",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer sub-tok",
          "Content-Type": "application/json"
        }),
        body: JSON.stringify({ planCode: "investor", billingPeriod: "monthly" })
      })
    );
  });
});
