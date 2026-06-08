import type React from "react";
import { Link } from "react-router-dom";
import { isInternalAppPath } from "../../lib/routerLinks";

export type AppSectionTabItem = {
  id: string;
  label: string;
  href?: string;
  target?: string;
  rel?: string;
  disabled?: boolean;
  /** When using tablist semantics, id of the controlled panel element. */
  controls?: string;
};

function tabClassName(active: boolean, className?: string) {
  return ["pg-app-section-tabs__tab", active ? "is-active" : "", className].filter(Boolean).join(" ");
}

function buildTabHref(
  basePath: string | undefined,
  item: AppSectionTabItem,
  extraQueryForTab?: Record<string, string>
): string | undefined {
  if (item.href) return item.href;
  if (!basePath) return undefined;
  const suffix = extraQueryForTab?.[item.id] ? `&${extraQueryForTab[item.id]}` : "";
  return `${basePath}?tab=${encodeURIComponent(item.id)}${suffix}`;
}

function SectionTabLink({
  href,
  active,
  className,
  item,
  asTablist
}: {
  href: string;
  active: boolean;
  className: string;
  item: AppSectionTabItem;
  asTablist: boolean;
}) {
  const useRouterLink = isInternalAppPath(href) && !item.target;

  if (useRouterLink) {
    if (asTablist) {
      return (
        <Link
          to={href}
          role="tab"
          aria-selected={active}
          aria-controls={item.controls}
          className={className}
        >
          {item.label}
        </Link>
      );
    }

    return (
      <Link to={href} className={className} aria-current={active ? "page" : undefined}>
        {item.label}
      </Link>
    );
  }

  if (asTablist) {
    return (
      <a
        href={href}
        role="tab"
        aria-selected={active}
        aria-controls={item.controls}
        className={className}
        target={item.target}
        rel={item.rel}
      >
        {item.label}
      </a>
    );
  }

  return (
    <a
      href={href}
      className={className}
      aria-current={active ? "page" : undefined}
      target={item.target}
      rel={item.rel}
    >
      {item.label}
    </a>
  );
}

export function AppSectionTabs({
  items,
  activeId,
  onSelect,
  basePath,
  extraQueryForTab,
  asTablist = false,
  ariaLabel = "Sections",
  className,
  style
}: {
  items: AppSectionTabItem[];
  activeId: string;
  onSelect?: (id: string) => void;
  basePath?: string;
  extraQueryForTab?: Record<string, string>;
  asTablist?: boolean;
  ariaLabel?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const rootClassName = ["pg-app-section-tabs", className].filter(Boolean).join(" ");

  if (asTablist) {
    return (
      <div className={rootClassName} style={style} role="tablist" aria-label={ariaLabel}>
        {items.map((item) => {
          const active = activeId === item.id;
          const href = buildTabHref(basePath, item, extraQueryForTab);
          if (href) {
            return (
              <SectionTabLink
                key={item.id}
                href={href}
                active={active}
                className={tabClassName(active)}
                item={item}
                asTablist
              />
            );
          }
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={item.controls}
              disabled={item.disabled}
              className={tabClassName(active)}
              onClick={() => onSelect?.(item.id)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <nav className={rootClassName} style={style} aria-label={ariaLabel}>
      {items.map((item) => {
        const active = activeId === item.id;
        const href = buildTabHref(basePath, item, extraQueryForTab);
        if (href) {
          return (
            <SectionTabLink
              key={item.id}
              href={href}
              active={active}
              className={tabClassName(active)}
              item={item}
              asTablist={false}
            />
          );
        }
        return (
          <button
            key={item.id}
            type="button"
            disabled={item.disabled}
            className={tabClassName(active)}
            onClick={() => onSelect?.(item.id)}
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
