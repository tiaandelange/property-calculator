import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { LoginPage } from "./LoginPage";
import { AuthProvider } from "../contexts/AuthContext";

const { signInWithPassword, signUp } = vi.hoisted(() => ({
  signInWithPassword: vi.fn(() => Promise.resolve({ data: { user: {}, session: {} }, error: null })),
  signUp: vi.fn(() => Promise.resolve({ data: { user: {}, session: null }, error: null }))
}));

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

vi.mock("../lib/supabaseClient", () => ({
  isSupabaseConfigured: true,
  getSupabase: () => ({
    auth: {
      signInWithPassword,
      signUp
    },
    from: vi.fn(() => profileChain)
  }),
  supabase: {
    auth: {
      signInWithPassword,
      signUp,
      getSession: vi.fn(() => Promise.resolve({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn()
    },
    from: vi.fn(() => profileChain)
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
    signInWithPassword.mockClear();
    signUp.mockClear();
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
});
