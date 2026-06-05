import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { queryKeys } from "../queryKeys";
import {
  FALLBACK_SUBSCRIPTION_PLANS,
  listActiveSubscriptionPlans,
  type SubscriptionPlanRecord
} from "../../services/subscriptionPlansSupabase";
import { fetchSubscriptionUsageCounts } from "../../services/subscriptionUsageSupabase";
import { getUserSubscriptionForCurrentUser } from "../../services/userSubscriptionsSupabase";
import { useWorkspaceId } from "../../features/queries/useWorkspaceId";
import { computePlanPermissions } from "./planFeatures";
import type { PlanPermissionsSnapshot } from "./planTypes";

export type SubscriptionQueryData = {
  plans: SubscriptionPlanRecord[];
  subscription: Awaited<ReturnType<typeof getUserSubscriptionForCurrentUser>>;
  usage: Awaited<ReturnType<typeof fetchSubscriptionUsageCounts>>;
};

async function loadSubscriptionData(): Promise<SubscriptionQueryData> {
  const [plans, subscription] = await Promise.all([
    listActiveSubscriptionPlans().catch(() => FALLBACK_SUBSCRIPTION_PLANS),
    getUserSubscriptionForCurrentUser()
  ]);
  const usage = await fetchSubscriptionUsageCounts(subscription);
  return { plans, subscription, usage };
}

/** Derive effective entitlements from subscription query data (Starter access when pending_payment). */
export function computeSubscriptionEntitlements(
  data: SubscriptionQueryData | undefined,
  opts?: { freeUsesRemaining?: number | null; role?: string | null }
): PlanPermissionsSnapshot {
  return computePlanPermissions({
    plans: data?.plans ?? FALLBACK_SUBSCRIPTION_PLANS,
    subscription: data?.subscription ?? null,
    usage: data?.usage ?? null,
    freeUsesRemaining: opts?.freeUsesRemaining,
    role: opts?.role
  });
}

/** Loads plan catalog, user_subscriptions row, and usage counts for the signed-in workspace. */
export function useSubscriptionQuery() {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: workspaceId ? queryKeys.subscription(workspaceId) : ["subscription", "anonymous"],
    queryFn: loadSubscriptionData,
    staleTime: 30_000
  });
}

/** Subscription query plus derived entitlement snapshot (requires profile context). */
export function useSubscriptionEntitlements(opts?: {
  freeUsesRemaining?: number | null;
  role?: string | null;
}) {
  const query = useSubscriptionQuery();
  const entitlements = useMemo(
    () => computeSubscriptionEntitlements(query.data, opts),
    [query.data, opts?.freeUsesRemaining, opts?.role]
  );
  return { ...query, entitlements };
}

/** @deprecated Prefer useSubscriptionQuery */
export const useSubscriptionDashboardQuery = useSubscriptionQuery;

export type { SubscriptionQueryData as SubscriptionDashboardData };
