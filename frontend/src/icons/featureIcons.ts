import { CheckCircle2, GitBranch, Shield, Zap, type LucideIcon } from "lucide-react";
import type { IconContainerAccent } from "../components/ui/IconContainer";

export type HomepageFeatureIconKey = "accurate" | "fast" | "scenarios" | "secure";

type FeatureIconConfig = { icon: LucideIcon; accent: IconContainerAccent };

export const featureIconByKey: Record<HomepageFeatureIconKey, FeatureIconConfig> = {
  accurate: { icon: CheckCircle2, accent: "success" },
  fast: { icon: Zap, accent: "warning" },
  scenarios: { icon: GitBranch, accent: "info" },
  secure: { icon: Shield, accent: "info" }
};

export function getFeatureIconConfig(key: HomepageFeatureIconKey): FeatureIconConfig {
  return featureIconByKey[key];
}
