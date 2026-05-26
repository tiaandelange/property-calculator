import { isCurrentLeaseStatus } from "../../utils/leaseDisplay";
import { deriveLeaseStatus } from "../tenants/tenantDirectoryAdapter";
import type { LeaseDirectoryMetrics, LeaseListItem } from "./leaseDirectoryTypes";

function propertyAddressFrom(row: Record<string, unknown> | null | undefined): string {
  if (!row) return "";
  const parts = [row.addressLine1, row.suburb, row.city].filter(Boolean).map(String);
  return parts.join(", ");
}

export function buildLeaseDirectory(
  leaseRows: Record<string, unknown>[],
  today = new Date()
): { items: LeaseListItem[]; metrics: LeaseDirectoryMetrics } {
  const items: LeaseListItem[] = leaseRows.map((lease) => {
    const tenant = (lease.tenant as Record<string, unknown> | null) ?? null;
    const property = (lease.property as Record<string, unknown> | null) ?? null;
    const display = String(lease.displayStatus ?? lease.status ?? "");
    const lifecycleStatus = deriveLeaseStatus(
      {
        id: String(lease.id ?? ""),
        tenantId: String(lease.tenantId ?? tenant?.id ?? ""),
        propertyId: String(lease.propertyId ?? property?.id ?? ""),
        startDate: lease.startDate != null ? String(lease.startDate) : null,
        fixedTermEndDate: lease.fixedTermEndDate != null ? String(lease.fixedTermEndDate) : null,
        monthlyRent: lease.monthlyRent != null ? Number(lease.monthlyRent) : null,
        status: lease.status != null ? String(lease.status) : null
      },
      today
    );
    const firstName = tenant?.firstName != null ? String(tenant.firstName) : "";
    const lastName = tenant?.lastName != null ? String(tenant.lastName) : "";
    const tenantName = `${firstName} ${lastName}`.trim() || "Unknown tenant";
    const leaseType = String(lease.leaseType ?? "FIXED_TERM");

    return {
      id: String(lease.id ?? ""),
      propertyId: String(lease.propertyId ?? property?.id ?? ""),
      propertyName: property?.name != null ? String(property.name) : "Unknown property",
      propertyAddress: propertyAddressFrom(property),
      tenantId: String(lease.tenantId ?? tenant?.id ?? ""),
      tenantName,
      tenantEmail: tenant?.email != null ? String(tenant.email) : null,
      tenantPhone: tenant?.phone != null ? String(tenant.phone) : null,
      monthlyRent: lease.monthlyRent != null ? Number(lease.monthlyRent) : null,
      depositAmount: lease.depositAmount != null ? Number(lease.depositAmount) : null,
      rentDueDay: lease.rentDueDay != null ? Number(lease.rentDueDay) : null,
      leaseType,
      leaseTypeLabel: leaseType === "MONTH_TO_MONTH" ? "Month-to-month" : "Fixed term",
      startDate: lease.startDate != null ? String(lease.startDate) : null,
      endDate: lease.fixedTermEndDate != null ? String(lease.fixedTermEndDate) : null,
      displayStatus: display,
      lifecycleStatus,
      isCancellable: isCurrentLeaseStatus(display)
    } satisfies LeaseListItem;
  });

  const renewalHorizon = new Date(today);
  renewalHorizon.setDate(renewalHorizon.getDate() + 30);

  let activeLeases = 0;
  let monthlyRentRoll = 0;
  let renewalsDue = 0;

  for (const item of items) {
    const isActive =
      item.lifecycleStatus === "active" ||
      item.lifecycleStatus === "ending_soon" ||
      item.lifecycleStatus === "notice" ||
      isCurrentLeaseStatus(item.displayStatus);

    if (isActive) {
      activeLeases += 1;
      monthlyRentRoll += item.monthlyRent ?? 0;
    }

    if (item.endDate) {
      const end = new Date(item.endDate);
      if (
        !Number.isNaN(end.getTime()) &&
        end >= today &&
        end <= renewalHorizon &&
        (item.lifecycleStatus === "active" || item.lifecycleStatus === "ending_soon")
      ) {
        renewalsDue += 1;
      }
    }
  }

  return {
    items,
    metrics: {
      totalLeases: items.length,
      activeLeases,
      monthlyRentRoll,
      renewalsDue
    }
  };
}
