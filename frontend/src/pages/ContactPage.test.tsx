import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { ContactPage } from "./ContactPage";

const submitMock = vi.fn();

vi.mock("../services/contactFormApi", () => ({
  submitContactForm: (...args: unknown[]) => submitMock(...args)
}));

function renderContact() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <ContactPage />
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe("ContactPage", () => {
  beforeEach(() => {
    submitMock.mockReset();
  });

  it("renders public contact form without sign-in", () => {
    renderContact();
    expect(screen.getByRole("heading", { name: /contact proplytic/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send message/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument();
  });

  it("shows validation error for empty submit", async () => {
    renderContact();
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/name is required/i);
    expect(submitMock).not.toHaveBeenCalled();
  });

  it("shows validation error for invalid email", async () => {
    renderContact();
    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: "Jane" } });
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: "bad-email" } });
    fireEvent.change(screen.getByLabelText(/^subject$/i), { target: { value: "Hi" } });
    fireEvent.change(screen.getByLabelText(/^message$/i), { target: { value: "Hello there" } });
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/valid email/i);
    expect(submitMock).not.toHaveBeenCalled();
  });

  it("shows success and clears form after API success", async () => {
    submitMock.mockResolvedValue({ ok: true });
    renderContact();

    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: "Jane Doe" } });
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: "jane@example.com" } });
    fireEvent.change(screen.getByLabelText(/^subject$/i), { target: { value: "Pricing" } });
    fireEvent.change(screen.getByLabelText(/^message$/i), { target: { value: "Question about plans." } });

    fireEvent.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => {
      expect(screen.getByText(/message sent/i)).toBeInTheDocument();
    });
    expect(submitMock).toHaveBeenCalled();
  });
});
