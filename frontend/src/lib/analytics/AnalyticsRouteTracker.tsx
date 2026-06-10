import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { trackPageView } from "./analytics";

/**
 * Fires `proplytic_page_view` on client-side navigations only.
 * Skips the first render so GTM's initial page view is not duplicated.
 */
export function AnalyticsRouteTracker() {
  const location = useLocation();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    trackPageView(location.pathname + location.search);
  }, [location.pathname, location.search]);

  return null;
}
