import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AppIcon } from "../../components/icons";
import { ProplyticLogo } from "../brand/ProplyticLogo";
import { useAuth } from "../../contexts/AuthContext";
import { isWorkspaceNavActive, WORKSPACE_SIDEBAR_NAV, type WorkspaceNavItem } from "../../nav/workspaceNavConfig";

function SidebarLink({
  item,
  active,
  collapsed,
  onClick
}: {
  item: WorkspaceNavItem;
  active: boolean;
  collapsed: boolean;
  onClick?: () => void;
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

  const inner =
    item.disabled || !item.to ? (
      <span className={className} aria-disabled="true">
        {icon}
        {label}
      </span>
    ) : onClick ? (
      <button type="button" className={className} onClick={onClick}>
        {icon}
        {label}
      </button>
    ) : (
      <Link to={item.to} className={className} aria-current={active ? "page" : undefined}>
        {icon}
        {label}
      </Link>
    );

  if (!collapsed) {
    return inner;
  }

  return (
    <div className="pg-workspace-rail-tooltip-wrap">
      {inner}
      <span className="pg-workspace-rail-tooltip" role="tooltip">
        {item.label}
      </span>
    </div>
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
            <ProplyticLogo mode="compact" title="Proplytic" />
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
                <SidebarLink item={item} active={active} collapsed={collapsed} />
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="pg-dashboard-sidebar-footer">
        {collapsed ? (
          <div className="pg-workspace-rail-tooltip-wrap">
            <button type="button" className="pg-dashboard-sidebar-link pg-dashboard-sidebar-logout" onClick={() => void logout()}>
              <AppIcon name="logout" size="lg" strokeWidth={2} />
              <span className="pg-dashboard-sidebar-link-label">Log out</span>
            </button>
            <span className="pg-workspace-rail-tooltip" role="tooltip">
              Log out
            </span>
          </div>
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
