import type { PropertyExpenseCategory } from "@prisma/client";
import { db } from "../../config/db.js";
import { computePropertyBondFinance } from "./property.bond.helpers.js";
import { isCurrentLeaseStatus, leaseDisplayStatus } from "./propertyLease.helpers.js";
import { isExpenseScheduleTemplate } from "./property.recurringExpenseMaterialize.js";
import { utcCalendarMonthBounds } from "./propertyExpenseMonth.helpers.js";

export type StatementRow = {
  id: string;
  date: string;
  description: string;
  type: string;
  debit: number | null;
  credit: number | null;
  balance: number | null;
  source: "INCOME" | "EXPENSE" | "INVOICE";
  sourceId: number;
  status: string;
  actions: string[];
  /** Invoice rows only — unpaid credits display but do not affect running balance until PAID */
  invoiceCountsTowardBalance?: boolean;
  leaseId?: number | null;
  /** EXPENSE rows — category enum for edits */
  expenseCategory?: PropertyExpenseCategory | null;
  bondInterestAmount?: number | null;
  bondPrincipalAmount?: number | null;
  /** INCOME rows — raw fields for inline edit */
  incomeCategory?: string | null;
  incomeDescriptionPlain?: string | null;
  /** INVOICE rows */
  invoiceNumber?: string | null;
  invoiceNotes?: string | null;
};

function propertyExpenseCategoryLabel(category: PropertyExpenseCategory): string {
  const map: Record<PropertyExpenseCategory, string> = {
    RATES_TAXES: "Rates and Taxes",
    WATER: "Water",
    ELECTRICITY: "Electricity",
    LEVIES: "Levies",
    INSURANCE: "Insurance",
    MAINTENANCE: "Maintenance",
    REPAIRS: "Repairs",
    MANAGEMENT_FEES: "Management Fees",
    BOND_PAYMENT: "Bond Payment",
    ACCOUNTING: "Accounting",
    OTHER: "Other"
  };
  return map[category] ?? category;
}

/** Canonical merged ledger for property workspace — no duplicate ids (composite key per row). */
export async function buildPropertyStatement(
  userId: number,
  propertyId: number,
  opts?: { includeExpectedIncomeRows?: boolean; calendarMonth?: string | null }
) {
  const property = await db.property.findFirst({
    where: { id: propertyId, userId },
    include: {
      leases: { include: { tenant: true }, orderBy: { createdAt: "desc" } },
      invoices: { include: { lineItems: true, tenant: true }, orderBy: { createdAt: "desc" } }
    }
  });
  if (!property) return null;

  const includeExpected = opts?.includeExpectedIncomeRows !== false;

  const [incomes, expenses] = await Promise.all([
    db.propertyIncome.findMany({
      where: { userId, propertyId, status: { not: "ARCHIVED" } },
      orderBy: [{ incomeDate: "asc" }, { id: "asc" }]
    }),
    db.propertyExpense.findMany({
      where: { userId, propertyId, status: { not: "ARCHIVED" } },
      orderBy: [{ expenseDate: "asc" }, { id: "asc" }]
    })
  ]);

  const invoices = property.invoices ?? [];

  const rowsUnsorted: StatementRow[] = [];

  for (const inc of incomes) {
    if (inc.status === "EXPECTED" && !includeExpected) continue;
    const credit = inc.status === "RECEIVED" ? inc.amount : null;
    const debit = inc.status === "EXPECTED" ? inc.amount : null;
    rowsUnsorted.push({
      id: `INCOME:${inc.id}`,
      date: inc.incomeDate.toISOString().slice(0, 10),
      description: `${inc.category}: ${inc.description}`,
      type: inc.status === "RECEIVED" ? "Income (received)" : "Income (expected)",
      debit,
      credit,
      balance: null,
      source: "INCOME",
      sourceId: inc.id,
      status: inc.status,
      incomeCategory: inc.category,
      incomeDescriptionPlain: inc.description,
      actions: []
    });
  }

  for (const ex of expenses) {
    if (isExpenseScheduleTemplate(ex)) continue;
    const catLabel = propertyExpenseCategoryLabel(ex.category);
    rowsUnsorted.push({
      id: `EXPENSE:${ex.id}`,
      date: ex.expenseDate.toISOString().slice(0, 10),
      description: ex.description,
      type: ex.isRecurring ? `Expense (recurring — ${catLabel})` : `Expense (${catLabel})`,
      debit: ex.amount,
      credit: null,
      balance: null,
      source: "EXPENSE",
      sourceId: ex.id,
      status: ex.status,
      expenseCategory: ex.category,
      bondInterestAmount: ex.category === "BOND_PAYMENT" ? ex.bondInterestAmount ?? null : null,
      bondPrincipalAmount: ex.category === "BOND_PAYMENT" ? ex.bondPrincipalAmount ?? null : null,
      actions: []
    });
  }

  for (const inv of invoices) {
    if (inv.status === "CANCELLED") continue;
    const paid = inv.status === "PAID";
    rowsUnsorted.push({
      id: `INVOICE:${inv.id}`,
      date: inv.invoiceDate.toISOString().slice(0, 10),
      description: inv.notes?.trim()
        ? `Invoice ${inv.invoiceNumber} — ${inv.notes.trim()}`
        : `Invoice ${inv.invoiceNumber}`,
      type: paid ? "Invoice (paid)" : `Invoice (${inv.status}) — unpaid`,
      debit: null,
      credit: inv.total,
      balance: null,
      source: "INVOICE",
      sourceId: inv.id,
      status: inv.status,
      invoiceCountsTowardBalance: paid,
      leaseId: inv.leaseId ?? null,
      invoiceNumber: inv.invoiceNumber,
      invoiceNotes: inv.notes ?? "",
      actions: []
    });
  }

  rowsUnsorted.sort((a, b) => {
    const da = new Date(a.date).getTime();
    const db = new Date(b.date).getTime();
    if (da !== db) return da - db;
    return a.id.localeCompare(b.id);
  });

  let running = 0;
  const statementRows = rowsUnsorted.map((r) => {
    const debit = r.debit ?? 0;
    let creditForBalance = r.credit ?? 0;
    if (r.source === "INVOICE" && r.status !== "PAID") creditForBalance = 0;
    running += creditForBalance - debit;
    return { ...r, balance: Math.round(running * 100) / 100 };
  });

  const { start: monthStart, end: monthEnd } = utcCalendarMonthBounds(opts?.calendarMonth ?? null, new Date());

  const incomeMonth = incomes.filter((i) => i.incomeDate >= monthStart && i.incomeDate < monthEnd);
  const expenseMonth = expenses.filter((e) => {
    if (e.status !== "ACTIVE") return false;
    if (isExpenseScheduleTemplate(e)) return false;
    const inCalendarMonth = e.expenseDate >= monthStart && e.expenseDate < monthEnd;
    const legacyMonthlyOverlay =
      Boolean(e.isRecurring && e.recurringFrequency === "MONTHLY") &&
      e.recurringScheduleParentId == null &&
      e.recurringMonthAnchor == null &&
      e.recurringStartDate == null;
    return inCalendarMonth || legacyMonthlyOverlay;
  });

  const invoicePaidThisMonth = invoices.filter(
    (inv) => inv.status === "PAID" && inv.invoiceDate >= monthStart && inv.invoiceDate < monthEnd
  );
  const invoiceReceivedMonth = invoicePaidThisMonth.reduce((a, inv) => a + Number(inv.total), 0);

  const receivedThisMonth =
    incomeMonth.filter((i) => i.status === "RECEIVED").reduce((a, i) => a + i.amount, 0) + invoiceReceivedMonth;
  const expectedThisMonth = incomeMonth.filter((i) => i.status === "EXPECTED").reduce((a, i) => a + i.amount, 0);

  const expensesThisMonthOp = expenseMonth.filter((e) => e.category !== "BOND_PAYMENT").reduce((a, e) => a + e.amount, 0);
  const bondFromLedger = expenseMonth.filter((e) => e.category === "BOND_PAYMENT").reduce((a, e) => a + e.amount, 0);
  /** Property profile bond when no ledger/recurring bond row applies this month */
  const bondFromProfile = bondFromLedger <= 0 ? Number(property.monthlyBondPayment ?? 0) : 0;
  const bondThisMonth = bondFromLedger + bondFromProfile;

  const openInvoices = invoices.filter((i) => ["DRAFT", "SENT", "OVERDUE"].includes(i.status));
  const balanceDue = openInvoices.reduce((a, i) => a + i.total, 0);

  const depositHeld = property.leases.reduce((acc, l) => {
    const disp = leaseDisplayStatus({ status: l.status, fixedTermEndDate: l.fixedTermEndDate });
    return acc + (isCurrentLeaseStatus(disp) ? l.depositAmount : 0);
  }, 0);

  const ledgerExpenseDebitTotal = expenseMonth.reduce((a, e) => a + e.amount, 0);
  const netCashFlow = receivedThisMonth - ledgerExpenseDebitTotal - bondFromProfile;

  const bondFinance = computePropertyBondFinance(property);

  return {
    bondFinance,
    property: {
      id: property.id,
      name: property.name,
      investmentType: property.investmentType,
      city: property.city,
      addressLine1: property.addressLine1
    },
    summary: {
      balanceDue: Math.round(balanceDue * 100) / 100,
      expectedThisMonth: Math.round(expectedThisMonth * 100) / 100,
      receivedThisMonth: Math.round(receivedThisMonth * 100) / 100,
      expensesThisMonth: Math.round(expensesThisMonthOp * 100) / 100,
      bondThisMonth: Math.round(bondThisMonth * 100) / 100,
      netCashFlow: Math.round(netCashFlow * 100) / 100,
      depositHeld: Math.round(depositHeld * 100) / 100
    },
    statementRows
  };
}

export async function getCurrentInvoiceForMonth(userId: number, propertyId: number, monthStr?: string | null) {
  const existing = await assertProperty(userId, propertyId);
  if (!existing) return null;

  const ref = monthStr && /^\d{4}-\d{2}$/.test(monthStr) ? new Date(Number(monthStr.slice(0, 4)), Number(monthStr.slice(5, 7)) - 1, 1) : new Date();
  const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);

  const inv = await db.invoice.findFirst({
    where: {
      userId,
      propertyId,
      invoiceDate: { gte: start, lt: end },
      status: { not: "CANCELLED" }
    },
    include: { lineItems: true, tenant: true, lease: true },
    orderBy: { createdAt: "desc" }
  });
  return inv;
}

async function assertProperty(userId: number, propertyId: number) {
  return db.property.findFirst({ where: { id: propertyId, userId } });
}

function expenseDueYmd(expenseDate: Date): string {
  return expenseDate.toISOString().slice(0, 10);
}

/**
 * Tenant rent / invoice-style rows must never appear under landlord charge forecasts,
 * even if stored as PropertyExpense (legacy imports, mistaken entries, or source INVOICE).
 */
function shouldExcludeExpenseFromLandlordCharges(e: { description: string; source: string }): boolean {
  if (e.source === "INVOICE") return true;
  const raw = e.description.trim();
  const t = raw.toLowerCase();
  if (!t) return false;
  if (/^expected\s+rent\b/.test(t)) return true;
  if (/\brecurring\s+income\s+rule\b/.test(t)) return true;
  if (/^recurring\s+invoice\b/.test(t)) return true;
  if (/^invoice\s+line\b/.test(t)) return true;
  // Default draft invoice line label — billing tenants, not a property operating expense
  if (/^monthly\s+rent\s*$/i.test(raw)) return true;
  return false;
}

/**
 * One-off property expenses dated strictly after today (same ledger rows as Expenses).
 * Tenant rent expectations and recurring-income templates are excluded — billing lives under invoices / income.
 */
export async function buildFutureCharges(userId: number, propertyId: number) {
  const property = await assertProperty(userId, propertyId);
  if (!property) return null;

  const todayStr = new Date().toISOString().slice(0, 10);

  const expenses = await db.propertyExpense.findMany({
    where: { userId, propertyId, status: "ACTIVE", isRecurring: false },
    orderBy: [{ expenseDate: "asc" }, { id: "asc" }]
  });

  const items = expenses
    .filter((e) => !shouldExcludeExpenseFromLandlordCharges(e) && expenseDueYmd(e.expenseDate) > todayStr)
    .map((e) => ({
      label: `${propertyExpenseCategoryLabel(e.category)}: ${e.description}`,
      description: e.description,
      amount: Number(e.amount),
      dueDate: expenseDueYmd(e.expenseDate),
      dueMonth: expenseDueYmd(e.expenseDate).slice(0, 7),
      source: `EXPENSE:${e.id}`,
      category: e.category,
      expenseId: e.id
    }));

  return { items };
}

/**
 * Recurring property expenses only (same rows as Expenses with recurring enabled).
 * Lease rent, recurring invoice rules, and recurring income expectations are excluded — those are tenant billing / revenue, not landlord cost charges.
 */
export async function buildRecurringChargesList(userId: number, propertyId: number) {
  const property = await assertProperty(userId, propertyId);
  if (!property) return null;

  const recurringExpenses = await db.propertyExpense.findMany({
    where: { userId, propertyId, status: "ACTIVE", isRecurring: true },
    orderBy: [{ expenseDate: "desc" }, { id: "desc" }]
  });

  const recurring = recurringExpenses
    .filter((e) => !shouldExcludeExpenseFromLandlordCharges(e) && e.category !== "BOND_PAYMENT")
    .map((e) => ({
    kind: "RECURRING_EXPENSE",
    id: e.id,
    description: e.description,
    amount: Number(e.amount),
    frequency: e.recurringFrequency ?? "MONTHLY",
    category: e.category,
    expenseDate: expenseDueYmd(e.expenseDate),
    recurringStartDate: e.recurringStartDate ? e.recurringStartDate.toISOString().slice(0, 10) : null,
    recurringEndDate: e.recurringEndDate ? e.recurringEndDate.toISOString().slice(0, 10) : null,
    recurringOpenEnded: Boolean(e.recurringOpenEnded),
    recurringMonthAnchor: e.recurringMonthAnchor ?? null,
    recurringDayOfMonth: e.recurringDayOfMonth ?? null
  }));

  return { recurringCharges: recurring };
}
