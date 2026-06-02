import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { fetchProfileForUserId, type ProfileForApp } from "../api/profileFromSupabase";
import { logAuthEvent, logAuthSignOut } from "../lib/authDebug";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";

export type AuthContextValue = {
  session: Session | null;
  user: User | null;
  /** Row from `public.profiles` for `session.user.id`, when signed in. */
  profile: ProfileForApp | null;
  /** True while the initial session read is in progress. */
  initializing: boolean;
  /** Alias for `initializing` — auth state is still unknown. */
  isLoadingAuth: boolean;
  /** True only after loading finished and a session exists. */
  isAuthenticated: boolean;
  /** True while loading `profile` for the current session (does not block `RequireAuth`). */
  profileLoading: boolean;
  refreshSession: () => Promise<void>;
  /** Re-load `public.profiles` for the current user (e.g. after profile PATCH). */
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [profile, setProfile] = useState<ProfileForApp | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const sessionRef = useRef<Session | null>(null);

  const applySession = useCallback((next: Session | null, reason: string) => {
    sessionRef.current = next;
    setSession(next);
    logAuthEvent("session updated", { reason, hasSession: Boolean(next) });
  }, []);

  const refreshSession = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      applySession(null, "refreshSession:supabase_unconfigured");
      return;
    }
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.warn("[auth] getSession", error.message);
      logAuthEvent("getSession error (keeping existing session)", { message: error.message });
      return;
    }
    const next = data.session ?? null;
    // During token refresh, getSession() can briefly return null while storage catches up.
    if (!next && sessionRef.current) {
      logAuthEvent("getSession returned null while session cached (ignored)");
      return;
    }
    applySession(next, "refreshSession");
  }, [applySession]);

  const refreshProfile = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    const active = sessionRef.current;
    if (!active?.user?.id) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    const uid = active.user.id;
    setProfileLoading(true);
    try {
      setProfile(await fetchProfileForUserId(uid));
    } catch (e) {
      console.warn("[auth] profile load", e instanceof Error ? e.message : e);
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      applySession(null, "bootstrap:supabase_unconfigured");
      setInitializing(false);
      return;
    }

    let cancelled = false;
    let initialSessionHandled = false;

    const finishInitializing = (reason: string) => {
      if (initialSessionHandled || cancelled) return;
      initialSessionHandled = true;
      logAuthEvent("auth ready", { reason });
      setInitializing(false);
    };

    // Safety net if INITIAL_SESSION never arrives (misconfigured client).
    const initTimeout = window.setTimeout(() => finishInitializing("timeout"), 8000);

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      logAuthEvent("onAuthStateChange", { event, hasSession: Boolean(nextSession) });

      // Defer state updates — avoids deadlocks if Supabase is called from this callback.
      setTimeout(() => {
        if (cancelled) return;

        if (event === "SIGNED_OUT") {
          applySession(null, `event:${event}`);
          finishInitializing("SIGNED_OUT");
          return;
        }

        if (event === "INITIAL_SESSION") {
          applySession(nextSession ?? null, `event:${event}`);
          finishInitializing("INITIAL_SESSION");
          return;
        }

        if (nextSession) {
          applySession(nextSession, `event:${event}`);
          if (!initialSessionHandled) finishInitializing(event);
          return;
        }

        // Ignore transient null payloads (e.g. TOKEN_REFRESHED mid-refresh). Never clear session here.
      }, 0);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(initTimeout);
      subscription.unsubscribe();
    };
  }, [applySession]);

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid || !isSupabaseConfigured || !supabase) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    let cancelled = false;
    setProfileLoading(true);
    void (async () => {
      try {
        const row = await fetchProfileForUserId(uid);
        if (cancelled) return;
        setProfile(row);
      } catch (e) {
        console.warn("[auth] profile load", e instanceof Error ? e.message : e);
        if (!cancelled) setProfile(null);
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  const signOut = useCallback(async () => {
    logAuthSignOut("AuthContext.signOut", "user_logout");
    if (!supabase) {
      applySession(null, "signOut:no_client");
      setProfile(null);
      return;
    }
    const { error } = await supabase.auth.signOut();
    if (error) console.warn("[auth] signOut", error.message);
    applySession(null, "signOut:complete");
    setProfile(null);
  }, [applySession]);

  const isAuthenticated = !initializing && Boolean(session);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      initializing,
      isLoadingAuth: initializing,
      isAuthenticated,
      profileLoading,
      refreshSession,
      refreshProfile,
      signOut
    }),
    [session, profile, initializing, isAuthenticated, profileLoading, refreshSession, refreshProfile, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
