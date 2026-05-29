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
      headers: {
        get: (name: string) => (name.toLowerCase() === "content-type" ? "application/json" : null)
      },
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

  it("accepts ephemeral draft PDF returned as application/pdf", async () => {
    getSession.mockResolvedValue({
      data: { session: { access_token: "tok-inv" } },
      error: null
    });
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (name: string) => {
          const key = name.toLowerCase();
          if (key === "content-type") return "application/pdf";
          if (key === "x-invoice-id") return "22222222-2222-2222-2222-222222222222";
          return null;
        }
      },
      arrayBuffer: async () => pdfBytes.buffer
    });

    const { generateInvoicePdfViaVercel } = await import("./invoicesVercel");
    const out = await generateInvoicePdfViaVercel("22222222-2222-2222-2222-222222222222");

    expect(out.ephemeral).toBe(true);
    expect(out.pdfBase64).toBe(btoa("%PDF-"));
    expect(out.invoiceId).toBe("22222222-2222-2222-2222-222222222222");
  });
});
