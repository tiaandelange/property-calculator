import React, { useEffect, useMemo, useState } from "react";
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

/**
 * Application chrome. Public and auth routes always render `<Outlet />` immediately —
 * they must never wait on Supabase session bootstrap. Workspace chrome is used only
 * when a session is already known on a workspace path; protected gating lives in RequireAuth.
 */
export function AppChrome() {
  const location = useLocation();
  const { session, authLoading, status, profile, profileLoading } = useAuth();
  const authReady = status === "authenticated" && Boolean(session?.user?.id);
  const settingsQuery = useSettingsQuery({ enabled: authReady });
  const [me, setMe] = useState<Me>(null);

  const onWorkspacePath = isWorkspacePath(location.pathname);
  // Workspace chrome only when a session is known. Public/auth routes never wait on auth.
  const useWorkspaceChrome = onWorkspacePath && Boolean(session);
  // Deep-link into the app while bootstrap is still running (or backend is down):
  // keep the dashboard shell so RequireAuth can show loading / BackendUnavailable.
  const useWorkspaceShellPending =
    onWorkspacePath && !session && (authLoading || status === "backend-unavailable");
  const isMarketingHome = location.pathname === "/";
  const isMarketingDarkHeroHub =
    location.pathname === "/calculators" || location.pathname === "/reports";
  const isAuthFocusShell =
    location.pathname === "/login" ||
    location.pathname === "/signup" ||
    location.pathname === "/confirm-email" ||
    location.pathname.startsWith("/confirm-email/");

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
    if (useWorkspaceChrome) {
      applyWorkspaceAppearance(workspaceAppearance);
      return;
    }
    // Avoid flashing marketing light theme onto a dashboard deep-link during bootstrap.
    if (useWorkspaceShellPending) return;
    applyMarketingAppearance();
  }, [useWorkspaceChrome, useWorkspaceShellPending, workspaceAppearance]);

  useEffect(() => {
    if (!useWorkspaceChrome || workspaceAppearance.themePreference !== "system") return;
    return subscribeToSystemTheme(() => {
      applyDocumentTheme(resolveEffectiveUiColorScheme("system"));
    });
  }, [useWorkspaceChrome, workspaceAppearance.themePreference]);

  // Never block the Outlet on auth bootstrap — public pages must paint immediately.
  if (useWorkspaceChrome || useWorkspaceShellPending) {
    return (
      <div className="pg-app">
        <AuthenticatedShell userRole={me?.role ?? null}>
          <Outlet />
        </AuthenticatedShell>
      </div>
    );
  }

  if (isAuthFocusShell) {
    return (
      <div className="pg-app pg-app--auth-focus">
        <main className="pg-main pg-main--auth-focus">
          <Outlet />
        </main>
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
            : isMarketingDarkHeroHub
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
