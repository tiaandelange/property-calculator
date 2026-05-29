import type { IconContainerAccent } from "../components/icons/IconContainer";
import type { IconName } from "../components/icons/iconRegistry";

export type HomepageFeatureIconKey = "accurate" | "fast" | "scenarios" | "secure";

type FeatureIconConfig = { icon: IconName; accent: IconContainerAccent };

export const featureIconByKey: Record<HomepageFeatureIconKey, FeatureIconConfig> = {
  accurate: { icon: "accurate", accent: "success" },
  fast: { icon: "fast", accent: "warning" },
  scenarios: { icon: "scenarios", accent: "info" },
  secure: { icon: "secure", accent: "info" }
};

export function getFeatureIconConfig(key: HomepageFeatureIconKey): FeatureIconConfig {
  return featureIconByKey[key];
}
