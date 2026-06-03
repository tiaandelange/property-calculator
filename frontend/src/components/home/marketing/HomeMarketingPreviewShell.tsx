import type { ReactNode } from "react";
import { AppIcon } from "../../icons/AppIcon";
import type { IconName } from "../../icons/iconRegistry";

const RAIL_ICONS: IconName[] = ["portfolio", "property", "leases", "invoices", "statements", "reports", "calculators"];

export function HomeMarketingPreviewShell({
  crumbs,
  chips,
  activeNav = 0,
  compact,
  dense,
  children,
  className = ""
}: {
  crumbs: readonly string[];
  chips?: readonly { label: string; muted?: boolean }[];
  activeNav?: number;
  compact?: boolean;
  dense?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const shellClass = [
    "hm-app-preview__shell",
    compact ? "hm-app-preview__shell--compact" : "",
    dense ? "hm-app-preview__shell--dense" : "",
    className
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="hm-app-preview__frame">
      <div className={shellClass}>
        <aside className="hm-app-preview__rail" aria-hidden>
          {RAIL_ICONS.map((icon, index) => (
            <span
              key={icon}
              className={`hm-app-preview__rail-btn${index === activeNav ? " hm-app-preview__rail-btn--active" : ""}`}
            >
              <AppIcon name={icon} size="sm" />
            </span>
          ))}
        </aside>
        <div className="hm-app-preview__workspace">
          <header className="hm-app-preview__topbar">
            <div className="hm-app-preview__topbar-left">
              {crumbs.map((crumb, index) => (
                <span key={`${crumb}-${index}`} className="hm-app-preview__crumb-wrap">
                  {index > 0 ? <span className="hm-app-preview__crumb-sep">/</span> : null}
                  <span
                    className={
                      index === crumbs.length - 1 ? "hm-app-preview__page-title" : "hm-app-preview__crumb"
                    }
                  >
                    {crumb}
                  </span>
                </span>
              ))}
            </div>
            {chips?.length ? (
              <div className="hm-app-preview__topbar-right">
                {chips.map((chip) => (
                  <span
                    key={chip.label}
                    className={`hm-app-preview__chip${chip.muted ? " hm-app-preview__chip--muted" : ""}`}
                  >
                    {chip.label}
                  </span>
                ))}
              </div>
            ) : null}
          </header>
          {children}
        </div>
      </div>
    </div>
  );
}

export function HomeMarketingPreviewModuleLabel({ children }: { children: string }) {
  return <p className="hm-module-preview__label">{children}</p>;
}
