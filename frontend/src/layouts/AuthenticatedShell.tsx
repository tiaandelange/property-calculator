import React from "react";
import { WorkspaceRail } from "../components/nav/WorkspaceRail";

export function AuthenticatedShell({
  children,
  userRole
}: {
  children: React.ReactNode;
  userRole?: "USER" | "ADMIN" | null;
}) {
  return (
    <div className="pg-workspace-root">
      <WorkspaceRail userRole={userRole ?? null} />
      <div className="pg-workspace-main-col">
        <main className="pg-main pg-main-workspace">{children}</main>
      </div>
    </div>
  );
}
