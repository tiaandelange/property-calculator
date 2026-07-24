import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { fetchProfileForUserId, type ProfileForApp } from "../api/profileFromSupabase";
import { logAuthEvent, logAuthSignOut, logAuthState } from "../lib/authDebug";
import {
  AUTH_BOOTSTRAP_TIMEOUT_MS,
  type AuthStatus,
  authBootstrapTimeoutError,
  isAuthBackendUnavailableError,
  withTimeout
} from "../lib/authBackendAvailability";
import { authLoginInProgressRef } from "../lib/authLoginGuard";
import { readAuthSession, abandonInflightAuthSessionRead, supabaseAuthStorageKey } from "../lib/authSession";
import { sessionFromInitialAuthEvent, shouldIgnoreSignedOutEvent } from "../lib/authSessionPolicy";
import {
  isSupabaseConfigured,
  startSupabaseAutoRefresh,
  stopSupabaseAutoRefresh,
  supabase
} from "../lib/supabaseClient";

export type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: ProfileForApp | null;
  /** Explicit auth state machine status. */
  status: AuthStatus;
  /** False when Supabase is unconfigured or confirmed unreachable. */
  backendAvailable: boolean;
  initialized: boolean;
  /** True while status is `checking` (first bootstrap or user-initiated retry). */
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
  /** User-initiated reconnection attempt (finite; does not loop). */
  retryConnection: () => Promise<void>;
  /** Apply session immediately after sign-in (avoids race before onAuthStateChange). */
  recognizeSession: (session: Session) => void;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

let backendUnavailableLogged = false;

function logBackendUnavailableOnce(message: string): void {
  if (backendUnavailableLogged) return;
  backendUnavailableLogged = true;
  console.warn("[auth] Account services unreachable:", message);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [authError, setAuthError] = useState<Error | null>(null);
  const [profile, setProfile] = useState<ProfileForApp | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const sessionRef = useRef<Session | null>(null);
  const statusRef = useRef<AuthStatus>("checking");
  const bootstrapDoneRef = useRef(false);
  const sessionEstablishedAtRef = useRef<number | null>(null);
  /** Guards Strict Mode double-mount from overlapping bootstrap retries. */
  const bootstrapGenerationRef = useRef(0);

  const setAuthStatus = useCallback((next: AuthStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const finishBootstrap = useCallback(
    (reason: string, nextStatus: AuthStatus) => {
      bootstrapDoneRef.current = true;
      setAuthStatus(nextStatus);
      logAuthEvent("auth ready", {
        reason,
        status: nextStatus,
        hasSession: Boolean(sessionRef.current)
      });
      logAuthState({
        initialized: true,
        authLoading: false,
        status: nextStatus,
        hasUser: Boolean(sessionRef.current?.user?.id)
      });
    },
    [setAuthStatus]
  );

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
      initialized: bootstrapDoneRef.current,
      authLoading: statusRef.current === "checking",
      hasUser: Boolean(next?.user?.id)
    });
  }, []);

  const markBackendUnavailable = useCallback(
    (error: Error, reason: string) => {
      abandonInflightAuthSessionRead();
      stopSupabaseAutoRefresh();
      logBackendUnavailableOnce(error.message);
      setAuthError(error);
      // Keep any cached session — do not wipe local auth on a network blip.
      finishBootstrap(reason, "backend-unavailable");
    },
    [finishBootstrap]
  );

  const resolveReadyStatus = useCallback((next: Session | null): AuthStatus => {
    return next?.user?.id ? "authenticated" : "unauthenticated";
  }, []);

  const recognizeSession = useCallback(
    (next: Session) => {
      startSupabaseAutoRefresh();
      backendUnavailableLogged = false;
      applySession(next, "recognizeSession");
      setAuthError(null);
      finishBootstrap("recognizeSession", "authenticated");
    },
    [applySession, finishBootstrap]
  );

  const runSessionCheck = useCallback(
    async (reason: string, isStale?: () => boolean): Promise<void> => {
      if (!isSupabaseConfigured || !supabase) {
        applySession(null, `${reason}:supabase_unconfigured`);
        setAuthError(new Error("Supabase is not configured."));
        finishBootstrap(`${reason}:supabase_unconfigured`, "backend-unavailable");
        return;
      }

      setAuthStatus("checking");
      setAuthError(null);
      startSupabaseAutoRefresh();

      try {
        const { session: bootSession, error } = await withTimeout(
          readAuthSession(),
          AUTH_BOOTSTRAP_TIMEOUT_MS,
          authBootstrapTimeoutError
        );

        if (isStale?.()) return;

        if (error) {
          if (isAuthBackendUnavailableError(error)) {
            markBackendUnavailable(new Error(error.message), `${reason}:network`);
            return;
          }
          console.warn("[auth] getSession", error.message);
          logAuthEvent("getSession error (session kept)", { message: error.message });
          setAuthError(error);
          finishBootstrap(`${reason}:getSession_error`, resolveReadyStatus(sessionRef.current));
          return;
        }

        const bootstrapped = sessionFromInitialAuthEvent(bootSession, sessionRef.current);
        applySession(bootstrapped, reason);
        setAuthError(null);
        backendUnavailableLogged = false;
        finishBootstrap(reason, resolveReadyStatus(bootstrapped));
      } catch (e) {
        if (isStale?.()) {
          abandonInflightAuthSessionRead();
          return;
        }
        const err = e instanceof Error ? e : new Error(String(e));
        if (isAuthBackendUnavailableError(err)) {
          markBackendUnavailable(err, `${reason}:unreachable`);
          return;
        }
        console.warn("[auth] session check", err.message);
        setAuthError(err);
        finishBootstrap(`${reason}:error`, resolveReadyStatus(sessionRef.current));
      }
    },
    [applySession, finishBootstrap, markBackendUnavailable, resolveReadyStatus, setAuthStatus]
  );

  const refreshSession = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setAuthError(new Error("Supabase is not configured."));
      setAuthStatus("backend-unavailable");
      return;
    }
    const { session: next, error } = await readAuthSession();
    if (error) {
      if (isAuthBackendUnavailableError(error)) {
        stopSupabaseAutoRefresh();
        logBackendUnavailableOnce(error.message);
        setAuthError(new Error(error.message));
        setAuthStatus("backend-unavailable");
        return;
      }
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
    backendUnavailableLogged = false;
    setAuthStatus(resolveReadyStatus(next));
  }, [applySession, resolveReadyStatus, setAuthStatus]);

  const retryConnection = useCallback(async () => {
    bootstrapDoneRef.current = true;
    await runSessionCheck("retry:connection");
  }, [runSessionCheck]);

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
    if (statusRef.current === "backend-unavailable") {
      setProfileLoading(false);
      return;
    }
    const uid = active.user.id;
    setProfileLoading(true);
    try {
      setProfile(await fetchProfileForUserId(uid));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (isAuthBackendUnavailableError(e)) {
        logBackendUnavailableOnce(msg);
        stopSupabaseAutoRefresh();
        setAuthStatus("backend-unavailable");
        setAuthError(e instanceof Error ? e : new Error(msg));
      } else {
        console.warn("[auth] profile load", msg);
      }
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, [setAuthStatus]);

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
        if (statusRef.current !== "backend-unavailable") {
          setAuthStatus("unauthenticated");
        }
        return;
      }

      if (event === "TOKEN_REFRESHED") {
        if (nextSession) {
          applySession(nextSession, `event:${event}`);
          if (statusRef.current === "backend-unavailable") {
            backendUnavailableLogged = false;
            setAuthError(null);
            setAuthStatus("authenticated");
            startSupabaseAutoRefresh();
          } else if (statusRef.current !== "checking") {
            setAuthStatus("authenticated");
          }
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
        backendUnavailableLogged = false;
        setAuthError(null);
        if (statusRef.current === "checking" || statusRef.current === "backend-unavailable") {
          finishBootstrap(`event:${event}`, "authenticated");
        } else {
          setAuthStatus("authenticated");
        }
        return;
      }

      if (nextSession) {
        applySession(nextSession, `event:${event}`);
      }
    },
    [applySession, finishBootstrap, setAuthStatus]
  );

  useEffect(() => {
    const generation = ++bootstrapGenerationRef.current;
    let cancelled = false;

    const client = supabase;
    if (!isSupabaseConfigured || !client) {
      applySession(null, "bootstrap:supabase_unconfigured");
      setAuthError(new Error("Supabase is not configured."));
      finishBootstrap("bootstrap:supabase_unconfigured", "backend-unavailable");
      return;
    }

    logAuthState({ initialized: false, authLoading: true, hasUser: false, status: "checking" });

    const {
      data: { subscription }
    } = client.auth.onAuthStateChange((event, nextSession) => {
      if (cancelled || generation !== bootstrapGenerationRef.current) return;
      handleAuthEvent(event, nextSession);
    });

    void (async () => {
      await runSessionCheck(
        "bootstrap:getSession",
        () => cancelled || generation !== bootstrapGenerationRef.current
      );
    })();

    const authStorageKey = supabaseAuthStorageKey();
    const onStorage = (event: StorageEvent) => {
      if (cancelled || !authStorageKey || event.key !== authStorageKey) return;
      void readAuthSession().then(({ session: next, error }) => {
        if (cancelled || error || !next) return;
        applySession(next, "storage:sync");
        if (statusRef.current !== "checking") {
          setAuthStatus(resolveReadyStatus(next));
        }
      });
    };
    window.addEventListener("storage", onStorage);

    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
      subscription.unsubscribe();
    };
  }, [applySession, finishBootstrap, handleAuthEvent, resolveReadyStatus, runSessionCheck, setAuthStatus]);

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid || !isSupabaseConfigured || !supabase) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    if (status === "backend-unavailable" || status === "checking") {
      if (status === "backend-unavailable") setProfileLoading(false);
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
          setAuthStatus("unauthenticated");
          return;
        }
        setProfile(row);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (isAuthBackendUnavailableError(e)) {
          logBackendUnavailableOnce(msg);
          stopSupabaseAutoRefresh();
          if (!cancelled) {
            setAuthError(e instanceof Error ? e : new Error(msg));
            setAuthStatus("backend-unavailable");
            setProfile(null);
          }
        } else {
          console.warn("[auth] profile load", msg);
          if (!cancelled) setProfile(null);
        }
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, status, applySession, setAuthStatus]);

  const signOut = useCallback(async () => {
    logAuthSignOut("AuthContext.signOut", "user_logout");
    if (!supabase) {
      applySession(null, "signOut:no_client");
      setProfile(null);
      setAuthStatus("unauthenticated");
      return;
    }
    const { error } = await supabase.auth.signOut();
    if (error) console.warn("[auth] signOut", error.message);
    applySession(null, "signOut:complete");
    setProfile(null);
    setAuthStatus("unauthenticated");
  }, [applySession, setAuthStatus]);

  const user = session?.user ?? null;
  const authLoading = status === "checking";
  const initialized = status !== "idle" && status !== "checking";
  const backendAvailable = status !== "backend-unavailable" && isSupabaseConfigured;
  const isAuthenticated = status === "authenticated" && Boolean(session?.user?.id);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      profile,
      status,
      backendAvailable,
      initialized,
      authLoading,
      initializing: authLoading,
      isLoadingAuth: authLoading,
      authError,
      isAuthenticated,
      profileLoading,
      refreshSession,
      retryConnection,
      recognizeSession,
      refreshProfile,
      signOut
    }),
    [
      session,
      user,
      profile,
      status,
      backendAvailable,
      initialized,
      authLoading,
      authError,
      isAuthenticated,
      profileLoading,
      refreshSession,
      retryConnection,
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
