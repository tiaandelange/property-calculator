import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AppChrome } from "./AppChrome";
import { AuthProvider } from "../contexts/AuthContext";

const { sessionRef, mockSupabaseClient } = vi.hoisted(() => {
  const profileRow = {
    full_name: null as string | null,
    role: "USER",
    invoice_payment_details: null,
    ui_color_scheme: "dark",
    free_uses_remaining: 3
  };
  const sessionRef: {
    current: { access_token: string; user: { id: string; email: string } } | null;
  } = {
    current: null
  };
  const mockSupabaseClient = {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: sessionRef.current } })),
      onAuthStateChange: vi.fn((callback: (event: string, session: unknown) => void) => {
        Promise.resolve().then(() => callback("INITIAL_SESSION", sessionRef.current));
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      })
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() => Promise.resolve({ data: profileRow, error: null }))
        }))
      }))
    }))
  };
  return { sessionRef, mockSupabaseClient };
});

vi.mock("../lib/supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: mockSupabaseClient,
  getSupabase: () => mockSupabaseClient
}));

function renderWithAuth(ui: React.ReactElement) {
  return render(<AuthProvider>{ui}</AuthProvider>);
}

describe("AppChrome", () => {
  beforeEach(() => {
    sessionRef.current = null;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows workspace navigation when signed in on a workspace route", async () => {
    sessionRef.current = { access_token: "test-at", user: { id: "u1", email: "user@test.example" } };

    renderWithAuth(
      <MemoryRouter initialEntries={["/owned-properties/dashboard"]}>
        <Routes>
          <Route element={<AppChrome />}>
            <Route path="/owned-properties/dashboard" element={<div>Portfolio</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole("complementary", { name: /dashboard sidebar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open menu/i })).toBeInTheDocument();
  });

  it("renders marketing site header on home (no legacy TopNav)", async () => {
    sessionRef.current = null;

    renderWithAuth(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<AppChrome />}>
            <Route path="/" element={<div>Home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /The Property Guy — Home/i })).toBeInTheDocument();
    });
    expect(screen.queryByRole("navigation", { name: /primary workspace/i })).not.toBeInTheDocument();
  });

  it("renders marketing site header on calculators hub (same shell as homepage)", async () => {
    sessionRef.current = null;

    renderWithAuth(
      <MemoryRouter initialEntries={["/calculators"]}>
        <Routes>
          <Route element={<AppChrome />}>
            <Route path="/calculators" element={<div>Hub</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /The Property Guy — Home/i })).toBeInTheDocument();
    });
    expect(screen.getByRole("navigation", { name: /^Primary$/i })).toBeInTheDocument();
  });
});
