import { useMemo } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useSubscriptionDashboardQuery } from "../queries/useSubscriptionQuery";
import {
  computeSubscriptionLimits,
  type ComputedSubscriptionLimits
} from "./subscriptionLimits";

export type SubscriptionLimits = ComputedSubscriptionLimits & {
  isLoading: boolean;
  isError: boolean;
};

export function useSubscriptionLimits(): SubscriptionLimits {
  const { profile } = useAuth();
  const { data, isLoading, isError } = useSubscriptionDashboardQuery();

  const limits = useMemo(
    () =>
      computeSubscriptionLimits({
        plans: data?.plans ?? [],
        subscription: data?.subscription ?? null,
        usage: data?.usage ?? null,
        freeUsesRemaining: profile?.free_uses_remaining,
        role: profile?.role
      }),
    [data?.plans, data?.subscription, data?.usage, profile?.free_uses_remaining, profile?.role]
  );

  return {
    ...limits,
    isLoading,
    isError
  };
}
