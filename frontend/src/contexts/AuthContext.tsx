import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { fetchProfileForUserId, type ProfileForApp } from "../api/profileFromSupabase";
import { logAuthEvent, logAuthSignOut } from "../lib/authDebug";
import { isInvalidRefreshTokenError, sessionFromInitialAuthEvent } from "../lib/authSessionPolicy";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";

export type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: ProfileForApp | null;
  /** True while the initial session read is in progress. */
  initializing: boolean;
  /** True after the first session resolution (bootstrap or INITIAL_SESSION). */
  initialized: boolean;
  /** Alias for `initializing` — auth state is still unknown. */
  isLoadingAuth: boolean;
  /** Last auth bootstrap error (does not clear session on its own). */
  authError: Error | null;
  isAuthenticated: boolean;
  profileLoading: boolean;
  refreshSession: () => Promise<void>;
  /** Apply session immediately after sign-in (avoids race before onAuthStateChange). */
  recognizeSession: (session: Session) => void;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const INIT_TIMEOUT_MS = 12_000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [authError, setAuthError] = useState<Error | null>(null);
  const [profile, setProfile] = useState<ProfileForApp | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const sessionRef = useRef<Session | null>(null);
  const initializedRef = useRef(false);

  const markInitialized = useCallback((reason: string) => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    setInitialized(true);
    setInitializing(false);
    logAuthEvent("auth ready", { reason, hasSession: Boolean(sessionRef.current) });
  }, []);

  const applySession = useCallback((next: Session | null, reason: string) => {
    sessionRef.current = next;
    setSession(next);
    logAuthEvent("session updated", { reason, hasSession: Boolean(next) });
  }, []);

  const recognizeSession = useCallback(
    (next: Session) => {
      applySession(next, "recognizeSession");
      markInitialized("recognizeSession");
    },
    [applySession, markInitialized]
  );

  const refreshSession = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      applySession(null, "refreshSession:supabase_unconfigured");
      return;
    }
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.warn("[auth] getSession", error.message);
      logAuthEvent("getSession error (keeping existing session)", { message: error.message });
      if (isInvalidRefreshTokenError(error.message)) {
        applySession(null, "refreshSession:invalid_refresh_token");
        setAuthError(error);
      }
      return;
    }
    const next = data.session ?? null;
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
    const client = supabase;
    if (!isSupabaseConfigured || !client) {
      applySession(null, "bootstrap:supabase_unconfigured");
      markInitialized("bootstrap:supabase_unconfigured");
      return;
    }

    let cancelled = false;

    void client.auth.getSession().then(({ data, error }) => {
      if (cancelled || initializedRef.current) return;
      if (error) {
        console.warn("[auth] bootstrap getSession", error.message);
        setAuthError(error);
        return;
      }
      if (data.session) {
        applySession(data.session, "bootstrap:getSession");
      }
    });

    const initTimeout = window.setTimeout(() => {
      void client.auth.getSession().then(({ data, error }) => {
        if (cancelled || initializedRef.current) return;
        if (!error && data.session) {
          applySession(data.session, "bootstrap:timeout:getSession");
        } else if (!sessionRef.current) {
          applySession(null, "bootstrap:timeout:no_session");
        }
        markInitialized("timeout");
      });
    }, INIT_TIMEOUT_MS);

    const {
      data: { subscription }
    } = client.auth.onAuthStateChange((event, nextSession) => {
      logAuthEvent("onAuthStateChange", { event, hasSession: Boolean(nextSession) });

      setTimeout(() => {
        if (cancelled) return;

        if (event === "SIGNED_OUT") {
          void client.auth.getSession().then(({ data, error }) => {
            if (cancelled) return;
            if (!error && data.session) {
              logAuthEvent("SIGNED_OUT ignored — session still in storage");
              applySession(data.session, "SIGNED_OUT:recovered");
              markInitialized("SIGNED_OUT:recovered");
              return;
            }
            applySession(null, `event:${event}`);
            markInitialized("SIGNED_OUT");
          });
          return;
        }

        if (event === "INITIAL_SESSION") {
          const resolved = sessionFromInitialAuthEvent(nextSession, sessionRef.current);
          applySession(resolved, `event:${event}`);
          markInitialized("INITIAL_SESSION");
          return;
        }

        if (nextSession) {
          applySession(nextSession, `event:${event}`);
          if (!initializedRef.current) markInitialized(event);
          return;
        }

        // TOKEN_REFRESHED / USER_UPDATED with null payload — keep cached session.
      }, 0);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(initTimeout);
      subscription.unsubscribe();
    };
  }, [applySession, markInitialized]);

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

  const isAuthenticated = initialized && Boolean(session);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      initializing,
      initialized,
      isLoadingAuth: initializing,
      authError,
      isAuthenticated,
      profileLoading,
      refreshSession,
      recognizeSession,
      refreshProfile,
      signOut
    }),
    [
      session,
      profile,
      initializing,
      initialized,
      authError,
      isAuthenticated,
      profileLoading,
      refreshSession,
      recognizeSession,
      refreshProfile,
      signOut
    ]
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
