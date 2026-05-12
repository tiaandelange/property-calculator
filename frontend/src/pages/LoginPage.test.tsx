import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { LoginPage } from "./LoginPage";

vi.mock("../api/client", () => ({
  api: {
    post: vi.fn((): Promise<{ data: { token: string } }> =>
      Promise.resolve({ data: { token: "new-token" } }))
  }
}));

describe("LoginPage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("stores token after successful sign-in", async () => {
    render(
      <HelmetProvider>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </HelmetProvider>
    );

    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "a@test.example" }
    });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), {
      target: { value: "password123" }
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(localStorage.getItem("token")).toBe("new-token");
    });
  });
});
