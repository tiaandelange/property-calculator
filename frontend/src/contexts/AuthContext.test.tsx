import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { AuthProvider, useAuth } from "./AuthContext";
import { AUTH_BOOTSTRAP_TIMEOUT_MS } from "../lib/authBackendAvailability";
import { resetAuthSessionReadCoalescingForTests } from "../lib/authSession";

const { sessionRef, onAuthChangeRef, getSessionImpl, mockAuthClient } = vi.hoisted(() => {
  const sessionRef: { current: { access_token: string; user: { id: string } } | null } = {
    current: null
  };
  const onAuthChangeRef: { cb: ((event: string, session: unknown) => void) | null } = { cb: null };
  const getSessionImpl: {
    current: () => Promise<{ data: { session: unknown }; error: { message: string } | null }>;
  } = {
    current: () => Promise.resolve({ data: { session: sessionRef.current }, error: null })
  };
  const mockAuthClient = () => ({
    auth: {
      getSession: vi.fn(() => getSessionImpl.current()),
      onAuthStateChange: vi.fn((cb: (event: string, session: unknown) => void) => {
        onAuthChangeRef.cb = cb;
        queueMicrotask(() => cb("INITIAL_SESSION", sessionRef.current));
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
      stopAutoRefresh: vi.fn(),
      startAutoRefresh: vi.fn()
    }
  });
  return { sessionRef, onAuthChangeRef, getSessionImpl, mockAuthClient };
});

vi.mock("../lib/supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: mockAuthClient(),
  getSupabase: () => mockAuthClient(),
  stopSupabaseAutoRefresh: vi.fn(),
  startSupabaseAutoRefresh: vi.fn()
}));

vi.mock("../api/profileFromSupabase", () => ({
  fetchProfileForUserId: vi.fn(async (userId: string) => ({
    id: userId,
    full_name: null,
    role: "USER",
    invoice_payment_details: null,
    ui_color_scheme: "dark",
    free_uses_remaining: 3
  }))
}));

function Probe() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="initialized">{String(auth.initialized)}</span>
      <span data-testid="auth-loading">{String(auth.authLoading)}</span>
      <span data-testid="authenticated">{String(auth.isAuthenticated)}</span>
      <span data-testid="has-user">{String(Boolean(auth.user?.id))}</span>
      <span data-testid="status">{auth.status}</span>
      <span data-testid="backend-available">{String(auth.backendAvailable)}</span>
    </div>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    resetAuthSessionReadCoalescingForTests();
    sessionRef.current = null;
    onAuthChangeRef.cb = null;
    getSessionImpl.current = () =>
      Promise.resolve({ data: { session: sessionRef.current }, error: null });
  });

  afterEach(() => {
    resetAuthSessionReadCoalescingForTests();
    vi.useRealTimers();
  });

  it("marks initialized and unauthenticated when no session", async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("initialized")).toHaveTextContent("true");
    });
    expect(screen.getByTestId("auth-loading")).toHaveTextContent("false");
    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    expect(screen.getByTestId("has-user")).toHaveTextContent("false");
    expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated");
    expect(screen.getByTestId("backend-available")).toHaveTextContent("true");
  });

  it("treats TOKEN_REFRESHED with session as authenticated", async () => {
    sessionRef.current = { access_token: "at", user: { id: "u1" } };

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("authenticated")).toHaveTextContent("true");
    });

    onAuthChangeRef.cb?.("TOKEN_REFRESHED", sessionRef.current);
    expect(screen.getByTestId("authenticated")).toHaveTextContent("true");
  });

  it("keeps session on TOKEN_REFRESHED with null payload", async () => {
    sessionRef.current = { access_token: "at", user: { id: "u1" } };

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("authenticated")).toHaveTextContent("true");
    });

    onAuthChangeRef.cb?.("TOKEN_REFRESHED", null);
    expect(screen.getByTestId("authenticated")).toHaveTextContent("true");
    expect(screen.getByTestId("has-user")).toHaveTextContent("true");
  });

  it("clears session on SIGNED_OUT after grace window", async () => {
    const nowSpy = vi.spyOn(Date, "now");
    sessionRef.current = { access_token: "at", user: { id: "u1" } };

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("authenticated")).toHaveTextContent("true");
    });

    nowSpy.mockReturnValue(Date.now() + 60_000);
    onAuthChangeRef.cb?.("SIGNED_OUT", null);

    await waitFor(() => {
      expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    });
    expect(screen.getByTestId("has-user")).toHaveTextContent("false");
    nowSpy.mockRestore();
  });

  it("resolves to backend-unavailable on Failed to fetch without hanging", async () => {
    getSessionImpl.current = () =>
      Promise.resolve({
        data: { session: null },
        error: { message: "Failed to fetch" }
      });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("backend-unavailable");
    });
    expect(screen.getByTestId("auth-loading")).toHaveTextContent("false");
    expect(screen.getByTestId("initialized")).toHaveTextContent("true");
    expect(screen.getByTestId("backend-available")).toHaveTextContent("false");
    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
  });

  it("resolves to backend-unavailable when getSession times out", async () => {
    vi.useFakeTimers();
    getSessionImpl.current = () =>
      new Promise(() => {
        /* never resolves */
      });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTH_BOOTSTRAP_TIMEOUT_MS + 50);
    });

    expect(screen.getByTestId("status")).toHaveTextContent("backend-unavailable");
    expect(screen.getByTestId("auth-loading")).toHaveTextContent("false");
    expect(screen.getByTestId("backend-available")).toHaveTextContent("false");
  });
});
