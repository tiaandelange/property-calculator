import { ChevronDown, UserCircle } from "lucide-react";
import { ProplyticLogo } from "../brand/ProplyticLogo";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { usePropertyOptionsQuery, usePropertyQuery } from "../../features/queries";
import { WorkspaceGlobalSearch } from "../../features/workspace/WorkspaceGlobalSearch";
import { WorkspaceNotificationsPanel } from "../../features/workspace/WorkspaceNotificationsPanel";
import { workspacePageTitle } from "../../nav/workspaceNavConfig";

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
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const [propertyMenuOpen, setPropertyMenuOpen] = useState(false);
  const propertyMenuRef = useRef<HTMLDivElement | null>(null);

  const propertyOptionsQuery = usePropertyOptionsQuery();

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

  const propertyIdFromPath = useMemo(() => {
    const m = /^\/owned-properties\/([^/?#]+)/.exec(pathname);
    if (!m) return null;
    const seg = m[1];
    if (!seg || ["dashboard", "my-properties", "new", "reports", "metrics"].includes(seg)) return null;
    return seg;
  }, [pathname]);

  const showPropertySwitcher = Boolean(propertyIdFromPath);
  const propertyDetailQuery = usePropertyQuery(propertyIdFromPath ?? undefined, { includeInvoices: false });

  const propertyOptions = useMemo(
    () =>
      (propertyOptionsQuery.data ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        typeLabel: null as string | null
      })),
    [propertyOptionsQuery.data]
  );

  const propertyCtx = useMemo(() => {
    if (!propertyIdFromPath) return null;
    const current = propertyDetailQuery.data as Record<string, unknown> | undefined;
    const fallback = propertyOptions.find((p) => p.id === propertyIdFromPath) ?? null;
    if (current) {
      return {
        id: String(current.id ?? propertyIdFromPath),
        name: String(current.name ?? "Property"),
        typeLabel: propertyTypeLabel(current)
      };
    }
    if (fallback) {
      return { id: fallback.id, name: fallback.name, typeLabel: fallback.typeLabel };
    }
    return { id: propertyIdFromPath, name: "Property", typeLabel: null as string | null };
  }, [propertyDetailQuery.data, propertyIdFromPath, propertyOptions]);

  const userLabel = useMemo(
    () => displayUserName(session?.user?.email, profile?.full_name),
    [session?.user?.email, profile?.full_name]
  );

  if (mobile) {
    return (
      <header className="pg-dashboard-mobile-topbar">
        <Link
          to="/owned-properties/dashboard"
          className="pg-dashboard-mobile-brand-link"
          aria-label="Proplytic — Dashboard"
        >
          <ProplyticLogo mode="icon" width={28} height={28} title="Proplytic" />
        </Link>
        <h1 className="pg-dashboard-mobile-topbar-title">
          {showPropertySwitcher && propertyCtx ? "Properties" : title}
        </h1>
        <div className="pg-dashboard-mobile-topbar-actions">
          <WorkspaceNotificationsPanel />
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
      <WorkspaceGlobalSearch />
      <div className="pg-dashboard-shell-header-actions">
        <WorkspaceNotificationsPanel />
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
