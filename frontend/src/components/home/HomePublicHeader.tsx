import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  getCalculatorMegaMenuGroups,
  type CalculatorMegaMenuGroup,
  type CalculatorMegaMenuItem
} from "../../data/calculatorMegaMenu";
import { CalculatorIconDisplay } from "../icons/CalculatorIconDisplay";
import { HomeBrandWordmark } from "./HomeBrandWordmark";

const CALCULATOR_MEGA_MENU_GROUPS = getCalculatorMegaMenuGroups();

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

type NavDef =
  | { key: string; label: string; kind: "home"; to: string }
  | { key: string; label: string; kind: "route"; to: string; end?: boolean }
  | { key: string; label: string; kind: "hash"; hash: string };

const NAV: NavDef[] = [
  { key: "home", label: "Home", kind: "home", to: "/" },
  { key: "calculators", label: "Calculators", kind: "route", to: "/calculators" },
  { key: "how", label: "How it works", kind: "hash", hash: "how-it-works" },
  { key: "why", label: "Why us", kind: "hash", hash: "why-us" },
  { key: "reviews", label: "Reviews", kind: "hash", hash: "reviews" },
  { key: "contact", label: "Contact", kind: "route", to: "/contact", end: true }
];

function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true"
  );
}

export function HomePublicHeader() {
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [calculatorsMegaOpen, setCalculatorsMegaOpen] = useState(false);
  const [hash, setHash] = useState(() => (typeof window !== "undefined" ? window.location.hash : ""));
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const prevFocus = useRef<HTMLElement | null>(null);
  const calculatorsMegaRef = useRef<HTMLDivElement | null>(null);
  const calculatorsMegaCloseTimer = useRef<number | null>(null);
  const titleId = useId();
  const calculatorsMegaPanelId = useId();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    setHash(location.hash);
  }, [location.hash]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(min-width: 901px)");
    const onChange = () => {
      if (mq.matches) setDrawerOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const clearCalculatorsMegaCloseTimer = useCallback(() => {
    if (calculatorsMegaCloseTimer.current != null) {
      window.clearTimeout(calculatorsMegaCloseTimer.current);
      calculatorsMegaCloseTimer.current = null;
    }
  }, []);

  const openCalculatorsMega = useCallback(() => {
    clearCalculatorsMegaCloseTimer();
    setCalculatorsMegaOpen(true);
  }, [clearCalculatorsMegaCloseTimer]);

  const scheduleCloseCalculatorsMega = useCallback(() => {
    clearCalculatorsMegaCloseTimer();
    calculatorsMegaCloseTimer.current = window.setTimeout(() => {
      setCalculatorsMegaOpen(false);
      calculatorsMegaCloseTimer.current = null;
    }, 160);
  }, [clearCalculatorsMegaCloseTimer]);

  useEffect(() => {
    setCalculatorsMegaOpen(false);
  }, [location.pathname, location.hash]);

  useEffect(() => () => clearCalculatorsMegaCloseTimer(), [clearCalculatorsMegaCloseTimer]);

  useEffect(() => {
    if (!drawerOpen) return;
    prevFocus.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";

    const root = drawerRef.current;
    const closeBtn = closeBtnRef.current;
    window.setTimeout(() => closeBtn?.focus(), 0);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeDrawer();
        return;
      }
      if (e.key !== "Tab" || !root) return;
      const list = getFocusable(root);
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      prevFocus.current?.focus?.();
    };
  }, [drawerOpen, closeDrawer]);

  const isHashActive = (h: string) => hash === `#${h}`;

  const linkClasses = (active: boolean) => `pg-home-site-header-link${active ? " pg-home-site-header-link--active" : ""}`;

  const navClass = ({ isActive }: { isActive: boolean }) => linkClasses(isActive);

  const onCalculatorsMegaFocusOut = useCallback(() => {
    const root = calculatorsMegaRef.current;
    window.requestAnimationFrame(() => {
      if (root && !root.contains(document.activeElement)) {
        scheduleCloseCalculatorsMega();
      }
    });
  }, [scheduleCloseCalculatorsMega]);

  const renderNavLink = (item: NavDef, onNavigate?: () => void) => {
    if (item.kind === "home") {
      return (
        <NavLink key={item.key} to={item.to} end className={navClass} onClick={onNavigate}>
          {item.label}
        </NavLink>
      );
    }
    if (item.kind === "route") {
      return (
        <NavLink key={item.key} to={item.to} end={item.end} className={navClass} onClick={onNavigate}>
          {item.label}
        </NavLink>
      );
    }
    const to = `/#${item.hash}`;
    const active = isHashActive(item.hash);
    return (
      <Link key={item.key} to={to} className={linkClasses(active)} onClick={onNavigate}>
        {item.label}
      </Link>
    );
  };

  const joinCtaClass = "pg-home-site-header-cta";
  const signInClass = "pg-home-site-header-sign-in";

  const calculatorsHeroShell =
    location.pathname === "/calculators" || /^\/calculators\/.+/.test(location.pathname);

  return (
    <>
      <header
        className="pg-home-site-header"
        data-scrolled={scrolled ? "true" : "false"}
        data-drawer-open={drawerOpen ? "true" : "false"}
        data-calculators-hero-shell={calculatorsHeroShell ? "true" : "false"}
      >
        <div className="pg-container pg-container--marketing-wide pg-home-site-header-inner">
          <div className="pg-home-site-header-brand">
            <Link to="/" className="pg-home-site-header-logo" aria-label="Proplytic — Home">
              <HomeBrandWordmark alt="" />
            </Link>
          </div>

          <nav className="pg-home-site-header-nav pg-home-site-header-nav--desktop" aria-label="Primary">
            {NAV.map((item) => {
              if (item.key === "calculators" && item.kind === "route") {
                return (
                  <div
                    key={item.key}
                    ref={calculatorsMegaRef}
                    className="pg-home-site-header-mega"
                    data-open={calculatorsMegaOpen ? "true" : "false"}
                    onMouseEnter={openCalculatorsMega}
                    onMouseLeave={scheduleCloseCalculatorsMega}
                    onFocusCapture={openCalculatorsMega}
                    onBlurCapture={onCalculatorsMegaFocusOut}
                  >
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        `${navClass({ isActive })} pg-home-site-header-mega-trigger`
                      }
                      end={false}
                      aria-expanded={calculatorsMegaOpen}
                      aria-controls={calculatorsMegaPanelId}
                      aria-haspopup="true"
                    >
                      <span>Calculators</span>
                      <svg
                        className="pg-home-site-header-mega-chevron"
                        width="11"
                        height="11"
                        viewBox="0 0 11 11"
                        aria-hidden="true"
                      >
                        <path
                          d="M2.25 3.75L5.5 7L8.75 3.75"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.35"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </NavLink>
                    <div
                      id={calculatorsMegaPanelId}
                      className="pg-home-site-header-mega-panel"
                      role="region"
                      aria-label="All calculators"
                      aria-hidden={!calculatorsMegaOpen}
                    >
                      <div className="pg-home-site-header-mega-panel-inner">
                        <div className="pg-home-site-header-mega-grid">
                          {CALCULATOR_MEGA_MENU_GROUPS.map((group: CalculatorMegaMenuGroup) => (
                            <div key={group.title} className="pg-home-site-header-mega-col">
                              <div className="pg-home-site-header-mega-col-title">{group.title}</div>
                              <ul className="pg-home-site-header-mega-list">
                                {group.items.map((cal: CalculatorMegaMenuItem) => (
                                  <li key={cal.slug}>
                                    <Link
                                      to={cal.route}
                                      className="pg-home-site-header-mega-item"
                                      tabIndex={calculatorsMegaOpen ? 0 : -1}
                                    >
                                      <CalculatorIconDisplay
                                        slug={cal.slug}
                                        size="md"
                                        className="pg-home-site-header-mega-item-icon"
                                      />
                                      <span className="pg-home-site-header-mega-item-text">
                                        <span className="pg-home-site-header-mega-item-title">{cal.name}</span>
                                        <span className="pg-home-site-header-mega-item-desc">{cal.tagline}</span>
                                      </span>
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }
              return renderNavLink(item);
            })}
          </nav>

          <div className="pg-home-site-header-actions pg-home-site-header-actions--desktop pg-home-site-header-auth-actions">
            <Link to="/login" className={signInClass}>
              Sign In
            </Link>
            <Link to="/pricing" className={joinCtaClass}>
              Join
            </Link>
          </div>

          <button
            type="button"
            className="pg-home-site-header-burger"
            aria-label={drawerOpen ? "Close menu" : "Open menu"}
            aria-expanded={drawerOpen}
            aria-controls="home-site-menu"
            onClick={() => setDrawerOpen((o) => !o)}
          >
            <span className="pg-home-site-header-burger-lines" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>
        </div>
      </header>

      <div
        className="pg-home-site-drawer-backdrop"
        data-open={drawerOpen ? "true" : "false"}
        aria-hidden={!drawerOpen}
        onClick={closeDrawer}
      />

      <div
        id="home-site-menu"
        ref={drawerRef}
        className="pg-home-site-drawer"
        data-open={drawerOpen ? "true" : "false"}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="pg-home-site-drawer-top">
          <Link to="/" className="pg-home-site-drawer-logo" onClick={closeDrawer} aria-label="Proplytic — Home">
            <HomeBrandWordmark alt="" />
          </Link>
          <button ref={closeBtnRef} type="button" className="pg-home-site-drawer-close" onClick={closeDrawer}>
            Close
          </button>
          <h2 id={titleId} className="pg-home-site-drawer-title pg-visually-hidden">
            Menu
          </h2>
        </div>
        <nav className="pg-home-site-drawer-nav" aria-label="Primary mobile">
          {NAV.map((item) => {
            if (item.key === "calculators" && item.kind === "route") {
              return (
                <div key={item.key} className="pg-home-site-drawer-calculators">
                  <div className="pg-home-site-drawer-row">
                    <NavLink
                      to={item.to}
                      className={navClass}
                      end={false}
                      onClick={closeDrawer}
                    >
                      Calculators
                    </NavLink>
                  </div>
                  {CALCULATOR_MEGA_MENU_GROUPS.map((group: CalculatorMegaMenuGroup) => (
                    <div key={group.title} className="pg-home-site-drawer-mega-block">
                      <div className="pg-home-site-drawer-mega-col-title">{group.title}</div>
                      <ul className="pg-home-site-drawer-mega-list">
                        {group.items.map((cal: CalculatorMegaMenuItem) => (
                          <li key={cal.slug}>
                            <Link
                              to={cal.route}
                              className="pg-home-site-drawer-mega-item"
                              onClick={closeDrawer}
                            >
                              <CalculatorIconDisplay
                                slug={cal.slug}
                                size="sm"
                                className="pg-home-site-drawer-mega-item-icon"
                              />
                              <span className="pg-home-site-drawer-mega-item-text">
                                <span className="pg-home-site-drawer-mega-item-title">{cal.name}</span>
                                <span className="pg-home-site-drawer-mega-item-desc">{cal.tagline}</span>
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              );
            }
            return (
              <div key={item.key} className="pg-home-site-drawer-row">
                {renderNavLink(item, closeDrawer)}
              </div>
            );
          })}
        </nav>
        <div className="pg-home-site-drawer-cta-wrap pg-home-site-header-auth-actions pg-home-site-header-auth-actions--stacked">
          <Link to="/login" className={signInClass} onClick={closeDrawer}>
            Sign In
          </Link>
          <Link to="/pricing" className={joinCtaClass} onClick={closeDrawer}>
            Join
          </Link>
        </div>
      </div>
    </>
  );
}
