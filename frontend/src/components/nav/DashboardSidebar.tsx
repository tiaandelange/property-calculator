import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { ProplyticLogo } from "../brand/ProplyticLogo";
import { useAuth } from "../../contexts/AuthContext";
import { isWorkspaceNavActive, WORKSPACE_SIDEBAR_NAV } from "../../nav/workspaceNavConfig";

export function DashboardSidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const logout = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <aside className="pg-dashboard-sidebar" aria-label="Dashboard sidebar">
      <div className="pg-dashboard-sidebar-brand">
        <Link to="/owned-properties/dashboard" className="pg-dashboard-sidebar-logo" aria-label="Proplytic — Dashboard">
          <ProplyticLogo mode="compact" title="Proplytic" />
        </Link>
      </div>

      <nav className="pg-dashboard-sidebar-nav" aria-label="Main">
        <ul className="pg-dashboard-sidebar-list">
          {WORKSPACE_SIDEBAR_NAV.map((item) => {
            const active = !item.disabled && isWorkspaceNavActive(pathname, item);
            const Icon = item.icon;
            if (item.disabled || !item.to) {
              return (
                <li key={item.id}>
                  <span className="pg-dashboard-sidebar-link pg-dashboard-sidebar-link--disabled" aria-disabled="true">
                    <Icon size={20} strokeWidth={2} aria-hidden />
                    <span>{item.label}</span>
                  </span>
                </li>
              );
            }
            return (
              <li key={item.id}>
                <Link
                  to={item.to}
                  className={`pg-dashboard-sidebar-link${active ? " pg-dashboard-sidebar-link--active" : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon size={20} strokeWidth={active ? 2.25 : 2} aria-hidden />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="pg-dashboard-sidebar-footer">
        <button type="button" className="pg-dashboard-sidebar-link pg-dashboard-sidebar-logout" onClick={() => void logout()}>
          <LogOut size={20} strokeWidth={2} aria-hidden />
          <span>Log out</span>
        </button>
      </div>
    </aside>
  );
}
