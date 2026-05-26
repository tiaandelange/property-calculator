import { Bell, ChevronDown, Search, UserCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { workspacePageTitle } from "../../nav/workspaceNavConfig";
import { PortfolioDashboardFilters } from "./portfolio/PortfolioDashboardFilters";

function displayUserName(email: string | undefined, fullName: string | null | undefined): string {
  const name = fullName?.trim();
  if (name) return name;
  if (email) {
    const local = email.split("@")[0];
    if (local) return local.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return "User";
}

export function WorkspaceShellHeader({ mobile = false }: { mobile?: boolean }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { session, profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!userMenuOpen) return;
    function onDocMouseDown(e: MouseEvent) {
      if (!userMenuRef.current?.contains(e.target as Node)) setUserMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [userMenuOpen]);

  const title = workspacePageTitle(pathname);
  const isPortfolioDashboard = pathname === "/owned-properties/dashboard";
  const userLabel = useMemo(
    () => displayUserName(session?.user?.email, profile?.full_name),
    [session?.user?.email, profile?.full_name]
  );

  const onSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) {
      navigate("/owned-properties/my-properties");
      return;
    }
    navigate(`/owned-properties/my-properties?q=${encodeURIComponent(q)}`);
  };

  if (mobile) {
    return (
      <header className="pg-dashboard-mobile-topbar">
        <h1 className="pg-dashboard-mobile-topbar-title">{title}</h1>
        <div className="pg-dashboard-mobile-topbar-actions">
          {isPortfolioDashboard ? <PortfolioDashboardFilters /> : null}
          <button type="button" className="pg-dashboard-shell-icon-btn" aria-label="Notifications">
            <Bell size={20} aria-hidden />
          </button>
          <Link to="/settings" className="pg-dashboard-shell-avatar" aria-label="Account settings">
            <UserCircle size={26} aria-hidden />
          </Link>
        </div>
      </header>
    );
  }

  return (
    <header className="pg-dashboard-shell-header">
      <h1 className="pg-dashboard-shell-header-title">{title}</h1>
      <form className="pg-dashboard-shell-search" onSubmit={onSearchSubmit} role="search">
        <Search size={18} className="pg-dashboard-shell-search-icon" aria-hidden />
        <input
          type="search"
          className="pg-dashboard-shell-search-input"
          placeholder="Search properties, tenants, leases…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search workspace"
        />
      </form>
      <div className="pg-dashboard-shell-header-actions">
        {isPortfolioDashboard ? <PortfolioDashboardFilters /> : null}
        <button type="button" className="pg-dashboard-shell-icon-btn" aria-label="Notifications">
          <Bell size={20} aria-hidden />
        </button>
        <div className="pg-dashboard-shell-user-wrap" ref={userMenuRef}>
          <button
            type="button"
            className="pg-dashboard-shell-user"
            aria-expanded={userMenuOpen}
            aria-haspopup="menu"
            onClick={() => setUserMenuOpen((v) => !v)}
          >
            <span className="pg-dashboard-shell-avatar" aria-hidden>
              <UserCircle size={28} />
            </span>
            <span className="pg-dashboard-shell-user-name">{userLabel}</span>
            <ChevronDown size={16} aria-hidden />
          </button>
          {userMenuOpen ? (
            <div className="pg-dashboard-shell-user-menu" role="menu">
              <Link to="/settings" role="menuitem" className="pg-dashboard-shell-user-menu-item" onClick={() => setUserMenuOpen(false)}>
                Settings
              </Link>
              <Link to="/account" role="menuitem" className="pg-dashboard-shell-user-menu-item" onClick={() => setUserMenuOpen(false)}>
                Account
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
