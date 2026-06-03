import type { UserSubscriptionRecord } from "../../services/userSubscriptionsSupabase";

const STATUS_LABELS: Record<string, string> = {
  trialing: "Trialing",
  active: "Active",
  active_manual: "Active",
  pending_payment: "Pending payment",
  past_due: "Expired",
  cancelled: "Cancelled",
  expired: "Expired"
};

export function formatSubscriptionStatus(status: string): string {
  return STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

export function formatSubscriptionStatusBadgeClass(status: string): string {
  if (status === "trialing" || status === "active" || status === "active_manual") {
    return "pg-settings-badge";
  }
  if (status === "pending_payment" || status === "past_due") {
    return "pg-settings-badge pg-settings-badge--muted";
  }
  return "pg-settings-badge pg-settings-badge--muted";
}

export function formatTrialEndDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

export function formatUsagePeriodRange(period: { start: Date; end: Date }): string {
  const opts: Intl.DateTimeFormatOptions = { dateStyle: "medium" };
  return `${period.start.toLocaleDateString(undefined, opts)} – ${period.end.toLocaleDateString(undefined, opts)}`;
}

export function subscriptionHasPaymentProvider(sub: UserSubscriptionRecord | null): boolean {
  return Boolean(sub?.paymentProvider?.trim() || sub?.paymentSubscriptionId?.trim());
}
