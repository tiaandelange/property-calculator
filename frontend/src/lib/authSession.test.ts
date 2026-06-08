import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readAuthSession, resetAuthSessionReadCoalescingForTests } from "./authSession";

const getSession = vi.fn();

vi.mock("./supabaseClient", () => ({
  getSupabase: () => ({
    auth: { getSession }
  })
}));

describe("readAuthSession", () => {
  beforeEach(() => {
    getSession.mockReset();
    resetAuthSessionReadCoalescingForTests();
  });

  afterEach(() => {
    resetAuthSessionReadCoalescingForTests();
  });

  it("coalesces concurrent getSession calls", async () => {
    let resolve!: (value: { data: { session: null }; error: null }) => void;
    getSession.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        })
    );

    const first = readAuthSession();
    const second = readAuthSession();

    expect(getSession).toHaveBeenCalledTimes(1);

    resolve({ data: { session: null }, error: null });

    const [a, b] = await Promise.all([first, second]);
    expect(a.session).toBeNull();
    expect(b.session).toBeNull();
  });
});
