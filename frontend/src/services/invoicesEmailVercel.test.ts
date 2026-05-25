import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();

vi.mock("../lib/supabaseClient", () => ({
  getSupabase: () => ({ auth: { getSession } })
}));

describe("sendInvoiceEmailViaVercel", () => {
  beforeEach(() => {
    vi.resetModules();
    getSession.mockReset();
    global.fetch = vi.fn();
  });

  it("POSTs send-email with Bearer token", async () => {
    getSession.mockResolvedValue({
      data: { session: { access_token: "tok-email" } },
      error: null
    });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ message: "Sent." })
    });

    const { sendInvoiceEmailViaVercel } = await import("./invoicesEmailVercel");
    const out = await sendInvoiceEmailViaVercel("22222222-2222-2222-2222-222222222222");

    expect(out.message).toBe("Sent.");
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/invoices/22222222-2222-2222-2222-222222222222/send-email",
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Bearer tok-email" }
      })
    );
  });
});
