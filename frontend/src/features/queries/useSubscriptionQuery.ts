import { useQuery } from "@tanstack/react-query";
import {
  FALLBACK_SUBSCRIPTION_PLANS,
  listActiveSubscriptionPlans,
  type SubscriptionPlanRecord
} from "../../services/subscriptionPlansSupabase";
import { fetchSubscriptionUsageCounts } from "../../services/subscriptionUsageSupabase";
import { getUserSubscriptionForCurrentUser } from "../../services/userSubscriptionsSupabase";
import { queryKeys } from "../../lib/queryKeys";
import { useWorkspaceId } from "./useWorkspaceId";

export type SubscriptionDashboardData = {
  plans: SubscriptionPlanRecord[];
  subscription: Awaited<ReturnType<typeof getUserSubscriptionForCurrentUser>>;
  usage: Awaited<ReturnType<typeof fetchSubscriptionUsageCounts>>;
};

async function loadSubscriptionDashboard(): Promise<SubscriptionDashboardData> {
  const [plans, subscription] = await Promise.all([
    listActiveSubscriptionPlans().catch(() => FALLBACK_SUBSCRIPTION_PLANS),
    getUserSubscriptionForCurrentUser()
  ]);
  const usage = await fetchSubscriptionUsageCounts(subscription);
  return { plans, subscription, usage };
}

export function useSubscriptionDashboardQuery() {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: workspaceId ? queryKeys.subscription(workspaceId) : ["subscription", "anonymous"],
    queryFn: loadSubscriptionDashboard,
    staleTime: 30_000
  });
}
