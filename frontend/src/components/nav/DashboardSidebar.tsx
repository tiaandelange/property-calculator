import { useQueryClient } from "@tanstack/react-query";
import { useWorkspaceWordmarkVariant } from "../../hooks/useWorkspaceWordmarkVariant";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AppIcon } from "../../components/icons";
import { ProplyticLogo } from "../brand/ProplyticLogo";
import { useAuth } from "../../contexts/AuthContext";
import { navWarmHandlers } from "../../lib/routePrefetch";
import { useWorkspaceId } from "../../features/queries/useWorkspaceId";
import { isWorkspaceNavActive, WORKSPACE_SIDEBAR_NAV, type WorkspaceNavItem } from "../../nav/workspaceNavConfig";

function SidebarLink({
  item,
  active,
  collapsed,
  onClick,
  onWarm
}: {
  item: WorkspaceNavItem;
  active: boolean;
  collapsed: boolean;
  onClick?: () => void;
  onWarm?: () => ReturnType<typeof navWarmHandlers> | undefined;
}) {
  const className = [
    "pg-dashboard-sidebar-link",
    active ? "pg-dashboard-sidebar-link--active" : "",
    item.disabled ? "pg-dashboard-sidebar-link--disabled" : ""
  ]
    .filter(Boolean)
    .join(" ");

  const icon = <AppIcon name={item.icon} size="lg" strokeWidth={active ? 2.25 : 2} />;
  const label = <span className="pg-dashboard-sidebar-link-label">{item.label}</span>;

  if (!collapsed) {
    if (item.disabled || !item.to) {
      return (
        <span className={className} aria-disabled="true">
          {icon}
          {label}
        </span>
      );
    }
    if (onClick) {
      return (
        <button type="button" className={className} onClick={onClick}>
          {icon}
          {label}
        </button>
      );
    }
    return (
      <Link
        to={item.to}
        className={className}
        aria-current={active ? "page" : undefined}
        {...(onWarm ? onWarm() : {})}
      >
        {icon}
        {label}
      </Link>
    );
  }

  const iconOnly =
    item.disabled || !item.to ? (
      <span className={className} aria-disabled="true" aria-label={item.label}>
        {icon}
      </span>
    ) : onClick ? (
      <button type="button" className={className} onClick={onClick} aria-label={item.label}>
        {icon}
      </button>
    ) : (
      <Link
        to={item.to}
        className={className}
        aria-label={item.label}
        aria-current={active ? "page" : undefined}
        {...(onWarm ? onWarm() : {})}
      >
        {icon}
      </Link>
    );

  return (
    <span className="pg-icon-action-wrap pg-dashboard-sidebar-icon-wrap">
      {iconOnly}
      <span className="pg-icon-action-tooltip pg-dashboard-sidebar-icon-tooltip" role="tooltip">
        {item.label}
      </span>
    </span>
  );
}

export function DashboardSidebar({
  collapsed,
  onCollapsedChange
}: {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceId();
  const wordmarkVariant = useWorkspaceWordmarkVariant();
  const authReady = Boolean(workspaceId);

  const warmRoute = (to?: string) => {
    if (!to) return;
    return navWarmHandlers(to, queryClient, workspaceId ?? null, authReady);
  };

  const logout = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <aside
      className={`pg-dashboard-sidebar${collapsed ? " pg-dashboard-sidebar--collapsed" : ""}`}
      aria-label="Dashboard sidebar"
    >
      <div className="pg-dashboard-sidebar-brand">
        {!collapsed ? (
          <Link to="/owned-properties/dashboard" className="pg-dashboard-sidebar-logo" aria-label="Proplytic — Dashboard">
            <ProplyticLogo mode="compact" title="Proplytic" wordmarkVariant={wordmarkVariant} />
          </Link>
        ) : null}
        <button
          type="button"
          className="pg-dashboard-sidebar-collapse-btn pg-dashboard-shell-icon-btn"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          onClick={() => onCollapsedChange(!collapsed)}
        >
          {collapsed ? <ChevronRight size={20} strokeWidth={2} aria-hidden /> : <ChevronLeft size={20} strokeWidth={2} aria-hidden />}
        </button>
      </div>

      <nav className="pg-dashboard-sidebar-nav" aria-label="Main">
        <ul className="pg-dashboard-sidebar-list">
          {WORKSPACE_SIDEBAR_NAV.map((item) => {
            const active = !item.disabled && isWorkspaceNavActive(pathname, item);
            return (
              <li key={item.id}>
                <SidebarLink item={item} active={active} collapsed={collapsed} onWarm={() => warmRoute(item.to)} />
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="pg-dashboard-sidebar-footer">
        {collapsed ? (
          <span className="pg-icon-action-wrap pg-dashboard-sidebar-icon-wrap">
            <button
              type="button"
              className="pg-dashboard-sidebar-link pg-dashboard-sidebar-logout"
              onClick={() => void logout()}
              aria-label="Log out"
            >
              <AppIcon name="logout" size="lg" strokeWidth={2} />
            </button>
            <span className="pg-icon-action-tooltip pg-dashboard-sidebar-icon-tooltip" role="tooltip">
              Log out
            </span>
          </span>
        ) : (
          <button type="button" className="pg-dashboard-sidebar-link pg-dashboard-sidebar-logout" onClick={() => void logout()}>
            <AppIcon name="logout" size="lg" strokeWidth={2} />
            <span className="pg-dashboard-sidebar-link-label">Log out</span>
          </button>
        )}
      </div>
    </aside>
  );
}
