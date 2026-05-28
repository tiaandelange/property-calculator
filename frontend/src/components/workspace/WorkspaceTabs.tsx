import type React from "react";
import { Link } from "react-router-dom";

export function WorkspaceTabs({
  basePath,
  active,
  tabs,
  extraQueryForTab,
  className,
  style
}: {
  basePath: string;
  active: string;
  tabs: Array<{ key: string; label: React.ReactNode; to?: string; newTab?: boolean; variant?: "primary" | "secondary" | "ghost" | "danger" }>;
  /** e.g. { financials: "fin=statement" } — appended only for that tab link */
  extraQueryForTab?: Record<string, string>;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={className}
      style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        marginBottom: 12,
        ...style
      }}
    >
      {tabs.map((t) => {
        const suffix = extraQueryForTab?.[t.key] ? `&${extraQueryForTab[t.key]}` : "";
        const href = (t as any).to as string | undefined;
        const newTab = Boolean((t as any).newTab);
        const forceVariant = (t as any).variant as "primary" | "secondary" | "ghost" | "danger" | undefined;
        const cls = `pg-btn ${forceVariant ? `pg-btn-${forceVariant}` : active === t.key ? "pg-btn-primary" : "pg-btn-ghost"}`;

        if (href) {
          return (
            <Link
              key={t.key}
              to={href}
              className={cls}
              target={newTab ? "_blank" : undefined}
              rel={newTab ? "noopener noreferrer" : undefined}
            >
              {t.label}
            </Link>
          );
        }

        return (
          <Link key={t.key} to={`${basePath}?tab=${t.key}${suffix}`} className={cls}>
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}

