/**
 * Requires a **Supabase Auth** session (`getSession` / `onAuthStateChange` in `AuthProvider`).
 */
import type React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { RouteFallback } from "../ui/RouteFallback";
import { logProtectedRoute } from "../../lib/authDebug";
import { isSupabaseConfigured } from "../../lib/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";

function loginRedirectPath(pathname: string, search: string): string {
  const target = `${pathname}${search}`;
  if (!target || target === "/login" || target.startsWith("/login?")) {
    return "/login";
  }
  return `/login?redirectTo=${encodeURIComponent(target)}`;
}

export function RequireAuth({ children }: { children: React.ReactElement }) {
  const location = useLocation();
  const { session, user, initializing, initialized, isLoadingAuth, isAuthenticated } = useAuth();

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

  if (!initialized || initializing || isLoadingAuth) {
    logProtectedRoute("loading", {
      path: location.pathname,
      authLoading: true,
      initialized: false,
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
