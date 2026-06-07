import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { fetchProfileForUserId, type ProfileForApp } from "../api/profileFromSupabase";
import { logAuthEvent, logAuthSignOut, logAuthState } from "../lib/authDebug";
import { authLoginInProgressRef } from "../lib/authLoginGuard";
import {
  sessionFromInitialAuthEvent,
  shouldClearSessionForGetSessionError,
  shouldIgnoreSignedOutEvent
} from "../lib/authSessionPolicy";
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
  authLoading: boolean;
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

function supabaseAuthStorageKey(): string | null {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
  const match = url.match(/https?:\/\/([^.]+)\.supabase\.co/i);
  if (!match?.[1]) return null;
  return `sb-${match[1]}-auth-token`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [authError, setAuthError] = useState<Error | null>(null);
  const [profile, setProfile] = useState<ProfileForApp | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const sessionRef = useRef<Session | null>(null);
  const initializedRef = useRef(false);
  const sessionEstablishedAtRef = useRef<number | null>(null);

  const markInitialized = useCallback((reason: string) => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    setInitialized(true);
    setInitializing(false);
    logAuthEvent("auth ready", { reason, hasSession: Boolean(sessionRef.current) });
    logAuthState({
      initialized: true,
      authLoading: false,
      hasUser: Boolean(sessionRef.current?.user?.id)
    });
  }, []);

  const applySession = useCallback((next: Session | null, reason: string) => {
    sessionRef.current = next;
    setSession(next);
    if (next?.user?.id) {
      sessionEstablishedAtRef.current = Date.now();
    } else if (reason.startsWith("signOut") || reason.startsWith("event:SIGNED_OUT")) {
      sessionEstablishedAtRef.current = null;
    }
    logAuthEvent("session updated", { reason, hasSession: Boolean(next) });
    logAuthState({
      initialized: initializedRef.current,
      authLoading: !initializedRef.current,
      hasUser: Boolean(next?.user?.id)
    });
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
      logAuthEvent("getSession error (session kept)", { message: error.message });
      if (shouldClearSessionForGetSessionError(error.message, sessionRef.current)) {
        applySession(null, "refreshSession:invalid_refresh_token");
      }
      setAuthError(error);
      return;
    }
    const next = data.session ?? null;
    if (!next && sessionRef.current) {
      logAuthEvent("getSession returned null while session cached (ignored)");
      return;
    }
    applySession(next, "refreshSession");
    setAuthError(null);
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

  const recoverSessionAfterSignedOut = useCallback(
    async (client: NonNullable<typeof supabase>, reason: string): Promise<boolean> => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        if (attempt > 0) {
          await new Promise((resolve) => window.setTimeout(resolve, 250 * attempt));
        }

        const { data: refreshed, error: refreshError } = await client.auth.refreshSession();
        if (!refreshError && refreshed.session) {
          applySession(refreshed.session, `${reason}:refreshSession`);
          return true;
        }

        const { data, error } = await client.auth.getSession();
        if (!error && data.session) {
          applySession(data.session, `${reason}:getSession`);
          return true;
        }
      }

      return false;
    },
    [applySession]
  );

  useEffect(() => {
    const client = supabase;
    if (!isSupabaseConfigured || !client) {
      applySession(null, "bootstrap:supabase_unconfigured");
      markInitialized("bootstrap:supabase_unconfigured");
      return;
    }

    let cancelled = false;

    logAuthState({ initialized: false, authLoading: true, hasUser: false });

    const {
      data: { subscription }
    } = client.auth.onAuthStateChange((event, nextSession) => {
      if (cancelled) return;

      logAuthEvent("onAuthStateChange", { event, hasSession: Boolean(nextSession) });

      if (event === "INITIAL_SESSION") {
        const resolved = sessionFromInitialAuthEvent(nextSession, sessionRef.current);
        applySession(resolved, `event:${event}`);
        markInitialized("INITIAL_SESSION");
        return;
      }

      if (event === "SIGNED_OUT") {
        void (async () => {
          if (cancelled) return;

          if (
            shouldIgnoreSignedOutEvent(
              sessionRef.current,
              sessionEstablishedAtRef.current,
              authLoginInProgressRef.current
            )
          ) {
            logAuthEvent("SIGNED_OUT ignored — login or recent session grace");
            const recovered = await recoverSessionAfterSignedOut(client, "SIGNED_OUT:grace");
            if (!cancelled && recovered) return;
          }

          const recovered = await recoverSessionAfterSignedOut(client, "SIGNED_OUT");
          if (cancelled) return;
          if (recovered) return;

          applySession(null, `event:${event}`);
        })();
        return;
      }

      if (nextSession) {
        applySession(nextSession, `event:${event}`);
        if (!initializedRef.current) markInitialized(event);
        return;
      }

      if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        logAuthEvent("auth event with null session — keeping cached session", { event });
      }
    });

    const initTimeout = window.setTimeout(() => {
      if (cancelled || initializedRef.current) return;
      if (!sessionRef.current) {
        applySession(null, "bootstrap:timeout:no_session");
      }
      markInitialized("timeout");
    }, INIT_TIMEOUT_MS);

    const authStorageKey = supabaseAuthStorageKey();
    const onStorage = (event: StorageEvent) => {
      if (cancelled || !authStorageKey || event.key !== authStorageKey) return;
      void client.auth.getSession().then(({ data, error }) => {
        if (cancelled || error || !data.session) return;
        applySession(data.session, "storage:sync");
      });
    };
    window.addEventListener("storage", onStorage);

    const onVisibility = () => {
      if (cancelled || document.visibilityState !== "visible" || !sessionRef.current) return;
      void client.auth.getSession().then(({ data, error }) => {
        if (cancelled || error) return;
        if (data.session) {
          applySession(data.session, "visibility:sync");
        }
      });
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearTimeout(initTimeout);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibility);
      subscription.unsubscribe();
    };
  }, [applySession, markInitialized, recoverSessionAfterSignedOut]);

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

  const isAuthenticated = initialized && Boolean(session?.user?.id);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      initializing,
      initialized,
      authLoading: initializing,
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
