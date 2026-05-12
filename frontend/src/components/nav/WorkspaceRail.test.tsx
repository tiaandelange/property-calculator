import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { WorkspaceRail } from "./WorkspaceRail";

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
  });

  it("marks the home rail control active on portfolio dashboard route", () => {
    render(
      <MemoryRouter initialEntries={["/owned-properties/dashboard"]}>
        <WorkspaceRail userRole="USER" />
      </MemoryRouter>
    );

    const home = screen.getByRole("button", { name: /home and portfolio/i });
    expect(home).toHaveClass("pg-rail-icon-btn-active");
  });

  it("opens the settings submenu from the keyboard (Enter)", () => {
    render(
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
    render(
      <MemoryRouter initialEntries={["/account"]}>
        <WorkspaceRail userRole="USER" />
      </MemoryRouter>
    );

    const settings = screen.getByRole("button", { name: /settings and account/i });
    fireEvent.click(settings);

    expect(settings).toHaveAttribute("aria-expanded", "true");
  });

  it("closes the submenu on Escape", () => {
    render(
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
