import { Bell, ChevronDown, Search, UserCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { workspacePageTitle } from "../../nav/workspaceNavConfig";
import { PortfolioDashboardFilters } from "./portfolio/PortfolioDashboardFilters";
import { getProperties, getProperty } from "../../api/ownedProperties";

function titleizeEnum(v: string): string {
  const t = v.replace(/_/g, " ").toLowerCase();
  return t.replace(/\b\w/g, (c) => c.toUpperCase());
}

function propertyTypeLabel(p: Record<string, unknown> | null): string | null {
  if (!p) return null;
  const raw = String((p.propertyType ?? p.investmentType ?? "") as string).trim();
  if (!raw) return null;
  return titleizeEnum(raw);
}

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
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const { session, profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const [propertyMenuOpen, setPropertyMenuOpen] = useState(false);
  const propertyMenuRef = useRef<HTMLDivElement | null>(null);
  const [propertyCtx, setPropertyCtx] = useState<null | { id: string; name: string; typeLabel: string | null }>(null);
  const [propertyOptions, setPropertyOptions] = useState<Array<{ id: string; name: string; typeLabel: string | null }>>([]);

  useEffect(() => {
    if (!userMenuOpen) return;
    function onDocMouseDown(e: MouseEvent) {
      if (!userMenuRef.current?.contains(e.target as Node)) setUserMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [userMenuOpen]);

  useEffect(() => {
    if (!propertyMenuOpen) return;
    function onDocMouseDown(e: MouseEvent) {
      if (!propertyMenuRef.current?.contains(e.target as Node)) setPropertyMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [propertyMenuOpen]);

  const title = workspacePageTitle(pathname);
  const isPortfolioDashboard = pathname === "/owned-properties/dashboard";

  const propertyIdFromPath = useMemo(() => {
    const m = /^\/owned-properties\/([^/?#]+)/.exec(pathname);
    if (!m) return null;
    const seg = m[1];
    if (!seg || ["dashboard", "my-properties", "new", "reports", "metrics"].includes(seg)) return null;
    return seg;
  }, [pathname]);

  const showPropertySwitcher = Boolean(propertyIdFromPath);

  useEffect(() => {
    let cancelled = false;
    async function loadPropertyContext() {
      if (!propertyIdFromPath) {
        setPropertyCtx(null);
        setPropertyOptions([]);
        return;
      }
      try {
        const [props, current] = await Promise.all([
          getProperties().catch(() => []),
          getProperty(propertyIdFromPath).catch(() => null)
        ]);
        if (cancelled) return;
        const opt = (props as any[]).map((p) => ({
          id: String(p.id),
          name: String(p.name ?? "Property"),
          typeLabel: propertyTypeLabel(p as Record<string, unknown>)
        }));
        setPropertyOptions(opt);
        if (current) {
          setPropertyCtx({
            id: String((current as any).id ?? propertyIdFromPath),
            name: String((current as any).name ?? "Property"),
            typeLabel: propertyTypeLabel(current as Record<string, unknown>)
          });
        } else {
          const fallback = opt.find((p) => p.id === propertyIdFromPath) ?? null;
          setPropertyCtx(
            fallback
              ? { id: fallback.id, name: fallback.name, typeLabel: fallback.typeLabel }
              : { id: propertyIdFromPath, name: "Property", typeLabel: null }
          );
        }
      } catch {
        if (cancelled) return;
        setPropertyCtx({ id: propertyIdFromPath, name: "Property", typeLabel: null });
      }
    }
    void loadPropertyContext();
    return () => {
      cancelled = true;
    };
  }, [propertyIdFromPath]);

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
        <h1 className="pg-dashboard-mobile-topbar-title">
          {showPropertySwitcher && propertyCtx ? "Properties" : title}
        </h1>
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
      <div className="pg-dashboard-shell-title-block">
        <h1 className="pg-dashboard-shell-header-title">
          {showPropertySwitcher && propertyCtx ? "Properties" : title}
        </h1>
        {showPropertySwitcher && propertyCtx ? (
          <div className="pg-dashboard-shell-title-sub">
            <div className="pg-dashboard-shell-prop-switch" ref={propertyMenuRef}>
              <button
                type="button"
                className="pg-dashboard-shell-prop-switch-btn"
                onClick={() => setPropertyMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={propertyMenuOpen}
              >
                <span className="pg-dashboard-shell-prop-switch-label">
                  {propertyCtx.name}
                  {propertyCtx.typeLabel ? ` · ${propertyCtx.typeLabel}` : null}
                </span>
                <ChevronDown size={16} aria-hidden />
              </button>
              {propertyMenuOpen ? (
                <div className="pg-dashboard-shell-prop-menu" role="menu">
                  {propertyOptions.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="pg-dashboard-shell-prop-menu-item"
                      role="menuitem"
                      onClick={() => {
                        setPropertyMenuOpen(false);
                        const params = new URLSearchParams(search);
                        params.set("tab", params.get("tab") ?? "overview");
                        navigate(`/owned-properties/${p.id}?${params.toString()}`);
                      }}
                    >
                      <span className="pg-dashboard-shell-prop-menu-line">
                        <span className="pg-dashboard-shell-prop-menu-name">{p.name}</span>
                        <span className="pg-dashboard-shell-prop-menu-dot">·</span>
                        <span className="pg-dashboard-shell-prop-menu-type">{p.typeLabel ?? "Property"}</span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
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
