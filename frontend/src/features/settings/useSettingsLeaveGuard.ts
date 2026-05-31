import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate, type Location } from "react-router-dom";

function locationKey(location: Location): string {
  return `${location.pathname}${location.search}${location.hash}`;
}

function isSettingsPath(pathname: string): boolean {
  return pathname.startsWith("/settings");
}

function isLeavingSettings(from: Location, to: Location): boolean {
  return isSettingsPath(from.pathname) && !isSettingsPath(to.pathname);
}

function resolveInternalPath(href: string): string | null {
  if (!href || href.startsWith("#") || /^https?:\/\//i.test(href) || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return null;
  }
  try {
    const url = new URL(href, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function useSettingsLeaveGuard(
  dirty: boolean,
  save: () => Promise<boolean>,
  discard: () => void
) {
  const location = useLocation();
  const navigate = useNavigate();
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const pendingTargetRef = useRef<string | null>(null);
  const skipGuardRef = useRef(false);
  const lastSettingsLocationRef = useRef(location);

  const openLeaveDialog = useCallback((targetPath: string) => {
    pendingTargetRef.current = targetPath;
    setLeaveDialogOpen(true);
  }, []);

  const cancelLeave = useCallback(() => {
    pendingTargetRef.current = null;
    setLeaveDialogOpen(false);
  }, []);

  const proceedNavigation = useCallback(() => {
    const target = pendingTargetRef.current;
    pendingTargetRef.current = null;
    setLeaveDialogOpen(false);
    if (!target) return;
    skipGuardRef.current = true;
    navigate(target);
  }, [navigate]);

  const confirmLeaveDiscard = useCallback(() => {
    discard();
    proceedNavigation();
  }, [discard, proceedNavigation]);

  const confirmLeaveSave = useCallback(async () => {
    const ok = await save();
    if (ok) {
      proceedNavigation();
    }
  }, [save, proceedNavigation]);

  useEffect(() => {
    if (dirty) {
      lastSettingsLocationRef.current = location;
    }
  }, [dirty, location]);

  useLayoutEffect(() => {
    if (skipGuardRef.current) {
      skipGuardRef.current = false;
      return;
    }

    if (!dirty) return;

    const previous = lastSettingsLocationRef.current;
    if (!isLeavingSettings(previous, location)) {
      if (isSettingsPath(location.pathname)) {
        lastSettingsLocationRef.current = location;
      }
      return;
    }

    openLeaveDialog(locationKey(location));
    skipGuardRef.current = true;
    navigate(locationKey(previous), { replace: true });
  }, [dirty, location, navigate, openLeaveDialog]);

  useEffect(() => {
    if (!dirty) return;

    const handleClick = (event: MouseEvent) => {
      if (skipGuardRef.current || leaveDialogOpen) return;
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      const path = href ? resolveInternalPath(href) : null;
      if (!path) return;

      const current = locationKey(location);
      if (path === current) return;

      try {
        const url = new URL(path, window.location.origin);
        if (!isLeavingSettings(location, { ...location, pathname: url.pathname })) return;
      } catch {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      openLeaveDialog(path);
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [dirty, leaveDialogOpen, location, openLeaveDialog]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  return {
    leaveDialogOpen,
    cancelLeave,
    confirmLeaveSave,
    confirmLeaveDiscard
  };
}
