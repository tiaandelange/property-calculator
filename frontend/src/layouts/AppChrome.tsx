import React, { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AuthenticatedShell } from "./AuthenticatedShell";
import { RouteFallback } from "../components/ui/RouteFallback";
import { HomePublicFooter } from "../components/home/HomePublicFooter";
import { HomePublicHeader } from "../components/home/HomePublicHeader";
import { DEFAULT_USER_SETTINGS } from "../features/settings/settingsDefaults";
import { isWorkspacePath } from "../utils/workspacePaths";
import { applyDocumentTheme, readStoredThemePreference, resolveEffectiveUiColorScheme, subscribeToSystemTheme } from "../theme/uiColorScheme";
import {
  applyMarketingAppearance,
  applyWorkspaceAppearance,
  type WorkspaceAppearance
} from "../theme/workspaceAppearance";
import { useAuth } from "../contexts/AuthContext";
import { useSettingsQuery } from "../features/queries";

type Me = {
  email?: string;
  role?: "USER" | "ADMIN";
  freeUsesRemaining?: number | null;
} | null;

function readInitialWorkspaceAppearance(): WorkspaceAppearance {
  return {
    themePreference: readStoredThemePreference() ?? DEFAULT_USER_SETTINGS.themePreference,
    accentColor: DEFAULT_USER_SETTINGS.accentColor,
    density: DEFAULT_USER_SETTINGS.density
  };
}

export function AppChrome() {
  const location = useLocation();
  const { session, initializing, profile, profileLoading } = useAuth();
  const settingsQuery = useSettingsQuery();
  const [me, setMe] = useState<Me>(null);

  const useWorkspaceChrome = !initializing && Boolean(session) && isWorkspacePath(location.pathname);
  const isMarketingHome = location.pathname === "/";
  const isMarketingCalculatorsShell =
    location.pathname === "/calculators" || /^\/calculators\/.+/.test(location.pathname);

  const workspaceAppearance = useMemo((): WorkspaceAppearance => {
    if (settingsQuery.data) {
      return {
        themePreference: settingsQuery.data.themePreference,
        accentColor: settingsQuery.data.accentColor,
        density: settingsQuery.data.density
      };
    }
    const initial = readInitialWorkspaceAppearance();
    if (profile?.ui_color_scheme === "light") initial.themePreference = "light";
    else if (profile?.ui_color_scheme === "dark") initial.themePreference = "dark";
    return initial;
  }, [settingsQuery.data, profile?.ui_color_scheme]);

  useEffect(() => {
    if (!session) {
      setMe(null);
      return;
    }
    if (!profile && profileLoading) return;
    const email = session.user.email ?? "";
    setMe({
      email,
      role: profile?.role === "ADMIN" ? "ADMIN" : "USER",
      freeUsesRemaining: profile?.free_uses_remaining ?? null
    });
  }, [session, profile, profileLoading]);

  useEffect(() => {
    if (!session || !useWorkspaceChrome) {
      applyMarketingAppearance();
      return;
    }
    applyWorkspaceAppearance(workspaceAppearance);
  }, [session, useWorkspaceChrome, workspaceAppearance]);

  useEffect(() => {
    if (!useWorkspaceChrome || workspaceAppearance.themePreference !== "system") return;
    return subscribeToSystemTheme(() => {
      applyDocumentTheme(resolveEffectiveUiColorScheme("system"));
    });
  }, [useWorkspaceChrome, workspaceAppearance.themePreference]);

  if (initializing) {
    if (isWorkspacePath(location.pathname)) {
      return (
        <div className="pg-app">
          <AuthenticatedShell userRole={null}>
            <RouteFallback />
          </AuthenticatedShell>
        </div>
      );
    }
    return (
      <div className="pg-app pg-app--marketing-public">
        <HomePublicHeader />
        <main className="pg-main pg-main-marketing pg-main-marketing-site">
          <RouteFallback />
        </main>
        <HomePublicFooter />
      </div>
    );
  }

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
