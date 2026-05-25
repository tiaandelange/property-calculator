import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const createClient = vi.fn();

vi.mock("../lib/supabaseClient", () => ({
  getSupabase: () => ({ auth: { getSession } })
}));

describe("generateReportViaVercel", () => {
  beforeEach(() => {
    vi.resetModules();
    getSession.mockReset();
    global.fetch = vi.fn();
  });

  it("POSTs to /api/reports/generate with Bearer token", async () => {
    getSession.mockResolvedValue({
      data: { session: { access_token: "tok-abc" } },
      error: null
    });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        reportId: "r1",
        downloadUrl: "https://signed.example/x.pdf",
        expiresIn: 600
      })
    });

    const { generateReportViaVercel } = await import("./reportsVercel");
    const out = await generateReportViaVercel({
      reportType: "CALCULATION",
      calculationId: "11111111-1111-1111-1111-111111111111"
    });

    expect(out.downloadUrl).toContain("signed.example");
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/reports/generate",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer tok-abc",
          "Content-Type": "application/json"
        }),
        body: JSON.stringify({
          reportType: "CALCULATION",
          calculationId: "11111111-1111-1111-1111-111111111111"
        })
      })
    );
  });

  it("throws when not signed in", async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    const { generateReportViaVercel } = await import("./reportsVercel");
    await expect(
      generateReportViaVercel({ reportType: "PROPERTY_SUMMARY", propertyId: "22222222-2222-2222-2222-222222222222" })
    ).rejects.toThrow(/not signed in/i);
  });
});
