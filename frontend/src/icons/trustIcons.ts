import { Activity, LayoutGrid, Percent, Shield, Star, type LucideIcon } from "lucide-react";
import type { IconContainerAccent } from "../components/ui/IconContainer";

export type HomepageTrustStatIcon = "activity" | "tools" | "star" | "percent" | "shield";

type TrustIconConfig = { icon: LucideIcon; accent: IconContainerAccent };

export const trustIconByVariant: Record<HomepageTrustStatIcon, TrustIconConfig> = {
  activity: { icon: Activity, accent: "primary" },
  tools: { icon: LayoutGrid, accent: "info" },
  star: { icon: Star, accent: "warning" },
  percent: { icon: Percent, accent: "success" },
  shield: { icon: Shield, accent: "info" }
};

export function getTrustIconConfig(variant: HomepageTrustStatIcon): TrustIconConfig {
  return trustIconByVariant[variant];
}
