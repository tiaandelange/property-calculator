import type { IconContainerAccent } from "../components/icons/IconContainer";
import type { IconName } from "../components/icons/iconRegistry";

export type HomepageTrustStatIcon = "activity" | "tools" | "star" | "percent" | "shield";

type TrustIconConfig = { icon: IconName; accent: IconContainerAccent };

export const trustIconByVariant: Record<HomepageTrustStatIcon, TrustIconConfig> = {
  activity: { icon: "activity", accent: "primary" },
  tools: { icon: "tools", accent: "info" },
  star: { icon: "star", accent: "warning" },
  percent: { icon: "percent", accent: "success" },
  shield: { icon: "shield", accent: "info" }
};

export function getTrustIconConfig(variant: HomepageTrustStatIcon): TrustIconConfig {
  return trustIconByVariant[variant];
}
