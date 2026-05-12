import React, { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AuthenticatedShell } from "./AuthenticatedShell";
import { HomePublicFooter } from "../components/home/HomePublicFooter";
import { HomePublicHeader } from "../components/home/HomePublicHeader";
import { isWorkspacePath } from "../utils/workspacePaths";
import { api, authHeader } from "../api/client";
import { applyUiColorScheme, normalizeUiColorScheme } from "../theme/uiColorScheme";

type Me = {
  email?: string;
  role?: "USER" | "ADMIN";
  freeUsesRemaining?: number | null;
  uiColorScheme?: "dark" | "light";
} | null;

export function AppChrome() {
  const location = useLocation();
  const [me, setMe] = useState<Me>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));

  const useWorkspaceChrome = Boolean(token) && isWorkspacePath(location.pathname);
  const isMarketingHome = location.pathname === "/";
  /** Hub + individual tool pages share the same shell: navy hero under the fixed header, then content. */
  const isMarketingCalculatorsShell =
    location.pathname === "/calculators" || /^\/calculators\/.+/.test(location.pathname);

  useEffect(() => {
    const t = window.setInterval(() => {
      const next = localStorage.getItem("token");
      setToken((curr) => (curr === next ? curr : next));
    }, 500);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!localStorage.getItem("token")) return;
      try {
        const res = await api.get("/auth/me", { headers: authHeader() });
        if (!cancelled) {
          setMe(res.data);
          applyUiColorScheme(normalizeUiColorScheme(res.data?.uiColorScheme));
        }
      } catch {
        if (!cancelled) setMe(null);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (useWorkspaceChrome) {
    return (
      <div className="pg-app">
        <AuthenticatedShell userRole={me?.role ?? null}>
          <Outlet />
        </AuthenticatedShell>
      </div>
    );
  }

  return (
    <div className="pg-app pg-app--marketing-public">
      <HomePublicHeader />
      <main
        className={
          isMarketingHome
            ? "pg-main pg-main-marketing pg-main-marketing-home"
            : isMarketingCalculatorsShell
              ? "pg-main pg-main-marketing pg-main-marketing-calculators-hub"
              : "pg-main pg-main-marketing pg-main-marketing-site"
        }
      >
        <Outlet />
      </main>
      <HomePublicFooter />
    </div>
  );
}
