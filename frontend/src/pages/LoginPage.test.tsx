import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { LoginPage } from "./LoginPage";
import { AuthProvider } from "../contexts/AuthContext";

const { signInWithPassword, signUp, subscriptionInsert, activeSessionRef } = vi.hoisted(() => {
  const activeSessionRef: { current: { user: { id: string } } | null } = { current: null };
  return {
    activeSessionRef,
    signInWithPassword: vi.fn(() => {
      const session = { user: { id: "u1" } };
      activeSessionRef.current = session;
      return Promise.resolve({ data: { user: session.user, session }, error: null });
    }),
    signUp: vi.fn(() => {
      const session = { user: { id: "u1" } };
      activeSessionRef.current = session;
      return Promise.resolve({ data: { user: session.user, session }, error: null });
    }),
    subscriptionInsert: vi.fn(() => Promise.resolve({ error: null }))
  };
});

const profileChain = {
  select: vi.fn(() => ({
    eq: vi.fn(() => ({
      maybeSingle: vi.fn(() =>
        Promise.resolve({
          data: {
            full_name: null,
            role: "USER",
            invoice_payment_details: null,
            ui_color_scheme: "dark",
            free_uses_remaining: 3
          },
          error: null
        })
      )
    }))
  }))
};

const subscriptionPlansChain = {
  select: vi.fn(() => ({
    eq: vi.fn(() => ({
      order: vi.fn(() =>
        Promise.resolve({
          data: [
            {
              id: "1",
              code: "investor",
              name: "Investor",
              description: null,
              monthly_price: 299,
              currency: "ZAR",
              trial_days: 0,
              property_limit: 10,
              report_limit: 10,
              includes_calculators: true,
              includes_management: true,
              includes_unlimited_reports: false,
              sort_order: 20
            }
          ],
          error: null
        })
      )
    }))
  }))
};

const userSubscriptionsChain = {
  select: vi.fn(() => ({
    eq: vi.fn(() => ({
      maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null }))
    }))
  })),
  insert: subscriptionInsert
};

function fromMock(table: string) {
  if (table === "user_subscriptions") return userSubscriptionsChain;
  if (table === "subscription_plans") return subscriptionPlansChain;
  return profileChain;
}

vi.mock("../lib/supabaseClient", () => ({
  isSupabaseConfigured: true,
  stopSupabaseAutoRefresh: vi.fn(),
  startSupabaseAutoRefresh: vi.fn(),
  getSupabase: () => ({
    auth: {
      signInWithPassword,
      signUp,
      getSession: vi.fn(() => Promise.resolve({ data: { session: activeSessionRef.current }, error: null })),
      getUser: vi.fn(() =>
        Promise.resolve({ data: { user: activeSessionRef.current?.user ?? null }, error: null })
      ),
      stopAutoRefresh: vi.fn(),
      startAutoRefresh: vi.fn()
    },
    from: vi.fn(fromMock)
  }),
  supabase: {
    auth: {
      signInWithPassword,
      signUp,
      getSession: vi.fn(() => Promise.resolve({ data: { session: activeSessionRef.current }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn(),
      getUser: vi.fn(() =>
        Promise.resolve({ data: { user: activeSessionRef.current?.user ?? null }, error: null })
      ),
      stopAutoRefresh: vi.fn(),
      startAutoRefresh: vi.fn()
    },
    from: vi.fn(fromMock)
  }
}));

function renderLogin() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    activeSessionRef.current = null;
    signInWithPassword.mockClear();
    signUp.mockClear();
    subscriptionInsert.mockClear();
    sessionStorage.clear();
  });

  it("calls Supabase signInWithPassword on sign in", async () => {
    renderLogin();

    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "a@test.example" }
    });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), {
      target: { value: "password123" }
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(signInWithPassword).toHaveBeenCalledWith({
        email: "a@test.example",
        password: "password123"
      });
    });
  });

  it("shows plan summary and creates subscription on signup with plan param", async () => {
    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={["/signup?plan=investor"]}>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </MemoryRouter>
      </HelmetProvider>
    );

    expect(await screen.findByRole("heading", { name: /investor/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /change plan/i })).toHaveAttribute("href", "/pricing");

    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "new@test.example" }
    });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), {
      target: { value: "password123" }
    });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(signUp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "new@test.example",
          password: "password123",
          options: expect.objectContaining({
            data: { plan_code: "investor" }
          })
        })
      );
    });

    await waitFor(() => {
      expect(subscriptionInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: "u1",
          plan_code: "investor",
          status: "pending_payment",
          payment_provider: null,
          payment_subscription_id: null
        })
      );
    });
  });
});
