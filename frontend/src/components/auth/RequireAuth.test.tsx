import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "../../contexts/AuthContext";
import { RequireAuth } from "./RequireAuth";
import { resetAuthSessionReadCoalescingForTests } from "../../lib/authSession";

const { sessionRef, getSessionImpl, mockAuthClient } = vi.hoisted(() => {
  const sessionRef: { current: { access_token: string; user: { id: string } } | null } = {
    current: null
  };
  const getSessionImpl: {
    current: () => Promise<{ data: { session: unknown }; error: { message: string } | null }>;
  } = {
    current: () => Promise.resolve({ data: { session: sessionRef.current }, error: null })
  };
  const mockAuthClient = () => ({
    auth: {
      getSession: vi.fn(() => getSessionImpl.current()),
      onAuthStateChange: vi.fn((cb: (event: string, session: unknown) => void) => {
        queueMicrotask(() => cb("INITIAL_SESSION", sessionRef.current));
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
      stopAutoRefresh: vi.fn(),
      startAutoRefresh: vi.fn()
    }
  });
  return { sessionRef, getSessionImpl, mockAuthClient };
});

vi.mock("../../lib/supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: mockAuthClient(),
  getSupabase: () => mockAuthClient(),
  stopSupabaseAutoRefresh: vi.fn(),
  startSupabaseAutoRefresh: vi.fn()
}));

vi.mock("../../api/profileFromSupabase", () => ({
  fetchProfileForUserId: vi.fn(() => Promise.resolve({ id: "u1", role: "USER" }))
}));

vi.mock("../../services/settingsSupabase", () => ({
  getOrCreateUserSettings: vi.fn(() =>
    Promise.resolve({
      themePreference: "dark",
      accentColor: "blue",
      density: "comfortable"
    })
  )
}));

vi.mock("../../lib/subscription/useSubscriptionQuery", () => ({
  useSubscriptionQuery: () => ({
    isLoading: false,
    isError: false,
    data: undefined
  })
}));

function renderGuard(initialPath: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>
            <Route path="/login" element={<div>Login page</div>} />
            <Route
              path="/tenants"
              element={
                <RequireAuth>
                  <div>Protected tenants</div>
                </RequireAuth>
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe("RequireAuth", () => {
  beforeEach(() => {
    resetAuthSessionReadCoalescingForTests();
    sessionRef.current = null;
    getSessionImpl.current = () =>
      Promise.resolve({ data: { session: sessionRef.current }, error: null });
  });

  it("shows loading while auth bootstrap is in progress", () => {
    sessionRef.current = { access_token: "at", user: { id: "u1" } };
    renderGuard("/tenants");
    expect(screen.queryByText("Login page")).not.toBeInTheDocument();
    expect(screen.queryByText("Protected tenants")).not.toBeInTheDocument();
  });

  it("renders children when authenticated after bootstrap", async () => {
    sessionRef.current = { access_token: "at", user: { id: "u1" } };
    renderGuard("/tenants");

    await waitFor(() => {
      expect(screen.getByText("Protected tenants")).toBeInTheDocument();
    });
  });

  it("redirects to login once when unauthenticated after bootstrap", async () => {
    sessionRef.current = null;
    renderGuard("/tenants");

    await waitFor(() => {
      expect(screen.getByText("Login page")).toBeInTheDocument();
    });
    expect(screen.queryByText("Protected tenants")).not.toBeInTheDocument();
  });

  it("shows BackendUnavailable when getSession fails with a network error", async () => {
    getSessionImpl.current = () =>
      Promise.resolve({
        data: { session: null },
        error: { message: "Failed to fetch" }
      });

    renderGuard("/tenants");

    expect(await screen.findByTestId("backend-unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Login page")).not.toBeInTheDocument();
    expect(screen.queryByText("Protected tenants")).not.toBeInTheDocument();
  });
});
