import { describe, expect, it } from "vitest";
import { defaultBillingPeriod, dueDateForBillingPeriod } from "./leaseBillingPeriodUtils";

describe("leaseBillingPeriodUtils", () => {
  it("defaults to current month before rent due day", () => {
    const anchor = new Date(Date.UTC(2026, 4, 5));
    expect(defaultBillingPeriod(7, anchor)).toBe("2026-05");
  });

  it("defaults to next month after rent due day", () => {
    const anchor = new Date(Date.UTC(2026, 4, 20));
    expect(defaultBillingPeriod(7, anchor)).toBe("2026-06");
  });

  it("computes due date capped to month length", () => {
    expect(dueDateForBillingPeriod("2026-02", 31)).toBe("2026-02-28");
    expect(dueDateForBillingPeriod("2026-05", 7)).toBe("2026-05-07");
  });
});
