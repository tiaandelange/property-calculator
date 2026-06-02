/**
 * Requires a **Supabase Auth** session (`getSession` / `onAuthStateChange` in `AuthProvider`).
 * Supabase session is required for protected routes; legacy Express JWTs are not used.
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
  const { session, initializing, isLoadingAuth, isAuthenticated } = useAuth();

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

  if (initializing || isLoadingAuth) {
    logProtectedRoute("loading", { path: location.pathname });
    return <RouteFallback />;
  }

  if (!isAuthenticated || !session) {
    const to = loginRedirectPath(location.pathname, location.search);
    logProtectedRoute("redirect", { path: location.pathname, to, hasSession: Boolean(session) });
    return <Navigate to={to} replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  logProtectedRoute("allow", { path: location.pathname });
  return children;
}
