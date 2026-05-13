import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listTenants,
  listTenantsForProperty,
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

vi.mock("../lib/supabaseClient", () => ({
  getSupabase: () => ({
    auth: { getUser },
    from
  })
}));

describe("tenantsSupabase", () => {
  beforeEach(() => {
    getUser.mockReset();
    from.mockReset();
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

  it("listTenantsForProperty runs direct tenants + lease lookups", async () => {
    getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    from.mockImplementation(() => {
      const n = from.mock.calls.length;
      if (n === 1) {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => Promise.resolve({ data: [{ ...tenantRowSnake, property_id: propertyId }], error: null }))
              }))
            }))
          }))
        };
      }
      if (n === 2) {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                in: vi.fn(() => Promise.resolve({ data: [], error: null }))
              }))
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

    const rows = await listTenantsForProperty(propertyId);
    expect(from).toHaveBeenCalledWith("tenants");
    expect(from).toHaveBeenCalledWith("leases");
    expect(rows).toHaveLength(1);
    expect(rows[0].currentLease).toBeNull();
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

  it("createTenant sets user_id on insert", async () => {
    getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    const insert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: tenantRowSnake, error: null }))
      }))
    }));
    from.mockReturnValue({ insert });

    const created = await createTenant({ firstName: "Jane", lastName: "Doe" });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: userId }));
    expect(created.id).toBe(tenantId);
  });

  it("createTenantForProperty includes property_id in insert body", async () => {
    getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    const insert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() =>
          Promise.resolve({
            data: { ...tenantRowSnake, property_id: propertyId },
            error: null
          })
        )
      }))
    }));
    from.mockReturnValue({ insert });

    await createTenantForProperty(propertyId, { firstName: "Jane", lastName: "Doe" });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: userId, property_id: propertyId })
    );
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

  it("deleteTenant hard-deletes when no leases exist", async () => {
    getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    from.mockImplementation((table: string) => {
      if (table === "leases") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                limit: vi.fn(() => Promise.resolve({ data: [], error: null }))
              }))
            }))
          }))
        };
      }
      const eqUser = vi.fn(() => Promise.resolve({ error: null }));
      const eqId = vi.fn(() => ({ eq: eqUser }));
      return { delete: vi.fn(() => ({ eq: eqId })) };
    });

    const out = await deleteTenant(tenantId);
    expect(out.message).toMatch(/Deleted/i);
  });

  it("deleteTenant soft-marks PAST when leases exist", async () => {
    getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    from.mockImplementation((table: string) => {
      if (table === "leases") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                limit: vi.fn(() => Promise.resolve({ data: [{ id: "lease-1" }], error: null }))
              }))
            }))
          }))
        };
      }
      const single = vi.fn(() =>
        Promise.resolve({ data: { ...tenantRowSnake, status: "PAST" }, error: null })
      );
      const update = vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({ single }))
          }))
        }))
      }));
      return { update };
    });

    const out = await deleteTenant(tenantId);
    expect(out.message).toMatch(/past/i);
    expect(out.tenant?.status).toBe("PAST");
  });

  it("linkTenantToProperty updates tenant scoped by user_id", async () => {
    getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    from.mockImplementation((table: string) => {
      if (table === "leases") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                in: vi.fn(() => Promise.resolve({ data: [], error: null }))
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
                  data: { ...tenantRowSnake, property_id: propertyId, status: "ACTIVE" },
                  error: null
                })
              )
            }))
          }))
        }))
      }));
      return { update };
    });

    const { tenant } = await linkTenantToProperty(propertyId, tenantId);
    expect(tenant.propertyId).toBe(propertyId);
  });

  it("linkTenantToProperty surfaces RLS failure (cannot attach to another user property)", async () => {
    getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    from.mockImplementation((table: string) => {
      if (table === "leases") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                in: vi.fn(() => Promise.resolve({ data: [], error: null }))
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
                  data: null,
                  error: { message: "new row violates row-level security policy", code: "42501" }
                })
              )
            }))
          }))
        }))
      }));
      return { update };
    });

    await expect(linkTenantToProperty(propertyId, tenantId)).rejects.toThrow(/row-level security/i);
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
  });
});
