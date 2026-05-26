import { describe, expect, it } from "vitest";
import { buildLeaseDirectory } from "./leaseDirectoryAdapter";

describe("buildLeaseDirectory", () => {
  it("computes metrics from lease rows", () => {
    const today = new Date("2026-05-15T12:00:00Z");
    const { items, metrics } = buildLeaseDirectory(
      [
        {
          id: "l1",
          propertyId: "p1",
          tenantId: "t1",
          leaseType: "FIXED_TERM",
          startDate: "2026-01-01",
          fixedTermEndDate: "2026-06-01",
          monthlyRent: 10000,
          depositAmount: 10000,
          rentDueDay: 1,
          status: "ACTIVE",
          displayStatus: "ACTIVE",
          tenant: { firstName: "Jane", lastName: "Doe" },
          property: { id: "p1", name: "Flat 1", addressLine1: "1 Main", city: "CPT" }
        },
        {
          id: "l2",
          propertyId: "p2",
          tenantId: "t2",
          leaseType: "FIXED_TERM",
          startDate: "2025-01-01",
          fixedTermEndDate: "2025-12-01",
          monthlyRent: 5000,
          depositAmount: 5000,
          rentDueDay: 5,
          status: "EXPIRED",
          displayStatus: "EXPIRED",
          tenant: { firstName: "Bob", lastName: "Smith" },
          property: { id: "p2", name: "House", addressLine1: "2 Oak", city: "JHB" }
        }
      ],
      today
    );

    expect(items).toHaveLength(2);
    expect(metrics.totalLeases).toBe(2);
    expect(metrics.activeLeases).toBe(1);
    expect(metrics.monthlyRentRoll).toBe(10000);
    expect(metrics.renewalsDue).toBe(1);
    expect(items[0]?.tenantName).toBe("Jane Doe");
    expect(items[0]?.propertyName).toBe("Flat 1");
  });
});
