import { describe, expect, it } from "vitest";
import { enumerateBondDueYmdsInRange, isValidYmd } from "./bondYmd";

describe("bondYmd", () => {
  it("validates YYYY-MM-DD", () => {
    expect(isValidYmd("2026-05-01")).toBe(true);
    expect(isValidYmd("2026-5-01")).toBe(false);
  });

  it("enumerates inclusive month range with clamped day", () => {
    const list = enumerateBondDueYmdsInRange("2026-01-31", "2026-03-31");
    expect(list).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  });
});
