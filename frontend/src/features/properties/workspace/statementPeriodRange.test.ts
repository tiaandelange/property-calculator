import { describe, it, expect } from "vitest";
import { resolveStatementPeriodRange } from "./statementPeriodRange";

describe("resolveStatementPeriodRange", () => {
  const now = new Date(Date.UTC(2026, 4, 30, 12, 0, 0)); // 2026-05-30 UTC

  it("maps LAST_MONTH to the prior UTC calendar month", () => {
    expect(resolveStatementPeriodRange("LAST_MONTH", 2026, now)).toEqual({
      startDate: "2026-04-01",
      endDate: "2026-04-30"
    });
  });

  it("maps SIX_MONTHS to six inclusive UTC months ending today", () => {
    expect(resolveStatementPeriodRange("SIX_MONTHS", 2026, now)).toEqual({
      startDate: "2025-12-01",
      endDate: "2026-05-30"
    });
  });

  it("maps YTD to Jan 1 through today UTC", () => {
    expect(resolveStatementPeriodRange("YTD", 2026, now)).toEqual({
      startDate: "2026-01-01",
      endDate: "2026-05-30"
    });
  });

  it("maps PER_YEAR to the selected UTC calendar year", () => {
    expect(resolveStatementPeriodRange("PER_YEAR", 2024, now)).toEqual({
      startDate: "2024-01-01",
      endDate: "2024-12-31"
    });
  });

  it("caps FOREVER at twelve UTC months ending today", () => {
    expect(resolveStatementPeriodRange("FOREVER", 2026, now)).toEqual({
      startDate: "2025-06-01",
      endDate: "2026-05-30"
    });
  });
});
