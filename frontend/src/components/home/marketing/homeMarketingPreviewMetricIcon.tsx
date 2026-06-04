import { IconContainer } from "../../icons/IconContainer";
import {
  getDashboardStatIconConfig,
  inferDashboardStatIconPreset
} from "../../icons/dashboardStatIcons";
import type { IconName } from "../../icons/iconRegistry";

/** Colored stat icon (theme accents) for homepage dashboard previews. */
export function PreviewMetricIcon({ label, icon }: { label: string; icon: string }) {
  const preset = inferDashboardStatIconPreset(label);
  const config = preset
    ? getDashboardStatIconConfig(preset)
    : { icon: icon as IconName, accent: "primary" as const };

  return (
    <IconContainer
      icon={config.icon}
      accent={config.accent}
      size="sm"
      className="hm-app-preview__metric-icon"
    />
  );
}
