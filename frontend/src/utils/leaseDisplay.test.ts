import { describe, expect, it } from "vitest";
import { isLeaseCurrentlyActive, leaseDisplayStatus } from "./leaseDisplay";

describe("leaseDisplayStatus", () => {
  it("treats future cancellation as active until the cancellation date", () => {
    const future = "2099-06-30";
    expect(
      leaseDisplayStatus({
        status: "CANCELLED",
        fixedTermEndDate: "2098-01-01",
        cancellationDate: future
      })
    ).toBe("ACTIVE");
    expect(
      isLeaseCurrentlyActive({
        status: "CANCELLED",
        fixedTermEndDate: null,
        cancellationDate: future
      })
    ).toBe(true);
  });

  it("treats past cancellation as cancelled", () => {
    expect(
      leaseDisplayStatus({
        status: "CANCELLED",
        fixedTermEndDate: null,
        cancellationDate: "2020-01-01"
      })
    ).toBe("CANCELLED");
  });

  it("keeps historical property context available after cancellation", () => {
    expect(
      leaseDisplayStatus({
        status: "CANCELLED",
        fixedTermEndDate: "2024-12-31",
        cancellationDate: "2025-01-31"
      })
    ).toBe("CANCELLED");
  });
});
