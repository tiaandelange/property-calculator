import React, { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "../components/nav/DashboardShell";
import { useWorkspaceId } from "../features/queries/useWorkspaceId";
import { SettingsUnsavedChangesProvider } from "../features/settings/settingsUnsavedChanges";
import { prefetchAuthWorkspace } from "../lib/routePrefetch";

export function AuthenticatedShell({
  children,
  userRole: _userRole
}: {
  children: React.ReactNode;
  userRole?: "USER" | "ADMIN" | null;
}) {
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!workspaceId) return;
    prefetchAuthWorkspace(queryClient, workspaceId, true);
  }, [workspaceId, queryClient]);

  return (
    <SettingsUnsavedChangesProvider>
      <DashboardShell>{children}</DashboardShell>
    </SettingsUnsavedChangesProvider>
  );
}
