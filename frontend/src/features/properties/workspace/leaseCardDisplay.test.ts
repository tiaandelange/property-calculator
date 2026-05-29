import { describe, expect, it } from "vitest";
import {
  leaseCardStatusTags,
  leaseReferenceDisplay,
  leaseTermTypeLabel,
  rentDueDayLabel
} from "./leaseCardDisplay";

describe("leaseCardDisplay", () => {
  it("formats rent due day labels", () => {
    expect(rentDueDayLabel(1)).toBe("1st of the month");
    expect(rentDueDayLabel(15)).toBe("15th of the month");
    expect(rentDueDayLabel(31)).toBe("Last day of the month");
  });

  it("shows lease reference No when absent", () => {
    expect(leaseReferenceDisplay({})).toBe("No");
    expect(leaseReferenceDisplay({ leaseReference: "  REF-1  " })).toBe("REF-1");
  });

  it("derives term label from dates", () => {
    expect(
      leaseTermTypeLabel({
        leaseType: "FIXED_TERM",
        status: "ACTIVE",
        startDate: "2025-01-01",
        fixedTermEndDate: "2026-01-01"
      })
    ).toBe("12 months");
    expect(
      leaseTermTypeLabel({
        leaseType: "FIXED_TERM",
        status: "ACTIVE",
        displayStatus: "MONTH_TO_MONTH",
        startDate: "2024-01-01",
        fixedTermEndDate: "2024-06-01"
      })
    ).toBe("Month-to-month");
  });

  it("tags months left for active fixed term", () => {
    const today = new Date(2026, 0, 15);
    const tags = leaseCardStatusTags(
      {
        id: "l1",
        status: "ACTIVE",
        displayStatus: "ACTIVE",
        startDate: "2025-06-01",
        fixedTermEndDate: "2026-03-01",
        tenantId: "t1"
      },
      today
    );
    expect(tags.some((t) => t.label === "1 month left")).toBe(true);
  });
});
