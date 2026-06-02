import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { MARKETING_PRICING_HREF, MARKETING_SIGN_IN_HREF } from "../../data/homepageMarketingContent";
import { HomeBrandWordmark } from "./HomeBrandWordmark";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

type NavDef =
  | { key: string; label: string; kind: "route"; to: string; end?: boolean }
  | { key: string; label: string; kind: "hash"; hash: string };

const NAV: NavDef[] = [
  { key: "features", label: "Features", kind: "hash", hash: "features" },
  { key: "reports", label: "Reports", kind: "hash", hash: "reports" },
  { key: "calculators", label: "Calculators", kind: "hash", hash: "calculators" },
  { key: "pricing", label: "Pricing", kind: "route", to: MARKETING_PRICING_HREF },
  { key: "faq", label: "FAQ", kind: "hash", hash: "faq" }
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
  const [hash, setHash] = useState(() => (typeof window !== "undefined" ? window.location.hash : ""));
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const prevFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();

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

  const renderNavLink = (item: NavDef, onNavigate?: () => void) => {
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

  const trialCtaClass = "pg-home-site-header-cta";
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
            {NAV.map((item) => renderNavLink(item))}
          </nav>

          <div className="pg-home-site-header-actions pg-home-site-header-actions--desktop pg-home-site-header-auth-actions">
            <Link to={MARKETING_SIGN_IN_HREF} className={signInClass}>
              Sign In
            </Link>
            <Link to={MARKETING_PRICING_HREF} className={trialCtaClass}>
              Start Free Trial
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
          {NAV.map((item) => (
            <div key={item.key} className="pg-home-site-drawer-row">
              {renderNavLink(item, closeDrawer)}
            </div>
          ))}
        </nav>
        <div className="pg-home-site-drawer-cta-wrap pg-home-site-header-auth-actions pg-home-site-header-auth-actions--stacked">
          <Link to={MARKETING_SIGN_IN_HREF} className={signInClass} onClick={closeDrawer}>
            Sign In
          </Link>
          <Link to={MARKETING_PRICING_HREF} className={trialCtaClass} onClick={closeDrawer}>
            Start Free Trial
          </Link>
        </div>
      </div>
    </>
  );
}
