import { Suspense, useEffect, type ReactNode } from "react";
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { logRouteNavigation } from "../../lib/routeLoadLog";
import { RouteErrorBoundary } from "./RouteErrorBoundary";
import { RouteFallback } from "./RouteFallback";

/** Per-route Suspense + error boundary + query error reset — app shell stays visible. */
export function RouteBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();

  useEffect(() => {
    logRouteNavigation(location.pathname);
  }, [location.pathname]);

  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <RouteErrorBoundary resetKey={location.pathname} onReset={reset}>
          <Suspense fallback={<RouteFallback />}>{children}</Suspense>
        </RouteErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
