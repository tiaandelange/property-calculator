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

  it("POSTs to /api/invoices/generate with Bearer token and invoiceId body", async () => {
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
      "/api/invoices/generate",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer tok-inv"
        },
        body: JSON.stringify({ invoiceId: "11111111-1111-1111-1111-111111111111" })
      })
    );
  });

  it("accepts ephemeral draft PDF signed URL response", async () => {
    getSession.mockResolvedValue({
      data: { session: { access_token: "tok-inv" } },
      error: null
    });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        invoiceId: "22222222-2222-2222-2222-222222222222",
        hasPdf: false,
        ephemeral: true,
        downloadUrl: "https://signed.example/draft.pdf",
        expiresIn: 600
      })
    });

    const { generateInvoicePdfViaVercel } = await import("./invoicesVercel");
    const out = await generateInvoicePdfViaVercel("22222222-2222-2222-2222-222222222222");

    expect(out.ephemeral).toBe(true);
    expect(out.downloadUrl).toContain("signed.example");
  });
});
