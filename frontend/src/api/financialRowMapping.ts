import { snakeRowToCamel } from "./propertyRowMapping";

function n(v: unknown): number {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

function s(v: unknown): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  return t === "" ? null : t;
}

function ymdToUtcNoonIso(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return new Date(ymd).toISOString();
  return `${m[1]}-${m[2]}-${m[3]}T12:00:00.000Z`;
}

function coerceIsoDateField(v: unknown): string {
  if (v == null) return new Date(0).toISOString();
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return ymdToUtcNoonIso(v);
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? String(v) : d.toISOString();
  }
  if (v instanceof Date) return v.toISOString();
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? String(v) : d.toISOString();
}

/** Maps `income_entries` row → Express / Prisma-style camelCase for the SPA. */
export function dbToIncome(row: Record<string, unknown>): Record<string, unknown> {
  const c = snakeRowToCamel(row) as Record<string, unknown>;
  return {
    ...c,
    incomeDate: coerceIsoDateField(c.incomeDate),
    createdAt: c.createdAt != null ? coerceIsoDateField(c.createdAt) : c.createdAt,
    updatedAt: c.updatedAt != null ? coerceIsoDateField(c.updatedAt) : c.updatedAt,
    archivedAt: c.archivedAt != null ? coerceIsoDateField(c.archivedAt) : null
  };
}

/** Maps `expense_entries` row → Express / Prisma-style camelCase for the SPA. */
export function dbToExpense(row: Record<string, unknown>): Record<string, unknown> {
  const c = snakeRowToCamel(row) as Record<string, unknown>;
  return {
    ...c,
    isRecurring: Boolean(c.isRecurring),
    expenseDate: coerceIsoDateField(c.expenseDate),
    recurringStartDate:
      c.recurringStartDate != null ? coerceIsoDateField(c.recurringStartDate).slice(0, 10) : c.recurringStartDate,
    recurringEndDate:
      c.recurringEndDate != null ? coerceIsoDateField(c.recurringEndDate).slice(0, 10) : c.recurringEndDate,
    createdAt: c.createdAt != null ? coerceIsoDateField(c.createdAt) : c.createdAt,
    updatedAt: c.updatedAt != null ? coerceIsoDateField(c.updatedAt) : c.updatedAt,
    archivedAt: c.archivedAt != null ? coerceIsoDateField(c.archivedAt) : null
  };
}

export function buildIncomeInsert(
  userId: string,
  propertyId: string,
  input: Record<string, unknown>
): Record<string, unknown> {
  const rawDate = input.incomeDate ?? input.income_date;
  const ymd =
    typeof rawDate === "string"
      ? rawDate.slice(0, 10)
      : rawDate instanceof Date
        ? rawDate.toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);

  return {
    user_id: userId,
    property_id: propertyId,
    tenant_id: input.tenantId == null || input.tenantId === "" ? null : String(input.tenantId),
    lease_id: input.leaseId == null || input.leaseId === "" ? null : String(input.leaseId),
    category: String(input.category ?? "RENT"),
    description: String(input.description ?? ""),
    amount: n(input.amount),
    income_date: ymdToUtcNoonIso(ymd),
    source: String(input.source ?? "MANUAL_FINANCIAL_ENTRY"),
    status: String(input.status ?? "RECEIVED")
  };
}

export function buildExpenseInsert(
  userId: string,
  propertyId: string,
  input: Record<string, unknown>
): Record<string, unknown> {
  const rawDate = input.expenseDate ?? input.expense_date;
  const ymd =
    typeof rawDate === "string"
      ? rawDate.slice(0, 10)
      : rawDate instanceof Date
        ? rawDate.toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);

  return {
    user_id: userId,
    property_id: propertyId,
    category: String(input.category ?? "OTHER"),
    description: String(input.description ?? ""),
    amount: n(input.amount),
    expense_date: ymdToUtcNoonIso(ymd),
    is_recurring: false,
    recurring_frequency: null,
    recurring_schedule_parent_id: null,
    recurring_start_date: null,
    recurring_end_date: null,
    recurring_open_ended: false,
    recurring_month_anchor: null,
    recurring_day_of_month: null,
    source: String(input.source ?? "MANUAL_FINANCIAL_ENTRY"),
    status: String(input.status ?? "ACTIVE")
  };
}

/** PATCH body → snake_case columns (partial). */
export function buildIncomeUpdatePatch(input: Record<string, unknown>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (input.tenantId !== undefined) {
    patch.tenant_id = input.tenantId == null || input.tenantId === "" ? null : String(input.tenantId);
  }
  if (input.leaseId !== undefined) {
    patch.lease_id = input.leaseId == null || input.leaseId === "" ? null : String(input.leaseId);
  }
  if (input.category != null) patch.category = String(input.category);
  if (input.description !== undefined) patch.description = String(input.description ?? "");
  if (input.amount !== undefined) patch.amount = n(input.amount);
  if (input.incomeDate != null) {
    const raw = input.incomeDate;
    const ymd =
      typeof raw === "string" ? raw.slice(0, 10) : raw instanceof Date ? raw.toISOString().slice(0, 10) : "";
    if (ymd) patch.income_date = ymdToUtcNoonIso(ymd);
  }
  if (input.status != null) patch.status = String(input.status);
  if (input.source != null) patch.source = String(input.source);
  return patch;
}

export function buildExpenseUpdatePatch(input: Record<string, unknown>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (input.category != null) patch.category = String(input.category);
  if (input.description !== undefined) patch.description = String(input.description ?? "");
  if (input.amount !== undefined) patch.amount = n(input.amount);
  if (input.expenseDate != null) {
    const raw = input.expenseDate;
    const ymd =
      typeof raw === "string" ? raw.slice(0, 10) : raw instanceof Date ? raw.toISOString().slice(0, 10) : "";
    if (ymd) patch.expense_date = ymdToUtcNoonIso(ymd);
  }
  if (input.status != null) patch.status = String(input.status);
  if (input.source != null) patch.source = String(input.source);
  return patch;
}

export function recurringIncomeRuleToCamel(row: Record<string, unknown>): Record<string, unknown> {
  const c = snakeRowToCamel(row) as Record<string, unknown>;
  return {
    ...c,
    startDate: c.startDate != null ? coerceIsoDateField(c.startDate) : c.startDate,
    endDate: c.endDate != null ? coerceIsoDateField(c.endDate) : c.endDate,
    createdAt: c.createdAt != null ? coerceIsoDateField(c.createdAt) : c.createdAt,
    updatedAt: c.updatedAt != null ? coerceIsoDateField(c.updatedAt) : c.updatedAt
  };
}

export function recurringInvoiceRuleToCamel(row: Record<string, unknown>): Record<string, unknown> {
  const c = snakeRowToCamel(row) as Record<string, unknown>;
  return {
    ...c,
    nextRunDate: c.nextRunDate != null ? coerceIsoDateField(c.nextRunDate) : c.nextRunDate,
    createdAt: c.createdAt != null ? coerceIsoDateField(c.createdAt) : c.createdAt,
    updatedAt: c.updatedAt != null ? coerceIsoDateField(c.updatedAt) : c.updatedAt
  };
}

export function sOpt(v: unknown): string | null {
  return s(v);
}
