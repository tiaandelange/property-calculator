import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AppIcon, IconButton } from "../../components/icons";
import { ProplyticLogo } from "../brand/ProplyticLogo";
import { useAuth } from "../../contexts/AuthContext";
import { useWorkspaceId } from "../../features/queries/useWorkspaceId";
import { navWarmHandlers } from "../../lib/routePrefetch";
import { isWorkspaceNavActive, WORKSPACE_SIDEBAR_NAV } from "../../nav/workspaceNavConfig";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function MobileWorkspaceMenu({ open, onClose }: Props) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceId();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const logout = async () => {
    await signOut();
    onClose();
    navigate("/");
  };

  if (!open) return null;

  return (
    <div className="pg-dashboard-mobile-menu" role="dialog" aria-modal="true" aria-label="Navigation menu">
      <button type="button" className="pg-dashboard-mobile-menu-backdrop" aria-label="Close menu" onClick={onClose} />
      <div className="pg-dashboard-mobile-menu-panel">
        <div className="pg-dashboard-mobile-menu-head">
          <ProplyticLogo mode="compact" title="Proplytic" className="pg-dashboard-mobile-menu-brand" />
          <IconButton icon="close" aria-label="Close menu" variant="ghost" size="lg" tooltip={false} onClick={onClose} />
        </div>
        <nav aria-label="Mobile workspace">
          <ul className="pg-dashboard-mobile-menu-list">
            {WORKSPACE_SIDEBAR_NAV.map((item) => {
              const active = !item.disabled && isWorkspaceNavActive(pathname, item);
              if (item.disabled || !item.to) {
                return (
                  <li key={item.id}>
                    <span className="pg-dashboard-mobile-menu-link pg-dashboard-mobile-menu-link--disabled">{item.label}</span>
                  </li>
                );
              }
              const warm = navWarmHandlers(item.to, queryClient, workspaceId ?? null);
              return (
                <li key={item.id}>
                  <Link
                    to={item.to}
                    className={`pg-dashboard-mobile-menu-link${active ? " pg-dashboard-mobile-menu-link--active" : ""}`}
                    onClick={onClose}
                    {...warm}
                  >
                    <AppIcon name={item.icon} size="lg" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
            <li>
              <button type="button" className="pg-dashboard-mobile-menu-link pg-dashboard-mobile-menu-logout" onClick={() => void logout()}>
                <AppIcon name="logout" size="lg" />
                Log out
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  );
}
