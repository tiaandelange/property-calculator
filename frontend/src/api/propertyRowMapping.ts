/**
 * Maps between SPA camelCase (legacy Express / Prisma shape) and Supabase `public.properties` snake_case rows.
 */

const PROPERTY_TYPE_ENUM = new Set([
  "HOUSE",
  "APARTMENT",
  "TOWNHOUSE",
  "DUPLEX",
  "ROOM",
  "COMMERCIAL",
  "OTHER"
]);

const INVESTMENT_TYPE_ENUM = new Set([
  "LONG_TERM_RENTAL",
  "SHORT_TERM_RENTAL",
  "PRIMARY_RESIDENCE",
  "HOUSE_HACK",
  "BRRRR",
  "FLIP",
  "VACANT_LAND",
  "COMMERCIAL",
  "MIXED_USE",
  "OTHER"
]);

const LAND_USE_ENUM = new Set(["RESIDENTIAL", "AGRICULTURAL", "COMMERCIAL", "INDUSTRIAL", "OTHER"]);
const FLIP_STAGE_ENUM = new Set(["ACQUISITION", "RENOVATION", "FOR_SALE", "SOLD"]);
const BRRRR_STAGE_ENUM = new Set(["ACQUISITION", "RENOVATION", "RENTED", "REFINANCED"]);

function enumOrNull(raw: string | null, allowed: Set<string>): string | null {
  if (!raw) return null;
  const u = raw.toUpperCase();
  return allowed.has(u) ? u : null;
}

function n(v: unknown): number | null {
  if (v === "" || v == null) return null;
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : null;
}

function i(v: unknown): number | null {
  const x = n(v);
  if (x == null) return null;
  return Math.trunc(x);
}

function s(v: unknown): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  return t === "" ? null : t;
}

function d(v: unknown): string | null {
  const t = s(v);
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  if (t.includes("T")) return t.slice(0, 10);
  return t;
}

function coercePropertyType(body: Record<string, unknown>): string {
  const raw = String(body.propertyType ?? "OTHER").toUpperCase();
  return PROPERTY_TYPE_ENUM.has(raw) ? raw : "OTHER";
}

function coerceInvestmentType(body: Record<string, unknown>): string {
  const raw = String(body.investmentType ?? "LONG_TERM_RENTAL").toUpperCase();
  return INVESTMENT_TYPE_ENUM.has(raw) ? raw : "LONG_TERM_RENTAL";
}

/** Core column map from SPA body → snake_case (no `user_id`). */
export function buildPropertyFieldsFromBody(body: Record<string, unknown>): Record<string, unknown> {
  const purchasePrice = n(body.purchasePrice);
  return {
    name: s(body.name) ?? "",
    property_type: coercePropertyType(body),
    investment_type: coerceInvestmentType(body),
    address_line1: s(body.addressLine1) ?? "",
    address_line2: s(body.addressLine2),
    suburb: s(body.suburb),
    city: s(body.city) ?? "",
    province: s(body.province) ?? "",
    postal_code: s(body.postalCode),
    country: s(body.country) ?? "South Africa",
    erf_number: s(body.erfNumber),
    size_sqm: n(body.sizeSqm),
    bedrooms: i(body.bedrooms),
    bathrooms: i(body.bathrooms),
    parking_bays: i(body.parkingBays),
    purchase_price: purchasePrice ?? 0,
    purchase_date: d(body.purchaseDate),
    current_estimated_value: n(body.currentEstimatedValue),
    outstanding_bond_balance: n(body.outstandingBondBalance),
    monthly_bond_payment: n(body.monthlyBondPayment),
    bond_annual_interest_rate_percent: n(body.bondAnnualInterestRatePercent),
    bond_term_years: i(body.bondTermYears),
    bond_start_date: d(body.bondStartDate),
    bond_remaining_term_months: i(body.bondRemainingTermMonths),
    bond_interest_portion_override: n(body.bondInterestPortionOverride),
    bond_principal_portion_override: n(body.bondPrincipalPortionOverride),
    total_cash_invested: n(body.totalCashInvested),
    bond_costs: n(body.bondCosts),
    transfer_costs: n(body.transferCosts),
    holding_period_years: i(body.holdingPeriodYears),
    estimated_selling_cost_percent: n(body.estimatedSellingCostPercent),
    expected_monthly_income: n(body.expectedMonthlyIncome),
    expected_monthly_expenses: n(body.expectedMonthlyExpenses),
    status: s(body.status),
    notes: s(body.notes),
    land_use: enumOrNull(s(body.landUse), LAND_USE_ENUM),
    zoning: s(body.zoning),
    rates_and_taxes_monthly: n(body.ratesAndTaxesMonthly),
    levies_monthly: n(body.leviesMonthly),
    security_monthly: n(body.securityMonthly),
    maintenance_monthly: n(body.maintenanceMonthly),
    expected_annual_appreciation_percent: n(body.expectedAnnualAppreciationPercent),
    average_daily_rate: n(body.averageDailyRate),
    occupancy_rate: n(body.occupancyRate),
    available_nights_per_month: i(body.availableNightsPerMonth),
    platform_fee_percent: n(body.platformFeePercent),
    cleaning_fees_monthly: n(body.cleaningFeesMonthly),
    management_fee_percent: n(body.managementFeePercent),
    furnishing_value: n(body.furnishingValue),
    monthly_utilities: n(body.monthlyUtilities),
    rehab_budget: n(body.rehabBudget),
    holding_costs_monthly: n(body.holdingCostsMonthly),
    expected_sale_price: n(body.expectedSalePrice),
    target_sale_date: body.targetSaleDate ? d(body.targetSaleDate) : null,
    project_stage: enumOrNull(s(body.projectStage), FLIP_STAGE_ENUM),
    after_repair_value: n(body.afterRepairValue),
    refinance_amount: n(body.refinanceAmount),
    brrrr_stage: enumOrNull(s(body.brrrrStage), BRRRR_STAGE_ENUM),
    structure_type_id: s(body.structureTypeId)
  };
}

/** Insert row including `user_id` for RLS and FK to `profiles`. */
export function buildPropertyInsertRow(userId: string, body: Record<string, unknown>): Record<string, unknown> {
  return {
    user_id: userId,
    ...buildPropertyFieldsFromBody(body)
  };
}

/** Full replace-style update payload (all mapped columns). */
export function buildPropertyUpdatePatch(body: Record<string, unknown>): Record<string, unknown> {
  return buildPropertyFieldsFromBody(body);
}

function camelKey(snake: string): string {
  return snake.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

/** Convert a Supabase row (snake keys) to a plain object with camelCase keys (shallow). */
export function snakeRowToCamel<T extends Record<string, unknown>>(row: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[camelKey(k)] = v;
  }
  return out;
}

/** List card shape — occupancy/lease placeholders; financials filled in `listProperties` enrichment. */
export function enrichPropertyListItem(base: Record<string, unknown>): Record<string, unknown> {
  return {
    ...base,
    tenantStatus: "Vacant",
    occupancyStatus: "VACANT",
    leaseDisplayStatus: "VACANT",
    currentLeases: [],
    currentTenant: null,
    currentLease: null,
    allTenantsCount: 0,
    rentOverdue: false,
    rentDueSoon: false,
    leaseExpiringSoon: false,
    leaseMonthToMonth: false,
    invoices: []
  };
}

/** Detail tab shape — empty relations until other entities are migrated. */
export function enrichPropertyDetail(base: Record<string, unknown>): Record<string, unknown> {
  const list = enrichPropertyListItem(base);
  return {
    ...list,
    tenants: [],
    leases: [],
    documents: [],
    incomeEntries: [],
    expenses: [],
    recurringIncomeRules: [],
    financialSummary: null,
    combinedMonthlyRentFromLeases: 0,
    aggregateMeta: {
      alerts: [],
      counts: {},
      recentIncome: [],
      recentExpenses: [],
      historicalLeaseSummaries: []
    }
  };
}
