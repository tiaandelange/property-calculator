import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listTenants,
  listTenantsForProperty,
  listTenantsEligibleForProperty,
  getTenant,
  createTenant,
  createTenantForProperty,
  updateTenant,
  deleteTenant,
  linkTenantToProperty,
  unlinkTenantFromProperty
} from "./tenantsSupabase";
import { dbToTenant, tenantToDb } from "../api/tenantRowMapping";

const userId = "11111111-1111-1111-1111-111111111111";
const propertyId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const tenantId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

const tenantRowSnake = {
  id: tenantId,
  user_id: userId,
  first_name: "Jane",
  last_name: "Doe",
  email: null,
  phone: null,
  id_number: null,
  emergency_contact_name: null,
  emergency_contact_phone: null,
  status: "ACTIVE",
  property_id: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  properties: null
};

const getUser = vi.fn();
const from = vi.fn();
const rpc = vi.fn();
const storageRemove = vi.fn(() => Promise.resolve({ error: null }));
const storageFrom = vi.fn(() => ({ remove: storageRemove }));

vi.mock("./tenantDocumentsSupabase", () => ({
  listTenantDocumentsOwner: vi.fn(() => Promise.resolve([]))
}));

vi.mock("../lib/supabaseClient", () => ({
  getSupabase: () => ({
    auth: { getUser },
    from,
    rpc,
    storage: { from: storageFrom }
  })
}));

describe("tenantsSupabase", () => {
  beforeEach(() => {
    getUser.mockReset();
    from.mockReset();
    rpc.mockReset();
    storageFrom.mockClear();
    storageRemove.mockClear();
  });

  it("throws when logged out (no user)", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(listTenants()).rejects.toThrow(/Not signed in/i);
    await expect(listTenantsForProperty(propertyId)).rejects.toThrow(/Not signed in/i);
    await expect(getTenant(tenantId)).rejects.toThrow(/Not signed in/i);
    await expect(createTenant({ firstName: "A", lastName: "B" })).rejects.toThrow(/Not signed in/i);
    await expect(createTenantForProperty(propertyId, { firstName: "A", lastName: "B" })).rejects.toThrow(/Not signed in/i);
    await expect(updateTenant(tenantId, { firstName: "A" })).rejects.toThrow(/Not signed in/i);
    await expect(deleteTenant(tenantId)).rejects.toThrow(/Not signed in/i);
    await expect(linkTenantToProperty(propertyId, tenantId)).rejects.toThrow(/Not signed in/i);
    await expect(unlinkTenantFromProperty(propertyId, tenantId)).rejects.toThrow(/Not signed in/i);
  });

  it("listTenants queries tenants with property join", async () => {
    getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    from.mockReturnValue({
      select: vi.fn(() => ({
        order: vi.fn(() => Promise.resolve({ data: [tenantRowSnake], error: null }))
      }))
    });

    const rows = await listTenants();
    expect(from).toHaveBeenCalledWith("tenants");
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(tenantId);
    expect(rows[0].firstName).toBe("Jane");
  });

  it("listTenantsEligibleForProperty returns global tenants without an active lease", async () => {
    getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    const applicant = { ...tenantRowSnake, id: "t-applicant", status: "APPLICANT", property_id: null };
    const past = { ...tenantRowSnake, id: "t-past", status: "PAST", property_id: null };
    from.mockImplementation((table: string) => {
      if (table === "tenants") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() =>
                Promise.resolve({ data: [applicant, past, { ...tenantRowSnake, property_id: propertyId }], error: null })
              )
            }))
          }))
        };
      }
      if (table === "lease_tenants") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: [], error: null }))
          }))
        };
      }
      return { select: vi.fn() };
    });

    const rows = await listTenantsEligibleForProperty(propertyId);
    expect(rows.map((r) => r.id)).toEqual(expect.arrayContaining([tenantId]));
    expect(rows.map((r) => r.id)).not.toContain("t-past");
    expect(rows.map((r) => r.id)).not.toContain("t-applicant");
  });

  it("listTenantsEligibleForProperty excludes tenants with an active lease", async () => {
    getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    from.mockImplementation((table: string) => {
      if (table === "tenants") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ data: [tenantRowSnake], error: null }))
            }))
          }))
        };
      }
      if (table === "lease_tenants") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() =>
              Promise.resolve({
                data: [
                  {
                    tenant_id: tenantId,
                    leases: { property_id: propertyId, status: "ACTIVE", cancellation_date: null }
                  }
                ],
                error: null
              })
            )
          }))
        };
      }
      return { select: vi.fn() };
    });

    const rows = await listTenantsEligibleForProperty(propertyId);
    expect(rows).toHaveLength(0);
  });

  it("listTenantsForProperty derives tenants from leases and lease_tenants", async () => {
    getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    from.mockImplementation((table: string) => {
      if (table === "leases") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() =>
                  Promise.resolve({
                    data: [
                      {
                        id: "lease-1",
                        user_id: userId,
                        property_id: propertyId,
                        tenant_id: tenantId,
                        status: "ACTIVE",
                        start_date: "2026-01-01T00:00:00Z",
                        fixed_term_end_date: null,
                        monthly_rent: 5000,
                        lease_tenants: [
                          {
                            tenant_id: tenantId,
                            role: "primary_tenant",
                            is_primary: true,
                            tenants: tenantRowSnake
                          }
                        ]
                      }
                    ],
                    error: null
                  })
                )
              }))
            }))
          }))
        };
      }
      return { select: vi.fn() };
    });

    const rows = await listTenantsForProperty(propertyId);
    expect(from).toHaveBeenCalledWith("leases");
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(tenantId);
    expect(rows[0].currentLease).not.toBeNull();
  });

  it("getTenant loads tenant and leases", async () => {
    getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    from.mockImplementation((table: string) => {
      if (table === "tenants") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() => Promise.resolve({ data: tenantRowSnake, error: null }))
            }))
          }))
        };
      }
      if (table === "lease_tenants") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({ data: [], error: null }))
            }))
          }))
        };
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ data: [], error: null }))
            }))
          }))
        }))
      };
    });

    const { tenant, currentLease } = await getTenant(tenantId);
    expect(tenant.id).toBe(tenantId);
    expect(tenant.leases).toEqual([]);
    expect(currentLease).toBeNull();
  });

  it("getTenant resolves current lease and property via lease_tenants when tenant has no property_id", async () => {
    const leaseId = "cccccccc-cccc-cccc-cccc-cccccccccccc";
    getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    from.mockImplementation((table: string) => {
      if (table === "tenants") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() => Promise.resolve({ data: tenantRowSnake, error: null }))
            }))
          }))
        };
      }
      if (table === "lease_tenants") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() =>
                Promise.resolve({
                  data: [
                    {
                      leases: {
                        id: leaseId,
                        user_id: userId,
                        tenant_id: null,
                        property_id: propertyId,
                        unit_id: null,
                        status: "ACTIVE",
                        start_date: "2026-01-01",
                        fixed_term_end_date: "2027-01-01",
                        monthly_rent: 10000,
                        rent_due_day: 1,
                        lease_type: "FIXED",
                        lease_reference: "L-1",
                        created_at: "2026-01-01T00:00:00Z",
                        properties: { id: propertyId, name: "Oak House", address_line1: null, suburb: null, city: null }
                      }
                    }
                  ],
                  error: null
                })
              )
            }))
          }))
        };
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ data: [], error: null }))
            }))
          }))
        }))
      };
    });

    const { tenant, currentLease } = await getTenant(tenantId);
    expect(tenant.propertyId).toBeFalsy();
    expect(currentLease).not.toBeNull();
    expect(currentLease?.id).toBe(leaseId);
    expect(currentLease?.propertyId).toBe(propertyId);
    expect((currentLease?.property as { name?: string })?.name).toBe("Oak House");
  });

  it("createTenant sets user_id on insert and defaults status to ACTIVE", async () => {
    getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    const insert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: tenantRowSnake, error: null }))
      }))
    }));
    from.mockReturnValue({ insert });

    const created = await createTenant({ firstName: "Jane", lastName: "Doe" });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: userId, status: "ACTIVE" }));
    expect(created.id).toBe(tenantId);
  });

  it("createTenant accepts APPLICANT status when requested", async () => {
    getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    const insert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: { ...tenantRowSnake, status: "APPLICANT" }, error: null }))
      }))
    }));
    from.mockReturnValue({ insert });

    await createTenant({ firstName: "Jane", lastName: "Doe", status: "APPLICANT" });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: userId, status: "APPLICANT" }));
  });

  it("createTenantForProperty creates a global tenant without property_id", async () => {
    getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    const insert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: tenantRowSnake, error: null }))
      }))
    }));
    from.mockReturnValue({ insert });

    await createTenantForProperty(propertyId, { firstName: "Jane", lastName: "Doe" });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: userId }));
    expect(insert).toHaveBeenCalledWith(expect.not.objectContaining({ property_id: propertyId }));
  });

  it("updateTenant merges existing row then updates with user_id filter", async () => {
    getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    let tenantsPhase: "read" | "write" = "read";
    from.mockImplementation((table: string) => {
      if (table !== "tenants") return {};
      if (tenantsPhase === "read") {
        tenantsPhase = "write";
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(() => Promise.resolve({ data: tenantRowSnake, error: null }))
              }))
            }))
          }))
        };
      }
      const update = vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() =>
                Promise.resolve({
                  data: { ...tenantRowSnake, first_name: "Janet" },
                  error: null
                })
              )
            }))
          }))
        }))
      }));
      return { update };
    });

    const updated = await updateTenant(tenantId, { firstName: "Janet" });
    expect(updated.firstName).toBe("Janet");
  });

  it("deleteTenant calls hard_delete_tenant RPC after storage cleanup", async () => {
    getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    rpc.mockResolvedValue({
      data: { message: "Tenant permanently deleted" },
      error: null
    });
    from.mockImplementation((table: string) => {
      if (table === "invoices") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({ data: [], error: null }))
            }))
          }))
        };
      }
      return {};
    });

    const out = await deleteTenant(tenantId);
    expect(out.message).toMatch(/permanently deleted/i);
    expect(rpc).toHaveBeenCalledWith("hard_delete_tenant", { p_tenant_id: tenantId });
  });

  it("linkTenantToProperty is deprecated", async () => {
    getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    await expect(linkTenantToProperty(propertyId, tenantId)).rejects.toThrow(/creating a lease/i);
  });

  it("unlinkTenantFromProperty blocks when an active lease exists on the property", async () => {
    getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    from.mockImplementation((table: string) => {
      if (table === "leases") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  in: vi.fn(() => ({
                    limit: vi.fn(() => Promise.resolve({ data: [{ id: "l1" }], error: null }))
                  }))
                }))
              }))
            }))
          }))
        };
      }
      return {};
    });

    await expect(unlinkTenantFromProperty(propertyId, tenantId)).rejects.toThrow(/Cancel the current lease/i);
  });

  it("unlinkTenantFromProperty clears property_id when allowed", async () => {
    getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    let leasesCalls = 0;
    from.mockImplementation((table: string) => {
      if (table === "leases") {
        leasesCalls += 1;
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  in: vi.fn(() => ({
                    limit: vi.fn(() => Promise.resolve({ data: [], error: null }))
                  }))
                }))
              }))
            }))
          }))
        };
      }
      const update = vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({ data: { ...tenantRowSnake, property_id: null }, error: null }))
              }))
            }))
          }))
        }))
      }));
      return { update };
    });

    const { tenant } = await unlinkTenantFromProperty(propertyId, tenantId);
    expect(leasesCalls).toBe(1);
    expect(tenant.propertyId).toBeNull();
  });

  it("tenantToDb / dbToTenant map snake_case and camelCase", () => {
    const db = tenantToDb({
      firstName: "A",
      lastName: "B",
      email: "a@b.c",
      propertyId: propertyId
    });
    expect(db.first_name).toBe("A");
    expect(db.property_id).toBe(propertyId);
    const round = dbToTenant({ ...tenantRowSnake, first_name: "A", last_name: "B" });
    expect(round.firstName).toBe("A");
    expect(round.lastName).toBe("B");
    const withApplied = dbToTenant({
      ...tenantRowSnake,
      applied_property: { id: propertyId, name: "Flat 1" }
    });
    expect(withApplied.appliedProperty).toEqual(expect.objectContaining({ id: propertyId, name: "Flat 1" }));
  });
});
