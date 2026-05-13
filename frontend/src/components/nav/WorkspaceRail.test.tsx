import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { WorkspaceRail } from "./WorkspaceRail";
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

function renderRail(ui: React.ReactElement) {
  return render(<AuthProvider>{ui}</AuthProvider>);
}

describe("WorkspaceRail", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    );
    signOut.mockClear();
  });

  it("marks the home rail control active on portfolio dashboard route", () => {
    renderRail(
      <MemoryRouter initialEntries={["/owned-properties/dashboard"]}>
        <WorkspaceRail userRole="USER" />
      </MemoryRouter>
    );

    const home = screen.getByRole("button", { name: /home and portfolio/i });
    expect(home).toHaveClass("pg-rail-icon-btn-active");
  });

  it("opens the settings submenu from the keyboard (Enter)", () => {
    renderRail(
      <MemoryRouter initialEntries={["/account"]}>
        <WorkspaceRail userRole="USER" />
      </MemoryRouter>
    );

    const settings = screen.getByRole("button", { name: /settings and account/i });
    expect(settings).toHaveAttribute("aria-expanded", "false");

    fireEvent.keyDown(settings, { key: "Enter", code: "Enter" });

    expect(settings).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menu", { name: /settings/i })).toBeInTheDocument();
  });

  it("opens the settings submenu on click", () => {
    renderRail(
      <MemoryRouter initialEntries={["/account"]}>
        <WorkspaceRail userRole="USER" />
      </MemoryRouter>
    );

    const settings = screen.getByRole("button", { name: /settings and account/i });
    fireEvent.click(settings);

    expect(settings).toHaveAttribute("aria-expanded", "true");
  });

  it("closes the submenu on Escape", () => {
    renderRail(
      <MemoryRouter initialEntries={["/account"]}>
        <WorkspaceRail userRole="USER" />
      </MemoryRouter>
    );

    const settings = screen.getByRole("button", { name: /settings and account/i });
    fireEvent.click(settings);
    expect(settings).toHaveAttribute("aria-expanded", "true");

    fireEvent.keyDown(window, { key: "Escape" });

    expect(settings).toHaveAttribute("aria-expanded", "false");
  });
});
