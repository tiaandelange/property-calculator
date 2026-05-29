/** Maps domain status strings to shared Proplytic table badge variants. */

export type ProplyticStatusVariant =
  | "success"
  | "warning"
  | "danger"
  | "neutral"
  | "primary"
  | "info";

const STATUS_VARIANT: Record<string, ProplyticStatusVariant> = {
  draft: "neutral",
  generated: "warning",
  sent: "primary",
  due: "warning",
  unpaid: "warning",
  partially_paid: "warning",
  paid: "success",
  overdue: "danger",
  cancelled: "neutral",
  void: "neutral",
  active: "success",
  inactive: "neutral",
  pending: "warning",
  vacant: "neutral",
  occupied: "success",
  linked: "success",
  unlinked: "neutral",
  paused: "neutral",
  expected: "warning",
  received: "success",
  posted: "success",
  month_to_month: "info",
  fixed_term: "primary",
  primary_tenant: "primary",
  co_tenant: "info"
};

const STATUS_LABEL: Record<string, string> = {
  generated: "Draft",
  partially_paid: "Partially paid",
  month_to_month: "Month to month",
  fixed_term: "Fixed term",
  due_soon: "Due soon"
};

export function normalizeStatusKey(status: unknown): string {
  return String(status ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

export function proplyticStatusVariant(status: unknown): ProplyticStatusVariant {
  const key = normalizeStatusKey(status);
  return STATUS_VARIANT[key] ?? "neutral";
}

export function proplyticStatusLabel(status: unknown): string {
  const key = normalizeStatusKey(status);
  if (STATUS_LABEL[key]) return STATUS_LABEL[key];
  if (!key) return "—";
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
