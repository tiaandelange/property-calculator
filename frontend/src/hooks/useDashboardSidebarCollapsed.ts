import { useCallback, useState } from "react";

const STORAGE_KEY = "pg-dashboard-sidebar-collapsed";

function readStoredCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function useDashboardSidebarCollapsed() {
  const [collapsed, setCollapsedState] = useState(readStoredCollapsed);

  const setCollapsed = useCallback((next: boolean) => {
    setCollapsedState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      /* ignore storage errors */
    }
  }, []);

  return [collapsed, setCollapsed] as const;
}
