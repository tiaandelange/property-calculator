import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AppChrome } from "./AppChrome";

vi.mock("../api/client", () => ({
  api: {
    get: vi.fn(() => Promise.resolve({ data: { email: "user@test.example", role: "USER" } }))
  },
  authHeader: () => ({ Authorization: "Bearer test-token" })
}));

describe("AppChrome", () => {
  beforeEach(() => {
    localStorage.setItem("token", "test-token");
  });

  afterEach(() => {
    localStorage.removeItem("token");
    vi.clearAllMocks();
  });

  it("shows workspace navigation when signed in on a workspace route", async () => {
    render(
      <MemoryRouter initialEntries={["/owned-properties/dashboard"]}>
        <Routes>
          <Route element={<AppChrome />}>
            <Route path="/owned-properties/dashboard" element={<div>Portfolio</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole("navigation", { name: /workspace/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/open menu/i)).not.toBeInTheDocument();
  });

  it("renders marketing site header on home (no legacy TopNav)", () => {
    localStorage.removeItem("token");

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<AppChrome />}>
            <Route path="/" element={<div>Home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: /The Property Guy — Home/i })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: /primary workspace/i })).not.toBeInTheDocument();
  });

  it("renders marketing site header on calculators hub (same shell as homepage)", () => {
    localStorage.removeItem("token");

    render(
      <MemoryRouter initialEntries={["/calculators"]}>
        <Routes>
          <Route element={<AppChrome />}>
            <Route path="/calculators" element={<div>Hub</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: /The Property Guy — Home/i })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: /^Primary$/i })).toBeInTheDocument();
  });
});
