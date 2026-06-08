import { snakeRowToCamel } from "../../api/propertyRowMapping";
import { dbToTenant } from "../../api/tenantRowMapping";
import { isCurrentLeaseStatus, leaseDisplayStatus } from "../../utils/leaseDisplay";
import type {
  ApplicantDirectoryMetrics,
  TenantDirectoryMetrics,
  TenantLeaseStatus,
  TenantListItem,
  TenantPaymentStatus
} from "./tenantDirectoryTypes";

type InvoiceRow = {
  tenantId: string;
  dueDate: string;
  status: string;
  total: number;
  paidAt?: string | null;
};

type LeaseRow = {
  id: string;
  tenantId: string;
  propertyId: string;
  startDate?: string | null;
  fixedTermEndDate?: string | null;
  cancellationDate?: string | null;
  monthlyRent?: number | null;
  status?: string | null;
  property?: Record<string, unknown> | null;
};

const PAID_STATUSES = new Set(["PAID", "CANCELLED"]);

export function derivePaymentStatus(invoices: InvoiceRow[], today = new Date()): TenantPaymentStatus {
  const unpaid = invoices.filter((i) => !PAID_STATUSES.has(String(i.status ?? "").toUpperCase()));
  if (!unpaid.length) return "paid";
  if (unpaid.some((i) => new Date(i.dueDate) < today)) return "overdue";
  if (unpaid.length > 1) return "partial";
  return "pending";
}

export function deriveLeaseStatus(lease: LeaseRow | null, today = new Date()): TenantLeaseStatus {
  if (!lease) return "inactive";
  const display = leaseDisplayStatus({
    status: String(lease.status ?? ""),
    fixedTermEndDate: lease.fixedTermEndDate,
    cancellationDate: lease.cancellationDate
  });
  if (!isCurrentLeaseStatus(display)) {
    if (["EXPIRED", "TERMINATED", "CANCELLED"].includes(display)) return "expired";
    return "inactive";
  }
  const end = lease.fixedTermEndDate ? new Date(lease.fixedTermEndDate) : null;
  if (end && !Number.isNaN(end.getTime())) {
    const days = (end.getTime() - today.getTime()) / 86_400_000;
    if (days >= 0 && days <= 30) return "ending_soon";
    if (display === "MONTH_TO_MONTH") return "notice";
  }
  return "active";
}

function pickCurrentLease(leases: LeaseRow[]): LeaseRow | null {
  const sorted = [...leases].sort(
    (a, b) => new Date(String(b.startDate ?? 0)).getTime() - new Date(String(a.startDate ?? 0)).getTime()
  );
  return (
    sorted.find((l) =>
      isCurrentLeaseStatus(
        leaseDisplayStatus({
          status: String(l.status ?? ""),
          fixedTermEndDate: l.fixedTermEndDate,
          cancellationDate: l.cancellationDate
        })
      )
    ) ?? sorted[0] ?? null
  );
}

function propertyAddressFrom(row: Record<string, unknown> | null | undefined): string {
  if (!row) return "";
  const parts = [row.addressLine1, row.suburb, row.city].filter(Boolean).map(String);
  return parts.join(", ");
}

function invoiceRowsFromRaw(rows: Record<string, unknown>[]): InvoiceRow[] {
  return rows.map((r) => {
    const c = snakeRowToCamel(r) as Record<string, unknown>;
    return {
      tenantId: String(c.tenantId ?? ""),
      dueDate: String(c.dueDate ?? ""),
      status: String(c.status ?? ""),
      total: Number(c.total ?? 0),
      paidAt: c.paidAt != null ? String(c.paidAt) : null
    };
  });
}

function leaseRowsFromRaw(rows: Record<string, unknown>[]): LeaseRow[] {
  return rows.map((r) => {
    const c = snakeRowToCamel(r) as Record<string, unknown>;
    const propRel = c.properties ?? c.property;
    let property: Record<string, unknown> | null = null;
    if (propRel && typeof propRel === "object" && !Array.isArray(propRel)) {
      property = snakeRowToCamel(propRel as Record<string, unknown>);
    }
    return {
      id: String(c.id ?? ""),
      tenantId: String(c.tenantId ?? ""),
      propertyId: String(c.propertyId ?? ""),
      startDate: c.startDate != null ? String(c.startDate) : null,
      fixedTermEndDate: c.fixedTermEndDate != null ? String(c.fixedTermEndDate) : null,
      monthlyRent: c.monthlyRent != null ? Number(c.monthlyRent) : null,
      status: c.status != null ? String(c.status) : null,
      property
    };
  });
}

export function buildTenantDirectory(
  tenantRows: Record<string, unknown>[],
  leaseRows: Record<string, unknown>[],
  invoiceRows: Record<string, unknown>[],
  today = new Date()
): { items: TenantListItem[]; metrics: TenantDirectoryMetrics } {
  const leases = leaseRowsFromRaw(leaseRows);
  const invoices = invoiceRowsFromRaw(invoiceRows);

  const leasesByTenant = new Map<string, LeaseRow[]>();
  for (const l of leases) {
    const list = leasesByTenant.get(l.tenantId) ?? [];
    list.push(l);
    leasesByTenant.set(l.tenantId, list);
  }

  const invoicesByTenant = new Map<string, InvoiceRow[]>();
  for (const inv of invoices) {
    const list = invoicesByTenant.get(inv.tenantId) ?? [];
    list.push(inv);
    invoicesByTenant.set(inv.tenantId, list);
  }

  const items: TenantListItem[] = tenantRows.map((row) => {
    const tenant = dbToTenant(row);
    const id = String(tenant.id ?? "");
    const tenantLeases = leasesByTenant.get(id) ?? [];
    const currentLease = pickCurrentLease(tenantLeases);
    const tenantInvoices = invoicesByTenant.get(id) ?? [];

    const propertyFromTenant = tenant.property as Record<string, unknown> | undefined;
    const propertyFromApplied = tenant.appliedProperty as Record<string, unknown> | undefined;
    const propertyFromLease = currentLease?.property ?? null;
    const property = propertyFromLease ?? propertyFromTenant ?? propertyFromApplied ?? null;
    const appliedPropertyId =
      tenant.appliedPropertyId != null
        ? String(tenant.appliedPropertyId)
        : propertyFromApplied?.id != null
          ? String(propertyFromApplied.id)
          : null;

    const unpaid = tenantInvoices.filter((i) => !PAID_STATUSES.has(i.status.toUpperCase()));
    const outstandingAmount = unpaid.reduce((sum, i) => sum + (Number.isFinite(i.total) ? i.total : 0), 0);
    const nextDue = unpaid
      .map((i) => new Date(i.dueDate))
      .filter((d) => !Number.isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime())[0];

    const paidInvoices = tenantInvoices
      .filter((i) => i.status.toUpperCase() === "PAID" && i.paidAt)
      .map((i) => new Date(String(i.paidAt)))
      .filter((d) => !Number.isNaN(d.getTime()))
      .sort((a, b) => b.getTime() - a.getTime());

    const display = currentLease
      ? leaseDisplayStatus({
          status: String(currentLease.status ?? ""),
          fixedTermEndDate: currentLease.fixedTermEndDate,
          cancellationDate: currentLease.cancellationDate
        })
      : null;

    return {
      id,
      firstName: String(tenant.firstName ?? ""),
      lastName: String(tenant.lastName ?? ""),
      fullName: `${tenant.firstName ?? ""} ${tenant.lastName ?? ""}`.trim(),
      email: tenant.email != null ? String(tenant.email) : null,
      phone: tenant.phone != null ? String(tenant.phone) : null,
      avatarUrl: null,
      tenantStatus: tenant.status != null ? String(tenant.status) : null,
      propertyId: String(
        currentLease?.propertyId ?? tenant.propertyId ?? appliedPropertyId ?? property?.id ?? ""
      ) || null,
      propertyName: property?.name != null ? String(property.name) : null,
      propertyAddress: propertyAddressFrom(property),
      unitNumber: property?.addressLine2 != null ? String(property.addressLine2) : null,
      leaseId: currentLease?.id ?? null,
      monthlyRent: currentLease?.monthlyRent ?? null,
      leaseStartDate: currentLease?.startDate ?? null,
      leaseEndDate: currentLease?.fixedTermEndDate ?? null,
      leaseStatus: deriveLeaseStatus(currentLease, today),
      leaseDisplayStatus: display,
      paymentStatus: currentLease ? derivePaymentStatus(tenantInvoices, today) : "unknown",
      outstandingAmount: outstandingAmount > 0 ? outstandingAmount : null,
      lastPaymentDate: paidInvoices[0] ? paidInvoices[0].toISOString() : null,
      nextPaymentDueDate: nextDue ? nextDue.toISOString() : null
    } satisfies TenantListItem;
  });

  return {
    items,
    metrics: computeTenantDirectoryMetrics(items, today)
  };
}

export function computeTenantDirectoryMetrics(
  items: TenantListItem[],
  today = new Date()
): TenantDirectoryMetrics {
  const renewalHorizon = new Date(today);
  renewalHorizon.setDate(renewalHorizon.getDate() + 30);

  let activeLeases = 0;
  let renewalsDue = 0;
  let pendingPaymentsTotal = 0;
  let pendingPaymentsCount = 0;

  for (const item of items) {
    if (item.leaseStatus === "active" || item.leaseStatus === "ending_soon" || item.leaseStatus === "notice") {
      activeLeases += 1;
    }
    if (item.leaseEndDate) {
      const end = new Date(item.leaseEndDate);
      if (
        !Number.isNaN(end.getTime()) &&
        end >= today &&
        end <= renewalHorizon &&
        (item.leaseStatus === "active" || item.leaseStatus === "ending_soon")
      ) {
        renewalsDue += 1;
      }
    }
    if (item.paymentStatus === "overdue" || item.paymentStatus === "pending" || item.paymentStatus === "partial") {
      pendingPaymentsCount += 1;
      pendingPaymentsTotal += item.outstandingAmount ?? 0;
    }
  }

  return {
    totalTenants: items.length,
    activeLeases,
    pendingPaymentsTotal,
    pendingPaymentsCount,
    renewalsDue
  };
}

export function computeApplicantDirectoryMetrics(items: TenantListItem[]): ApplicantDirectoryMetrics {
  const applicants = items.filter((item) => String(item.tenantStatus ?? "").toUpperCase() === "APPLICANT");
  return {
    totalApplicants: applicants.length,
    awaitingProperty: applicants.filter((item) => !item.propertyId).length,
    linkedToProperty: applicants.filter((item) => Boolean(item.propertyId)).length,
    readyForLease: applicants.filter((item) => Boolean(item.propertyId) && !item.leaseId).length
  };
}

export function isApplicantListItem(item: TenantListItem): boolean {
  return String(item.tenantStatus ?? "").toUpperCase() === "APPLICANT";
}
