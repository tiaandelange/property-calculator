import { dbInvoiceToClient } from "../../api/invoiceRowMapping";
import { snakeRowToCamel } from "../../api/propertyRowMapping";
import type { InvoiceDirectoryRow } from "./invoiceDirectoryTypes";
import { propertyUnitDisplayLabel } from "./propertyUnitDisplayLabel";

function nestedOne(row: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const raw = row[key];
  if (!raw || typeof raw !== "object") return null;
  if (Array.isArray(raw)) {
    const first = raw[0];
    return first && typeof first === "object" ? (snakeRowToCamel(first as Record<string, unknown>) as Record<string, unknown>) : null;
  }
  return snakeRowToCamel(raw as Record<string, unknown>) as Record<string, unknown>;
}

function tenantNameFrom(row: Record<string, unknown>, tenant: Record<string, unknown> | null): string {
  if (tenant) {
    const name = `${String(tenant.firstName ?? tenant.first_name ?? "")} ${String(tenant.lastName ?? tenant.last_name ?? "")}`.trim();
    if (name) return name;
  }
  return "—";
}

function unitLabelFrom(unit: Record<string, unknown> | null): string | null {
  return propertyUnitDisplayLabel(unit);
}

function leaseLabelFrom(lease: Record<string, unknown> | null): string | null {
  if (!lease) return null;
  const start = lease.startDate ?? lease.start_date;
  if (start) return `From ${String(start).slice(0, 10)}`;
  return "Lease";
}

function leaseReferenceFrom(lease: Record<string, unknown> | null): string | null {
  if (!lease) return null;
  const ref = lease.leaseReference ?? lease.lease_reference;
  const trimmed = ref != null ? String(ref).trim() : "";
  return trimmed || null;
}

export function mapInvoiceDirectoryRow(raw: Record<string, unknown>): InvoiceDirectoryRow {
  const tenant = nestedOne(raw, "tenants") ?? nestedOne(raw, "tenant");
  const property = nestedOne(raw, "properties") ?? nestedOne(raw, "property");
  const unit = nestedOne(raw, "property_units") ?? nestedOne(raw, "propertyUnits");
  const lease = nestedOne(raw, "leases") ?? nestedOne(raw, "lease");
  const base = dbInvoiceToClient(raw);
  const total = Number(base.totalAmount ?? base.total ?? 0);
  const balanceDueRaw = base.balanceDue;
  const balanceDue =
    balanceDueRaw != null && Number.isFinite(Number(balanceDueRaw)) ? Number(balanceDueRaw) : total;

  return {
    id: String(base.id ?? ""),
    invoiceNumber: String(base.invoiceNumber ?? base.id ?? ""),
    leaseReference: leaseReferenceFrom(lease),
    tenantId: String(base.tenantId ?? base.primaryTenantId ?? tenant?.id ?? ""),
    tenantName: tenantNameFrom(raw, tenant),
    propertyId: String(base.propertyId ?? property?.id ?? ""),
    propertyName: property?.name != null ? String(property.name) : "—",
    unitId: base.unitId != null ? String(base.unitId) : null,
    unitLabel: unitLabelFrom(unit),
    leaseId: base.leaseId != null ? String(base.leaseId) : null,
    leaseLabel: leaseLabelFrom(lease),
    invoicePeriod: base.invoicePeriod != null ? String(base.invoicePeriod) : null,
    issueDate: base.issueDate != null ? String(base.issueDate) : null,
    dueDate: base.dueDate != null ? String(base.dueDate) : null,
    total,
    balanceDue,
    status: base.status as InvoiceDirectoryRow["status"],
    isEditable: Boolean(base.isEditable),
    hasPdf: Boolean(base.hasPdf),
    invoiceType: String(base.invoiceType ?? "MANUAL")
  };
}
