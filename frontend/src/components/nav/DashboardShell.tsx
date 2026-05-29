import { useState } from "react";
import { IconButton } from "../../components/icons";
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
          <IconButton
            icon="menu"
            aria-label="Open menu"
            variant="ghost"
            size="lg"
            tooltip={false}
            className="pg-dashboard-shell-icon-btn"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen(true)}
          />
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
