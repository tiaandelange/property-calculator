import { Fragment } from "react";
import { Link } from "react-router-dom";

export type PageBreadcrumbItem = { label: string; to?: string };

/** Trail segments; last segment is always shown as current (blue bold), never linked. */
export function PageBreadcrumb({ items, ariaLabel = "Breadcrumb" }: { items: PageBreadcrumbItem[]; ariaLabel?: string }) {
  if (!items.length) return null;
  return (
    <nav className="pg-workspace-breadcrumb" aria-label={ariaLabel}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        const node =
          item.to && !isLast ? (
            <Link to={item.to}>{item.label}</Link>
          ) : (
            <span className={isLast ? "pg-workspace-breadcrumb-current" : undefined}>{item.label}</span>
          );
        return (
          <Fragment key={`${item.label}-${i}`}>
            {i > 0 ? (
              <span className="pg-workspace-bc-sep" aria-hidden="true">
                {" / "}
              </span>
            ) : null}
            {node}
          </Fragment>
        );
      })}
    </nav>
  );
}
