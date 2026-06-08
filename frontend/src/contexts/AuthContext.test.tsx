import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "./AuthContext";

const { sessionRef, onAuthChangeRef, mockAuthClient } = vi.hoisted(() => {
  const sessionRef: { current: { access_token: string; user: { id: string } } | null } = {
    current: null
  };
  const onAuthChangeRef: { cb: ((event: string, session: unknown) => void) | null } = { cb: null };
  const mockAuthClient = () => ({
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: sessionRef.current }, error: null })),
      onAuthStateChange: vi.fn((cb: (event: string, session: unknown) => void) => {
        onAuthChangeRef.cb = cb;
        queueMicrotask(() => cb("INITIAL_SESSION", sessionRef.current));
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      signOut: vi.fn(() => Promise.resolve({ error: null }))
    }
  });
  return { sessionRef, onAuthChangeRef, mockAuthClient };
});

vi.mock("../lib/supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: mockAuthClient(),
  getSupabase: () => mockAuthClient()
}));

vi.mock("../api/profileFromSupabase", () => ({
  fetchProfileForUserId: vi.fn(() => Promise.resolve(null))
}));

function Probe() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="initialized">{String(auth.initialized)}</span>
      <span data-testid="auth-loading">{String(auth.authLoading)}</span>
      <span data-testid="authenticated">{String(auth.isAuthenticated)}</span>
      <span data-testid="has-user">{String(Boolean(auth.user?.id))}</span>
    </div>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    sessionRef.current = null;
    onAuthChangeRef.cb = null;
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
});
