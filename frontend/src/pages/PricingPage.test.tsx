import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { FALLBACK_SUBSCRIPTION_PLANS } from "../services/subscriptionPlansSupabase";
import { PricingPage } from "./PricingPage";

vi.mock("../services/subscriptionPlansSupabase", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/subscriptionPlansSupabase")>();
  return {
    ...actual,
    listActiveSubscriptionPlans: vi.fn(() => Promise.resolve([]))
  };
});

describe("PricingPage QA", () => {
  it("renders four public tiers from fallback plans", async () => {
    render(
      <HelmetProvider>
        <MemoryRouter>
          <PricingPage />
        </MemoryRouter>
      </HelmetProvider>
    );

    expect(await screen.findByRole("heading", { name: /choose the plan/i })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: /starter/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("heading", { name: /investor/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("heading", { name: /^portfolio$/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("heading", { name: /portfolio pro/i }).length).toBeGreaterThan(0);
    expect(FALLBACK_SUBSCRIPTION_PLANS).toHaveLength(4);
  });

  it("links sign in without auth wrapper", () => {
    render(
      <HelmetProvider>
        <MemoryRouter>
          <PricingPage />
        </MemoryRouter>
      </HelmetProvider>
    );

    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login");
  });
});
