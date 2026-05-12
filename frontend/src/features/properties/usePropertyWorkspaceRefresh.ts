import { useEffect, useRef } from "react";
import { PROPERTY_DATA_INVALIDATION } from "./invalidate";

/** Refetch when another screen invalidates portfolio/property data (no React Query). */
export function usePropertyWorkspaceRefresh(opts: {
  /** Current route property id; omit for global listeners (lists, portfolio). */
  propertyId?: string | number | null;
  onRefresh: () => void;
}) {
  const { propertyId, onRefresh } = opts;
  const cbRef = useRef(onRefresh);
  cbRef.current = onRefresh;

  useEffect(() => {
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<{ propertyId?: string | number | null }>).detail;
      const pid = detail?.propertyId;
      if (propertyId != null && pid != null && String(pid) !== String(propertyId)) return;
      cbRef.current();
    };
    window.addEventListener(PROPERTY_DATA_INVALIDATION, handler);
    return () => window.removeEventListener(PROPERTY_DATA_INVALIDATION, handler);
  }, [propertyId]);
}
