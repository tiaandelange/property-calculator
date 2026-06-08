/**
 * Requires a **Supabase Auth** session (`getSession` / `onAuthStateChange` in `AuthProvider`).
 * Never redirects while auth is still loading or workspace metadata queries are in flight.
 */
import type React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { RouteFallback } from "../ui/RouteFallback";
import { logProtectedRoute } from "../../lib/authDebug";
import { isSupabaseConfigured } from "../../lib/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import { useSettingsQuery } from "../../features/queries";
import { useSubscriptionQuery } from "../../lib/subscription/useSubscriptionQuery";

function loginRedirectPath(pathname: string, search: string): string {
  const target = `${pathname}${search}`;
  if (!target || target === "/login" || target.startsWith("/login?")) {
    return "/login";
  }
  return `/login?redirectTo=${encodeURIComponent(target)}`;
}

/** True while first-load profile/settings/subscription fetches are in flight (errors do not block). */
function useWorkspaceMetadataLoading(authReady: boolean, userId: string | undefined): boolean {
  const { profileLoading } = useAuth();
  const metadataEnabled = authReady && Boolean(userId);
  const settingsQuery = useSettingsQuery({ enabled: metadataEnabled });
  const subscriptionQuery = useSubscriptionQuery({ enabled: metadataEnabled });

  if (!userId) return false;

  if (profileLoading) return true;
  if (settingsQuery.isLoading && !settingsQuery.isError) return true;
  if (subscriptionQuery.isLoading && !subscriptionQuery.isError) return true;

  return false;
}

export function RequireAuth({ children }: { children: React.ReactElement }) {
  const location = useLocation();
  const { session, user, initialized, authLoading, isAuthenticated } = useAuth();
  const authReady = initialized && !authLoading && Boolean(session?.user?.id);
  const workspaceMetadataLoading = useWorkspaceMetadataLoading(authReady, session?.user?.id);

  if (!isSupabaseConfigured) {
    logProtectedRoute("redirect", { reason: "supabase_unconfigured" });
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname, reason: "supabase_unconfigured" }}
      />
    );
  }

  if (!initialized || authLoading) {
    logProtectedRoute("loading", {
      path: location.pathname,
      authLoading: true,
      initialized: false,
      hasSession: Boolean(session),
      hasUser: Boolean(user)
    });
    return <RouteFallback />;
  }

  if (workspaceMetadataLoading) {
    logProtectedRoute("loading", {
      path: location.pathname,
      authLoading: false,
      initialized: true,
      workspaceMetadataLoading: true,
      hasSession: Boolean(session),
      hasUser: Boolean(user)
    });
    return <RouteFallback />;
  }

  if (!isAuthenticated || !session?.user?.id) {
    const to = loginRedirectPath(location.pathname, location.search);
    logProtectedRoute("redirect", {
      path: location.pathname,
      to,
      hasSession: Boolean(session),
      hasUser: Boolean(user),
      initialized: true,
      authLoading: false
    });
    return <Navigate to={to} replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  logProtectedRoute("allow", {
    path: location.pathname,
    hasSession: true,
    hasUser: Boolean(user),
    initialized: true
  });
  return children;
}
