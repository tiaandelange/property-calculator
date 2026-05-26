import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Calculator, CircleHelp, LayoutDashboard, Settings, type LucideIcon } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { calculators } from "../../data/calculators";
import { groupCalculators } from "../../data/calculatorHubGroups";
import { useAuth } from "../../contexts/AuthContext";

export type WorkspaceRailProps = {
  userRole?: "USER" | "ADMIN" | null;
};

type RailSection = "home" | "calc" | "settings" | "help";

const HOVER_OPEN_MS = 220;
const HOVER_CLOSE_MS = 180;

function RailLucideIcon({ icon: Icon, active }: { icon: LucideIcon; active: boolean }) {
  return <Icon size={22} strokeWidth={active ? 2.25 : 2} aria-hidden />;
}

export function WorkspaceRail({ userRole }: WorkspaceRailProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const baseId = useId();
  const isAdmin = userRole === "ADMIN";
  const [coarsePointer, setCoarsePointer] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia === "function") {
      setCoarsePointer(window.matchMedia("(pointer: coarse)").matches);
    }
  }, []);

  const [pinned, setPinned] = useState<RailSection | null>(null);
  const pinnedRef = useRef<RailSection | null>(null);
  const [hoverOpen, setHoverOpen] = useState<RailSection | null>(null);
  const hoverTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const railRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    pinnedRef.current = pinned;
  }, [pinned]);

  const flyoutVisible = pinned ?? hoverOpen;

  const clearHoverTimer = () => {
    if (hoverTimerRef.current != null) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  const clearCloseTimer = () => {
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleHoverOpen = (id: RailSection) => {
    if (pinnedRef.current) return;
    clearHoverTimer();
    clearCloseTimer();
    hoverTimerRef.current = window.setTimeout(() => {
      if (!pinnedRef.current) setHoverOpen(id);
      hoverTimerRef.current = null;
    }, HOVER_OPEN_MS);
  };

  const scheduleHoverClose = () => {
    clearHoverTimer();
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      if (!pinnedRef.current) setHoverOpen(null);
      closeTimerRef.current = null;
    }, HOVER_CLOSE_MS);
  };

  const setPinnedSection = useCallback((id: RailSection | null) => {
    clearHoverTimer();
    clearCloseTimer();
    pinnedRef.current = id;
    setPinned(id);
    setHoverOpen(null);
  }, []);

  const closeAll = useCallback(() => {
    clearHoverTimer();
    clearCloseTimer();
    pinnedRef.current = null;
    setPinned(null);
    setHoverOpen(null);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeAll();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeAll]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!railRef.current) return;
      if (e.target instanceof Node && !railRef.current.contains(e.target)) {
        if (pinned) closeAll();
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [pinned, closeAll]);

  const homeActive = useMemo(
    () =>
      location.pathname.startsWith("/dashboard") ||
      location.pathname.startsWith("/owned-properties") ||
      location.pathname.startsWith("/tenants") ||
      location.pathname.startsWith("/leases") ||
      location.pathname.startsWith("/financials") ||
      location.pathname.startsWith("/invoices") || // legacy redirect
      location.pathname.startsWith("/documents") ||
      location.pathname.includes("/owned-properties/reports"),
    [location.pathname]
  );

  const calcActive = location.pathname.startsWith("/calculators");
  const settingsActive =
    location.pathname.startsWith("/account") ||
    location.pathname.startsWith("/subscription") ||
    location.pathname.startsWith("/settings") ||
    (isAdmin && location.pathname === "/admin");
  const helpActive =
    location.pathname.startsWith("/help") ||
    location.pathname === "/faq" ||
    location.pathname === "/feedback" ||
    location.pathname === "/contact";

  const portfolioLinks = [
    { to: "/owned-properties/dashboard", label: "Portfolio dashboard" },
    { to: "/owned-properties/my-properties", label: "My properties" },
    { to: "/tenants", label: "Tenants" },
    { to: "/leases", label: "Leases" },
    { to: "/financials", label: "Financials" },
    { to: "/documents", label: "Documents" },
    { to: "/owned-properties/reports", label: "Reports" }
  ];

  const calcGroups = useMemo(() => groupCalculators(calculators), []);

  const onPrimaryPointerDown = (id: RailSection, defaultPath: string) => {
    if (coarsePointer) {
      if (pinned !== id) {
        setPinnedSection(id);
        return;
      }
      navigate(defaultPath);
      closeAll();
      return;
    }
    navigate(defaultPath);
    setPinnedSection(id);
  };

  const onFlyoutLinkNavigate = () => {
    closeAll();
  };

  const logout = async () => {
    await signOut();
    closeAll();
    navigate("/");
  };

  const expanded = pinned ?? hoverOpen;
  const expandedProps = (id: RailSection) => ({
    "aria-haspopup": "menu" as const,
    "aria-expanded": expanded === id,
    "aria-controls": `${baseId}-${id}-menu`
  });

  return (
    <aside className="pg-workspace-rail" ref={railRef} aria-label="Workspace">
      <nav className="pg-workspace-rail-icons" aria-label="Primary workspace">
        <div className="pg-workspace-rail-tooltip-wrap">
          <button
            type="button"
            className={`pg-rail-icon-btn ${homeActive ? "pg-rail-icon-btn-active" : ""}`}
            aria-label="Home and portfolio"
            {...expandedProps("home")}
            onMouseEnter={() => scheduleHoverOpen("home")}
            onMouseLeave={scheduleHoverClose}
            onClick={() => onPrimaryPointerDown("home", "/owned-properties/dashboard")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
                e.preventDefault();
                setPinnedSection("home");
                window.setTimeout(() => {
                  document.getElementById(`${baseId}-home-first`)?.focus();
                }, 0);
              }
            }}
          >
            <RailLucideIcon icon={LayoutDashboard} active={homeActive} />
          </button>
          <span className="pg-workspace-rail-tooltip" role="tooltip">
            Home & portfolio
          </span>
        </div>

        <div className="pg-workspace-rail-tooltip-wrap">
          <button
            type="button"
            className={`pg-rail-icon-btn ${calcActive ? "pg-rail-icon-btn-active" : ""}`}
            aria-label="Calculators"
            {...expandedProps("calc")}
            onMouseEnter={() => scheduleHoverOpen("calc")}
            onMouseLeave={scheduleHoverClose}
            onClick={() => onPrimaryPointerDown("calc", "/calculators")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
                e.preventDefault();
                setPinnedSection("calc");
                window.setTimeout(() => {
                  document.getElementById(`${baseId}-calc-first`)?.focus();
                }, 0);
              }
            }}
          >
            <RailLucideIcon icon={Calculator} active={calcActive} />
          </button>
          <span className="pg-workspace-rail-tooltip" role="tooltip">
            Calculators
          </span>
        </div>

        <div className="pg-workspace-rail-tooltip-wrap">
          <button
            type="button"
            className={`pg-rail-icon-btn ${settingsActive ? "pg-rail-icon-btn-active" : ""}`}
            aria-label="Settings and account"
            {...expandedProps("settings")}
            onMouseEnter={() => scheduleHoverOpen("settings")}
            onMouseLeave={scheduleHoverClose}
            onClick={() => onPrimaryPointerDown("settings", "/settings")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
                e.preventDefault();
                setPinnedSection("settings");
                window.setTimeout(() => {
                  document.getElementById(`${baseId}-settings-first`)?.focus();
                }, 0);
              }
            }}
          >
            <RailLucideIcon icon={Settings} active={settingsActive} />
          </button>
          <span className="pg-workspace-rail-tooltip" role="tooltip">
            Settings
          </span>
        </div>

        <div className="pg-workspace-rail-tooltip-wrap">
          <button
            type="button"
            className={`pg-rail-icon-btn ${helpActive ? "pg-rail-icon-btn-active" : ""}`}
            aria-label="Help"
            {...expandedProps("help")}
            onMouseEnter={() => scheduleHoverOpen("help")}
            onMouseLeave={scheduleHoverClose}
            onClick={() => onPrimaryPointerDown("help", "/help")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
                e.preventDefault();
                setPinnedSection("help");
                window.setTimeout(() => {
                  document.getElementById(`${baseId}-help-first`)?.focus();
                }, 0);
              }
            }}
          >
            <RailLucideIcon icon={CircleHelp} active={helpActive} />
          </button>
          <span className="pg-workspace-rail-tooltip" role="tooltip">
            Help
          </span>
        </div>
      </nav>

      {flyoutVisible ? (
        <div
          className="pg-workspace-flyout"
          role="presentation"
          onMouseEnter={clearCloseTimer}
          onMouseLeave={scheduleHoverClose}
        >
          {flyoutVisible === "home" ? (
            <div
              id={`${baseId}-home-menu`}
              role="menu"
              className="pg-workspace-flyout-inner"
              aria-label="Portfolio navigation"
            >
              <div className="pg-workspace-flyout-title">Portfolio</div>
              <ul className="pg-workspace-flyout-list">
                {portfolioLinks.map((l, i) => (
                  <li key={l.to} role="none">
                    <Link
                      role="menuitem"
                      id={i === 0 ? `${baseId}-home-first` : undefined}
                      to={l.to}
                      className="pg-workspace-flyout-link"
                      data-active={location.pathname === l.to || (l.to !== "/owned-properties/dashboard" && location.pathname.startsWith(l.to)) ? "true" : "false"}
                      onClick={onFlyoutLinkNavigate}
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {flyoutVisible === "calc" ? (
            <div
              id={`${baseId}-calc-menu`}
              role="menu"
              className="pg-workspace-flyout-inner pg-workspace-flyout-scroll"
              aria-label="Calculators"
            >
              {calcGroups.map((g, gi) => (
                <div key={g.title} className="pg-workspace-flyout-group">
                  <div className="pg-workspace-flyout-subtitle">{g.title}</div>
                  <ul className="pg-workspace-flyout-list">
                    {g.items.map((c, ci) => (
                      <li key={c.slug} role="none">
                        <Link
                          role="menuitem"
                          id={gi === 0 && ci === 0 ? `${baseId}-calc-first` : undefined}
                          to={`/calculators/${c.slug}`}
                          className="pg-workspace-flyout-link"
                          data-active={location.pathname === `/calculators/${c.slug}` ? "true" : "false"}
                          onClick={onFlyoutLinkNavigate}
                        >
                          {c.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : null}

          {flyoutVisible === "settings" ? (
            <div
              id={`${baseId}-settings-menu`}
              role="menu"
              className="pg-workspace-flyout-inner"
              aria-label="Settings"
            >
              <div className="pg-workspace-flyout-title">Settings</div>
              <ul className="pg-workspace-flyout-list">
                <li role="none">
                  <Link
                    role="menuitem"
                    id={`${baseId}-settings-first`}
                    to="/settings"
                    className="pg-workspace-flyout-link"
                    data-active={location.pathname === "/settings" ? "true" : "false"}
                    onClick={onFlyoutLinkNavigate}
                  >
                    <span style={{ display: "block", fontWeight: 700 }}>Settings overview</span>
                    <span className="pg-muted" style={{ display: "block", fontSize: 12, marginTop: 2, opacity: 0.85 }}>
                      Workspace preferences & admin links
                    </span>
                  </Link>
                </li>
                <li role="none">
                  <Link
                    role="menuitem"
                    to="/account"
                    className="pg-workspace-flyout-link"
                    data-active={location.pathname === "/account" ? "true" : "false"}
                    onClick={onFlyoutLinkNavigate}
                  >
                    <span style={{ display: "block", fontWeight: 700 }}>Account</span>
                    <span className="pg-muted" style={{ display: "block", fontSize: 12, marginTop: 2, opacity: 0.85 }}>
                      Invoice banking details
                    </span>
                  </Link>
                </li>
                <li role="none">
                  <Link
                    role="menuitem"
                    to="/subscription"
                    className="pg-workspace-flyout-link"
                    data-active={location.pathname.startsWith("/subscription") ? "true" : "false"}
                    onClick={onFlyoutLinkNavigate}
                  >
                    Subscription
                  </Link>
                </li>
                <li role="none">
                  <Link
                    role="menuitem"
                    to="/settings/security"
                    className="pg-workspace-flyout-link"
                    data-active={location.pathname === "/settings/security" ? "true" : "false"}
                    onClick={onFlyoutLinkNavigate}
                  >
                    Security
                  </Link>
                </li>
                <li role="none">
                  <Link
                    role="menuitem"
                    to="/settings/notifications"
                    className="pg-workspace-flyout-link"
                    data-active={location.pathname === "/settings/notifications" ? "true" : "false"}
                    onClick={onFlyoutLinkNavigate}
                  >
                    Notifications
                  </Link>
                </li>
                {isAdmin ? (
                  <li role="none">
                    <Link
                      role="menuitem"
                      to="/admin"
                      className="pg-workspace-flyout-link"
                      data-active={location.pathname === "/admin" ? "true" : "false"}
                      onClick={onFlyoutLinkNavigate}
                    >
                      Admin metrics
                    </Link>
                  </li>
                ) : null}
                <li role="none">
                  <button type="button" role="menuitem" className="pg-workspace-flyout-link pg-workspace-flyout-btn" onClick={logout}>
                    Log out
                  </button>
                </li>
              </ul>
            </div>
          ) : null}

          {flyoutVisible === "help" ? (
            <div
              id={`${baseId}-help-menu`}
              role="menu"
              className="pg-workspace-flyout-inner"
              aria-label="Help"
            >
              <div className="pg-workspace-flyout-title">Help</div>
              <ul className="pg-workspace-flyout-list">
                <li role="none">
                  <Link
                    role="menuitem"
                    id={`${baseId}-help-first`}
                    to="/help"
                    className="pg-workspace-flyout-link"
                    data-active={location.pathname === "/help" ? "true" : "false"}
                    onClick={onFlyoutLinkNavigate}
                  >
                    Help centre
                  </Link>
                </li>
                <li role="none">
                  <Link
                    role="menuitem"
                    to="/contact"
                    className="pg-workspace-flyout-link"
                    data-active={location.pathname === "/contact" ? "true" : "false"}
                    onClick={onFlyoutLinkNavigate}
                  >
                    Contact
                  </Link>
                </li>
                <li role="none">
                  <Link
                    role="menuitem"
                    to="/faq"
                    className="pg-workspace-flyout-link"
                    data-active={location.pathname === "/faq" ? "true" : "false"}
                    onClick={onFlyoutLinkNavigate}
                  >
                    FAQ
                  </Link>
                </li>
                <li role="none">
                  <Link
                    role="menuitem"
                    to="/feedback"
                    className="pg-workspace-flyout-link"
                    data-active={location.pathname === "/feedback" ? "true" : "false"}
                    onClick={onFlyoutLinkNavigate}
                  >
                    Feedback
                  </Link>
                </li>
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
