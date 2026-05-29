import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listProperties,
  getProperty,
  createProperty,
  updateProperty,
  deleteProperty,
  dbToProperty,
  propertyToDb
} from "./propertiesSupabase";

const userId = "11111111-1111-1111-1111-111111111111";
const propertyId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

const mockRow = {
  id: propertyId,
  user_id: userId,
  name: "Test House",
  property_type: "HOUSE",
  investment_type: "LONG_TERM_RENTAL",
  address_line1: "1 Main",
  address_line2: null,
  suburb: null,
  city: "Cape Town",
  province: "WC",
  postal_code: null,
  country: "South Africa",
  erf_number: null,
  size_sqm: null,
  bedrooms: null,
  bathrooms: null,
  parking_bays: null,
  purchase_price: 1000000,
  purchase_date: null,
  current_estimated_value: null,
  outstanding_bond_balance: null,
  monthly_bond_payment: null,
  bond_annual_interest_rate_percent: null,
  bond_term_years: null,
  bond_start_date: null,
  bond_remaining_term_months: null,
  bond_interest_portion_override: null,
  bond_principal_portion_override: null,
  total_cash_invested: null,
  bond_costs: null,
  transfer_costs: null,
  holding_period_years: null,
  estimated_selling_cost_percent: null,
  expected_monthly_income: null,
  expected_monthly_expenses: null,
  status: null,
  notes: null,
  land_use: null,
  zoning: null,
  rates_and_taxes_monthly: null,
  levies_monthly: null,
  security_monthly: null,
  maintenance_monthly: null,
  expected_annual_appreciation_percent: null,
  average_daily_rate: null,
  occupancy_rate: null,
  available_nights_per_month: null,
  platform_fee_percent: null,
  cleaning_fees_monthly: null,
  management_fee_percent: null,
  furnishing_value: null,
  monthly_utilities: null,
  rehab_budget: null,
  holding_costs_monthly: null,
  expected_sale_price: null,
  target_sale_date: null,
  project_stage: null,
  after_repair_value: null,
  refinance_amount: null,
  brrrr_stage: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z"
};

const getUser = vi.fn();
const from = vi.fn();

vi.mock("../lib/supabaseClient", () => ({
  getSupabase: () => ({
    auth: { getUser },
    from
  })
}));

describe("propertiesSupabase", () => {
  beforeEach(() => {
    getUser.mockReset();
    from.mockReset();
  });

  it("throws when logged out (no user)", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(listProperties()).rejects.toThrow(/Not signed in/i);
    await expect(getProperty(propertyId)).rejects.toThrow(/Not signed in/i);
    await expect(createProperty({ name: "X" })).rejects.toThrow(/Not signed in/i);
    await expect(updateProperty(propertyId, { name: "Y" })).rejects.toThrow(/Not signed in/i);
    await expect(deleteProperty(propertyId)).rejects.toThrow(/Not signed in/i);
  });

  it("listProperties queries properties scoped to user_id", async () => {
    getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    const queryResult = Promise.resolve({ data: [], error: null });
    const fluent = (): Record<string, unknown> => {
      const chain: Record<string, unknown> = {};
      const self = () => chain;
      for (const method of ["eq", "in", "is", "neq", "order"]) {
        chain[method] = vi.fn(self);
      }
      chain.then = queryResult.then.bind(queryResult);
      return chain;
    };
    from.mockImplementation((table: string) => {
      if (table === "properties") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ data: [mockRow], error: null }))
            }))
          }))
        };
      }
      return { select: vi.fn(() => fluent()) };
    });

    const rows = await listProperties();
    expect(from).toHaveBeenCalledWith("properties");
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(propertyId);
    expect(rows[0]).toHaveProperty("tenantStatus");
    expect(rows[0].occupancyStatus).toBe("VACANT");
  });

  it("getProperty throws when row missing", async () => {
    getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null }))
          }))
        }))
      }))
    });
    await expect(getProperty(propertyId)).rejects.toThrow(/Property not found/);
  });

  it("getProperty returns detail shape when found", async () => {
    getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    from.mockImplementation((table: string) => {
      if (table === "properties") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(() => Promise.resolve({ data: mockRow, error: null }))
              }))
            }))
          }))
        };
      }
      if (table === "leases") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ data: [], error: null }))
            }))
          }))
        };
      }
      if (table === "invoices") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ data: [], error: null }))
            }))
          }))
        };
      }
      return {};
    });
    const p = await getProperty(propertyId);
    expect(p.id).toBe(propertyId);
    expect(p.tenants).toEqual([]);
    expect(p.leases).toEqual([]);
    expect(p.invoices).toEqual([]);
  });

  it("createProperty sets user_id on insert", async () => {
    getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    const insert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: mockRow, error: null }))
      }))
    }));
    from.mockReturnValue({ insert });

    const created = await createProperty({
      name: "New",
      propertyType: "HOUSE",
      investmentType: "LONG_TERM_RENTAL",
      addressLine1: "1 Main",
      city: "Cape Town",
      province: "WC",
      country: "South Africa",
      purchasePrice: 500000
    });
    expect(insert).toHaveBeenCalled();
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: userId }));
    expect(created.id).toBe(propertyId);
  });

  it("updateProperty chains id and user_id filters", async () => {
    getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    const single = vi.fn(() => Promise.resolve({ data: { ...mockRow, name: "Renamed" }, error: null }));
    const select = vi.fn(() => ({ single }));
    const eqUser = vi.fn(() => ({ select }));
    const eqId = vi.fn(() => ({ eq: eqUser }));
    const update = vi.fn(() => ({ eq: eqId }));
    from.mockReturnValue({ update });

    await updateProperty(propertyId, { name: "Renamed" });
    expect(update).toHaveBeenCalled();
    expect(eqId).toHaveBeenCalledWith("id", propertyId);
    expect(eqUser).toHaveBeenCalledWith("user_id", userId);
  });

  it("deleteProperty chains id and user_id filters", async () => {
    getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    const eqUser = vi.fn(() => Promise.resolve({ data: null, error: null }));
    const eqId = vi.fn(() => ({ eq: eqUser }));
    const del = vi.fn(() => ({ eq: eqId }));
    from.mockReturnValue({ delete: del });

    await deleteProperty(propertyId);
    expect(del).toHaveBeenCalled();
    expect(eqId).toHaveBeenCalledWith("id", propertyId);
    expect(eqUser).toHaveBeenCalledWith("user_id", userId);
  });

  it("propertyToDb maps camelCase keys", () => {
    const db = propertyToDb({
      name: "A",
      propertyType: "HOUSE",
      investmentType: "LONG_TERM_RENTAL",
      addressLine1: "St",
      city: "C",
      province: "P",
      country: "South Africa",
      purchasePrice: 1
    });
    expect(db.name).toBe("A");
    expect(db.property_type).toBe("HOUSE");
    expect(db.purchase_price).toBe(1);
  });

  it("dbToProperty list variant adds list enrichments", () => {
    const p = dbToProperty(mockRow as unknown as Record<string, unknown>, "list");
    expect(p.currentLeases).toEqual([]);
    expect(p.tenantStatus).toBe("Vacant");
  });
});
