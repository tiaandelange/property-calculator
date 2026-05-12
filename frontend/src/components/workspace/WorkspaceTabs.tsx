import { Link } from "react-router-dom";

export function WorkspaceTabs({
  basePath,
  active,
  tabs,
  extraQueryForTab
}: {
  basePath: string;
  active: string;
  tabs: Array<{ key: string; label: string }>;
  /** e.g. { financials: "fin=statement" } — appended only for that tab link */
  extraQueryForTab?: Record<string, string>;
}) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
      {tabs.map((t) => {
        const suffix = extraQueryForTab?.[t.key] ? `&${extraQueryForTab[t.key]}` : "";
        return (
          <Link key={t.key} to={`${basePath}?tab=${t.key}${suffix}`} className={`pg-btn ${active === t.key ? "pg-btn-primary" : "pg-btn-ghost"}`}>
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}

