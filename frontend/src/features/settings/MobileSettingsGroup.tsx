import type { ReactNode } from "react";

type MobileSettingsGroupProps = {
  label: string;
  children: ReactNode;
};

export function MobileSettingsGroup({ label, children }: MobileSettingsGroupProps) {
  return (
    <section className="pg-settings-mobile-group" aria-label={label}>
      <h2 className="pg-settings-mobile-group__label">{label}</h2>
      <div className="pg-settings-mobile-group__card">{children}</div>
    </section>
  );
}
