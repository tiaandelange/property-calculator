export type TenantLinkRole = "primary_tenant" | "co_tenant" | "spouse" | "occupant" | "guarantor";

export type TenantLinkStatus = "draft" | "active" | "pending" | "ended" | "removed";

export type TenantUnitLinkRecord = {
  id: string;
  propertyId: string;
  unitId: string | null;
  tenantId: string;
  leaseId: string | null;
  role: TenantLinkRole;
  status: TenantLinkStatus;
  isPrimary: boolean;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  createdAt?: string;
  updatedAt?: string;
  tenant?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    status: string;
  };
  lease?: {
    id: string;
    status: string;
    displayStatus?: string;
    monthlyRent?: number;
  } | null;
};

export const TENANT_LINK_ROLE_OPTIONS: { value: TenantLinkRole; label: string }[] = [
  { value: "primary_tenant", label: "Primary Tenant" },
  { value: "co_tenant", label: "Co-Tenant" },
  { value: "spouse", label: "Spouse" },
  { value: "occupant", label: "Occupant" },
  { value: "guarantor", label: "Guarantor" }
];

export const TENANT_LINK_STATUS_OPTIONS: { value: TenantLinkStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
  { value: "ended", label: "Ended" },
  { value: "removed", label: "Removed" }
];

export type VettingDisplayStatus = "Vetted" | "Pending" | "Failed" | "Not Started";

export function vettingStatusFromTenant(tenantStatus: string | undefined | null): VettingDisplayStatus {
  const s = String(tenantStatus ?? "").toUpperCase();
  if (s === "ACTIVE") return "Vetted";
  if (s === "APPLICANT") return "Pending";
  if (s === "PAST") return "Not Started";
  return "Not Started";
}

export function vettingBadgeClass(status: VettingDisplayStatus): string {
  if (status === "Vetted") return "pg-pfin-badge pg-pfin-badge--success";
  if (status === "Pending") return "pg-pfin-badge pg-pfin-badge--warning";
  if (status === "Failed") return "pg-pfin-badge pg-pfin-badge--danger";
  return "pg-pfin-badge pg-pfin-badge--muted";
}

export function linkStatusBadgeClass(status: TenantLinkStatus): string {
  if (status === "active") return "pg-pfin-badge pg-pfin-badge--success";
  if (status === "pending") return "pg-pfin-badge pg-pfin-badge--warning";
  if (status === "draft") return "pg-pfin-badge pg-pfin-badge--info";
  if (status === "ended" || status === "removed") return "pg-pfin-badge pg-pfin-badge--muted";
  return "pg-pfin-badge pg-pfin-badge--muted";
}

export function unitOccupancyBadgeClass(label: string): string {
  if (label === "Occupied") return "pg-pfin-badge pg-pfin-badge--success";
  if (label === "Partially Occupied") return "pg-pfin-badge pg-pfin-badge--info";
  if (label === "Unavailable") return "pg-pfin-badge pg-pfin-badge--muted";
  return "pg-pfin-badge pg-pfin-badge--warning";
}
