import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../queryKeys";
import {
  FALLBACK_SUBSCRIPTION_PLANS,
  listActiveSubscriptionPlans,
  type SubscriptionPlanRecord
} from "../../services/subscriptionPlansSupabase";
import { fetchSubscriptionUsageCounts } from "../../services/subscriptionUsageSupabase";
import { getUserSubscriptionForCurrentUser } from "../../services/userSubscriptionsSupabase";
import { useWorkspaceId } from "../../features/queries/useWorkspaceId";

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

/** Loads plan catalog, user_subscriptions row, and usage counts for the signed-in workspace. */
export function useSubscriptionQuery() {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: workspaceId ? queryKeys.subscription(workspaceId) : ["subscription", "anonymous"],
    queryFn: loadSubscriptionData,
    staleTime: 30_000
  });
}

/** @deprecated Prefer useSubscriptionQuery */
export const useSubscriptionDashboardQuery = useSubscriptionQuery;

export type { SubscriptionQueryData as SubscriptionDashboardData };
