import type { ReactNode } from "react";

type SettingsSaveBarProps = {
  children: ReactNode;
  mobile?: boolean;
};

export function SettingsSaveBar({ children, mobile }: SettingsSaveBarProps) {
  return (
    <div
      className={[
        "pg-settings-save-bar",
        mobile ? "pg-settings-save-bar--mobile" : "pg-settings-save-bar--desktop"
      ].join(" ")}
      role="group"
      aria-label="Save settings"
    >
      {children}
    </div>
  );
}
