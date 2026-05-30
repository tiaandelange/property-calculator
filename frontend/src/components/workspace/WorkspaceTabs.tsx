import type React from "react";
import { AppSectionTabs, type AppSectionTabItem } from "../ui/AppSectionTabs";

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
  tabs: Array<{ key: string; label: React.ReactNode; to?: string; newTab?: boolean }>;
  /** e.g. { financials: "fin=statement" } — appended only for that tab link */
  extraQueryForTab?: Record<string, string>;
  className?: string;
  style?: React.CSSProperties;
}) {
  const items: AppSectionTabItem[] = tabs.map((t) => ({
    id: t.key,
    label: typeof t.label === "string" ? t.label : String(t.label),
    href: t.to,
    target: t.newTab ? "_blank" : undefined,
    rel: t.newTab ? "noopener noreferrer" : undefined
  }));

  return (
    <AppSectionTabs
      className={className}
      style={style}
      ariaLabel="Property sections"
      activeId={active}
      basePath={basePath}
      extraQueryForTab={extraQueryForTab}
      items={items}
    />
  );
}
