import { describe, expect, it } from "vitest";
import { buildTenantDirectory, deriveLeaseStatus, derivePaymentStatus } from "./tenantDirectoryAdapter";

describe("tenantDirectoryAdapter", () => {
  it("derivePaymentStatus marks overdue when due date passed", () => {
    const today = new Date("2026-05-26T12:00:00Z");
    const status = derivePaymentStatus(
      [{ tenantId: "t1", dueDate: "2026-05-01T00:00:00Z", status: "SENT", total: 100 }],
      today
    );
    expect(status).toBe("overdue");
  });

  it("buildTenantDirectory maps tenant with active lease", () => {
    const { items, metrics } = buildTenantDirectory(
      [
        {
          id: "t1",
          user_id: "u1",
          first_name: "Jane",
          last_name: "Doe",
          email: "jane@example.com",
          phone: "0820000000",
          status: "ACTIVE",
          property_id: "p1",
          properties: {
            id: "p1",
            name: "Ocean View",
            address_line1: "1 Beach Rd",
            city: "Cape Town"
          }
        }
      ],
      [
        {
          id: "l1",
          tenant_id: "t1",
          property_id: "p1",
          start_date: "2025-01-01T00:00:00Z",
          fixed_term_end_date: "2026-12-31T00:00:00Z",
          monthly_rent: 2500,
          status: "ACTIVE"
        }
      ],
      [],
      new Date("2026-05-26T12:00:00Z")
    );
    expect(items).toHaveLength(1);
    expect(items[0]?.fullName).toBe("Jane Doe");
    expect(items[0]?.monthlyRent).toBe(2500);
    expect(items[0]?.leaseStatus).toBe("active");
    expect(metrics.totalTenants).toBe(1);
    expect(metrics.activeLeases).toBe(1);
  });
});
