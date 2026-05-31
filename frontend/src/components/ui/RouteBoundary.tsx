import { Suspense, useEffect, useMemo, type ReactNode } from "react";
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { logRouteNavigation } from "../../lib/routeLoadLog";
import { RouteErrorBoundary } from "./RouteErrorBoundary";
import { RouteFallback } from "./RouteFallback";

type RouteBoundaryProps = {
  children: ReactNode;
  /** Human-readable route name for error diagnostics (e.g. "Properties"). */
  label?: string;
};

/** Per-route Suspense + error boundary + query error reset — app shell stays visible. */
export function RouteBoundary({ children, label }: RouteBoundaryProps) {
  const location = useLocation();
  const resetKey = useMemo(
    () => `${location.pathname}${location.search}:${location.key}`,
    [location.pathname, location.search, location.key]
  );

  useEffect(() => {
    logRouteNavigation(location.pathname);
  }, [location.pathname]);

  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <RouteErrorBoundary
          key={resetKey}
          resetKey={resetKey}
          routeLabel={label}
          path={`${location.pathname}${location.search}`}
          locationKey={location.key}
          onReset={reset}
        >
          <Suspense fallback={<RouteFallback />}>{children}</Suspense>
        </RouteErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
