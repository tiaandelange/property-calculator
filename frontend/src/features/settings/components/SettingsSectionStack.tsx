import type { ReactNode } from "react";

type SettingsSectionStackProps = {
  children: ReactNode;
  className?: string;
};

/** Vertical stack of cards and accordions within a settings section. */
export function SettingsSectionStack({ children, className }: SettingsSectionStackProps) {
  return (
    <div className={["pg-settings-section-stack", className].filter(Boolean).join(" ")}>{children}</div>
  );
}
