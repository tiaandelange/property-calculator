import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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

    expect(await screen.findByRole("heading", { name: /choose the plan that fits/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Most Popular/i).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("heading", { name: /starter/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("heading", { name: /investor/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("heading", { name: /^portfolio$/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("heading", { name: /portfolio pro/i }).length).toBeGreaterThan(0);
    expect(FALLBACK_SUBSCRIPTION_PLANS).toHaveLength(4);
  });

  it("links sign in without auth wrapper", async () => {
    render(
      <HelmetProvider>
        <MemoryRouter>
          <PricingPage />
        </MemoryRouter>
      </HelmetProvider>
    );

    expect(await screen.findByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login");
  });

  it("shows annual totals and save badges when annual billing is selected", async () => {
    render(
      <HelmetProvider>
        <MemoryRouter>
          <PricingPage />
        </MemoryRouter>
      </HelmetProvider>
    );

    await screen.findByRole("heading", { name: /choose the plan that fits/i });
    fireEvent.click(screen.getByRole("button", { name: /^annual$/i }));

    expect(screen.getAllByText(/save 17%/i).length).toBe(3);
    expect(screen.getAllByText(/R2,990\/year/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/R5,990\/year/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/R9,990\/year/).length).toBeGreaterThan(0);
  });

  it("includes FAQ and final CTA with signup links", async () => {
    render(
      <HelmetProvider>
        <MemoryRouter>
          <PricingPage />
        </MemoryRouter>
      </HelmetProvider>
    );

    expect(await screen.findByRole("heading", { name: /frequently asked questions/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /join free/i })).toHaveAttribute("href", "/signup?plan=starter");
    expect(screen.getByRole("heading", { name: /which plan should i choose/i })).toBeInTheDocument();
  });
});
