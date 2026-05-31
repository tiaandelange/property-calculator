import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, Link, useNavigate } from "react-router-dom";
import { SettingsUnsavedChangesProvider, useRegisterSettingsUnsavedChanges } from "./settingsUnsavedChanges";

function SettingsTestPage({
  dirty,
  saveResult = true
}: {
  dirty: boolean;
  saveResult?: boolean;
}) {
  const save = vi.fn(async () => saveResult);
  const discard = vi.fn();
  useRegisterSettingsUnsavedChanges(dirty, save, discard);

  return (
    <div>
      <h1>Settings</h1>
      <Link to="/dashboard">Dashboard</Link>
    </div>
  );
}

function DashboardPage() {
  return <h1>Dashboard</h1>;
}

function NavigateAwayButton() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate("/dashboard")}>
      Go to dashboard
    </button>
  );
}

function SettingsWithNavigate({ dirty }: { dirty: boolean }) {
  const save = vi.fn(async () => true);
  const discard = vi.fn();
  useRegisterSettingsUnsavedChanges(dirty, save, discard);

  return (
    <div>
      <h1>Settings</h1>
      <NavigateAwayButton />
    </div>
  );
}

function renderApp(initialPath = "/settings", settingsProps: { dirty: boolean; saveResult?: boolean } = { dirty: true }) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <SettingsUnsavedChangesProvider>
        <Routes>
          <Route path="/settings" element={<SettingsTestPage {...settingsProps} />} />
          <Route path="/dashboard" element={<DashboardPage />} />
        </Routes>
      </SettingsUnsavedChangesProvider>
    </MemoryRouter>
  );
}

describe("useSettingsLeaveGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the leave dialog when navigating away with unsaved changes", async () => {
    renderApp();

    fireEvent.click(screen.getByRole("link", { name: "Dashboard" }));

    expect(await screen.findByRole("dialog", { name: "Save before leaving" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
  });

  it("does not show the dialog when settings are clean", async () => {
    renderApp("/settings", { dirty: false });

    fireEvent.click(screen.getByRole("link", { name: "Dashboard" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("dialog", { name: "Save before leaving" })).not.toBeInTheDocument();
  });

  it("discards changes and navigates away", async () => {
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <SettingsUnsavedChangesProvider>
          <Routes>
            <Route path="/settings" element={<SettingsWithNavigate dirty />} />
            <Route path="/dashboard" element={<DashboardPage />} />
          </Routes>
        </SettingsUnsavedChangesProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Go to dashboard" }));
    fireEvent.click(await screen.findByRole("button", { name: "Discard" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    });
  });

  it("stays on settings when escape closes the dialog", async () => {
    renderApp();

    fireEvent.click(screen.getByRole("link", { name: "Dashboard" }));
    const dialog = await screen.findByRole("dialog", { name: "Save before leaving" });
    fireEvent.keyDown(dialog, { key: "Escape", code: "Escape" });

    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Save before leaving" })).not.toBeInTheDocument();
  });

  it("keeps the dialog open after a blocked navigation attempt", async () => {
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <SettingsUnsavedChangesProvider>
          <Routes>
            <Route path="/settings" element={<SettingsWithNavigate dirty />} />
            <Route path="/dashboard" element={<DashboardPage />} />
          </Routes>
        </SettingsUnsavedChangesProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Go to dashboard" }));

    const dialog = await screen.findByRole("dialog", { name: "Save before leaving" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
  });
});
