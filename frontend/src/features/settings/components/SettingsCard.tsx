import type { ReactNode } from "react";

type SettingsCardProps = {
  children: ReactNode;
  className?: string;
};

/** Primary settings group — shared border, radius, and padding. */
export function SettingsCard({ children, className }: SettingsCardProps) {
  return (
    <div
      className={["pg-settings-card", "pg-settings-card--fields", className].filter(Boolean).join(" ")}
    >
      {children}
    </div>
  );
}
