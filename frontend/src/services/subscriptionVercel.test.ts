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

  it("POSTs checkout with Bearer token", async () => {
    getSession.mockResolvedValue({
      data: { session: { access_token: "sub-tok" } },
      error: null
    });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ checkoutUrl: "https://checkout.stripe.com/test" })
    });

    const { startSubscriptionCheckout } = await import("./subscriptionVercel");
    const out = await startSubscriptionCheckout();
    expect(out.checkoutUrl).toContain("stripe.com");
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/subscription/checkout",
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Bearer sub-tok" }
      })
    );
  });
});
