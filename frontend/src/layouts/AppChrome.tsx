import React, { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AuthenticatedShell } from "./AuthenticatedShell";
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
import { getOrCreateUserSettings } from "../services/settingsSupabase";

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
  const [me, setMe] = useState<Me>(null);
  const [workspaceAppearance, setWorkspaceAppearance] = useState<WorkspaceAppearance>(readInitialWorkspaceAppearance);

  const useWorkspaceChrome = !initializing && Boolean(session) && isWorkspacePath(location.pathname);
  const isMarketingHome = location.pathname === "/";
  const isMarketingCalculatorsShell =
    location.pathname === "/calculators" || /^\/calculators\/.+/.test(location.pathname);

  useEffect(() => {
    if (!session) {
      setMe(null);
      return;
    }
    const email = session.user.email ?? "";
    if (!profile && profileLoading) {
      return;
    }

    let cancelled = false;

    void (async () => {
      let appearance: WorkspaceAppearance = readInitialWorkspaceAppearance();
      try {
        const settings = await getOrCreateUserSettings();
        appearance = {
          themePreference: settings.themePreference,
          accentColor: settings.accentColor,
          density: settings.density
        };
      } catch {
        if (profile?.ui_color_scheme === "light") {
          appearance.themePreference = "light";
        } else if (profile?.ui_color_scheme === "dark") {
          appearance.themePreference = "dark";
        }
      }
      if (cancelled) return;
      setWorkspaceAppearance(appearance);
      setMe({
        email,
        role: profile?.role === "ADMIN" ? "ADMIN" : "USER",
        freeUsesRemaining: profile?.free_uses_remaining ?? null
      });
    })();

    return () => {
      cancelled = true;
    };
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
    return null;
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
