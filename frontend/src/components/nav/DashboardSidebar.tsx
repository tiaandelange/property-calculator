import { Link, useLocation, useNavigate } from "react-router-dom";
import { AppIcon } from "../../components/icons";
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
            if (item.disabled || !item.to) {
              return (
                <li key={item.id}>
                  <span className="pg-dashboard-sidebar-link pg-dashboard-sidebar-link--disabled" aria-disabled="true">
                    <AppIcon name={item.icon} size="lg" strokeWidth={2} />
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
                  <AppIcon name={item.icon} size="lg" strokeWidth={active ? 2.25 : 2} />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="pg-dashboard-sidebar-footer">
        <button type="button" className="pg-dashboard-sidebar-link pg-dashboard-sidebar-logout" onClick={() => void logout()}>
          <AppIcon name="logout" size="lg" strokeWidth={2} />
          <span>Log out</span>
        </button>
      </div>
    </aside>
  );
}
