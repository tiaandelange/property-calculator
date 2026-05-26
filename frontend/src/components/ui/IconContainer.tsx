import type { LucideIcon } from "lucide-react";
import type React from "react";

export type IconContainerAccent = "primary" | "neutral" | "success" | "warning" | "danger" | "info";

export type IconContainerSize = "sm" | "md" | "lg";

const SIZE_CLASS: Record<IconContainerSize, string> = {
  sm: "pg-icon-container--sm",
  md: "pg-icon-container--md",
  lg: "pg-icon-container--lg"
};

/**
 * Rounded square container for dashboard / marketing icons (Lucide).
 */
export function IconContainer({
  icon: Icon,
  accent = "primary",
  size = "md",
  className,
  strokeWidth = 2,
  "aria-hidden": ariaHidden = true,
  ...props
}: Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> & {
  icon: LucideIcon;
  accent?: IconContainerAccent;
  size?: IconContainerSize;
  strokeWidth?: number;
  "aria-hidden"?: boolean;
}) {
  const accentClass = accent === "primary" ? "" : ` pg-icon-container--${accent}`;
  return (
    <span
      className={["pg-icon-container", SIZE_CLASS[size], accentClass, className].filter(Boolean).join(" ")}
      aria-hidden={ariaHidden}
      {...props}
    >
      <Icon className="pg-icon-container__svg" strokeWidth={strokeWidth} aria-hidden />
    </span>
  );
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
  tone?: IconContainerAccent;
  size?: IconContainerSize;
}) {
  const accentClass = tone === "primary" ? "" : ` pg-icon-container--${tone}`;
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
