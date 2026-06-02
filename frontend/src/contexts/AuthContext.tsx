import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { fetchProfileForUserId, type ProfileForApp } from "../api/profileFromSupabase";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";

export type AuthContextValue = {
  session: Session | null;
  user: User | null;
  /** Row from `public.profiles` for `session.user.id`, when signed in. */
  profile: ProfileForApp | null;
  /** True while the initial session read is in progress. */
  initializing: boolean;
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

  const refreshSession = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setSession(null);
      return;
    }
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.warn("[auth] getSession", error.message);
      // Keep the existing session on transient read errors (e.g. refresh in flight).
      return;
    }
    setSession(data.session ?? null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.user?.id) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    const uid = data.session.user.id;
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
      setSession(null);
      setInitializing(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      await refreshSession();
      if (!cancelled) setInitializing(false);
    })();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "SIGNED_OUT") {
        setSession(null);
        return;
      }
      if (nextSession) {
        setSession(nextSession);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [refreshSession]);

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
    if (!supabase) {
      setSession(null);
      setProfile(null);
      return;
    }
    const { error } = await supabase.auth.signOut();
    if (error) console.warn("[auth] signOut", error.message);
    setSession(null);
    setProfile(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      initializing,
      profileLoading,
      refreshSession,
      refreshProfile,
      signOut
    }),
    [session, profile, initializing, profileLoading, refreshSession, refreshProfile, signOut]
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
