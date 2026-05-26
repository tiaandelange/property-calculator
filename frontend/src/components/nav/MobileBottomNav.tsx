import { Link, useLocation } from "react-router-dom";
import { isWorkspaceNavActive, WORKSPACE_MOBILE_BOTTOM_NAV } from "../../nav/workspaceNavConfig";

export function MobileBottomNav() {
  const { pathname } = useLocation();

  return (
    <nav className="pg-dashboard-bottom-nav" aria-label="Primary mobile navigation">
      {WORKSPACE_MOBILE_BOTTOM_NAV.map((item) => {
        const Icon = item.icon;
        const active = item.to ? isWorkspaceNavActive(pathname, item) : false;
        return (
          <Link
            key={item.id}
            to={item.to!}
            className={`pg-dashboard-bottom-nav-item${active ? " pg-dashboard-bottom-nav-item--active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={22} strokeWidth={active ? 2.25 : 2} aria-hidden />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
