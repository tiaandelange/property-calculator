import { describe, it, expect } from "vitest";
import {
  addMonthsToLocalDate,
  computeEndDateFromTerm,
  isLeaseEndExpired,
  resolveLeaseTypeFromEndDate
} from "./leaseTermUtils";

describe("leaseTermUtils", () => {
  it("addMonthsToLocalDate adds months in local calendar", () => {
    expect(addMonthsToLocalDate("2026-01-15", 6)).toBe("2026-07-15");
    expect(addMonthsToLocalDate("2026-01-15", 12)).toBe("2027-01-15");
  });

  it("computeEndDateFromTerm uses preset months", () => {
    expect(computeEndDateFromTerm("2026-03-01", "6", "")).toBe("2026-09-01");
    expect(computeEndDateFromTerm("2026-03-01", "manual", "2028-01-01")).toBe("2028-01-01");
  });

  it("resolveLeaseTypeFromEndDate returns MONTH_TO_MONTH when expired", () => {
    expect(resolveLeaseTypeFromEndDate("2020-01-01")).toBe("MONTH_TO_MONTH");
    expect(resolveLeaseTypeFromEndDate("2099-12-31")).toBe("FIXED_TERM");
    expect(resolveLeaseTypeFromEndDate(null)).toBe("MONTH_TO_MONTH");
  });

  it("isLeaseEndExpired compares against today", () => {
    expect(isLeaseEndExpired("2020-01-01", new Date("2026-05-29"))).toBe(true);
    expect(isLeaseEndExpired("2099-01-01", new Date("2026-05-29"))).toBe(false);
  });
});
