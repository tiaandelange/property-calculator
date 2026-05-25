import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();

vi.mock("../lib/supabaseClient", () => ({
  getSupabase: () => ({ auth: { getSession } })
}));

describe("bondOperationsVercel", () => {
  beforeEach(() => {
    vi.resetModules();
    getSession.mockReset();
    global.fetch = vi.fn();
  });

  const pid = "33333333-3333-3333-3333-333333333333";

  it("previewBondAtDate GETs preview endpoint", async () => {
    getSession.mockResolvedValue({
      data: { session: { access_token: "bond-tok" } },
      error: null
    });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ dueDate: "2026-01-15", bondFinance: { paymentThisMonth: 100 } })
    });

    const { previewBondAtDate } = await import("./bondOperationsVercel");
    await previewBondAtDate(pid, "2026-01-15");

    expect(global.fetch).toHaveBeenCalledWith(
      `/api/properties/${pid}/bond/preview-at-date?dueDate=2026-01-15`,
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer bond-tok" }) })
    );
  });

  it("postBondStatementRow POSTs dueDate body", async () => {
    getSession.mockResolvedValue({
      data: { session: { access_token: "bond-tok" } },
      error: null
    });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: async () => ({}) });

    const { postBondStatementRow } = await import("./bondOperationsVercel");
    await postBondStatementRow(pid, "2026-02-01");

    expect(global.fetch).toHaveBeenCalledWith(
      `/api/properties/${pid}/bond/statement-row`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ dueDate: "2026-02-01" })
      })
    );
  });
});
