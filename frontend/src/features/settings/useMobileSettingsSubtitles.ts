import { useQuery } from "@tanstack/react-query";
import { authFetch } from "../../lib/authFetch";
import { formatStorageBytes } from "../../lib/billing/planStorageLimits";
import { planMarketingName } from "../pricing/pricingPlanDisplay";
import { useSubscriptionDashboardQuery } from "../queries";
import type { MobileSettingsMenuItem } from "./mobileSettingsMenu";
import type { UserSettings } from "./settingsTypes";

const THEME_LABELS = {
  light: "Light",
  dark: "Dark",
  system: "System"
} as const;

type StorageUsageResponse = {
  usedBytes: number;
  limitBytes: number;
};

async function fetchStorageUsage(): Promise<StorageUsageResponse> {
  return authFetch("/api/storage/usage") as Promise<StorageUsageResponse>;
}

export function useMobileSettingsSubtitles(draft: UserSettings | null, fullName: string, email: string) {
  const { data: subscriptionData } = useSubscriptionDashboardQuery();
  const { data: storageData } = useQuery({
    queryKey: ["storage-usage"],
    queryFn: fetchStorageUsage,
    staleTime: 60_000,
    retry: 1
  });

  const planName = (() => {
    const subscription = subscriptionData?.subscription ?? null;
    const plans = subscriptionData?.plans ?? [];
    const selectedPlan =
      subscription != null ? plans.find((p) => p.code === subscription.planCode) : null;
    const starter = plans.find((p) => p.code === "starter");
    const effectivePlan = selectedPlan ?? starter;
    return effectivePlan ? planMarketingName(effectivePlan) : "Free plan";
  })();

  const storageSubtitle =
    storageData && storageData.limitBytes > 0
      ? `${formatStorageBytes(storageData.usedBytes)} of ${formatStorageBytes(storageData.limitBytes)}`
      : undefined;

  const themeSubtitle = draft ? THEME_LABELS[draft.themePreference] : undefined;

  const invoiceSubtitle = draft
    ? draft.autoGenerateInvoices
      ? "Auto-generate on"
      : "Auto-generate off"
    : undefined;

  function subtitleForItem(item: MobileSettingsMenuItem): string | undefined {
    if (item.kind === "link") return item.subtitle;

    switch (item.key) {
      case "profile":
        return email || undefined;
      case "company":
        return fullName || email || undefined;
      case "subscription":
        return planName;
      case "appearance":
        return themeSubtitle;
      case "invoice-banking":
      case "reminders":
        return invoiceSubtitle;
      case "storage":
        return storageSubtitle;
      default:
        return undefined;
    }
  }

  return { subtitleForItem, planName, storageSubtitle, themeSubtitle };
}
