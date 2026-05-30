import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DashboardShell } from "./DashboardShell";
import { AuthProvider } from "../../contexts/AuthContext";

const { signOut } = vi.hoisted(() => ({
  signOut: vi.fn(() => Promise.resolve({ error: null }))
}));

vi.mock("../../lib/supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut
    }
  },
  getSupabase: () => ({
    auth: {
      signOut,
      getSession: vi.fn(() => Promise.resolve({ data: { session: null } }))
    }
  })
}));

function renderShell(path = "/owned-properties/dashboard") {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <DashboardShell>
          <div>Page content</div>
        </DashboardShell>
      </MemoryRouter>
    </AuthProvider>
  );
}

describe("DashboardShell", () => {
  beforeEach(() => {
    signOut.mockClear();
  });

  it("renders sidebar navigation with Dashboard link", () => {
    renderShell();
    expect(screen.getByRole("complementary", { name: /dashboard sidebar/i })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /^Dashboard$/i })[0]).toHaveAttribute("href", "/owned-properties/dashboard");
  });

  it("opens mobile menu from burger and closes on Escape", () => {
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: /open menu/i }));
    expect(screen.getByRole("dialog", { name: /navigation menu/i })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: /navigation menu/i })).not.toBeInTheDocument();
  });

  it("collapses and expands the desktop sidebar", () => {
    renderShell();
    const collapse = screen.getByRole("button", { name: /collapse sidebar/i });
    fireEvent.click(collapse);
    expect(screen.getByRole("button", { name: /expand sidebar/i })).toBeInTheDocument();
    expect(document.querySelector(".pg-dashboard-shell--sidebar-collapsed")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /expand sidebar/i }));
    expect(screen.getByRole("button", { name: /collapse sidebar/i })).toBeInTheDocument();
  });
});
