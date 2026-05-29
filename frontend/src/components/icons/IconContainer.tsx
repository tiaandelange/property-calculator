import type { LucideIcon } from "lucide-react";
import type React from "react";
import { getIconComponent, isIconName, type IconName } from "./iconRegistry";
import type { IconContainerSize } from "./iconSizes";

/** Theme token accents (primary = purple brand). */
export type IconContainerAccent =
  | "primary"
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info";

/** Human-friendly accent aliases mapped to theme tokens. */
export type IconAccentAlias = "purple" | "green" | "blue" | "amber" | "red" | "neutral";

export type IconContainerAccentInput = IconContainerAccent | IconAccentAlias;

const ACCENT_ALIAS: Record<IconAccentAlias, IconContainerAccent> = {
  purple: "primary",
  green: "success",
  blue: "info",
  amber: "warning",
  red: "danger",
  neutral: "neutral"
};

const SIZE_CLASS: Record<IconContainerSize, string> = {
  sm: "pg-icon-container--sm",
  md: "pg-icon-container--md",
  lg: "pg-icon-container--lg",
  xl: "pg-icon-container--xl"
};

function resolveAccent(accent: IconContainerAccentInput): IconContainerAccent {
  if (accent in ACCENT_ALIAS) return ACCENT_ALIAS[accent as IconAccentAlias];
  return accent as IconContainerAccent;
}

function resolveIcon(icon: IconName | LucideIcon): LucideIcon {
  if (typeof icon === "string" && isIconName(icon)) return getIconComponent(icon);
  return icon as LucideIcon;
}

/**
 * Rounded square container for dashboard / stat / marketing icons.
 * Uses theme soft-fill tokens — no hardcoded colours.
 */
export function IconContainer({
  icon,
  accent = "primary",
  size = "md",
  className,
  strokeWidth = 2,
  iconSize,
  "aria-hidden": ariaHidden = true,
  ...props
}: Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> & {
  icon: IconName | LucideIcon;
  accent?: IconContainerAccentInput;
  size?: IconContainerSize;
  strokeWidth?: number;
  /** Override inner icon size; defaults follow container size. */
  iconSize?: IconContainerSize;
  "aria-hidden"?: boolean;
}) {
  const resolvedAccent = resolveAccent(accent);
  const Icon = resolveIcon(icon);
  const accentClass = resolvedAccent === "primary" ? "" : ` pg-icon-container--${resolvedAccent}`;
  const innerSizeClass = iconSize ? ` pg-icon-container__svg--${iconSize}` : "";

  return (
    <span
      className={["pg-icon-container", SIZE_CLASS[size], accentClass, className].filter(Boolean).join(" ")}
      aria-hidden={ariaHidden}
      {...props}
    >
      <Icon className={`pg-icon-container__svg${innerSizeClass}`} strokeWidth={strokeWidth} aria-hidden />
    </span>
  );
}

/** Semantic wrapper — same as IconContainer with `icon` prop named for clarity. */
export function IconContainerByName({
  icon,
  ...props
}: Omit<React.ComponentProps<typeof IconContainer>, "icon"> & { icon: IconName }) {
  return <IconContainer icon={icon} {...props} />;
}

/** @deprecated Use IconContainer — kept for existing DashboardKit usage. */
export function IconBox({
  children,
  tone = "primary",
  className,
  size = "md",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  children: React.ReactNode;
  tone?: IconContainerAccentInput;
  size?: IconContainerSize;
}) {
  const resolved = resolveAccent(tone);
  const accentClass = resolved === "primary" ? "" : ` pg-icon-container--${resolved}`;
  return (
    <span
      className={["pg-icon-container", SIZE_CLASS[size], accentClass, className].filter(Boolean).join(" ")}
      aria-hidden
      {...props}
    >
      {children}
    </span>
  );
}

export type { IconContainerAccent as IconBoxTone };
