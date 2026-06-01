import { describe, expect, it } from "vitest";
import type { TenantListItem } from "./tenantDirectoryTypes";
import {
  matchesTenantDirectoryFilters,
  paginate,
  PAGE_SIZE,
  tenantRowContactField
} from "./tenantDirectoryUtils";

const baseItem = (patch: Partial<TenantListItem>): TenantListItem =>
  ({
    id: "t1",
    firstName: "Jane",
    lastName: "Doe",
    fullName: "Jane Doe",
    email: "jane@example.com",
    phone: null,
    avatarUrl: null,
    tenantStatus: "ACTIVE",
    propertyId: "p1",
    propertyName: "Ocean View",
    propertyAddress: "1 Main",
    unitNumber: null,
    leaseId: "l1",
    monthlyRent: 10000,
    leaseStartDate: null,
    leaseEndDate: null,
    leaseStatus: "active",
    leaseDisplayStatus: "ACTIVE",
    paymentStatus: "paid",
    outstandingAmount: null,
    lastPaymentDate: null,
    nextPaymentDueDate: null,
    ...patch
  }) as TenantListItem;

describe("tenantRowContactField", () => {
  it("returns the value unchanged when not grouped", () => {
    expect(tenantRowContactField("jane@example.com", "PRIMARY")).toBe("jane@example.com");
  });

  it("splits grouped values for primary and co roles", () => {
    expect(tenantRowContactField("a@x.com & b@y.com", "PRIMARY")).toBe("a@x.com");
    expect(tenantRowContactField("a@x.com & b@y.com", "CO")).toBe("b@y.com");
  });

  it("dedupes identical grouped values", () => {
    expect(tenantRowContactField("082 & 082", "PRIMARY")).toBe("082");
  });
});

describe("tenantDirectoryUtils pagination", () => {
  it("paginates with stable page size", () => {
    const items = [1, 2, 3, 4, 5, 6, 7].map((n) => baseItem({ id: `t${n}`, fullName: `Tenant ${n}` }));
    const page1 = paginate(items, 1, PAGE_SIZE);
    expect(page1.slice).toHaveLength(6);
    expect(page1.totalCount).toBe(7);
    const page2 = paginate(items, 2, PAGE_SIZE);
    expect(page2.slice).toHaveLength(1);
  });

  it("filters applicants tab", () => {
    const tenant = baseItem({ tenantStatus: "ACTIVE" });
    const applicant = baseItem({ id: "t2", tenantStatus: "APPLICANT" });
    expect(matchesTenantDirectoryFilters(applicant, { tab: "applicants" })).toBe(true);
    expect(matchesTenantDirectoryFilters(tenant, { tab: "applicants" })).toBe(false);
  });
});
