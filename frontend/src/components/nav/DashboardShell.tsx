import { Menu } from "lucide-react";
import { useState } from "react";
import { DashboardSidebar } from "./DashboardSidebar";
import { MobileBottomNav } from "./MobileBottomNav";
import { MobileWorkspaceMenu } from "./MobileWorkspaceMenu";
import { WorkspaceShellHeader } from "./WorkspaceShellHeader";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="pg-dashboard-shell">
      <DashboardSidebar />
      <div className="pg-dashboard-shell-main">
        <div className="pg-dashboard-shell-mobile-bar">
          <button
            type="button"
            className="pg-dashboard-shell-icon-btn"
            aria-label="Open menu"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu size={22} aria-hidden />
          </button>
          <WorkspaceShellHeader mobile />
        </div>
        <div className="pg-dashboard-shell-desktop-header">
          <WorkspaceShellHeader />
        </div>
        <div className="pg-dashboard-shell-content">
          <main className="pg-main pg-main-workspace">{children}</main>
        </div>
      </div>
      <MobileBottomNav />
      <MobileWorkspaceMenu open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
    </div>
  );
}
