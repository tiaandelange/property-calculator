import React, { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "../components/nav/DashboardShell";
import { useAuth } from "../contexts/AuthContext";
import { SettingsUnsavedChangesProvider } from "../features/settings/settingsUnsavedChanges";
import { prefetchAuthWorkspace } from "../lib/routePrefetch";

export function AuthenticatedShell({
  children,
  userRole: _userRole
}: {
  children: React.ReactNode;
  userRole?: "USER" | "ADMIN" | null;
}) {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    const workspaceId = session?.user?.id;
    if (!workspaceId) return;
    prefetchAuthWorkspace(queryClient, workspaceId);
  }, [session?.user?.id, queryClient]);

  return (
    <SettingsUnsavedChangesProvider>
      <DashboardShell>{children}</DashboardShell>
    </SettingsUnsavedChangesProvider>
  );
}
