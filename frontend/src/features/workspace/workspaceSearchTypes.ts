export type WorkspaceSearchKind =
  | "property"
  | "tenant"
  | "applicant"
  | "lease"
  | "invoice"
  | "report";

export type WorkspaceSearchHit = {
  kind: WorkspaceSearchKind;
  id: string;
  title: string;
  subtitle: string | null;
  route: string;
};

export type WorkspaceNotificationKind = "rent_overdue" | "rent_due_soon" | "lease_expiring";

export type WorkspaceNotificationSeverity = "danger" | "warning" | "info";

export type WorkspaceNotification = {
  id: string;
  kind: WorkspaceNotificationKind;
  severity: WorkspaceNotificationSeverity;
  title: string;
  subtitle: string | null;
  route: string;
  occurredAt: string;
};

export const WORKSPACE_SEARCH_KIND_LABELS: Record<WorkspaceSearchKind, string> = {
  property: "Property",
  tenant: "Tenant",
  applicant: "Applicant",
  lease: "Lease",
  invoice: "Invoice",
  report: "Report"
};
