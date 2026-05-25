/**
 * Requires a **Supabase Auth** session (`getSession` / `onAuthStateChange` in `AuthProvider`).
 * Supabase session is required for protected routes; legacy Express JWTs are not used.
 * Supabase access token when calling the Node API until those routes are migrated.
 */
import type React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { isSupabaseConfigured } from "../../lib/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";

export function RequireAuth({ children }: { children: React.ReactElement }) {
  const location = useLocation();
  const { session, initializing } = useAuth();

  if (!isSupabaseConfigured) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname, reason: "supabase_unconfigured" }}
      />
    );
  }

  if (initializing) {
    return (
      <div className="pg-muted" style={{ padding: 24 }}>
        Checking session…
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
