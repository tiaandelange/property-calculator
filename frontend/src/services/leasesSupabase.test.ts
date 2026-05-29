import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listLeasesForProperty,
  getCurrentLease,
  createLease,
  updateLease,
  deleteOrArchiveLease,
  hardDeleteLease,
  cancelLease,
  mergeLeaseBundleIntoPropertyDetail
} from "./leasesSupabase";
import { dbToLease } from "../api/leaseRowMapping";

const userId = "11111111-1111-1111-1111-111111111111";
const propertyId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const leaseId = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const tenantId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

const leaseRowSnake = {
  id: leaseId,
  user_id: userId,
  property_id: propertyId,
  tenant_id: tenantId,
  start_date: "2026-01-01T00:00:00Z",
  fixed_term_end_date: "2027-01-01T00:00:00Z",
  lease_type: "FIXED_TERM",
  monthly_rent: 5000,
  deposit_amount: 5000,
  deposit_annual_growth_percent: null,
  deposit_growth_last_applied_month: null,
  rent_due_day: 1,
  escalation_percent: null,
  escalation_date: null,
  status: "ACTIVE",
  cancellation_date: null,
  cancellation_reason: null,
  cancelled_by: null,
  lease_document_id: null,
  notes: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  tenants: {
    id: tenantId,
    first_name: "Jane",
    last_name: "Doe",
    email: null,
    phone: null
  }
};

const getUser = vi.fn();
const from = vi.fn();
const rpc = vi.fn();

vi.mock("../lib/supabaseClient", () => ({
  getSupabase: () => ({
    auth: { getUser },
    from,
    rpc
  })
}));

describe("leasesSupabase", () => {
  beforeEach(() => {
    getUser.mockReset();
    from.mockReset();
    rpc.mockReset();
  });

  it("throws when logged out", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(listLeasesForProperty(propertyId)).rejects.toThrow(/Not signed in/i);
    await expect(createLease(propertyId, { tenantId, startDate: "2026-01-01" })).rejects.toThrow(/Not signed in/i);
  });

  it("listLeasesForProperty returns current + historical split", async () => {
    getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [leaseRowSnake], error: null }))
        }))
      }))
    });
    const b = await listLeasesForProperty(propertyId);
    expect(from).toHaveBeenCalledWith("leases");
    expect(b.leases).toHaveLength(1);
    expect(b.currentLease).not.toBeNull();
    expect(b.currentLeases).toHaveLength(1);
    expect(b.historicalLeases).toHaveLength(0);
  });

  it("getCurrentLease matches list slice", async () => {
    getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      }))
    });
    const cur = await getCurrentLease(propertyId);
    expect(cur.currentLease).toBeNull();
    expect(cur.currentLeases).toEqual([]);
  });

  it("createLease calls create_property_lease RPC", async () => {
    getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    rpc.mockResolvedValue({ data: { ...leaseRowSnake, tenants: null }, error: null });
    await createLease(propertyId, { tenantId, startDate: "2026-01-01", monthlyRent: 1, depositAmount: 0 });
    expect(rpc).toHaveBeenCalledWith(
      "create_property_lease",
      expect.objectContaining({
        p_payload: expect.objectContaining({ propertyId, tenantId })
      })
    );
  });

  it("cancelLease calls cancel_lease RPC", async () => {
    getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    rpc.mockResolvedValue({
      data: { ...leaseRowSnake, status: "CANCELLED", tenants: null },
      error: null
    });
    const out = await cancelLease(leaseId, {
      cancellationDate: "2026-06-01",
      cancellationReason: "x",
      cancelledBy: "LANDLORD"
    });
    expect(rpc).toHaveBeenCalledWith(
      "cancel_lease",
      expect.objectContaining({
        p_lease_id: leaseId,
        p_cancellation_date: "2026-06-01"
      })
    );
    expect(out.lease.status).toBe("CANCELLED");
  });

  it("hardDeleteLease calls hard_delete_lease RPC", async () => {
    getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    rpc.mockResolvedValue({
      data: { deleted: true, message: "Lease permanently deleted" },
      error: null
    });
    const out = await hardDeleteLease(leaseId);
    expect(rpc).toHaveBeenCalledWith("hard_delete_lease", { p_lease_id: leaseId });
    expect(out.message).toMatch(/permanently deleted/i);
  });

  it("deleteOrArchiveLease calls delete_or_archive_lease RPC", async () => {
    getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    rpc.mockResolvedValue({
      data: { deleted: true, message: "Deleted draft lease" },
      error: null
    });
    const out = await deleteOrArchiveLease(leaseId);
    expect(rpc).toHaveBeenCalledWith("delete_or_archive_lease", { p_lease_id: leaseId });
    expect(out.message).toMatch(/deleted/i);
  });

  it("updateLease updates lease then recurring rule when rent changes", async () => {
    getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    let fromCalls = 0;
    from.mockImplementation((table: string) => {
      if (table === "leases") {
        fromCalls += 1;
        if (fromCalls === 1) {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(() => Promise.resolve({ data: leaseRowSnake, error: null }))
                }))
              }))
            }))
          };
        }
        if (fromCalls === 2) {
          const update = vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn(() =>
                    Promise.resolve({
                      data: { ...leaseRowSnake, monthly_rent: 6000, tenants: leaseRowSnake.tenants },
                      error: null
                    })
                  )
                }))
              }))
            }))
          }));
          return { update };
        }
      }
      if (table === "invoices") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({ count: 0, error: null }))
            }))
          }))
        };
      }
      if (table === "income_entries") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({ count: 0, error: null }))
            }))
          }))
        };
      }
      if (table === "recurring_income_rules") {
        const update = vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ error: null }))
          }))
        }));
        return { update };
      }
      return {};
    });

    const updated = await updateLease(leaseId, { monthlyRent: 6000 });
    expect(updated.monthlyRent).toBe(6000);
  });

  it("mergeLeaseBundleIntoPropertyDetail sets lease aggregates", () => {
    const base = { id: propertyId, aggregateMeta: { counts: {}, alerts: [] } };
    const bundle = {
      leases: [
        {
          id: leaseId,
          monthlyRent: 100,
          displayStatus: "ACTIVE",
          tenant: { id: tenantId, firstName: "J", lastName: "D" }
        }
      ],
      currentLeases: [
        {
          id: leaseId,
          monthlyRent: 100,
          displayStatus: "ACTIVE",
          tenant: { id: tenantId, firstName: "J", lastName: "D" }
        }
      ],
      currentLease: {
        id: leaseId,
        monthlyRent: 100,
        displayStatus: "ACTIVE",
        tenant: { id: tenantId, firstName: "J", lastName: "D" }
      },
      historicalLeases: [],
      historicalLeaseSummaries: []
    };
    const merged = mergeLeaseBundleIntoPropertyDetail(base as Record<string, unknown>, bundle as any);
    expect(merged.combinedMonthlyRentFromLeases).toBe(100);
    expect(merged.occupancyStatus).toBe("OCCUPIED");
    expect((merged.currentTenant as { firstName: string }).firstName).toBe("J");
  });

  it("mergeLeaseBundleIntoPropertyDetail marks duplex with one lease as partially rented", () => {
    const base = {
      propertyType: "DUPLEX",
      investmentType: "LONG_TERM_RENTAL",
      structureTypeId: "duplex"
    };
    const bundle = {
      leases: [{ id: "l1", monthlyRent: 100, displayStatus: "ACTIVE" }],
      currentLeases: [{ id: "l1", monthlyRent: 100, displayStatus: "ACTIVE" }],
      currentLease: { id: "l1", monthlyRent: 100, displayStatus: "ACTIVE" },
      historicalLeases: [],
      historicalLeaseSummaries: []
    };
    const merged = mergeLeaseBundleIntoPropertyDetail(base as Record<string, unknown>, bundle as any, {
      activeUnitCount: 2
    });
    expect(merged.occupancyStatus).toBe("PARTIALLY_OCCUPIED");
    expect(merged.tenantStatus).toBe("Partially rented");
  });

  it("dbToLease maps tenant embed", () => {
    const l = dbToLease(leaseRowSnake as unknown as Record<string, unknown>);
    expect(l.tenant).toBeTruthy();
    expect((l.tenant as { firstName: string }).firstName).toBe("Jane");
  });
});
