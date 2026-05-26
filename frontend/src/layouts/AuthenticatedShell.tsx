import React from "react";
import { DashboardShell } from "../components/nav/DashboardShell";

export function AuthenticatedShell({
  children,
  userRole: _userRole
}: {
  children: React.ReactNode;
  userRole?: "USER" | "ADMIN" | null;
}) {
  return <DashboardShell>{children}</DashboardShell>;
}
