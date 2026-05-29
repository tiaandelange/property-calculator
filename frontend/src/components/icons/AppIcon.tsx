import type { LucideProps } from "lucide-react";
import { getIconComponent, type IconName } from "./iconRegistry";
import { ICON_SIZE_PX, type IconSize } from "./iconSizes";

export type AppIconProps = Omit<LucideProps, "ref"> & {
  name: IconName;
  size?: IconSize;
};

/**
 * Render a semantic icon from the central registry.
 * Colour inherits from CSS via currentColor / stroke.
 */
export function AppIcon({ name, size = "md", strokeWidth = 2, className, ...props }: AppIconProps) {
  const Icon = getIconComponent(name);
  const px = ICON_SIZE_PX[size];
  return <Icon size={px} strokeWidth={strokeWidth} className={className} aria-hidden {...props} />;
}
