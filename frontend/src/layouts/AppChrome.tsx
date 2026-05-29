import React, { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AuthenticatedShell } from "./AuthenticatedShell";
import { HomePublicFooter } from "../components/home/HomePublicFooter";
import { HomePublicHeader } from "../components/home/HomePublicHeader";
import { isWorkspacePath } from "../utils/workspacePaths";
import {
  applyThemePreference,
  readStoredThemePreference,
  subscribeToSystemTheme,
  type ThemePreference
} from "../theme/uiColorScheme";
import { useAuth } from "../contexts/AuthContext";
import { getOrCreateUserSettings } from "../services/settingsSupabase";

type Me = {
  email?: string;
  role?: "USER" | "ADMIN";
  freeUsesRemaining?: number | null;
  themePreference?: ThemePreference;
} | null;

export function AppChrome() {
  const location = useLocation();
  const { session, initializing, profile, profileLoading } = useAuth();
  const [me, setMe] = useState<Me>(null);
  const [themePref, setThemePref] = useState<ThemePreference>(
    () => readStoredThemePreference() ?? "system"
  );

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
      let pref: ThemePreference = "system";
      try {
        const settings = await getOrCreateUserSettings();
        pref = settings.themePreference;
      } catch {
        if (profile?.ui_color_scheme === "light") pref = "light";
        else if (profile?.ui_color_scheme === "dark") pref = "dark";
      }
      if (cancelled) return;
      setThemePref(pref);
      applyThemePreference(pref);
      setMe({
        email,
        role: profile?.role === "ADMIN" ? "ADMIN" : "USER",
        freeUsesRemaining: profile?.free_uses_remaining ?? null,
        themePreference: pref
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [session, profile, profileLoading]);

  useEffect(() => {
    applyThemePreference(themePref);
  }, [themePref]);

  useEffect(() => {
    if (themePref !== "system") return;
    return subscribeToSystemTheme(() => applyThemePreference("system"));
  }, [themePref]);

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
