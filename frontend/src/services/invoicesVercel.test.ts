import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();

vi.mock("../lib/supabaseClient", () => ({
  getSupabase: () => ({ auth: { getSession } })
}));

describe("generateInvoicePdfViaVercel", () => {
  beforeEach(() => {
    vi.resetModules();
    getSession.mockReset();
    global.fetch = vi.fn();
  });

  it("POSTs to /api/invoices/:id/generate-pdf with Bearer token", async () => {
    getSession.mockResolvedValue({
      data: { session: { access_token: "tok-inv" } },
      error: null
    });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        invoiceId: "11111111-1111-1111-1111-111111111111",
        hasPdf: true,
        downloadUrl: "https://signed.example/inv.pdf",
        expiresIn: 600
      })
    });

    const { generateInvoicePdfViaVercel } = await import("./invoicesVercel");
    const out = await generateInvoicePdfViaVercel("11111111-1111-1111-1111-111111111111");

    expect(out.downloadUrl).toContain("signed.example");
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/invoices/11111111-1111-1111-1111-111111111111/generate-pdf",
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Bearer tok-inv" }
      })
    );
  });
});
