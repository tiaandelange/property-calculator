import type { HomepageFeatureIconKey } from "../../icons/featureIcons";
import { getFeatureIconConfig } from "../../icons/featureIcons";
import { IconContainer } from "../ui/IconContainer";

export function HomeFeatureIcon({ iconKey, label }: { iconKey: HomepageFeatureIconKey; label: string }) {
  const { icon, accent } = getFeatureIconConfig(iconKey);
  return (
    <span className="pg-home-feature-icon-slot" aria-hidden="true" title={label}>
      <IconContainer icon={icon} accent={accent} size="lg" />
    </span>
  );
}
