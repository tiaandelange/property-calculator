import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "../../contexts/AuthContext";
import { RequireAuth } from "./RequireAuth";

const { sessionRef, mockAuthClient } = vi.hoisted(() => {
  const sessionRef: { current: { access_token: string; user: { id: string } } | null } = {
    current: null
  };
  const mockAuthClient = () => ({
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: sessionRef.current }, error: null })),
      onAuthStateChange: vi.fn((cb: (event: string, session: unknown) => void) => {
        queueMicrotask(() => cb("INITIAL_SESSION", sessionRef.current));
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      signOut: vi.fn(() => Promise.resolve({ error: null }))
    }
  });
  return { sessionRef, mockAuthClient };
});

vi.mock("../../lib/supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: mockAuthClient(),
  getSupabase: () => mockAuthClient()
}));

vi.mock("../../api/profileFromSupabase", () => ({
  fetchProfileForUserId: vi.fn(() => Promise.resolve(null))
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
    sessionRef.current = null;
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
});
