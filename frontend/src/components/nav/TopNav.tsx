import { NavLink, useNavigate } from "react-router-dom";
import { Container } from "../ui/Container";
import { ButtonLink } from "../ui/Button";
import { HamburgerButton } from "./HamburgerButton";
import { useEffect, useRef, useState } from "react";
import { calculators } from "../../data/calculators";

export function TopNav({
  onMenu,
  userEmail,
  userRole,
  signedIn
}: {
  onMenu: () => void;
  userEmail?: string | null;
  userRole?: "USER" | "ADMIN" | null;
  signedIn: boolean;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const initials = userEmail ? userEmail.slice(0, 2).toUpperCase() : null;
  const isAdmin = userRole === "ADMIN";
  const [calcOpen, setCalcOpen] = useState(false);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) setOpen(false);
    }
    if (open) window.addEventListener("mousedown", onClickOutside);
    return () => window.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const logout = () => {
    localStorage.removeItem("token");
    setOpen(false);
    navigate("/");
    window.location.reload();
  };

  return (
    <div className="pg-topbar">
      <Container>
        <div className="pg-topbar-inner">
          <div className="pg-brand">
            <HamburgerButton onClick={onMenu} />
            <div>
              <NavLink to="/" end className={({ isActive }) => `pg-logo${isActive ? " pg-logo-active" : ""}`}>
                The Property Guy
              </NavLink>
              <div className="pg-logo-tagline">Property calculators & portfolio tools</div>
            </div>
          </div>
          <nav className="pg-main-nav">
            <div className="pg-main-nav-item" onMouseEnter={() => setCalcOpen(true)} onMouseLeave={() => setCalcOpen(false)}>
              <button type="button" className="pg-main-nav-btn">
                Property Calculators
              </button>
              {calcOpen ? (
                <div className="pg-main-nav-menu">
                  {calculators.slice(0, 10).map((c) => (
                    <NavLink
                      key={c.slug}
                      to={`/calculators/${c.slug}`}
                      className={({ isActive }) => `pg-profile-item${isActive ? " pg-main-nav-link-active" : ""}`}
                      onClick={() => setCalcOpen(false)}
                    >
                      {c.name}
                    </NavLink>
                  ))}
                </div>
              ) : null}
            </div>
            <NavLink to="/learn" className={({ isActive }) => `pg-main-nav-link${isActive ? " pg-main-nav-link-active" : ""}`}>
              Learn
            </NavLink>
            <NavLink to="/about" className={({ isActive }) => `pg-main-nav-link${isActive ? " pg-main-nav-link-active" : ""}`}>
              About
            </NavLink>
            <NavLink to="/contact" className={({ isActive }) => `pg-main-nav-link${isActive ? " pg-main-nav-link-active" : ""}`}>
              Contact
            </NavLink>
          </nav>
          <div className="pg-top-actions">
            {signedIn ? (
              <div className="pg-profile" ref={menuRef}>
                <button type="button" className="pg-avatar" aria-label="Open profile menu" onClick={() => setOpen((v) => !v)}>
                  {initials}
                </button>
                {open ? (
                  <div className="pg-profile-menu">
                    <div className="pg-profile-label">{isAdmin ? "Admin" : "User"}</div>
                    <NavLink
                      to="/owned-properties/dashboard"
                      className={({ isActive }) => `pg-profile-item${isActive ? " pg-main-nav-link-active" : ""}`}
                      onClick={() => setOpen(false)}
                    >
                      Open workspace
                    </NavLink>
                    <NavLink
                      to="/account"
                      className={({ isActive }) => `pg-profile-item${isActive ? " pg-main-nav-link-active" : ""}`}
                      onClick={() => setOpen(false)}
                    >
                      Account
                    </NavLink>
                    <NavLink
                      to="/settings"
                      className={({ isActive }) => `pg-profile-item${isActive ? " pg-main-nav-link-active" : ""}`}
                      onClick={() => setOpen(false)}
                    >
                      Settings
                    </NavLink>
                    {isAdmin ? (
                      <NavLink
                        to="/admin"
                        className={({ isActive }) => `pg-profile-item${isActive ? " pg-main-nav-link-active" : ""}`}
                        onClick={() => setOpen(false)}
                      >
                        Admin metrics
                      </NavLink>
                    ) : null}
                    <NavLink
                      to="/subscription"
                      end
                      className={({ isActive }) => `pg-profile-item${isActive ? " pg-main-nav-link-active" : ""}`}
                      onClick={() => setOpen(false)}
                    >
                      Subscription
                    </NavLink>
                    <button type="button" className="pg-profile-item pg-profile-item-button" onClick={logout}>
                      Log out
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <>
                <ButtonLink href="/login" variant="secondary">
                  Sign In
                </ButtonLink>
                <ButtonLink href="/login" variant="ghost">
                  Register
                </ButtonLink>
              </>
            )}
          </div>
        </div>
      </Container>
    </div>
  );
}

