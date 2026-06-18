import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { fetchProfileForUserId, type ProfileForApp } from "../api/profileFromSupabase";
import { logAuthEvent, logAuthSignOut, logAuthState } from "../lib/authDebug";
import { authLoginInProgressRef } from "../lib/authLoginGuard";
import { readAuthSession, supabaseAuthStorageKey } from "../lib/authSession";
import { sessionFromInitialAuthEvent, shouldIgnoreSignedOutEvent } from "../lib/authSessionPolicy";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";

export type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: ProfileForApp | null;
  initialized: boolean;
  /** True until the first `getSession()` bootstrap completes. */
  authLoading: boolean;
  /** @deprecated Prefer `authLoading` */
  initializing: boolean;
  /** @deprecated Prefer `authLoading` */
  isLoadingAuth: boolean;
  authError: Error | null;
  isAuthenticated: boolean;
  profileLoading: boolean;
  /** Sync React state from coalesced `getSession()` — does not call `refreshSession()`. */
  refreshSession: () => Promise<void>;
  /** Apply session immediately after sign-in (avoids race before onAuthStateChange). */
  recognizeSession: (session: Session) => void;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<Error | null>(null);
  const [profile, setProfile] = useState<ProfileForApp | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const sessionRef = useRef<Session | null>(null);
  const initializedRef = useRef(false);
  const sessionEstablishedAtRef = useRef<number | null>(null);

  const finishBootstrap = useCallback((reason: string) => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    setInitialized(true);
    setAuthLoading(false);
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
      if (!initializedRef.current) {
        finishBootstrap("recognizeSession");
      }
    },
    [applySession, finishBootstrap]
  );

  const refreshSession = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setAuthError(new Error("Supabase is not configured."));
      return;
    }
    const { session: next, error } = await readAuthSession();
    if (error) {
      console.warn("[auth] getSession", error.message);
      logAuthEvent("getSession error (session kept)", { message: error.message });
      setAuthError(error);
      return;
    }
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

  const handleAuthEvent = useCallback(
    (event: string, nextSession: Session | null) => {
      logAuthEvent("onAuthStateChange", { event, hasSession: Boolean(nextSession) });

      if (event === "INITIAL_SESSION") {
        const resolved = sessionFromInitialAuthEvent(nextSession, sessionRef.current);
        applySession(resolved, `event:${event}`);
        return;
      }

      if (event === "SIGNED_OUT") {
        if (
          shouldIgnoreSignedOutEvent(
            sessionRef.current,
            sessionEstablishedAtRef.current,
            authLoginInProgressRef.current
          )
        ) {
          logAuthEvent("SIGNED_OUT ignored — login or recent session grace");
          return;
        }
        applySession(null, `event:${event}`);
        setProfile(null);
        return;
      }

      if (event === "TOKEN_REFRESHED") {
        if (nextSession) {
          applySession(nextSession, `event:${event}`);
        } else {
          logAuthEvent("TOKEN_REFRESHED with null session — keeping cached session", { event });
        }
        return;
      }

      if (event === "USER_UPDATED" && nextSession) {
        applySession(nextSession, `event:${event}`);
        return;
      }

      if ((event === "SIGNED_IN" || event === "PASSWORD_RECOVERY") && nextSession) {
        applySession(nextSession, `event:${event}`);
        return;
      }

      if (nextSession) {
        applySession(nextSession, `event:${event}`);
      }
    },
    [applySession]
  );

  useEffect(() => {
    const client = supabase;
    if (!isSupabaseConfigured || !client) {
      applySession(null, "bootstrap:supabase_unconfigured");
      finishBootstrap("bootstrap:supabase_unconfigured");
      return;
    }

    let cancelled = false;

    logAuthState({ initialized: false, authLoading: true, hasUser: false });

    const {
      data: { subscription }
    } = client.auth.onAuthStateChange((event, nextSession) => {
      if (cancelled) return;
      handleAuthEvent(event, nextSession);
    });

    void (async () => {
      const { session: bootSession, error } = await readAuthSession();
      if (cancelled) return;

      if (error) {
        console.warn("[auth] bootstrap getSession", error.message);
        logAuthEvent("bootstrap getSession error (session kept)", { message: error.message });
        setAuthError(error);
      } else {
        const bootstrapped = sessionFromInitialAuthEvent(bootSession, sessionRef.current);
        applySession(bootstrapped, "bootstrap:getSession");
        setAuthError(null);
      }

      finishBootstrap("bootstrap:getSession");
    })();

    const authStorageKey = supabaseAuthStorageKey();
    const onStorage = (event: StorageEvent) => {
      if (cancelled || !authStorageKey || event.key !== authStorageKey) return;
      void readAuthSession().then(({ session, error }) => {
        if (cancelled || error || !session) return;
        applySession(session, "storage:sync");
      });
    };
    window.addEventListener("storage", onStorage);

    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
      subscription.unsubscribe();
    };
  }, [applySession, finishBootstrap, handleAuthEvent]);

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
        if (!row) {
          console.warn("[auth] profile missing for session user — signing out stale session");
          logAuthSignOut("AuthContext.profileMissing", "stale_session");
          if (supabase) {
            await supabase.auth.signOut();
          }
          applySession(null, "profileMissing:signOut");
          setProfile(null);
          return;
        }
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
  }, [session?.user?.id, applySession]);

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

  const user = session?.user ?? null;
  const isAuthenticated = initialized && !authLoading && Boolean(session?.user?.id);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      profile,
      initialized,
      authLoading,
      initializing: authLoading,
      isLoadingAuth: authLoading,
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
      user,
      profile,
      initialized,
      authLoading,
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
