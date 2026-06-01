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

  it("POSTs send-email with Bearer token and JSON body", async () => {
    getSession.mockResolvedValue({
      data: { session: { access_token: "tok-email" } },
      error: null
    });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ message: "Invoice emailed successfully.", providerEmailId: "re_123" })
    });

    const { sendInvoiceEmailViaVercel } = await import("./invoicesEmailVercel");
    const out = await sendInvoiceEmailViaVercel({
      invoiceId: "22222222-2222-2222-2222-222222222222",
      to: ["tenant@example.com"],
      subject: "Invoice",
      message: "Hello",
      copyMe: true
    });

    expect(out.message).toContain("emailed");
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/invoices/22222222-2222-2222-2222-222222222222/send-email",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer tok-email",
          "Content-Type": "application/json"
        }),
        body: JSON.stringify({
          to: ["tenant@example.com"],
          subject: "Invoice",
          message: "Hello",
          copyMe: true
        })
      })
    );
  });
});
